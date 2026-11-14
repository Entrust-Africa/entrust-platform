import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { enqueue, JOB_NAMES } from "@entrust/jobs";
import { organizationKind, requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { checkSmeDuplicates, legalNameIndex, normalizeLegalName, type LegalNameMatch } from "./sme-registry";
import { enrolSme } from "./trade-cohorts";

// Most people who fill in the public onboarding diagnostic never make a business on TRADE: the form needs no account, and
// of those who made one, most never added their business. Staff enrol them straight from the submitted form: this makes
// the business from what the form says, enrols it in the cohort, and gives the enrolment the avenue the form assigned.

/** An invitation to own a business made by staff stays open this long: long enough for a busy owner to get to it. */
const INVITATION_DAYS = 30;

/** A submitted diagnostic from someone who has no business on Entrust yet, so it can't be enrolled any other way. */
export interface WaitingDiagnostic {
  /** The person's latest submitted form. */
  publicDiagnosticId: string;
  businessName: string | null;
  email: string;
  phone: string | null;
  submittedAt: string;
  pathway: string | null;
  /** They opened the link in their email, so the address is theirs and their account owns the business straight away. */
  emailVerified: boolean;
  /** A business already on the SME registry with a similar name: staff confirm it's a different one before enrolling. */
  similarSme: { smeId: string; legalName: string } | null;
}

/** The emails that already belong to someone in a business (not Entrust, not a sponsor), lower-cased. */
async function emailsWithABusiness(db: Executor, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const rows = await db
    .select({ email: sql<string>`lower(${schema.user.email})`, metadata: schema.organization.metadata })
    .from(schema.user)
    .innerJoin(schema.member, eq(schema.member.userId, schema.user.id))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(inArray(sql`lower(${schema.user.email})`, emails));
  return new Set(rows.filter((r) => (organizationKind(r.metadata) ?? "sme") === "sme").map((r) => r.email));
}

/**
 * The people with a submitted diagnostic and no business: one row each, their latest submitted form, newest first. A
 * person drops off once any of their forms is linked to an enrolment, or once their email belongs to a business (that
 * business is then on the waiting list, or enrolled, and the form is linked to it from the diagnostic's page).
 */
export async function listWaitingDiagnostics(ctx: Ctx, limit = 200): Promise<WaitingDiagnostic[]> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "see the businesses waiting to be enrolled");
  // One row per person, their latest submitted form, done in the database: only people none of whose forms is linked yet.
  const emailKey = sql<string>`lower(${schema.publicDiagnostic.email})`;
  const rows = await ctx.db
    .selectDistinctOn([emailKey], {
      id: schema.publicDiagnostic.id,
      email: schema.publicDiagnostic.email,
      businessName: schema.publicDiagnostic.businessName,
      phone: schema.publicDiagnostic.phone,
      submittedAt: schema.publicDiagnostic.submittedAt,
      pathway: schema.publicDiagnostic.pathway,
      emailVerifiedAt: schema.publicDiagnostic.emailVerifiedAt,
    })
    .from(schema.publicDiagnostic)
    .where(
      and(
        eq(schema.publicDiagnostic.status, "submitted"),
        isNotNull(schema.publicDiagnostic.submittedAt),
        sql`not exists (select 1 from ${schema.publicDiagnostic} as linked
          where lower(linked.email) = lower(${schema.publicDiagnostic.email}) and linked.linked_enrollment_id is not null)`,
      ),
    )
    .orderBy(emailKey, desc(schema.publicDiagnostic.submittedAt));

  const latest = new Map(rows.map((row) => [row.email.toLowerCase(), row]));
  const owners = await emailsWithABusiness(ctx.db, [...latest.keys()]);
  const people = [...latest.entries()]
    .filter(([email]) => !owners.has(email))
    .sort(([, a], [, b]) => b.submittedAt!.getTime() - a.submittedAt!.getTime())
    .slice(0, limit);

  // The registry is read once for every name, not once per name: per name it ran past the API's CPU limit.
  const registered = people.some(([, row]) => row.businessName) ? await legalNameIndex(ctx.db, "ET") : new Map<string, LegalNameMatch>();
  return people.map(([, row]) => {
    const similar = row.businessName ? registered.get(normalizeLegalName(row.businessName)) : undefined;
    return {
      publicDiagnosticId: row.id,
      businessName: row.businessName,
      email: row.email,
      phone: row.phone,
      submittedAt: row.submittedAt!.toISOString(),
      pathway: row.pathway,
      emailVerified: Boolean(row.emailVerifiedAt),
      similarSme: similar ? { smeId: similar.smeId, legalName: similar.legalName } : null,
    };
  });
}

export interface EnrolFromDiagnosticInput {
  cohortId: string;
  publicDiagnosticId: string;
  /** Staff saw the similar business the list named and say this one is different. */
  confirmDuplicateName?: boolean;
}

export interface EnrolFromDiagnosticResult {
  enrollmentId: string;
  organizationId: string;
  smeId: string;
  /** "owner": their account owns the business now. "invited": an invitation to own it went to the form's email. */
  owner: "owner" | "invited";
}

const slugOf = (name: string): string =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "business"}-${randomUUID().slice(0, 6)}`;

const tradeAppUrl = (): string => (process.env.TRADE_APP_URL ?? "http://localhost:3001").trim().replace(/\/+$/, "");

/**
 * Makes the business a submitted diagnostic describes and enrols it in a cohort, in one go:
 *
 * - the business (an SME with a new SME ID, in Ethiopia, the country the form asks about) under the form's business name;
 * - its owner: the person's account when they proved their email by opening the link we sent, otherwise an invitation to
 *   that email, which they accept by signing in with it (the enrolment stays "invited" until then);
 * - the enrolment, through the same rules as any other;
 * - the avenue the form assigned. A form whose email was never proven only gives a provisional avenue, which staff confirm
 *   on the cohort page, because nothing yet shows the business itself filled it in.
 */
export async function enrolFromPublicDiagnostic(ctx: Ctx, input: EnrolFromDiagnosticInput): Promise<EnrolFromDiagnosticResult> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "enrol businesses");
  if (!/^[0-9a-f-]{36}$/.test(input.publicDiagnosticId)) throw new ServiceError("not_found", "Diagnostic not found.");

  const done = await ctx.db.transaction(async (tx) => {
    const [row] = await tx.select().from(schema.publicDiagnostic).where(eq(schema.publicDiagnostic.id, input.publicDiagnosticId)).for("update");
    if (!row) throw new ServiceError("not_found", "Diagnostic not found.");
    if (row.status !== "submitted" || !row.pathway || !row.rulesVersion) {
      throw new ServiceError("precondition_failed", "Only a submitted diagnostic can be used to enrol a business.");
    }
    if (row.linkedEnrollmentId) throw new ServiceError("conflict", "This diagnostic already belongs to an enrolment.");
    const email = row.email.trim().toLowerCase();
    const [otherLinked] = await tx
      .select({ id: schema.publicDiagnostic.id })
      .from(schema.publicDiagnostic)
      .where(and(eq(sql`lower(${schema.publicDiagnostic.email})`, email), isNotNull(schema.publicDiagnostic.linkedEnrollmentId)))
      .limit(1);
    if (otherLinked) throw new ServiceError("conflict", `Another diagnostic from ${row.email} already belongs to an enrolment.`);
    if ((await emailsWithABusiness(tx, [email])).has(email)) {
      throw new ServiceError(
        "conflict",
        `${row.email} already belongs to a business on Entrust. Enrol that business instead, then link this form to it from the diagnostic's page.`,
      );
    }
    const name = row.businessName?.trim();
    if (!name) throw new ServiceError("precondition_failed", "This form has no business name, so the business can't be made from it.");

    const duplicates = await checkSmeDuplicates(tx, { legalName: name, country: "ET" });
    if (duplicates.legalNameWarning && !input.confirmDuplicateName) {
      throw new ServiceError(
        "conflict",
        `A business with a similar name is already registered (${duplicates.legalNameWarning.legalName}, ${duplicates.legalNameWarning.smeId}). If it's the same business, enrol it from the registry search instead.`,
      );
    }

    const [seq] = (await tx.execute<{ value: string }>(sql`select nextval('core.sme_id_seq') as value`)).rows;
    if (!seq?.value) throw new ServiceError("invalid", "Could not allocate an SME ID.");
    const smeId = `ET-SME-${String(seq.value).padStart(6, "0")}`;
    const organizationId = randomUUID();
    const now = ctx.now;

    await tx.insert(schema.organization).values({
      id: organizationId,
      name,
      slug: slugOf(name),
      createdAt: now,
      metadata: JSON.stringify({ kind: "sme" }),
    });
    await tx.insert(schema.smeProfile).values({ organizationId, smeId, legalName: name, country: "ET" });

    // The proven email's account owns the business now. Anyone else gets an invitation: accepting it, signed in with that
    // email, is the proof the form never had.
    const ownerUserId = row.emailVerifiedAt && row.userId ? row.userId : null;
    let invitationId: string | null = null;
    if (ownerUserId) {
      await tx.insert(schema.member).values({ id: randomUUID(), organizationId, userId: ownerUserId, role: "owner", createdAt: now });
    } else {
      invitationId = randomUUID();
      await tx.insert(schema.invitation).values({
        id: invitationId,
        organizationId,
        email,
        role: "owner",
        status: "pending",
        expiresAt: new Date(now.getTime() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
        createdAt: now,
        inviterId: ctx.principal.userId,
        platform: "trade",
      });
    }
    await tx.insert(schema.auditLog).values({
      actorUserId: ctx.principal.userId,
      organizationId,
      platform: "trade",
      action: "organization.created",
      entityType: "organization",
      entityId: organizationId,
      after: { id: organizationId, name, legalName: name, country: "ET", smeId, fromPublicDiagnosticId: row.id, owner: ownerUserId ? "account" : "invited" },
    });

    const enrollment = await enrolSme(tx, ctx.principal.userId, { cohortId: input.cohortId, organizationId });

    const status = row.emailVerifiedAt && !row.pathwayProvisional ? "confirmed" : "provisional";
    await tx.insert(schema.pathwayAssignment).values({
      enrollmentId: enrollment.id,
      pathway: row.pathway,
      status,
      liveOrder: row.liveOrder ?? false,
      rulesVersion: row.rulesVersion,
      reasonCodes: row.reasonCodes ?? [],
      decidedByUserId: ctx.principal.userId,
      decisionReason: `From the public onboarding diagnostic submitted on ${row.submittedAt?.toISOString().slice(0, 10) ?? "an earlier date"}${
        row.emailVerifiedAt ? "" : ". Provisional: the email on the form was never confirmed"
      }.`,
    });
    await tx.update(schema.publicDiagnostic).set({ linkedEnrollmentId: enrollment.id }).where(eq(schema.publicDiagnostic.id, row.id));
    await tx.insert(schema.auditLog).values({
      actorUserId: ctx.principal.userId,
      organizationId,
      platform: "trade",
      action: "trade.pathway.from_public_diagnostic",
      entityType: "enrollment",
      entityId: enrollment.id,
      after: { publicDiagnosticId: row.id, pathway: row.pathway, status, liveOrder: row.liveOrder ?? false },
    });

    const [cohort] = await tx.select({ name: schema.cohort.name }).from(schema.cohort).where(eq(schema.cohort.id, input.cohortId));
    return { row, name, smeId, organizationId, enrollmentId: enrollment.id, invitationId, cohortName: cohort?.name ?? "a TRADE cohort" };
  });

  // The email goes after the commit, so nobody is invited to a business that was rolled back. A failed send is logged and
  // leaves the business, its enrolment and the invitation in place.
  try {
    const url = done.invitationId
      ? `${tradeAppUrl()}/accept-invitation?id=${encodeURIComponent(done.invitationId)}`
      : `${tradeAppUrl()}/`;
    await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: done.row.email,
      subject: `${done.name} is enrolled in TRADE`,
      template: "trade-notice",
      props: {
        heading: `${done.name} is enrolled in TRADE`,
        greeting: "Hello,",
        paragraphs: [
          `Thank you for filling in the onboarding diagnostic. Entrust Africa has enrolled ${done.name} in ${done.cohortName}, and set it up on TRADE with the SME ID ${done.smeId}.`,
          done.invitationId
            ? `To manage it, accept the invitation below and sign in, or create your account, with this email address. The invitation is open for ${INVITATION_DAYS} days.`
            : "Sign in to TRADE with this email address to see your training plan.",
        ],
        details: [],
        action: { label: done.invitationId ? "Accept the invitation" : "Open TRADE", url },
      },
    });
  } catch (error) {
    console.error(`[trade] The enrolment email for diagnostic ${done.row.id} could not be queued`, error);
  }

  return { enrollmentId: done.enrollmentId, organizationId: done.organizationId, smeId: done.smeId, owner: done.invitationId ? "invited" : "owner" };
}

