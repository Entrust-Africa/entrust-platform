import { and, asc, eq, inArray, isNull, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  CONSENT_WORDING_VERSION,
  DATA_KINDS,
  SPONSOR_DATA_KINDS,
  isSponsorDataKind,
  SPONSOR_DISCLAIMER,
  consentWording,
  type SponsorDataKind,
} from "@entrust/trade-engine";
import type { SponsorRole } from "@entrust/roles";
import { organizationKind, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { pathwayView, recordTradeChange } from "./trade-assessments";

// Sponsors and consent (#70). A sponsor organisation, such as the bank behind a cohort, has two roles: an
// administrator who manages colleagues, and a viewer. A sponsor sees only the cohorts it sponsors, and only
// figures without names, until an SME's owner agrees to share a kind of data. That agreement can be taken back
// at any time and stops at once, because every read checks the live consents.

// ---- Sponsor organisations ----

interface SponsorRow {
  id: string;
  name: string;
  slug: string;
}

async function sponsorOrganization(db: Executor, id: string): Promise<SponsorRow> {
  const [row] = await db
    .select({ id: schema.organization.id, name: schema.organization.name, slug: schema.organization.slug, metadata: schema.organization.metadata })
    .from(schema.organization)
    .where(eq(schema.organization.id, id));
  if (!row || organizationKind(row.metadata) !== "sponsor") throw new ServiceError("not_found", "Sponsor not found.");
  return { id: row.id, name: row.name, slug: row.slug };
}

const isEntrustAdmin = (ctx: Ctx): boolean => ctx.principal.staffRole === "admin";

async function membersOf(db: Executor, organizationId: string) {
  return db
    .select({ userId: schema.member.userId, name: schema.user.name, email: schema.user.email, role: schema.member.role })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
    .where(eq(schema.member.organizationId, organizationId))
    .orderBy(asc(schema.member.createdAt));
}

async function sponsorView(db: Executor, sponsor: SponsorRow) {
  return { ...sponsor, members: await membersOf(db, sponsor.id) };
}

export interface CreateSponsorInput {
  name: string;
  slug: string;
  /** The first sponsor administrator: someone who already has an account. */
  adminEmail?: string | undefined;
}

/** An Entrust administrator creates a sponsor organisation with TRADE access, and can name its first administrator. */
export async function createSponsor(ctx: Ctx, input: CreateSponsorInput) {
  if (!isEntrustAdmin(ctx)) throw new ServiceError("forbidden", "Only an Entrust administrator can create a sponsor organisation.");
  return ctx.db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: schema.organization.id }).from(schema.organization).where(eq(schema.organization.slug, input.slug));
    if (taken) throw new ServiceError("invalid", "An organisation with that slug already exists.");
    let adminId: string | null = null;
    if (input.adminEmail) {
      const [person] = await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, input.adminEmail.trim().toLowerCase()));
      if (!person) throw new ServiceError("invalid", "Nobody has an account with that email yet. Ask them to create one first.");
      adminId = person.id;
    }
    const id = crypto.randomUUID();
    await tx.insert(schema.organization).values({ id, name: input.name, slug: input.slug, createdAt: ctx.now, metadata: JSON.stringify({ kind: "sponsor" }) });
    await tx.insert(schema.platformAccess).values({ organizationId: id, platform: "trade", grantedBy: ctx.principal.userId });
    if (adminId) await tx.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: id, userId: adminId, role: "sponsor_admin", createdAt: ctx.now });
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.sponsor.created",
      organizationId: id,
      entityType: "organization",
      entityId: id,
      after: { name: input.name, slug: input.slug, firstAdministrator: adminId },
    });
    return sponsorView(tx, { id, name: input.name, slug: input.slug });
  });
}

/** Every sponsor organisation, for Entrust staff. */
export async function listSponsors(ctx: Ctx) {
  if (!ctx.principal.staffRole) throw new ServiceError("forbidden", "Only Entrust staff can list sponsor organisations.");
  const rows = await ctx.db
    .select({ id: schema.organization.id, name: schema.organization.name, slug: schema.organization.slug, metadata: schema.organization.metadata })
    .from(schema.organization)
    .orderBy(asc(schema.organization.name));
  const sponsors = rows.filter((r) => organizationKind(r.metadata) === "sponsor");
  return Promise.all(sponsors.map((s) => sponsorView(ctx.db, { id: s.id, name: s.name, slug: s.slug })));
}

/** Who may manage a sponsor's people: an Entrust administrator, or an administrator of that sponsor. */
function requireSponsorManager(ctx: Ctx, sponsorId: string): void {
  if (isEntrustAdmin(ctx) || ctx.principal.sponsorRoles.get(sponsorId) === "sponsor_admin") return;
  throw new ServiceError(ctx.principal.sponsorRoles.has(sponsorId) || ctx.principal.staffRole ? "forbidden" : "not_found", "You can't manage this sponsor's people.");
}

export async function getSponsor(ctx: Ctx, sponsorId: string) {
  const sponsor = await sponsorOrganization(ctx.db, sponsorId);
  if (!ctx.principal.staffRole && !ctx.principal.sponsorRoles.has(sponsorId)) throw new ServiceError("not_found", "Sponsor not found.");
  return sponsorView(ctx.db, sponsor);
}

export async function addSponsorMember(ctx: Ctx, sponsorId: string, input: { email: string; role: SponsorRole }) {
  const sponsor = await sponsorOrganization(ctx.db, sponsorId);
  requireSponsorManager(ctx, sponsorId);
  return ctx.db.transaction(async (tx) => {
    const [person] = await tx.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, input.email.trim().toLowerCase()));
    if (!person) throw new ServiceError("invalid", "Nobody has an account with that email yet. Ask them to create one first.");
    const [already] = await tx
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, sponsorId), eq(schema.member.userId, person.id)));
    if (already) throw new ServiceError("invalid", "That person is already a member.");
    await tx.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: sponsorId, userId: person.id, role: input.role, createdAt: ctx.now });
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.sponsor.memberAdded",
      organizationId: sponsorId,
      entityType: "organization",
      entityId: sponsorId,
      after: { userId: person.id, role: input.role },
    });
    return sponsorView(tx, sponsor);
  });
}

export async function removeSponsorMember(ctx: Ctx, sponsorId: string, userId: string) {
  const sponsor = await sponsorOrganization(ctx.db, sponsorId);
  requireSponsorManager(ctx, sponsorId);
  if (userId === ctx.principal.userId) throw new ServiceError("invalid", "You can't remove yourself.");
  return ctx.db.transaction(async (tx) => {
    const members = await membersOf(tx, sponsorId);
    const target = members.find((m) => m.userId === userId);
    if (!target) throw new ServiceError("not_found", "Member not found.");
    if (target.role === "sponsor_admin" && members.filter((m) => m.role === "sponsor_admin").length <= 1) {
      throw new ServiceError("invalid", "Can't remove the last administrator of the sponsor.");
    }
    await tx.delete(schema.member).where(and(eq(schema.member.organizationId, sponsorId), eq(schema.member.userId, userId)));
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.sponsor.memberRemoved",
      organizationId: sponsorId,
      entityType: "organization",
      entityId: sponsorId,
      before: { userId, role: target.role },
    });
    return sponsorView(tx, sponsor);
  });
}

// ---- What a sponsor sees ----

/** The sponsors the caller works for. Anyone else gets "not found": the sponsor screens don't exist for them. */
function sponsorIds(ctx: Ctx): string[] {
  const ids = [...ctx.principal.sponsorRoles.keys()];
  if (ids.length === 0) throw new ServiceError("not_found", "There are no sponsor screens for your account.");
  return ids;
}

type CohortRow = typeof schema.cohort.$inferSelect;

async function sponsoredCohort(ctx: Ctx, cohortId: string): Promise<{ cohort: CohortRow; program: string; sponsor: SponsorRow }> {
  const allowed = sponsorIds(ctx);
  const [found] = await ctx.db
    .select({ cohort: schema.cohort, program: schema.program.name })
    .from(schema.cohort)
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .where(eq(schema.cohort.id, cohortId));
  // A cohort that someone else sponsors looks the same as one that doesn't exist.
  if (!found || !found.cohort.sponsorOrganizationId || !allowed.includes(found.cohort.sponsorOrganizationId)) {
    throw new ServiceError("not_found", "Cohort not found.");
  }
  return { ...found, sponsor: await sponsorOrganization(ctx.db, found.cohort.sponsorOrganizationId) };
}

/** Figures with no names: how many are enrolled, how many finished the diagnostic, and the split between avenues. */
async function anonymisedFigures(db: Executor, cohortIds: readonly string[]) {
  const figures = new Map<string, { enrolled: number; byStatus: Record<string, number>; diagnosticsSubmitted: number; pathwayA: number; pathwayB: number }>(
    cohortIds.map((id) => [id, { enrolled: 0, byStatus: {}, diagnosticsSubmitted: 0, pathwayA: 0, pathwayB: 0 }]),
  );
  if (cohortIds.length === 0) return figures;
  const enrollments = await db
    .select({ id: schema.enrollment.id, cohortId: schema.enrollment.cohortId, status: schema.enrollment.status })
    .from(schema.enrollment)
    .where(inArray(schema.enrollment.cohortId, [...cohortIds]));
  const cohortOf = new Map(enrollments.map((e) => [e.id, e.cohortId]));
  for (const e of enrollments) {
    const f = figures.get(e.cohortId)!;
    f.enrolled += 1;
    f.byStatus[e.status] = (f.byStatus[e.status] ?? 0) + 1;
  }
  if (enrollments.length === 0) return figures;
  const ids = enrollments.map((e) => e.id);
  const diagnostics = await db
    .select({ enrollmentId: schema.tradeAssessment.enrollmentId })
    .from(schema.tradeAssessment)
    .where(and(inArray(schema.tradeAssessment.enrollmentId, ids), eq(schema.tradeAssessment.kind, "diagnostic"), inArray(schema.tradeAssessment.status, ["submitted", "review_required", "scored"])));
  for (const d of diagnostics) figures.get(cohortOf.get(d.enrollmentId)!)!.diagnosticsSubmitted += 1;
  const pathways = await db
    .select({ enrollmentId: schema.pathwayAssignment.enrollmentId, pathway: schema.pathwayAssignment.pathway })
    .from(schema.pathwayAssignment)
    .where(and(inArray(schema.pathwayAssignment.enrollmentId, ids), ne(schema.pathwayAssignment.status, "superseded")));
  for (const p of pathways) figures.get(cohortOf.get(p.enrollmentId)!)![p.pathway === "A" ? "pathwayA" : "pathwayB"] += 1;
  return figures;
}

const cohortSummary = (cohort: CohortRow, program: string, sponsor: SponsorRow, figures: Awaited<ReturnType<typeof anonymisedFigures>> extends Map<string, infer V> ? V : never) => ({
  id: cohort.id,
  name: cohort.name,
  program,
  country: cohort.country,
  startDate: cohort.startDate,
  endDate: cohort.endDate,
  sponsor: { id: sponsor.id, name: sponsor.name },
  figures,
});

/** The cohorts the caller's sponsor organisations sponsor, with figures that name nobody. */
export async function listSponsorCohorts(ctx: Ctx) {
  const ids = sponsorIds(ctx);
  const rows = await ctx.db
    .select({ cohort: schema.cohort, program: schema.program.name, sponsorName: schema.organization.name, sponsorSlug: schema.organization.slug })
    .from(schema.cohort)
    .innerJoin(schema.program, eq(schema.program.id, schema.cohort.programId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.cohort.sponsorOrganizationId))
    .where(inArray(schema.cohort.sponsorOrganizationId, ids))
    .orderBy(asc(schema.cohort.startDate), asc(schema.cohort.name));
  const figures = await anonymisedFigures(ctx.db, rows.map((r) => r.cohort.id));
  return {
    disclaimer: SPONSOR_DISCLAIMER,
    items: rows.map((r) => cohortSummary(r.cohort, r.program, { id: r.cohort.sponsorOrganizationId!, name: r.sponsorName, slug: r.sponsorSlug }, figures.get(r.cohort.id)!)),
  };
}

/** One live consent row per kind, for a sponsor and the SMEs in a cohort. */
async function liveConsents(db: Executor, sponsorId: string, smeOrganizationIds: readonly string[]) {
  if (smeOrganizationIds.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.sponsorConsent)
    .where(
      and(
        eq(schema.sponsorConsent.sponsorOrganizationId, sponsorId),
        inArray(schema.sponsorConsent.smeOrganizationId, [...smeOrganizationIds]),
        isNull(schema.sponsorConsent.withdrawnAt),
        // A Summit applicant's agreement is with Entrust, never with a cohort's sponsor.
        inArray(schema.sponsorConsent.kind, [...SPONSOR_DATA_KINDS]),
      ),
    );
  return rows.filter((c): c is typeof c & { kind: SponsorDataKind } => isSponsorDataKind(c.kind));
}

/** A sponsored cohort: the same figures, and the SMEs whose owners agreed to share something, with what. */
export async function getSponsorCohort(ctx: Ctx, cohortId: string) {
  const { cohort, program, sponsor } = await sponsoredCohort(ctx, cohortId);
  const figures = await anonymisedFigures(ctx.db, [cohortId]);
  const enrolled = await ctx.db
    .select({ organizationId: schema.enrollment.organizationId, name: schema.organization.name, smeId: schema.smeProfile.smeId })
    .from(schema.enrollment)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.enrollment.organizationId))
    .where(and(eq(schema.enrollment.cohortId, cohortId), ne(schema.enrollment.status, "withdrawn")));
  const consents = await liveConsents(ctx.db, sponsor.id, enrolled.map((e) => e.organizationId));
  const kindsBySme = new Map<string, SponsorDataKind[]>();
  for (const c of consents) kindsBySme.set(c.smeOrganizationId, [...(kindsBySme.get(c.smeOrganizationId) ?? []), c.kind]);
  return {
    ...cohortSummary(cohort, program, sponsor, figures.get(cohortId)!),
    disclaimer: SPONSOR_DISCLAIMER,
    consenting: enrolled
      .filter((e) => kindsBySme.has(e.organizationId))
      .map((e) => ({
        organizationId: e.organizationId,
        name: e.name,
        smeId: e.smeId,
        kinds: SPONSOR_DATA_KINDS.filter((k) => kindsBySme.get(e.organizationId)!.includes(k)),
      })),
  };
}

/**
 * A named SME in a sponsored cohort, with only the kinds of data its owner has agreed to share. With no live consent
 * the SME looks like it isn't there. Every view is written to the audit log, with what was shown.
 */
export async function getSponsorSme(ctx: Ctx, cohortId: string, organizationId: string) {
  const { cohort, sponsor } = await sponsoredCohort(ctx, cohortId);
  const [enrollment] = await ctx.db
    .select()
    .from(schema.enrollment)
    .where(and(eq(schema.enrollment.cohortId, cohortId), eq(schema.enrollment.organizationId, organizationId), ne(schema.enrollment.status, "withdrawn")));
  const granted = enrollment ? new Set((await liveConsents(ctx.db, sponsor.id, [organizationId])).map((c) => c.kind)) : new Set<SponsorDataKind>();
  if (!enrollment || granted.size === 0) throw new ServiceError("not_found", "SME not found.");

  const [identity] = await ctx.db
    .select({ name: schema.organization.name, smeId: schema.smeProfile.smeId, legalName: schema.smeProfile.legalName, country: schema.smeProfile.country })
    .from(schema.organization)
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.organization.id))
    .where(eq(schema.organization.id, organizationId));

  const data: Record<string, unknown> = {};
  for (const kind of SPONSOR_DATA_KINDS) {
    if (!granted.has(kind)) continue;
    if (kind === "placement_results") {
      const [placement] = await ctx.db
        .select({ status: schema.tradeAssessment.status, submittedAt: schema.tradeAssessment.assessedAt })
        .from(schema.tradeAssessment)
        .where(and(eq(schema.tradeAssessment.enrollmentId, enrollment.id), eq(schema.tradeAssessment.kind, "placement"), ne(schema.tradeAssessment.status, "superseded")));
      data[kind] = { available: true, pathway: await pathwayView(ctx.db, enrollment.id), placementAssessment: placement ? { status: placement.status, submittedAt: placement.submittedAt?.toISOString() ?? null } : null };
    } else if (kind === "learning_progress") {
      const rows = await ctx.db
        .select({ moduleId: schema.moduleProgress.moduleId, status: schema.moduleProgress.status })
        .from(schema.moduleProgress)
        .where(eq(schema.moduleProgress.enrollmentId, enrollment.id))
        .orderBy(asc(schema.moduleProgress.moduleId));
      data[kind] = { available: true, modules: rows };
    } else {
      // These kinds are shared the day TRADE records them. The consent exists already, so the screens and the checks need no change.
      data[kind] = { available: false };
    }
  }

  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.sponsor.viewedSme",
    organizationId,
    entityType: "organization",
    entityId: organizationId,
    after: { sponsorOrganizationId: sponsor.id, cohortId: cohort.id, kinds: SPONSOR_DATA_KINDS.filter((k) => granted.has(k)) },
  });
  return {
    sponsor: { id: sponsor.id, name: sponsor.name },
    cohort: { id: cohort.id, name: cohort.name },
    sme: { organizationId, name: identity?.name ?? "", legalName: identity?.legalName ?? null, smeId: identity?.smeId ?? null, country: identity?.country ?? null },
    sharedKinds: SPONSOR_DATA_KINDS.filter((k) => granted.has(k)),
    data,
    disclaimer: SPONSOR_DISCLAIMER,
  };
}

// ---- What an SME shares ----

async function resolveSme(ctx: Ctx, organizationId?: string): Promise<{ organizationId: string; owner: boolean }> {
  const { principal } = ctx;
  const id = organizationId ?? (principal.smeRoles.size === 1 ? [...principal.smeRoles.keys()][0] : undefined);
  // Someone with no SME organisation (a sponsor user, for one) has nothing to share.
  if (!id && principal.smeRoles.size === 0 && !principal.staffRole) throw new ServiceError("not_found", "Organisation not found.");
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  if (principal.staffRole) return { organizationId: id, owner: false };
  const role = principal.smeRoles.get(id);
  if (!role) throw new ServiceError("not_found", "Organisation not found.");
  return { organizationId: id, owner: role === "owner" };
}

/** The sponsors of the cohorts an organisation is enrolled in. */
async function sponsorsOf(db: Executor, organizationId: string) {
  const rows = await db
    .select({ sponsorId: schema.cohort.sponsorOrganizationId, sponsorName: schema.organization.name, cohort: schema.cohort.name })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.cohort.sponsorOrganizationId))
    .where(and(eq(schema.enrollment.organizationId, organizationId), ne(schema.enrollment.status, "withdrawn")));
  const sponsors = new Map<string, { id: string; name: string; cohorts: string[] }>();
  for (const r of rows) {
    if (!r.sponsorId) continue;
    const s = sponsors.get(r.sponsorId) ?? { id: r.sponsorId, name: r.sponsorName, cohorts: [] };
    s.cohorts.push(r.cohort);
    sponsors.set(r.sponsorId, s);
  }
  return [...sponsors.values()];
}

/** What an organisation has agreed to share with each sponsor of its cohorts, kind by kind. */
export async function listConsents(ctx: Ctx, organizationId?: string) {
  const sme = await resolveSme(ctx, organizationId);
  const sponsors = await sponsorsOf(ctx.db, sme.organizationId);
  const live = sponsors.length
    ? await ctx.db
        .select()
        .from(schema.sponsorConsent)
        .where(and(eq(schema.sponsorConsent.smeOrganizationId, sme.organizationId), isNull(schema.sponsorConsent.withdrawnAt)))
    : [];
  return {
    organizationId: sme.organizationId,
    canChange: sme.owner,
    wordingVersion: CONSENT_WORDING_VERSION,
    disclaimer: SPONSOR_DISCLAIMER,
    sponsors: sponsors.map((s) => ({
      sponsor: { id: s.id, name: s.name },
      cohorts: s.cohorts,
      kinds: SPONSOR_DATA_KINDS.map((kind) => {
        const grant = live.find((c) => c.sponsorOrganizationId === s.id && c.kind === kind);
        return {
          kind,
          label: DATA_KINDS[kind].label,
          description: DATA_KINDS[kind].description,
          wording: consentWording(kind, s.name),
          granted: Boolean(grant),
          consentId: grant?.id ?? null,
          grantedAt: grant?.grantedAt.toISOString() ?? null,
        };
      }),
    })),
  };
}

export interface GrantInput {
  organizationId?: string | undefined;
  sponsorOrganizationId: string;
  kinds: readonly SponsorDataKind[];
}

/** The owner agrees to share kinds of data with a sponsor of one of the organisation's cohorts. Records the words agreed to. */
export async function grantConsent(ctx: Ctx, input: GrantInput) {
  const sme = await resolveSme(ctx, input.organizationId);
  if (!sme.owner) throw new ServiceError("forbidden", "Only the owner of the organisation can decide what is shared.");
  await ctx.db.transaction(async (tx) => {
    const sponsor = (await sponsorsOf(tx, sme.organizationId)).find((s) => s.id === input.sponsorOrganizationId);
    if (!sponsor) throw new ServiceError("precondition_failed", "That organisation doesn't sponsor a cohort you are enrolled in.");
    for (const kind of new Set(input.kinds)) {
      const wording = consentWording(kind, sponsor.name);
      const [row] = await tx
        .insert(schema.sponsorConsent)
        .values({
          sponsorOrganizationId: sponsor.id,
          smeOrganizationId: sme.organizationId,
          kind,
          grantedByUserId: ctx.principal.userId,
          grantedAt: ctx.now,
          wordingVersion: CONSENT_WORDING_VERSION,
          wording,
        })
        .onConflictDoNothing()
        .returning();
      if (!row) continue;
      await recordTradeChange(tx, ctx.principal.userId, {
        action: "trade.consent.granted",
        organizationId: sme.organizationId,
        entityType: "sponsor_consent",
        entityId: row.id,
        after: { sponsorOrganizationId: sponsor.id, kind, wordingVersion: CONSENT_WORDING_VERSION },
      });
    }
  });
  return listConsents(ctx, sme.organizationId);
}

/** The owner takes back an agreement. The sponsor loses access on its next request. */
export async function withdrawConsent(ctx: Ctx, consentId: string) {
  const [row] = await ctx.db.select().from(schema.sponsorConsent).where(eq(schema.sponsorConsent.id, consentId));
  const role = row ? ctx.principal.smeRoles.get(row.smeOrganizationId) : undefined;
  if (!row || !role) throw new ServiceError("not_found", "Consent not found.");
  if (role !== "owner") throw new ServiceError("forbidden", "Only the owner of the organisation can decide what is shared.");
  await ctx.db.transaction(async (tx) => {
    const [withdrawn] = await tx
      .update(schema.sponsorConsent)
      .set({ withdrawnAt: ctx.now, withdrawnByUserId: ctx.principal.userId })
      .where(and(eq(schema.sponsorConsent.id, consentId), isNull(schema.sponsorConsent.withdrawnAt)))
      .returning();
    if (!withdrawn) throw new ServiceError("invalid_transition", "This agreement has already been withdrawn.");
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.consent.withdrawn",
      organizationId: row.smeOrganizationId,
      entityType: "sponsor_consent",
      entityId: consentId,
      before: { sponsorOrganizationId: row.sponsorOrganizationId, kind: row.kind },
    });
  });
  return listConsents(ctx, row.smeOrganizationId);
}
