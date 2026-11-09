import { and, asc, desc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange } from "./trade-shared";

// What sits under an export transaction (spec 10.3 to 10.5): its events in order, its documents, and its quoted, expected and
// actual costs, kept as revisions. These record what the business says and has done. They don't approve a shipment or certify a cost.

type Tx = typeof schema.exportTransaction.$inferSelect;

async function transactionFor(ctx: Ctx, id: string): Promise<{ tx: Tx; staff: boolean }> {
  const [tx] = await ctx.db.select().from(schema.exportTransaction).where(eq(schema.exportTransaction.id, id));
  const access = tx ? await accessTo(ctx.db, ctx.principal, tx.organizationId) : null;
  if (!tx || !access) throw new ServiceError("not_found", "Transaction not found.");
  return { tx, staff: access.staff };
}
async function writableTransactionFor(ctx: Ctx, id: string) {
  const { tx } = await transactionFor(ctx, id);
  const access = await accessTo(ctx.db, ctx.principal, tx.organizationId);
  if (!access?.write) throw new ServiceError("forbidden", "Write access required.");
  return tx;
}

// ---- Events ----

/** The platform writes a stage change here when a transaction moves, so the order of what happened is kept. */
export async function recordStageChange(db: Executor, tx: Tx, from: string, to: string, userId: string, at: Date): Promise<void> {
  await db.insert(schema.transactionEvent).values({ transactionId: tx.id, organizationId: tx.organizationId, type: "stage_change", summary: `Moved from ${from.replaceAll("_", " ")} to ${to.replaceAll("_", " ")}`, occurredAt: at, createdByUserId: userId });
}

export async function listEvents(ctx: Ctx, transactionId: string) {
  await transactionFor(ctx, transactionId);
  const rows = await ctx.db.select().from(schema.transactionEvent).where(eq(schema.transactionEvent.transactionId, transactionId)).orderBy(desc(schema.transactionEvent.occurredAt));
  return { items: rows.map((e) => ({ id: e.id, type: e.type, summary: e.summary, occurredAt: e.occurredAt.toISOString() })) };
}

export async function addEvent(ctx: Ctx, transactionId: string, input: { type: "note" | "exception" | "payment"; summary: string; occurredAt?: string | undefined }) {
  const tx = await writableTransactionFor(ctx, transactionId);
  const [row] = await ctx.db
    .insert(schema.transactionEvent)
    .values({ transactionId, organizationId: tx.organizationId, type: input.type, summary: input.summary, occurredAt: input.occurredAt ? new Date(input.occurredAt) : ctx.now, createdByUserId: ctx.principal.userId })
    .returning();
  return { id: row!.id, type: row!.type, summary: row!.summary, occurredAt: row!.occurredAt.toISOString() };
}

// ---- Documents ----

const documentView = (d: typeof schema.transactionDocument.$inferSelect) => ({ id: d.id, kind: d.kind, name: d.name, fileId: d.fileId, notes: d.notes, createdAt: d.createdAt.toISOString() });

export async function listDocuments(ctx: Ctx, transactionId: string) {
  await transactionFor(ctx, transactionId);
  const rows = await ctx.db.select().from(schema.transactionDocument).where(eq(schema.transactionDocument.transactionId, transactionId)).orderBy(asc(schema.transactionDocument.createdAt));
  return { items: rows.map(documentView) };
}

export async function addDocument(ctx: Ctx, transactionId: string, input: { kind: (typeof schema.TRANSACTION_DOCUMENT_KINDS)[number]; name: string; fileId?: string | null | undefined; notes?: string | null | undefined }) {
  const tx = await writableTransactionFor(ctx, transactionId);
  if (input.fileId) {
    // The file has to be this business's own.
    const [file] = await ctx.db.select({ organizationId: schema.file.organizationId }).from(schema.file).where(eq(schema.file.id, input.fileId));
    if (!file || file.organizationId !== tx.organizationId) throw new ServiceError("not_found", "File not found.");
  }
  const [row] = await ctx.db
    .insert(schema.transactionDocument)
    .values({ transactionId, organizationId: tx.organizationId, kind: input.kind, name: input.name, fileId: input.fileId ?? null, notes: input.notes ?? null, createdByUserId: ctx.principal.userId })
    .returning();
  await ctx.db.insert(schema.transactionEvent).values({ transactionId, organizationId: tx.organizationId, type: "document", summary: `Added ${input.kind.replaceAll("_", " ")}: ${input.name}`, occurredAt: ctx.now, createdByUserId: ctx.principal.userId });
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.transaction.document_added", organizationId: tx.organizationId, entityType: "export_transaction", entityId: transactionId, after: { kind: input.kind, name: input.name, fileId: input.fileId ?? null } });
  return documentView(row!);
}

export async function removeDocument(ctx: Ctx, transactionId: string, documentId: string) {
  const tx = await writableTransactionFor(ctx, transactionId);
  const [row] = await ctx.db
    .delete(schema.transactionDocument)
    .where(and(eq(schema.transactionDocument.id, documentId), eq(schema.transactionDocument.transactionId, transactionId)))
    .returning();
  if (!row) throw new ServiceError("not_found", "Document not found.");
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.transaction.document_removed", organizationId: tx.organizationId, entityType: "export_transaction", entityId: transactionId, before: { kind: row.kind, name: row.name } });
  return { ok: true as const };
}

// ---- Costs ----

type Cost = typeof schema.transactionCost.$inferSelect;
const costView = (c: Cost) => ({ id: c.id, category: c.category, basis: c.basis, amount: c.amount, currency: c.currency, note: c.note, createdAt: c.createdAt.toISOString() });

/** The newest figure for each category and basis, which is the one that counts. */
function current(rows: Cost[]): Cost[] {
  const seen = new Set<string>();
  const out: Cost[] = [];
  for (const row of [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())) {
    const key = `${row.basis}|${row.category}|${row.currency}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

const cents = (amount: string): number => Math.round(Number(amount) * 100);

export async function listCosts(ctx: Ctx, transactionId: string) {
  await transactionFor(ctx, transactionId);
  const rows = await ctx.db.select().from(schema.transactionCost).where(eq(schema.transactionCost.transactionId, transactionId)).orderBy(desc(schema.transactionCost.createdAt));
  // Totals per basis and currency from the newest figure of each category. Currencies are never added together.
  const totals: { basis: string; currency: string; total: string }[] = [];
  for (const row of current(rows)) {
    const entry = totals.find((t) => t.basis === row.basis && t.currency === row.currency);
    if (entry) entry.total = String((cents(entry.total) + cents(row.amount)) / 100);
    else totals.push({ basis: row.basis, currency: row.currency, total: String(cents(row.amount) / 100) });
  }
  return { revisions: rows.map(costView), current: current(rows).map(costView), totals };
}

export async function addCost(ctx: Ctx, transactionId: string, input: { category: (typeof schema.TRANSACTION_COST_CATEGORIES)[number]; basis: (typeof schema.TRANSACTION_COST_BASES)[number]; amount: number; currency: string; note?: string | null | undefined }) {
  const tx = await writableTransactionFor(ctx, transactionId);
  const [row] = await ctx.db
    .insert(schema.transactionCost)
    .values({ transactionId, organizationId: tx.organizationId, category: input.category, basis: input.basis, amount: input.amount.toFixed(2), currency: input.currency.toUpperCase(), note: input.note ?? null, createdByUserId: ctx.principal.userId })
    .returning();
  await ctx.db.insert(schema.transactionEvent).values({ transactionId, organizationId: tx.organizationId, type: "cost", summary: `${input.basis} ${input.category.replaceAll("_", " ")}: ${input.amount.toFixed(2)} ${input.currency.toUpperCase()}`, occurredAt: ctx.now, createdByUserId: ctx.principal.userId });
  return costView(row!);
}
