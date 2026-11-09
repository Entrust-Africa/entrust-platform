import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { notify, organizationMemberIds } from "./trade-notifications";
import { accessTo, assignedOrganizationIds, limitedToAssignedCohorts, recordTradeChange } from "./trade-shared";
import { getBusinessProfile, listExportHistory, listProducts } from "./trade-sme-record";
import { sharedWorksheets } from "./trade-worksheets";

// Partner referrals (FRD FR-13): staff refer a business to a bank, an insurer or a service provider. The business has to agree to
// that recipient, for that purpose and for those kinds of information before anything is released, and can withdraw at any time.
// TRADE records the referral, the consent and what was released. It sends nothing to a partner by itself: the package is for staff
// to pass on, and there is no partner access yet.

type Referral = typeof schema.partnerReferral.$inferSelect;
export type ReferralDataKind = (typeof schema.REFERRAL_DATA_KINDS)[number];
type Status = (typeof schema.REFERRAL_STATUSES)[number];

const view = (r: Referral, org: { name: string }, responsible: string | null) => ({
  id: r.id,
  organizationId: r.organizationId,
  organizationName: org.name,
  destinationName: r.destinationName,
  destinationType: r.destinationType,
  reason: r.reason,
  sharedDataKinds: r.sharedDataKinds as ReferralDataKind[],
  consentStatus: r.consentStatus,
  consentAt: r.consentAt?.toISOString() ?? null,
  status: r.status,
  referralDate: r.referralDate,
  responsible,
  outcome: r.outcome,
  createdAt: r.createdAt.toISOString(),
});

async function hydrate(ctx: Ctx, rows: Referral[]) {
  if (rows.length === 0) return [];
  const orgs = await ctx.db.select({ id: schema.organization.id, name: schema.organization.name }).from(schema.organization).where(inArray(schema.organization.id, [...new Set(rows.map((r) => r.organizationId))]));
  const userIds = [...new Set(rows.map((r) => r.responsibleUserId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length ? await ctx.db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, userIds)) : [];
  return rows.map((r) => view(r, { name: orgs.find((o) => o.id === r.organizationId)?.name ?? "" }, users.find((u) => u.id === r.responsibleUserId)?.name ?? null));
}

function requireStaffWriter(ctx: Ctx, doing: string): void {
  if (!ctx.principal.staffRole || ctx.principal.staffRole === "reviewer") throw new ServiceError("forbidden", `Only a Super Admin or Cohort Manager can ${doing}.`);
}

async function load(ctx: Ctx, id: string) {
  const [referral] = await ctx.db.select().from(schema.partnerReferral).where(eq(schema.partnerReferral.id, id));
  const access = referral ? await accessTo(ctx.db, ctx.principal, referral.organizationId) : null;
  if (!referral || !access) throw new ServiceError("not_found", "Referral not found.");
  return { referral, access };
}

async function record(ctx: Ctx, referral: Referral, type: string, note?: string | null, detail?: Record<string, unknown>) {
  await ctx.db.insert(schema.partnerReferralEvent).values({ referralId: referral.id, type, note: note ?? null, detail: detail ?? null, actorUserId: ctx.principal.userId });
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: `trade.referral.${type}`, organizationId: referral.organizationId, entityType: "referral", entityId: referral.id, ...(note ? { reason: note } : {}) });
}

const tellBusiness = (ctx: Ctx, referral: Referral, title: string, body: string) =>
  organizationMemberIds(ctx.db, referral.organizationId).then((userIds) => notify(ctx.db, { userIds, kind: "referral_status", title, body, path: "/business", organizationId: referral.organizationId }));

// ---- Reading ----

export async function listReferrals(ctx: Ctx, input: { organizationId?: string | undefined; status?: Status | undefined }) {
  const conditions = [];
  if (input.status) conditions.push(eq(schema.partnerReferral.status, input.status));
  if (input.organizationId) {
    if (!(await accessTo(ctx.db, ctx.principal, input.organizationId))) throw new ServiceError("not_found", "Organisation not found.");
    conditions.push(eq(schema.partnerReferral.organizationId, input.organizationId));
  } else if (ctx.principal.staffRole) {
    if (limitedToAssignedCohorts(ctx.principal)) {
      const organizations = await assignedOrganizationIds(ctx.db, ctx.principal.userId);
      if (organizations.length === 0) return { items: [] };
      conditions.push(inArray(schema.partnerReferral.organizationId, organizations));
    }
  } else {
    const own = [...ctx.principal.smeRoles.keys()];
    if (own.length === 0) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
    conditions.push(inArray(schema.partnerReferral.organizationId, own));
  }
  const rows = await ctx.db.select().from(schema.partnerReferral).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(schema.partnerReferral.createdAt));
  // A business doesn't see a referral staff are still drafting.
  const visible = ctx.principal.staffRole ? rows : rows.filter((r) => r.status !== "draft");
  return { items: await hydrate(ctx, visible) };
}

export async function referralEvents(ctx: Ctx, id: string) {
  const { referral } = await load(ctx, id);
  if (!ctx.principal.staffRole && referral.status === "draft") throw new ServiceError("not_found", "Referral not found.");
  const rows = await ctx.db.select().from(schema.partnerReferralEvent).where(eq(schema.partnerReferralEvent.referralId, id)).orderBy(desc(schema.partnerReferralEvent.createdAt));
  return { items: rows.map((e) => ({ id: e.id, type: e.type, note: e.note, detail: e.detail, createdAt: e.createdAt.toISOString() })) };
}

// ---- Staff ----

export interface CreateReferralInput {
  organizationId: string;
  destinationName: string;
  destinationType: (typeof schema.REFERRAL_DESTINATION_TYPES)[number];
  reason: string;
  sharedDataKinds: ReferralDataKind[];
  responsibleUserId?: string | null | undefined;
}

export async function createReferral(ctx: Ctx, input: CreateReferralInput) {
  requireStaffWriter(ctx, "refer a business");
  if (!(await accessTo(ctx.db, ctx.principal, input.organizationId))) throw new ServiceError("not_found", "Organisation not found.");
  const [row] = await ctx.db
    .insert(schema.partnerReferral)
    .values({ organizationId: input.organizationId, destinationName: input.destinationName, destinationType: input.destinationType, reason: input.reason, sharedDataKinds: [...new Set(input.sharedDataKinds)], responsibleUserId: input.responsibleUserId ?? ctx.principal.userId, createdByUserId: ctx.principal.userId })
    .returning();
  await record(ctx, row!, "created", input.reason, { kinds: row!.sharedDataKinds });
  return (await hydrate(ctx, [row!]))[0]!;
}

/** Asks the business to agree. It sees what would be shared, with whom and why, and chooses. */
export async function requestConsent(ctx: Ctx, id: string) {
  requireStaffWriter(ctx, "ask for consent");
  const { referral } = await load(ctx, id);
  if (!["draft", "awaiting_consent"].includes(referral.status) || referral.consentStatus === "granted") throw new ServiceError("invalid_transition", "This referral isn't waiting for consent.");
  const [row] = await ctx.db.update(schema.partnerReferral).set({ status: "awaiting_consent", consentStatus: "requested", referralDate: ctx.now.toISOString().slice(0, 10) }).where(eq(schema.partnerReferral.id, id)).returning();
  await record(ctx, row!, "consent_requested");
  const kinds = row!.sharedDataKinds.length ? row!.sharedDataKinds.map((k) => k.replaceAll("_", " ")).join(", ") : "no business information";
  await tellBusiness(ctx, row!, `Entrust would like to refer you to ${row!.destinationName}`, `Reason: ${row!.reason}. They would receive: ${kinds}. Nothing is shared unless you agree. Open your business page to decide.`);
  return (await hydrate(ctx, [row!]))[0]!;
}

export async function setReferralStatus(ctx: Ctx, id: string, input: { status: "accepted" | "declined" | "completed" | "closed"; outcome?: string | null | undefined }) {
  requireStaffWriter(ctx, "update a referral");
  const { referral } = await load(ctx, id);
  const allowed: Record<string, Status[]> = { shared: ["accepted", "declined", "closed"], accepted: ["completed", "closed"], declined: ["closed"], awaiting_consent: ["closed"], ready: ["closed"], draft: ["closed"] };
  if (!allowed[referral.status]?.includes(input.status)) throw new ServiceError("invalid_transition", `A referral that is ${referral.status.replaceAll("_", " ")} can't be marked ${input.status}.`);
  const [row] = await ctx.db.update(schema.partnerReferral).set({ status: input.status, ...(input.outcome !== undefined ? { outcome: input.outcome } : {}) }).where(eq(schema.partnerReferral.id, id)).returning();
  await record(ctx, row!, `status_${input.status}`, input.outcome ?? null);
  await tellBusiness(ctx, row!, `Your referral to ${row!.destinationName} is ${input.status}`, input.outcome ? `Outcome: ${input.outcome}` : `Its status is now ${input.status}.`);
  return (await hydrate(ctx, [row!]))[0]!;
}

// ---- The business ----

/** The business agrees, declines, or withdraws. Only an owner decides, and only for this recipient and purpose. */
export async function decideConsent(ctx: Ctx, id: string, input: { decision: "grant" | "decline" | "withdraw" }) {
  const { referral } = await load(ctx, id);
  if (ctx.principal.staffRole || ctx.principal.smeRoles.get(referral.organizationId) !== "owner") throw new ServiceError("forbidden", "Only an owner of the business can give or withdraw consent.");
  if (referral.status === "draft") throw new ServiceError("not_found", "Referral not found.");
  const now = ctx.now;
  let patch: Partial<Referral>;
  if (input.decision === "grant") {
    if (referral.consentStatus !== "requested") throw new ServiceError("invalid_transition", "There is no request to agree to.");
    patch = { consentStatus: "granted", consentAt: now, consentByUserId: ctx.principal.userId, status: "ready" };
  } else if (input.decision === "decline") {
    if (referral.consentStatus !== "requested") throw new ServiceError("invalid_transition", "There is no request to decline.");
    patch = { consentStatus: "declined", consentAt: now, consentByUserId: ctx.principal.userId, status: "closed", outcome: "The business declined to share its information." };
  } else {
    if (referral.consentStatus !== "granted") throw new ServiceError("invalid_transition", "There is no consent to withdraw.");
    patch = { consentStatus: "withdrawn", consentAt: now, consentByUserId: ctx.principal.userId, status: referral.status === "completed" ? "completed" : "closed" };
  }
  const [row] = await ctx.db.update(schema.partnerReferral).set(patch).where(eq(schema.partnerReferral.id, id)).returning();
  await record(ctx, row!, `consent_${input.decision === "grant" ? "granted" : input.decision === "decline" ? "declined" : "withdrawn"}`);
  // Staff who made the referral learn the answer.
  if (referral.createdByUserId) {
    await notify(ctx.db, {
      userIds: [referral.createdByUserId, ...(referral.responsibleUserId ? [referral.responsibleUserId] : [])],
      kind: "referral_status",
      title: `${row!.consentStatus === "granted" ? "Consent given" : row!.consentStatus === "declined" ? "Consent declined" : "Consent withdrawn"}: ${row!.destinationName}`,
      body: `The business ${row!.consentStatus === "granted" ? "agreed to" : row!.consentStatus === "declined" ? "declined" : "withdrew its agreement to"} the referral to ${row!.destinationName}.`,
      path: "/referrals",
      organizationId: row!.organizationId,
    });
  }
  return (await hydrate(ctx, [row!]))[0]!;
}

// ---- Releasing information ----

/**
 * The information the business agreed to release, and nothing else. Refused unless consent is granted now: before it is asked,
 * after a refusal, and after a withdrawal. Every release is recorded with the kinds it held.
 */
export async function referralPackage(ctx: Ctx, id: string) {
  requireStaffWriter(ctx, "release a referral's information");
  const { referral } = await load(ctx, id);
  if (referral.consentStatus !== "granted") throw new ServiceError("forbidden", "The business hasn't agreed to share its information for this referral.");
  const kinds = referral.sharedDataKinds as ReferralDataKind[];
  const content: Record<string, unknown> = {};
  if (kinds.includes("profile")) content.profile = await getBusinessProfile(ctx, { organizationId: referral.organizationId });
  if (kinds.includes("products")) content.products = (await listProducts(ctx, { organizationId: referral.organizationId })).items;
  if (kinds.includes("export_history")) content.exportHistory = (await listExportHistory(ctx, { organizationId: referral.organizationId })).items;
  if (kinds.includes("financial_worksheets")) {
    const [enrollment] = await ctx.db.select({ id: schema.enrollment.id }).from(schema.enrollment).where(eq(schema.enrollment.organizationId, referral.organizationId)).orderBy(desc(schema.enrollment.createdAt)).limit(1);
    content.financialWorksheets = enrollment ? await sharedWorksheets(ctx.db, enrollment.id, "financial_worksheets") : [];
  }
  const released = await ctx.db.update(schema.partnerReferral).set({ status: referral.status === "ready" ? "shared" : referral.status }).where(eq(schema.partnerReferral.id, id)).returning();
  await record(ctx, released[0]!, "package_released", null, { kinds });
  return { referralId: id, destinationName: referral.destinationName, purpose: referral.reason, consentAt: referral.consentAt?.toISOString() ?? null, kinds, ...content };
}
