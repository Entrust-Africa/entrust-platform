import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { accessTo, assignedOrganizationIds, limitedToAssignedCohorts, recordTradeChange } from "./trade-shared";
import type { Executor } from "./db";

// The SME record (architecture spec sections 5 and 6.7): the completed shipments a business has made and how far each has been
// checked, the pathway reviews they raise, the products it sells, and its profile with a history of changes. It records what the
// business says and what staff have checked. Nothing here changes a pathway, a score or a plan.

type History = typeof schema.smeExportHistory.$inferSelect;
type Product = typeof schema.smeProduct.$inferSelect;
type Review = typeof schema.pathwayReview.$inferSelect;

/** Which organisation a request is about: the one named, or the caller's only one. */
async function organizationFor(ctx: Ctx, organizationId?: string) {
  const id = organizationId ?? (ctx.principal.smeRoles.size === 1 ? [...ctx.principal.smeRoles.keys()][0] : undefined);
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  const access = await accessTo(ctx.db, ctx.principal, id);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  return { organizationId: id, access };
}

const writeAccess = (access: { write: boolean }) => {
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
};

// ---- Completed shipments ----

const historyView = (row: History) => ({
  id: row.id,
  organizationId: row.organizationId,
  transactionId: row.transactionId,
  product: row.product,
  destination: row.destination,
  buyerName: row.buyerName,
  shipmentDate: row.shipmentDate,
  evidenceStatus: row.evidenceStatus,
  evidenceNote: row.evidenceNote,
  createdAt: row.createdAt.toISOString(),
});

export async function listExportHistory(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const rows = await ctx.db.select().from(schema.smeExportHistory).where(eq(schema.smeExportHistory.organizationId, organizationId)).orderBy(desc(schema.smeExportHistory.createdAt));
  return { organizationId, items: rows.map(historyView) };
}

/**
 * The business's first completed shipment asks staff to look at the pathway of each enrolment that is still running. A review is
 * only a flag: it never changes the pathway.
 */
async function flagPathwayReview(db: Executor, organizationId: string, history: History): Promise<void> {
  const enrolments = await db
    .select({ id: schema.enrollment.id })
    .from(schema.enrollment)
    .where(and(eq(schema.enrollment.organizationId, organizationId), inArray(schema.enrollment.status, ["invited", "registered", "active", "paused"])));
  for (const enrolment of enrolments) {
    await db.insert(schema.pathwayReview).values({ enrollmentId: enrolment.id, exportHistoryId: history.id }).onConflictDoNothing();
  }
}

async function insertHistory(
  ctx: Ctx,
  organizationId: string,
  values: Pick<typeof schema.smeExportHistory.$inferInsert, "product" | "destination" | "buyerName" | "shipmentDate" | "evidenceStatus" | "evidenceNote" | "transactionId">,
): Promise<History> {
  const earlier = await ctx.db.select({ id: schema.smeExportHistory.id }).from(schema.smeExportHistory).where(eq(schema.smeExportHistory.organizationId, organizationId)).limit(1);
  const [row] = await ctx.db
    .insert(schema.smeExportHistory)
    .values({ ...values, organizationId, recordedByUserId: ctx.principal.userId })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new ServiceError("conflict", "This shipment is already recorded.");
  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.export_history.recorded",
    organizationId,
    entityType: "export_history",
    entityId: row.id,
    after: { product: row.product, evidenceStatus: row.evidenceStatus, transactionId: row.transactionId },
  });
  if (earlier.length === 0) await flagPathwayReview(ctx.db, organizationId, row);
  return row;
}

/**
 * Called when a real transaction is closed out. A practice transaction records nothing, and a transaction records one
 * shipment however many times it is closed. A confirmed order is not a shipment.
 */
export async function recordClosedTransaction(ctx: Ctx, transaction: typeof schema.exportTransaction.$inferSelect): Promise<void> {
  if (transaction.isPractice || transaction.stage !== "closed") return;
  const [existing] = await ctx.db.select({ id: schema.smeExportHistory.id }).from(schema.smeExportHistory).where(eq(schema.smeExportHistory.transactionId, transaction.id));
  if (existing) return;
  await insertHistory(ctx, transaction.organizationId, {
    transactionId: transaction.id,
    product: transaction.product,
    destination: transaction.destination,
    buyerName: transaction.buyerName,
    evidenceStatus: "self_reported",
  });
}

export interface AddShipmentInput {
  organizationId?: string | undefined;
  product: string;
  destination?: string | null | undefined;
  buyerName?: string | null | undefined;
  shipmentDate?: string | null | undefined;
  evidenceStatus?: (typeof schema.EXPORT_EVIDENCE_STATUSES)[number] | undefined;
  evidenceNote?: string | null | undefined;
}

/** A shipment from before the business used the platform. A business reports it as `self_reported`; only staff can record it as checked. */
export async function addExportHistory(ctx: Ctx, input: AddShipmentInput) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  writeAccess(access);
  const requested = input.evidenceStatus ?? "self_reported";
  if (!access.staff && requested !== "self_reported") throw new ServiceError("forbidden", "Only Entrust staff can record a shipment as supported by documents or verified.");
  const row = await insertHistory(ctx, organizationId, {
    product: input.product,
    destination: input.destination ?? null,
    buyerName: input.buyerName ?? null,
    shipmentDate: input.shipmentDate ?? null,
    evidenceStatus: requested,
    evidenceNote: input.evidenceNote ?? null,
  });
  return historyView(row);
}

export interface UpdateShipmentInput {
  product?: string | undefined;
  destination?: string | null | undefined;
  buyerName?: string | null | undefined;
  shipmentDate?: string | null | undefined;
  evidenceStatus?: (typeof schema.EXPORT_EVIDENCE_STATUSES)[number] | undefined;
  evidenceNote?: string | null | undefined;
}

export async function updateExportHistory(ctx: Ctx, id: string, input: UpdateShipmentInput) {
  const [existing] = await ctx.db.select().from(schema.smeExportHistory).where(eq(schema.smeExportHistory.id, id));
  const access = existing ? await accessTo(ctx.db, ctx.principal, existing.organizationId) : null;
  if (!existing || !access) throw new ServiceError("not_found", "Shipment not found.");
  writeAccess(access);
  // A business can correct what it said, but a shipment staff have checked stays as they left it, and only staff move the status.
  if (!access.staff && (input.evidenceStatus !== undefined || input.evidenceNote !== undefined)) throw new ServiceError("forbidden", "Only Entrust staff can change how far a shipment has been checked.");
  if (!access.staff && existing.evidenceStatus !== "self_reported") throw new ServiceError("forbidden", "Entrust has checked this shipment, so only staff can change it.");
  const [row] = await ctx.db
    .update(schema.smeExportHistory)
    .set({ ...input, ...(input.evidenceStatus && input.evidenceStatus !== existing.evidenceStatus ? { statusChangedByUserId: ctx.principal.userId } : {}) })
    .where(eq(schema.smeExportHistory.id, id))
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.export_history.updated",
    organizationId: existing.organizationId,
    entityType: "export_history",
    entityId: id,
    before: { evidenceStatus: existing.evidenceStatus, shipmentDate: existing.shipmentDate },
    after: { evidenceStatus: row!.evidenceStatus, shipmentDate: row!.shipmentDate, changed: Object.keys(input) },
  });
  return historyView(row!);
}

// ---- Pathway reviews ----

const reviewView = (row: Review, extra: { organizationId: string; organizationName: string; cohortId: string; shipment: { product: string; evidenceStatus: string } | null }) => ({
  id: row.id,
  enrollmentId: row.enrollmentId,
  organizationId: extra.organizationId,
  organizationName: extra.organizationName,
  cohortId: extra.cohortId,
  status: row.status,
  shipment: extra.shipment,
  resolution: row.resolution,
  createdAt: row.createdAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
});

function requireStaffCaller(ctx: Ctx): void {
  if (!ctx.principal.staffRole) throw new ServiceError("forbidden", "Only Entrust staff can see pathway reviews.");
}

export async function listPathwayReviews(ctx: Ctx, input: { cohortId?: string | undefined; status?: "open" | "resolved" | undefined }) {
  requireStaffCaller(ctx);
  const conditions = [];
  if (input.status) conditions.push(eq(schema.pathwayReview.status, input.status));
  if (input.cohortId) conditions.push(eq(schema.enrollment.cohortId, input.cohortId));
  if (limitedToAssignedCohorts(ctx.principal)) {
    const organizations = await assignedOrganizationIds(ctx.db, ctx.principal.userId);
    if (organizations.length === 0) return { items: [] };
    conditions.push(inArray(schema.enrollment.organizationId, organizations));
  }
  const rows = await ctx.db
    .select({
      review: schema.pathwayReview,
      organizationId: schema.enrollment.organizationId,
      cohortId: schema.enrollment.cohortId,
      organizationName: schema.organization.name,
      product: schema.smeExportHistory.product,
      evidenceStatus: schema.smeExportHistory.evidenceStatus,
    })
    .from(schema.pathwayReview)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.pathwayReview.enrollmentId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .leftJoin(schema.smeExportHistory, eq(schema.smeExportHistory.id, schema.pathwayReview.exportHistoryId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(schema.pathwayReview.status), desc(schema.pathwayReview.createdAt));
  return {
    items: rows.map((r) =>
      reviewView(r.review, { organizationId: r.organizationId, organizationName: r.organizationName, cohortId: r.cohortId, shipment: r.product ? { product: r.product, evidenceStatus: r.evidenceStatus! } : null }),
    ),
  };
}

/** Staff have looked at the pathway. This records that and nothing else: confirming or changing the pathway is a separate step. */
export async function resolvePathwayReview(ctx: Ctx, id: string, input: { resolution: string }) {
  requireStaffCaller(ctx);
  if (ctx.principal.staffRole === "reviewer") throw new ServiceError("forbidden", "Write access required.");
  const [found] = await ctx.db
    .select({ review: schema.pathwayReview, organizationId: schema.enrollment.organizationId, cohortId: schema.enrollment.cohortId, organizationName: schema.organization.name })
    .from(schema.pathwayReview)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.pathwayReview.enrollmentId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .where(eq(schema.pathwayReview.id, id));
  if (!found || !(await accessTo(ctx.db, ctx.principal, found.organizationId))) throw new ServiceError("not_found", "Review not found.");
  if (found.review.status === "resolved") throw new ServiceError("invalid_transition", "This review is already resolved.");
  const [row] = await ctx.db
    .update(schema.pathwayReview)
    .set({ status: "resolved", resolvedByUserId: ctx.principal.userId, resolvedAt: ctx.now, resolution: input.resolution })
    .where(eq(schema.pathwayReview.id, id))
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.pathway_review.resolved",
    organizationId: found.organizationId,
    entityType: "enrollment",
    entityId: found.review.enrollmentId,
    reason: input.resolution,
  });
  return reviewView(row!, { organizationId: found.organizationId, organizationName: found.organizationName, cohortId: found.cohortId, shipment: null });
}

// ---- Products ----

const productView = (row: Product) => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  description: row.description,
  category: row.category,
  hsCode: row.hsCode,
  archived: row.archivedAt !== null,
  createdAt: row.createdAt.toISOString(),
});

export async function listProducts(ctx: Ctx, input: { organizationId?: string | undefined; includeArchived?: boolean | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const rows = await ctx.db
    .select()
    .from(schema.smeProduct)
    .where(input.includeArchived ? eq(schema.smeProduct.organizationId, organizationId) : and(eq(schema.smeProduct.organizationId, organizationId), isNull(schema.smeProduct.archivedAt)))
    .orderBy(asc(schema.smeProduct.name));
  return { organizationId, items: rows.map(productView) };
}

export interface ProductInput {
  name: string;
  description?: string | null | undefined;
  category?: string | null | undefined;
  hsCode?: string | null | undefined;
}

export async function addProduct(ctx: Ctx, input: ProductInput & { organizationId?: string | undefined }) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  writeAccess(access);
  const [row] = await ctx.db
    .insert(schema.smeProduct)
    .values({ organizationId, name: input.name, description: input.description ?? null, category: input.category ?? null, hsCode: input.hsCode ?? null, createdByUserId: ctx.principal.userId })
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.product.added", organizationId, entityType: "product", entityId: row!.id, after: { name: row!.name } });
  return productView(row!);
}

export async function updateProduct(ctx: Ctx, id: string, input: Partial<ProductInput> & { archived?: boolean | undefined }) {
  const [existing] = await ctx.db.select().from(schema.smeProduct).where(eq(schema.smeProduct.id, id));
  const access = existing ? await accessTo(ctx.db, ctx.principal, existing.organizationId) : null;
  if (!existing || !access) throw new ServiceError("not_found", "Product not found.");
  writeAccess(access);
  const { archived, ...fields } = input;
  const [row] = await ctx.db
    .update(schema.smeProduct)
    .set({ ...fields, ...(archived === undefined ? {} : { archivedAt: archived ? ctx.now : null }) })
    .where(eq(schema.smeProduct.id, id))
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.product.updated", organizationId: existing.organizationId, entityType: "product", entityId: id, before: { name: existing.name, archived: existing.archivedAt !== null }, after: { name: row!.name, archived: row!.archivedAt !== null } });
  return productView(row!);
}

// ---- The business profile ----

/** What the business may correct itself, and which of those are material enough to flag in its history. */
export const PROFILE_FIELDS = {
  legalName: { label: "Legal name", material: true },
  tradingName: { label: "Trading name", material: false },
  registrationNumber: { label: "Registration number", material: true },
  tin: { label: "Tax identification number", material: true },
  sector: { label: "Sector", material: true },
  yearEstablished: { label: "Year established", material: false },
  ownershipType: { label: "Ownership type", material: false },
  businessEmail: { label: "Business email", material: false },
  businessPhone: { label: "Business phone", material: false },
  address: { label: "Address", material: false },
  website: { label: "Website", material: false },
  socialPages: { label: "Social pages", material: false },
  mainActivity: { label: "Main activity", material: false },
  permanentEmployees: { label: "Permanent employees", material: false },
  temporaryEmployees: { label: "Temporary employees", material: false },
  womanOwned: { label: "Woman-owned", material: false },
  premises: { label: "Premises", material: false },
} as const;
export type ProfileField = keyof typeof PROFILE_FIELDS;

const profileView = (row: typeof schema.smeProfile.$inferSelect) => ({
  organizationId: row.organizationId,
  smeId: row.smeId,
  country: row.country,
  ...(Object.fromEntries((Object.keys(PROFILE_FIELDS) as ProfileField[]).map((field) => [field, row[field] ?? null])) as Record<ProfileField, string | number | boolean | null>),
});

export async function getBusinessProfile(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const [row] = await ctx.db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, organizationId));
  if (!row) throw new ServiceError("not_found", "This organisation has no business profile.");
  return profileView(row);
}

export async function updateBusinessProfile(ctx: Ctx, input: { organizationId?: string | undefined; changes: Partial<Record<ProfileField, string | number | boolean | null>> }) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  writeAccess(access);
  const [existing] = await ctx.db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, organizationId));
  if (!existing) throw new ServiceError("not_found", "This organisation has no business profile.");

  const changed = (Object.keys(input.changes) as ProfileField[]).filter((field) => (existing[field] ?? null) !== (input.changes[field] ?? null));
  if (changed.length === 0) return profileView(existing);
  if (changed.includes("legalName") && !String(input.changes.legalName ?? "").trim()) throw new ServiceError("invalid", "A business needs a legal name.");

  let row;
  try {
    [row] = await ctx.db
      .update(schema.smeProfile)
      .set(Object.fromEntries(changed.map((field) => [field, input.changes[field] ?? null])))
      .where(eq(schema.smeProfile.organizationId, organizationId))
      .returning();
  } catch (error) {
    // The registration number is unique within a country, so one that another business holds is refused.
    if (String((error as { cause?: { code?: string } }).cause?.code ?? (error as { code?: string }).code) === "23505") throw new ServiceError("conflict", "Another business is registered with that registration number.");
    throw error;
  }
  await ctx.db.insert(schema.smeProfileChange).values(
    changed.map((field) => ({
      organizationId,
      changedByUserId: ctx.principal.userId,
      field,
      oldValue: existing[field] === null || existing[field] === undefined ? null : String(existing[field]),
      newValue: input.changes[field] === null || input.changes[field] === undefined ? null : String(input.changes[field]),
      material: PROFILE_FIELDS[field].material,
    })),
  );
  if (changed.some((field) => PROFILE_FIELDS[field].material)) {
    await recordTradeChange(ctx.db, ctx.principal.userId, {
      action: "trade.profile.material_change",
      organizationId,
      entityType: "sme_profile",
      entityId: existing.id,
      after: { fields: changed.filter((field) => PROFILE_FIELDS[field].material) },
    });
  }
  return profileView(row!);
}

export async function businessProfileHistory(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const rows = await ctx.db
    .select({ change: schema.smeProfileChange, changedBy: schema.user.name })
    .from(schema.smeProfileChange)
    .leftJoin(schema.user, eq(schema.user.id, schema.smeProfileChange.changedByUserId))
    .where(eq(schema.smeProfileChange.organizationId, organizationId))
    .orderBy(desc(schema.smeProfileChange.changedAt))
    .limit(200);
  return {
    organizationId,
    items: rows.map(({ change, changedBy }) => ({
      id: change.id,
      field: change.field,
      label: PROFILE_FIELDS[change.field as ProfileField]?.label ?? change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      material: change.material,
      changedBy,
      changedAt: change.changedAt.toISOString(),
    })),
  };
}
