import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { VERIFICATION_LADDER_STATUSES, type VerificationLadderStatus } from "@entrust/trade-engine";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange } from "./trade-shared";

// A business's one record of each buyer (spec 10.2): M05's pipeline, M10's register and the export transactions all point at
// it, so a buyer isn't typed three times and has one evidence status. The status uses the verification ladder.

type Buyer = typeof schema.smeBuyer.$inferSelect;

/** What two spellings of one buyer share: lower case, trimmed, runs of spaces squeezed. The migration's backfill does the same in SQL. */
export const nameKeyOf = (name: string): string => name.trim().replace(/\s+/g, " ").toLowerCase();

const rank = (status: string): number => VERIFICATION_LADDER_STATUSES.indexOf(status as VerificationLadderStatus);

/**
 * The business's record of a buyer, made if there isn't one. With a country the match is on name and country; without one
 * (a transaction only names the buyer) it is the business's buyer of that name, wherever it is, and a new one has no country.
 */
export async function ensureBuyer(
  db: Executor,
  organizationId: string,
  input: { name: string; country?: string | null | undefined; website?: string | null | undefined; verificationStatus?: VerificationLadderStatus | undefined },
): Promise<Buyer | null> {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const nameKey = nameKeyOf(name);
  const country = input.country?.trim() ?? "";
  const matches = await db
    .select()
    .from(schema.smeBuyer)
    .where(and(eq(schema.smeBuyer.organizationId, organizationId), eq(schema.smeBuyer.nameKey, nameKey), country ? eq(schema.smeBuyer.country, country) : sql`true`))
    .orderBy(asc(schema.smeBuyer.createdAt))
    .limit(1);
  if (matches[0]) return matches[0];
  // A transaction can name a buyer before the pipeline does, with no country. The first time the country is known it's
  // the same buyer, so the record gets the country rather than a twin.
  if (country) {
    const [placeless] = await db
      .update(schema.smeBuyer)
      .set({ country, ...(input.website ? { website: input.website } : {}) })
      .where(and(eq(schema.smeBuyer.organizationId, organizationId), eq(schema.smeBuyer.nameKey, nameKey), eq(schema.smeBuyer.country, "")))
      .returning();
    if (placeless) return placeless;
  }
  const [created] = await db
    .insert(schema.smeBuyer)
    .values({ organizationId, name, nameKey, country, website: input.website ?? null, verificationStatus: input.verificationStatus ?? "unverified" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(schema.smeBuyer).where(and(eq(schema.smeBuyer.organizationId, organizationId), eq(schema.smeBuyer.nameKey, nameKey), eq(schema.smeBuyer.country, country)));
  return again ?? null;
}

/** An opportunity moved up the ladder, so its buyer does too. The buyer never goes down this way. */
export async function raiseBuyerStatus(db: Executor, buyerId: string | null, status: string): Promise<void> {
  if (!buyerId) return;
  const [buyer] = await db.select({ status: schema.smeBuyer.verificationStatus }).from(schema.smeBuyer).where(eq(schema.smeBuyer.id, buyerId));
  if (buyer && rank(status) > rank(buyer.status)) await db.update(schema.smeBuyer).set({ verificationStatus: status as VerificationLadderStatus }).where(eq(schema.smeBuyer.id, buyerId));
}

const view = (row: Buyer, counts: { opportunities: number; transactions: number }) => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  country: row.country,
  website: row.website,
  contactName: row.contactName,
  contactEmail: row.contactEmail,
  verificationStatus: row.verificationStatus,
  evidenceNote: row.evidenceNote,
  opportunities: counts.opportunities,
  transactions: counts.transactions,
  createdAt: row.createdAt.toISOString(),
});

async function organizationFor(ctx: Ctx, organizationId?: string) {
  const id = organizationId ?? (ctx.principal.smeRoles.size === 1 ? [...ctx.principal.smeRoles.keys()][0] : undefined);
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  const access = await accessTo(ctx.db, ctx.principal, id);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  return { organizationId: id, access };
}

export async function listBuyers(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const buyers = await ctx.db.select().from(schema.smeBuyer).where(eq(schema.smeBuyer.organizationId, organizationId)).orderBy(asc(schema.smeBuyer.name), asc(schema.smeBuyer.country));
  const ids = buyers.map((b) => b.id);
  const opportunities = ids.length ? await ctx.db.select({ buyerId: schema.commercialOpportunity.buyerId }).from(schema.commercialOpportunity).where(inArray(schema.commercialOpportunity.buyerId, ids)) : [];
  const transactions = ids.length ? await ctx.db.select({ buyerId: schema.exportTransaction.buyerId }).from(schema.exportTransaction).where(inArray(schema.exportTransaction.buyerId, ids)) : [];
  const count = (rows: { buyerId: string | null }[], id: string) => rows.filter((r) => r.buyerId === id).length;
  return { organizationId, items: buyers.map((b) => view(b, { opportunities: count(opportunities, b.id), transactions: count(transactions, b.id) })) };
}

export interface BuyerInput {
  name: string;
  country?: string | null | undefined;
  website?: string | null | undefined;
  contactName?: string | null | undefined;
  contactEmail?: string | null | undefined;
}

export async function addBuyer(ctx: Ctx, input: BuyerInput & { organizationId?: string | undefined }) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const before = await ctx.db.select({ id: schema.smeBuyer.id }).from(schema.smeBuyer).where(and(eq(schema.smeBuyer.organizationId, organizationId), eq(schema.smeBuyer.nameKey, nameKeyOf(input.name)), eq(schema.smeBuyer.country, input.country?.trim() ?? "")));
  if (before.length) throw new ServiceError("conflict", "This buyer is already recorded.");
  const buyer = await ensureBuyer(ctx.db, organizationId, input);
  if (!buyer) throw new ServiceError("invalid", "Name the buyer.");
  const [row] = await ctx.db.update(schema.smeBuyer).set({ contactName: input.contactName ?? null, contactEmail: input.contactEmail ?? null }).where(eq(schema.smeBuyer.id, buyer.id)).returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.buyer.added", organizationId, entityType: "buyer", entityId: buyer.id, after: { name: buyer.name, country: buyer.country } });
  return view(row!, { opportunities: 0, transactions: 0 });
}

export interface BuyerChange {
  website?: string | null | undefined;
  contactName?: string | null | undefined;
  contactEmail?: string | null | undefined;
  evidenceNote?: string | null | undefined;
  verificationStatus?: VerificationLadderStatus | undefined;
}

/** A business keeps its buyer's details; only staff set the evidence status by hand, and it carries to the buyer's opportunities. */
export async function updateBuyer(ctx: Ctx, id: string, input: BuyerChange) {
  const [existing] = await ctx.db.select().from(schema.smeBuyer).where(eq(schema.smeBuyer.id, id));
  const access = existing ? await accessTo(ctx.db, ctx.principal, existing.organizationId) : null;
  if (!existing || !access) throw new ServiceError("not_found", "Buyer not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  if (!access.staff && (input.verificationStatus !== undefined || input.evidenceNote !== undefined)) throw new ServiceError("forbidden", "Only Entrust staff can set how far a buyer has been verified.");
  const changesStatus = input.verificationStatus !== undefined && input.verificationStatus !== existing.verificationStatus;
  const [row] = await ctx.db
    .update(schema.smeBuyer)
    .set({ ...input, ...(changesStatus ? { statusChangedByUserId: ctx.principal.userId } : {}) })
    .where(eq(schema.smeBuyer.id, id))
    .returning();
  if (changesStatus) await ctx.db.update(schema.commercialOpportunity).set({ verificationStatus: input.verificationStatus! }).where(eq(schema.commercialOpportunity.buyerId, id));
  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.buyer.updated",
    organizationId: existing.organizationId,
    entityType: "buyer",
    entityId: id,
    before: { verificationStatus: existing.verificationStatus },
    after: { verificationStatus: row!.verificationStatus, changed: Object.keys(input) },
  });
  const [opportunities, transactions] = await Promise.all([
    ctx.db.select({ id: schema.commercialOpportunity.id }).from(schema.commercialOpportunity).where(eq(schema.commercialOpportunity.buyerId, id)),
    ctx.db.select({ id: schema.exportTransaction.id }).from(schema.exportTransaction).where(eq(schema.exportTransaction.buyerId, id)),
  ]);
  return view(row!, { opportunities: opportunities.length, transactions: transactions.length });
}
