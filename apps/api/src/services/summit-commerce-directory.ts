import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  B2B_INTEREST_LABELS,
  B2B_STATUSES,
  PROFILE_STATUSES,
  PROFILE_VERIFICATION_LABELS,
  countryName,
  directoryDraft,
  profileProblems,
  slugify,
  type ProfileContent,
} from "@entrust/summit-engine";
import type { z } from "@hono/zod-openapi";
import type {
  B2bEnquiryBody,
  B2bHandledBody,
  B2bItem,
  B2bList,
  B2bQuery,
  B2bReceipt,
  DirectoryCard,
  DirectoryList,
  DirectoryQuery,
  PrefillBody,
  PrefillResult,
  ProfileDetail,
  ProfileList,
  ProfilePatch,
  ProfileQuery,
  PublicProfileView,
} from "../schemas/summit-commerce";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { currentEdition } from "./summit-commerce";
import { pickEdition } from "./summit-commerce-dashboard";
import { firstName, sendNotice, siteUrl } from "./summit-commerce-mail";
import { approvedFinalList } from "./summit-final-list";
import { loadPeriod } from "./summit-applications";
import { loadApplications } from "./summit-reports";
import { recordSummitChange } from "./summit-status";

// The ADTIS SME digital directory (section 9). A public profile is made from a selected SME's application as a draft; staff
// edit it, the business approves it, and only then is it published. What the public reads comes only from the profile, so
// nothing from the assessment (scores, findings, finances) can reach it.

type ProfileRow = typeof schema.smePublicProfile.$inferSelect;
type Card = z.infer<typeof DirectoryCard>;

const CONTENT_FIELDS = [
  "displayName", "country", "city", "sector", "summary", "productsServices", "productionCapacity", "exportReadiness", "targetMarkets",
  "seeksInvestment", "investmentRequirements", "verification", "website", "contactName", "contactPosition", "contactEmail", "contactPhone",
] as const satisfies readonly (keyof ProfileContent)[];

const contentOf = (row: ProfileRow): ProfileContent => ({
  displayName: row.displayName,
  country: row.country,
  city: row.city,
  sector: row.sector,
  summary: row.summary,
  productsServices: row.productsServices,
  productionCapacity: row.productionCapacity,
  exportReadiness: row.exportReadiness,
  targetMarkets: row.targetMarkets,
  seeksInvestment: row.seeksInvestment,
  investmentRequirements: row.investmentRequirements,
  verification: row.verification,
  website: row.website,
  contactName: row.contactName,
  contactPosition: row.contactPosition,
  contactEmail: row.contactEmail,
  contactPhone: row.contactPhone,
});

const profileUrl = (slug: string): string => siteUrl(`/smes/${slug}`);
const escapeLike = (text: string): string => `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// ---- The public directory ----

const card = (row: ProfileRow): Card => ({
  slug: row.slug,
  name: row.displayName,
  country: row.country,
  countryName: countryName(row.country) ?? row.country,
  city: row.city,
  sector: row.sector,
  summary: row.summary.length > 220 ? `${row.summary.slice(0, 219).trimEnd()}…` : row.summary,
  productsServices: row.productsServices.slice(0, 6),
  targetMarkets: row.targetMarkets.slice(0, 6),
  seeksInvestment: row.seeksInvestment,
  verification: row.verification,
  verificationLabel: PROFILE_VERIFICATION_LABELS[row.verification],
});

/** The published businesses of the current edition, filtered, with what there is to filter by. */
export async function publicDirectory(ctx: Pick<Ctx, "db">, query: z.infer<typeof DirectoryQuery>): Promise<z.infer<typeof DirectoryList>> {
  const empty = { items: [], total: 0, facets: { countries: [], sectors: [], markets: [], investment: 0, all: 0 } };
  const edition = await currentEdition(ctx.db);
  if (!edition) return empty;
  const p = schema.smePublicProfile;
  const published = await ctx.db
    .select()
    .from(p)
    .where(and(eq(p.editionId, edition.id), eq(p.status, "published")))
    .orderBy(asc(p.displayName), asc(p.id));

  const facetCount = <K>(values: readonly K[]): Map<K, number> => {
    const counts = new Map<K, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return counts;
  };
  const countries = [...facetCount(published.map((r) => r.country))].map(([code, n]) => ({ code, name: countryName(code) ?? code, count: n }));
  const sectors = [...facetCount(published.map((r) => r.sector))].map(([value, n]) => ({ value, count: n }));
  const markets = [...facetCount(published.flatMap((r) => [...new Set(r.targetMarkets)]))].map(([value, n]) => ({ value, count: n }));

  const q = query.q?.toLowerCase();
  const matches = published.filter(
    (r) =>
      (!query.country || r.country === query.country) &&
      (!query.sector || r.sector.toLowerCase() === query.sector.toLowerCase()) &&
      (!query.market || r.targetMarkets.some((m) => m.toLowerCase() === query.market!.toLowerCase())) &&
      (!query.investment || r.seeksInvestment) &&
      (!q || [r.displayName, r.sector, r.summary, ...r.productsServices].some((text) => text.toLowerCase().includes(q))),
  );
  return {
    items: matches.slice(query.offset, query.offset + query.limit).map(card),
    total: matches.length,
    facets: {
      countries: countries.sort((a, b) => a.name.localeCompare(b.name)),
      sectors: sectors.sort((a, b) => a.value.localeCompare(b.value)),
      markets: markets.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      investment: published.filter((r) => r.seeksInvestment).length,
      all: published.length,
    },
  };
}

async function publishedBySlug(db: Executor, slug: string): Promise<{ row: ProfileRow; edition: typeof schema.commerceEdition.$inferSelect }> {
  const edition = await currentEdition(db);
  const [row] = edition
    ? await db
        .select()
        .from(schema.smePublicProfile)
        .where(and(eq(schema.smePublicProfile.editionId, edition.id), eq(schema.smePublicProfile.slug, slug), eq(schema.smePublicProfile.status, "published")))
    : [];
  if (!edition || !row) throw new ServiceError("not_found", "No such business in the directory.");
  return { row, edition };
}

export async function publicProfile(ctx: Pick<Ctx, "db">, slug: string): Promise<z.infer<typeof PublicProfileView>> {
  const { row, edition } = await publishedBySlug(ctx.db, slug);
  return {
    ...card(row),
    // The full text, not the card's cut.
    summary: row.summary,
    productsServices: row.productsServices,
    targetMarkets: row.targetMarkets,
    edition: { name: edition.name, venue: edition.venue, datesNote: edition.datesNote },
    productionCapacity: row.productionCapacity,
    exportReadiness: row.exportReadiness,
    investmentRequirements: row.investmentRequirements,
    website: row.website,
    contact: { name: row.contactName, position: row.contactPosition, email: row.contactEmail, phone: row.contactPhone },
    url: profileUrl(row.slug),
  };
}

// ---- B2B enquiries ----

/** A sender may make this many enquiries a day, to one business and in all, so the form can't be used to flood inboxes. */
const PER_BUSINESS_PER_DAY = 3;
const PER_SENDER_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function submitB2bEnquiry(ctx: Pick<Ctx, "db" | "now">, slug: string, body: z.infer<typeof B2bEnquiryBody>): Promise<z.infer<typeof B2bReceipt>> {
  if (body.nickname) return { number: "B2B-0000", businessName: "" };
  const { row: profile, edition } = await publishedBySlug(ctx.db, slug);
  const email = body.email.toLowerCase();
  const e = schema.b2bEnquiry;
  const since = new Date(ctx.now.getTime() - DAY_MS);
  const [[toThis], [inAll]] = await Promise.all([
    ctx.db.select({ n: count() }).from(e).where(and(eq(e.profileId, profile.id), eq(e.fromEmail, email), sql`${e.createdAt} > ${since}`)),
    ctx.db.select({ n: count() }).from(e).where(and(eq(e.fromEmail, email), sql`${e.createdAt} > ${since}`)),
  ]);
  if ((toThis?.n ?? 0) >= PER_BUSINESS_PER_DAY || (inAll?.n ?? 0) >= PER_SENDER_PER_DAY) {
    throw new ServiceError("precondition_failed", "You have sent several enquiries today. Please wait a day, or contact the ADTIS secretariat.");
  }

  const [created] = await ctx.db
    .insert(e)
    .values({
      editionId: edition.id,
      profileId: profile.id,
      interest: body.interest,
      fromName: body.name,
      fromEmail: email,
      fromPhone: body.phone || null,
      fromOrganisation: body.organisation,
      fromRole: body.role || null,
      message: body.message,
      consentedAt: ctx.now,
    })
    .returning();
  if (!created) throw new Error("The enquiry was not saved.");

  const [application] = await ctx.db.select({ organizationId: schema.application.organizationId }).from(schema.application).where(eq(schema.application.id, profile.applicationId));
  const owners = application
    ? await ctx.db
        .select({ email: schema.user.email })
        .from(schema.member)
        .innerJoin(schema.user, eq(schema.user.id, schema.member.userId))
        .where(and(eq(schema.member.organizationId, application.organizationId), eq(schema.member.role, "owner")))
    : [];
  const forwarded = await Promise.all(
    owners.map((owner) =>
      sendNotice({
        to: owner.email,
        subject: `Someone would like to connect with ${profile.displayName} through ADTIS (${created.number})`,
        heading: "A B2B enquiry for your business",
        greeting: "Hello,",
        paragraphs: [
          `${body.name} of ${body.organisation} found ${profile.displayName} in the ADTIS directory and would like to connect (${B2B_INTEREST_LABELS[body.interest].toLowerCase()}).`,
          `Their message: ${body.message}`,
          "Please reply to them directly. The ADTIS team can also help set up a meeting.",
        ],
        details: [
          { label: "Reference", value: created.number },
          { label: "From", value: `${body.name}${body.role ? `, ${body.role}` : ""}, ${body.organisation}` },
          { label: "Email", value: email },
          ...(body.phone ? [{ label: "Phone", value: body.phone }] : []),
        ],
      }),
    ),
  );
  if (forwarded.some(Boolean)) await ctx.db.update(e).set({ forwardedAt: ctx.now }).where(eq(e.id, created.id));
  await sendNotice({
    to: email,
    subject: `We have passed your enquiry to ${profile.displayName} (${created.number})`,
    heading: "Your enquiry is on its way",
    greeting: `Hello ${firstName(body.name)},`,
    paragraphs: [
      `Thank you for your interest in ${profile.displayName}. We have passed your message and contact details to the business, which will reply to you directly.`,
      "The ADTIS team can also help arrange meetings between buyers, investors and the selected businesses at the summit.",
    ],
    details: [{ label: "Reference", value: created.number }],
  });
  return { number: created.number, businessName: profile.displayName };
}

// ---- Staff: making and editing profiles ----

function requireHandler(ctx: Ctx, doing: string): void {
  requireStaff(ctx.principal, ["admin", "facilitator"], doing);
}

async function freeSlug(db: Executor, editionId: string, name: string): Promise<string> {
  const base = slugify(name);
  const taken = await db
    .select({ slug: schema.smePublicProfile.slug })
    .from(schema.smePublicProfile)
    .where(and(eq(schema.smePublicProfile.editionId, editionId), ilike(schema.smePublicProfile.slug, `${base.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)));
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base.slice(0, 56)}-${i}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * Makes draft profiles for the selected SMEs of the edition's assessment period (all of them, or one). It needs the committee's
 * final list to be approved, so only businesses whose selection stands are put forward. A profile that exists is left alone.
 */
export async function prefillProfiles(ctx: Ctx, body: z.infer<typeof PrefillBody>): Promise<z.infer<typeof PrefillResult>> {
  requireHandler(ctx, "make directory profiles");
  const edition = await pickEdition(ctx.db);
  if (!edition.applicationPeriodId) throw new ServiceError("precondition_failed", "Choose the edition's assessment period first, in the edition settings.");
  const period = await loadPeriod(ctx.db, edition.applicationPeriodId);
  if (!(await approvedFinalList(ctx.db, period.id))) throw new ServiceError("precondition_failed", "The committee's final list for this period isn't approved yet.");

  const everyone = await loadApplications(ctx.db, period);
  const selected = everyone.filter((a) => a.status === "selected" && (!body.applicationId || a.id === body.applicationId));
  if (body.applicationId && selected.length === 0) throw new ServiceError("invalid", "That application isn't a selected SME of this edition's assessment period.");

  const existing = new Set(
    (await ctx.db.select({ id: schema.smePublicProfile.applicationId }).from(schema.smePublicProfile).where(eq(schema.smePublicProfile.editionId, edition.id))).map((r) => r.id),
  );
  const result = { created: 0, existing: 0, skipped: [] as { number: string; reason: string }[] };
  for (const app of selected) {
    if (existing.has(app.id)) {
      result.existing += 1;
      continue;
    }
    await ctx.db.transaction(async (tx) => {
      const draft = directoryDraft(app);
      const slug = await freeSlug(tx, edition.id, draft.displayName);
      const [row] = await tx
        .insert(schema.smePublicProfile)
        .values({ ...draft, editionId: edition.id, applicationId: app.id, slug })
        .returning({ id: schema.smePublicProfile.id });
      if (!row) throw new Error("The profile was not saved.");
      await recordSummitChange(tx, ctx.principal.userId, {
        action: "summit.directory.profile.created",
        entityType: "sme_public_profile",
        entityId: row.id,
        organizationId: null,
        after: { slug, application: app.number },
      });
    });
    result.created += 1;
  }
  return result;
}

const toItem = (row: ProfileRow, applicationNumber: string, enquiries: number) => ({
  id: row.id,
  slug: row.slug,
  status: row.status,
  displayName: row.displayName,
  country: row.country,
  sector: row.sector,
  verification: row.verification,
  applicationNumber,
  businessApproved: row.businessApprovedAt !== null,
  publishedAt: row.publishedAt?.toISOString() ?? null,
  updatedAt: row.updatedAt.toISOString(),
  enquiries,
});

/** The edition asked for (a 404 if it doesn't exist), else the current one, else none. */
async function editionToList(db: Executor, editionId?: string) {
  return editionId ? pickEdition(db, editionId) : currentEdition(db);
}

export async function listProfiles(ctx: Ctx, query: z.infer<typeof ProfileQuery>): Promise<z.infer<typeof ProfileList>> {
  requireHandler(ctx, "list directory profiles");
  // No edition yet: an empty list, as the bookings, delegates and sponsor lists give, not a 404.
  const edition = await editionToList(ctx.db, query.editionId);
  if (!edition) return { items: [], total: 0, byStatus: Object.fromEntries(PROFILE_STATUSES.map((s) => [s, 0])), selectedWithoutProfile: 0 };
  const p = schema.smePublicProfile;
  const where = and(
    eq(p.editionId, edition.id),
    query.status ? eq(p.status, query.status) : undefined,
    query.q ? or(ilike(p.displayName, escapeLike(query.q)), ilike(p.sector, escapeLike(query.q)), ilike(schema.application.number, escapeLike(query.q))) : undefined,
  );
  const [rows, [filtered], perStatus, withProfile, selectedCount] = await Promise.all([
    ctx.db
      .select({ p, number: schema.application.number, enquiries: sql<number>`(select count(*)::int from ${schema.b2bEnquiry} where ${schema.b2bEnquiry.profileId} = ${p.id})` })
      .from(p)
      .innerJoin(schema.application, eq(schema.application.id, p.applicationId))
      .where(where)
      .orderBy(asc(p.displayName))
      .limit(query.limit)
      .offset(query.offset),
    ctx.db.select({ n: count() }).from(p).innerJoin(schema.application, eq(schema.application.id, p.applicationId)).where(where),
    ctx.db.select({ status: p.status, n: count() }).from(p).where(eq(p.editionId, edition.id)).groupBy(p.status),
    ctx.db.select({ n: count() }).from(p).where(eq(p.editionId, edition.id)),
    edition.applicationPeriodId
      ? ctx.db.select({ n: count() }).from(schema.application).where(and(eq(schema.application.periodId, edition.applicationPeriodId), eq(schema.application.status, "selected")))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return {
    items: rows.map((r) => toItem(r.p, r.number, r.enquiries)),
    total: filtered?.n ?? 0,
    byStatus: Object.fromEntries(PROFILE_STATUSES.map((s) => [s, perStatus.find((r) => r.status === s)?.n ?? 0])),
    selectedWithoutProfile: Math.max(0, (selectedCount[0]?.n ?? 0) - (withProfile[0]?.n ?? 0)),
  };
}

async function loadProfile(db: Executor, id: string, lock = false): Promise<ProfileRow> {
  const query = db.select().from(schema.smePublicProfile).where(eq(schema.smePublicProfile.id, id));
  const [row] = lock ? await query.for("update") : await query;
  if (!row) throw new ServiceError("not_found", "No such directory profile.");
  return row;
}

async function detail(db: Executor, row: ProfileRow): Promise<z.infer<typeof ProfileDetail>> {
  const names = async (userId: string | null) => {
    if (!userId) return null;
    const [u] = await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId));
    return u ?? null;
  };
  const [[application], approvedBy, publishedBy] = await Promise.all([
    db.select({ id: schema.application.id, number: schema.application.number }).from(schema.application).where(eq(schema.application.id, row.applicationId)),
    names(row.businessApprovedBy),
    names(row.publishedBy),
  ]);
  if (!application) throw new Error("A profile lost its application.");
  return {
    ...contentOf(row),
    id: row.id,
    slug: row.slug,
    status: row.status,
    application,
    businessApprovedAt: row.businessApprovedAt?.toISOString() ?? null,
    businessApprovedBy: approvedBy,
    approvalNote: row.approvalNote,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedBy,
    updatedAt: row.updatedAt.toISOString(),
    problems: profileProblems(contentOf(row)),
    url: profileUrl(row.slug),
  };
}

export async function getProfile(ctx: Ctx, id: string): Promise<z.infer<typeof ProfileDetail>> {
  requireHandler(ctx, "see a directory profile");
  return detail(ctx.db, await loadProfile(ctx.db, id));
}

/**
 * Edits a profile. Changing what the public reads clears the business's approval and takes a published profile off the site,
 * because the business approved a different text; a `minorCorrection` keeps both. Approving needs a complete profile.
 */
export async function updateProfile(ctx: Ctx, id: string, patch: z.infer<typeof ProfilePatch>): Promise<z.infer<typeof ProfileDetail>> {
  requireHandler(ctx, "edit a directory profile");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadProfile(tx, id, true);
    const set: Partial<typeof schema.smePublicProfile.$inferInsert> = {};
    const before: Record<string, unknown> = {};
    for (const key of CONTENT_FIELDS) {
      const value = patch[key];
      if (value !== undefined && JSON.stringify(value) !== JSON.stringify(current[key])) {
        (set as Record<string, unknown>)[key] = value;
        before[key] = current[key];
      }
    }
    const textChanged = Object.keys(set).length > 0;
    let unpublished = false;
    if (textChanged && !patch.minorCorrection) {
      if (current.businessApprovedAt) {
        set.businessApprovedAt = null;
        set.businessApprovedBy = null;
        set.approvalNote = null;
      }
      if (current.status === "published") {
        set.status = "draft";
        set.publishedAt = null;
        set.publishedBy = null;
        unpublished = true;
      }
    }
    if (patch.approvalNote !== undefined && patch.businessApproved !== false) set.approvalNote = patch.approvalNote;
    if (patch.businessApproved !== undefined) {
      const merged = { ...contentOf(current), ...set } as ProfileContent;
      if (patch.businessApproved) {
        const problems = profileProblems(merged);
        if (problems.length) throw new ServiceError("precondition_failed", `The profile isn't complete: ${problems.join(" ")}`);
        set.businessApprovedAt = ctx.now;
        set.businessApprovedBy = ctx.principal.userId;
        if (patch.approvalNote !== undefined) set.approvalNote = patch.approvalNote;
      } else {
        set.businessApprovedAt = null;
        set.businessApprovedBy = null;
        set.approvalNote = null;
        if (current.status === "published") {
          set.status = "draft";
          set.publishedAt = null;
          set.publishedBy = null;
          unpublished = true;
        }
      }
    }
    if (Object.keys(set).length === 0) return current;
    const [updated] = await tx.update(schema.smePublicProfile).set(set).where(eq(schema.smePublicProfile.id, id)).returning();
    if (!updated) throw new Error("The profile was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.directory.profile.updated",
      entityType: "sme_public_profile",
      entityId: id,
      organizationId: null,
      before,
      after: {
        ...Object.fromEntries(Object.keys(before).map((key) => [key, (set as Record<string, unknown>)[key]])),
        ...(patch.businessApproved !== undefined ? { businessApproved: patch.businessApproved } : {}),
        ...(unpublished ? { status: "draft" } : {}),
        ...(patch.minorCorrection ? { minorCorrection: true } : {}),
      },
    });
    return updated;
  });
  return detail(ctx.db, row);
}

/** Puts an approved, complete profile on the public site. */
export async function publishProfile(ctx: Ctx, id: string): Promise<z.infer<typeof ProfileDetail>> {
  requireHandler(ctx, "publish a directory profile");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadProfile(tx, id, true);
    if (current.status === "published") throw new ServiceError("invalid_transition", "This profile is already published.");
    if (!current.businessApprovedAt) throw new ServiceError("precondition_failed", "The business hasn't approved this profile yet.");
    const problems = profileProblems(contentOf(current));
    if (problems.length) throw new ServiceError("precondition_failed", `The profile isn't complete: ${problems.join(" ")}`);
    const [application] = await tx.select({ status: schema.application.status }).from(schema.application).where(eq(schema.application.id, current.applicationId));
    if (application?.status !== "selected") throw new ServiceError("precondition_failed", "Only a selected SME can be in the directory.");
    const [updated] = await tx
      .update(schema.smePublicProfile)
      .set({ status: "published", publishedAt: ctx.now, publishedBy: ctx.principal.userId })
      .where(eq(schema.smePublicProfile.id, id))
      .returning();
    if (!updated) throw new Error("The profile was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.directory.profile.published",
      entityType: "sme_public_profile",
      entityId: id,
      organizationId: null,
      before: { status: "draft" },
      after: { status: "published", slug: updated.slug },
    });
    return updated;
  });
  return detail(ctx.db, row);
}

export async function unpublishProfile(ctx: Ctx, id: string): Promise<z.infer<typeof ProfileDetail>> {
  requireHandler(ctx, "take a directory profile down");
  const row = await ctx.db.transaction(async (tx) => {
    const current = await loadProfile(tx, id, true);
    if (current.status !== "published") throw new ServiceError("invalid_transition", "This profile isn't published.");
    const [updated] = await tx
      .update(schema.smePublicProfile)
      .set({ status: "draft", publishedAt: null, publishedBy: null })
      .where(eq(schema.smePublicProfile.id, id))
      .returning();
    if (!updated) throw new Error("The profile was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.directory.profile.unpublished",
      entityType: "sme_public_profile",
      entityId: id,
      organizationId: null,
      before: { status: "published" },
      after: { status: "draft" },
    });
    return updated;
  });
  return detail(ctx.db, row);
}

// ---- Staff: B2B enquiries ----

const b2bItem = (r: { e: typeof schema.b2bEnquiry.$inferSelect; business: string; handler: { id: string; name: string } | null }): z.infer<typeof B2bItem> => ({
  id: r.e.id,
  number: r.e.number,
  status: r.e.status,
  interest: r.e.interest,
  profileId: r.e.profileId,
  businessName: r.business,
  fromName: r.e.fromName,
  fromEmail: r.e.fromEmail,
  fromPhone: r.e.fromPhone,
  fromOrganisation: r.e.fromOrganisation,
  fromRole: r.e.fromRole,
  message: r.e.message,
  forwarded: r.e.forwardedAt !== null,
  handledBy: r.handler,
  handledAt: r.e.handledAt?.toISOString() ?? null,
  handlingNote: r.e.handlingNote,
  createdAt: r.e.createdAt.toISOString(),
});

export async function listB2bEnquiries(ctx: Ctx, query: z.infer<typeof B2bQuery>): Promise<z.infer<typeof B2bList>> {
  requireHandler(ctx, "list B2B enquiries");
  const edition = await editionToList(ctx.db, query.editionId);
  if (!edition) return { items: [], total: 0, byStatus: Object.fromEntries(B2B_STATUSES.map((s) => [s, 0])) };
  const e = schema.b2bEnquiry;
  const where = and(
    eq(e.editionId, edition.id),
    query.status ? eq(e.status, query.status) : undefined,
    query.profileId ? eq(e.profileId, query.profileId) : undefined,
    query.q
      ? or(ilike(e.fromName, escapeLike(query.q)), ilike(e.fromOrganisation, escapeLike(query.q)), ilike(e.fromEmail, escapeLike(query.q)), ilike(e.number, escapeLike(query.q)), ilike(schema.smePublicProfile.displayName, escapeLike(query.q)))
      : undefined,
  );
  const handler = schema.user;
  const [rows, [filtered], perStatus] = await Promise.all([
    ctx.db
      .select({ e, business: schema.smePublicProfile.displayName, handlerId: handler.id, handlerName: handler.name })
      .from(e)
      .innerJoin(schema.smePublicProfile, eq(schema.smePublicProfile.id, e.profileId))
      .leftJoin(handler, eq(handler.id, e.handledBy))
      .where(where)
      .orderBy(desc(e.createdAt), desc(e.id))
      .limit(query.limit)
      .offset(query.offset),
    ctx.db.select({ n: count() }).from(e).innerJoin(schema.smePublicProfile, eq(schema.smePublicProfile.id, e.profileId)).where(where),
    ctx.db.select({ status: e.status, n: count() }).from(e).where(eq(e.editionId, edition.id)).groupBy(e.status),
  ]);
  return {
    items: rows.map((r) => b2bItem({ e: r.e, business: r.business, handler: r.handlerId && r.handlerName ? { id: r.handlerId, name: r.handlerName } : null })),
    total: filtered?.n ?? 0,
    byStatus: Object.fromEntries(B2B_STATUSES.map((s) => [s, perStatus.find((r) => r.status === s)?.n ?? 0])),
  };
}

/** Marks an enquiry as followed up, with a note of what was done. */
export async function markB2bHandled(ctx: Ctx, id: string, body: z.infer<typeof B2bHandledBody>): Promise<z.infer<typeof B2bItem>> {
  requireHandler(ctx, "follow up a B2B enquiry");
  const e = schema.b2bEnquiry;
  const updated = await ctx.db.transaction(async (tx) => {
    const [current] = await tx.select().from(e).where(eq(e.id, id)).for("update");
    if (!current) throw new ServiceError("not_found", "No such B2B enquiry.");
    if (current.status === "handled") throw new ServiceError("invalid_transition", "This enquiry is already marked as followed up.");
    const [row] = await tx.update(e).set({ status: "handled", handledBy: ctx.principal.userId, handledAt: ctx.now, handlingNote: body.note ?? null }).where(eq(e.id, id)).returning();
    if (!row) throw new Error("The enquiry was not saved.");
    await recordSummitChange(tx, ctx.principal.userId, {
      action: "summit.directory.enquiry.handled",
      entityType: "b2b_enquiry",
      entityId: id,
      organizationId: null,
      before: { status: "new" },
      after: { status: "handled" },
      reason: body.note ?? null,
    });
    return row;
  });
  const [business] = await ctx.db.select({ name: schema.smePublicProfile.displayName }).from(schema.smePublicProfile).where(eq(schema.smePublicProfile.id, updated.profileId));
  const [handler] = await ctx.db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
  return b2bItem({ e: updated, business: business?.name ?? "", handler: handler ?? null });
}

