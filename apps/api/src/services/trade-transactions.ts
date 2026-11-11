import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { CreateTransactionInput, UpdateTransactionInput } from "../schemas/trade";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange } from "./trade-shared";
import { recordClosedTransaction } from "./trade-sme-record";
import { ensureBuyer } from "./trade-buyers";
import { recordStageChange } from "./trade-transaction-records";

// The Export Transaction Workspace (FR-10, M08): one record per active or planned export, with a reference CLEAR shares when the
// business runs the transaction there. It records what the business says and has done. It doesn't certify compliance or approve a
// shipment, and it belongs to the business, so it outlasts the training.

type Row = typeof schema.exportTransaction.$inferSelect;

const view = (row: Row, clearCase?: { id: string; reference: string; status: string } | null) => ({
  id: row.id,
  organizationId: row.organizationId,
  reference: row.reference,
  isPractice: row.isPractice,
  stage: row.stage,
  product: row.product,
  quantity: row.quantity,
  destination: row.destination,
  buyerName: row.buyerName,
  buyerStatus: row.buyerStatus,
  orderDocument: row.orderDocument,
  agreedPrice: row.agreedPrice,
  currency: row.currency,
  incoterm: row.incoterm,
  namedPlace: row.namedPlace,
  costingAndMargin: row.costingAndMargin,
  paymentTerms: row.paymentTerms,
  paymentRisk: row.paymentRisk,
  productionStatus: row.productionStatus,
  documentChecklist: row.documentChecklist,
  logistics: row.logistics,
  customsStatus: row.customsStatus,
  insuranceStatus: row.insuranceStatus,
  exceptions: row.exceptions,
  outstandingActions: row.outstandingActions,
  responsible: row.responsible,
  paymentStatus: row.paymentStatus,
  actualCosts: row.actualCosts,
  closeout: row.closeout,
  clearCase: clearCase ?? null,
  updatedAt: row.updatedAt.toISOString(),
});

async function organizationFor(ctx: Ctx, organizationId?: string) {
  const id = organizationId ?? (ctx.principal.smeRoles.size === 1 ? [...ctx.principal.smeRoles.keys()][0] : undefined);
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  const access = await accessTo(ctx.db, ctx.principal, id);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  return { organizationId: id, access };
}

/** The business's own real CLEAR cases. Practice cases aren't transactions, and another business's case isn't this one's. */
async function realCases(ctx: Ctx, organizationId: string) {
  return ctx.db
    .select({ id: schema.exportCase.id, reference: schema.exportCase.reference, status: schema.exportCase.status })
    .from(schema.exportCase)
    .where(and(eq(schema.exportCase.organizationId, organizationId), schema.realCase))
    .orderBy(desc(schema.exportCase.createdAt));
}

/** Whether the transaction was at a shipped stage before this change, now or at some point in its history. */
async function everShipped(ctx: Ctx, transaction: typeof schema.exportTransaction.$inferSelect): Promise<boolean> {
  if (SHIPPED_STAGES.includes(transaction.stage)) return true;
  const events = await ctx.db
    .select({ summary: schema.transactionEvent.summary })
    .from(schema.transactionEvent)
    .where(and(eq(schema.transactionEvent.transactionId, transaction.id), eq(schema.transactionEvent.type, "stage_change")));
  return events.some((e) => / to (shipped|delivered)$/.test(e.summary));
}

export async function listTransactions(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const { organizationId } = await organizationFor(ctx, input.organizationId);
  const rows = await ctx.db.select().from(schema.exportTransaction).where(eq(schema.exportTransaction.organizationId, organizationId)).orderBy(desc(schema.exportTransaction.createdAt));
  const cases = await realCases(ctx, organizationId);
  return { organizationId, items: rows.map((row) => view(row, cases.find((c) => c.id === row.clearCaseId))), clearCases: cases };
}

export async function createTransaction(ctx: Ctx, input: CreateTransactionInput) {
  const { organizationId, access } = await organizationFor(ctx, input.organizationId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const reference = `TX-${ctx.now.getUTCFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  const [row] = await ctx.db
    .insert(schema.exportTransaction)
    .values({ organizationId, reference, product: input.product, destination: input.destination ?? null, isPractice: input.isPractice ?? false, createdByUserId: ctx.principal.userId })
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.transaction.created", organizationId, entityType: "export_transaction", entityId: row!.id, after: { reference, product: row!.product, isPractice: row!.isPractice } });
  return view(row!);
}

/** The stage change and the shipment it records are one write: a failure between them can't lose the shipment. */
export async function updateTransaction(ctx: Ctx, id: string, input: UpdateTransactionInput) {
  return ctx.db.transaction((db) => applyTransactionUpdate({ ...ctx, db }, id, input));
}

/** Stages that mean the goods left. Closing from one of them is a completed shipment; closing from earlier is a deal that ended. */
const SHIPPED_STAGES: readonly string[] = ["shipped", "delivered"];

async function applyTransactionUpdate(ctx: Ctx, id: string, input: UpdateTransactionInput) {
  const [existing] = await ctx.db.select().from(schema.exportTransaction).where(eq(schema.exportTransaction.id, id)).for("update");
  const access = existing ? await accessTo(ctx.db, ctx.principal, existing.organizationId) : null;
  if (!existing || !access) throw new ServiceError("not_found", "Transaction not found.");
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");

  const cases = await realCases(ctx, existing.organizationId);
  if (input.clearCaseId && !cases.some((c) => c.id === input.clearCaseId)) throw new ServiceError("not_found", "CLEAR case not found.");

  // A buyer named on the transaction points at the business's one record of that buyer.
  const buyer = input.buyerName && input.buyerName !== existing.buyerName ? await ensureBuyer(ctx.db, existing.organizationId, { name: input.buyerName }) : null;
  const [row] = await ctx.db
    .update(schema.exportTransaction)
    .set({ ...input, ...(buyer ? { buyerId: buyer.id } : input.buyerName === null ? { buyerId: null } : {}), updatedAt: ctx.now })
    .where(eq(schema.exportTransaction.id, id))
    .returning();
  if (row!.stage !== existing.stage) await recordStageChange(ctx.db, row!, existing.stage, row!.stage, ctx.principal.userId, ctx.now);
  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.transaction.updated",
    organizationId: existing.organizationId,
    entityType: "export_transaction",
    entityId: id,
    before: { stage: existing.stage, clearCaseId: existing.clearCaseId },
    after: { stage: row!.stage, clearCaseId: row!.clearCaseId, changed: Object.keys(input) },
  });
  // Closing out a real transaction that shipped is what records a completed shipment on the business's record, which
  // counts as Pathway B evidence. A deal closed at enquiry or quotation never shipped anything.
  if (existing.stage !== "closed" && row!.stage === "closed" && (await everShipped(ctx, existing))) await recordClosedTransaction(ctx, row!);
  return view(row!, cases.find((c) => c.id === row!.clearCaseId));
}
