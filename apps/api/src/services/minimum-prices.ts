import { count, desc, eq, getTableColumns, inArray, max, min, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  checkMinimumPrices,
  parseMinimumPriceCsv,
  type NewMinimumPrice,
  type RawMinimumPrice,
} from "@entrust/gate-engine";
import type { PriceTableCreatedView, PriceTableDetailView, PriceTableSummaryView } from "../schemas/clear";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { fromEngine, ServiceError } from "./errors";
import { syncOpenCases } from "./flags";

// The weekly minimum export prices that ECTA sets for coffee. ECTA doesn't publish them online, so
// an Entrust admin uploads a CSV or types the prices in. Tables are kept: a correction is a new
// table, and the latest one that covers a day decides (see checkMinimumPrice in the GATE engine).

type TableRow = typeof schema.minimumPriceTable.$inferSelect;
type PriceRow = typeof schema.minimumPrice.$inferSelect;

const priceView = (price: PriceRow) => ({
  id: price.id,
  tableId: price.tableId,
  effectiveFrom: price.effectiveFrom,
  effectiveTo: price.effectiveTo,
  coffeeType: price.coffeeType,
  grade: price.grade,
  origin: price.origin,
  currency: price.currency,
  unit: price.unit,
  minPrice: Number(price.minPrice),
});

interface TableStats {
  priceCount: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

const summaryOf = (table: TableRow, stats: TableStats): PriceTableSummaryView => ({
  id: table.id,
  source: table.source,
  label: table.label,
  createdAt: table.createdAt.toISOString(),
  createdByUserId: table.createdByUserId,
  ...stats,
});

/** Entrust staff see the tables; only an admin loads them. */
const READERS = ["admin", "facilitator", "reviewer"] as const;

/** Every table, newest first, without its prices. */
export async function listPriceTables(ctx: Ctx): Promise<PriceTableSummaryView[]> {
  requireStaff(ctx.principal, READERS, "see the minimum export prices");
  const tables = schema.minimumPriceTable;
  const rows = await ctx.db
    .select({
      ...getTableColumns(tables),
      priceCount: count(schema.minimumPrice.id),
      effectiveFrom: min(schema.minimumPrice.effectiveFrom),
      effectiveTo: max(schema.minimumPrice.effectiveTo),
    })
    .from(tables)
    .leftJoin(schema.minimumPrice, eq(schema.minimumPrice.tableId, tables.id))
    .groupBy(tables.id)
    .orderBy(desc(tables.createdAt), desc(tables.id));
  return rows.map(({ priceCount, effectiveFrom, effectiveTo, ...table }) => summaryOf(table, { priceCount, effectiveFrom, effectiveTo }));
}

export async function getPriceTable(ctx: Ctx, tableId: string): Promise<PriceTableDetailView> {
  requireStaff(ctx.principal, READERS, "see the minimum export prices");
  return detailOf(ctx.db, tableId);
}

async function detailOf(db: Executor, tableId: string): Promise<PriceTableDetailView> {
  const [table] = await db.select().from(schema.minimumPriceTable).where(eq(schema.minimumPriceTable.id, tableId));
  if (!table) throw new ServiceError("not_found", "Price table not found.");
  const prices = await db
    .select()
    .from(schema.minimumPrice)
    .where(eq(schema.minimumPrice.tableId, table.id))
    .orderBy(schema.minimumPrice.effectiveFrom, schema.minimumPrice.coffeeType, schema.minimumPrice.grade, schema.minimumPrice.origin);
  return {
    ...summaryOf(table, {
      priceCount: prices.length,
      effectiveFrom: prices.map((p) => p.effectiveFrom).sort()[0] ?? null,
      effectiveTo: prices.map((p) => p.effectiveTo).sort().at(-1) ?? null,
    }),
    prices: prices.map(priceView),
  };
}

/** Records a table typed in. Only an Entrust admin can. */
export function recordPriceTable(ctx: Ctx, input: { label?: string | null; prices: readonly RawMinimumPrice[] }): Promise<PriceTableCreatedView> {
  requireStaff(ctx.principal, ["admin"], "load minimum export prices");
  const prices = fromEngine(() => checkMinimumPrices(input.prices));
  return store(ctx, { source: "manual", label: input.label, prices });
}

/** Records a table from a CSV file's text. Only an Entrust admin can. */
export function recordPriceCsv(ctx: Ctx, input: { csv: string; label?: string | null }): Promise<PriceTableCreatedView> {
  requireStaff(ctx.principal, ["admin"], "load minimum export prices");
  const prices = fromEngine(() => parseMinimumPriceCsv(input.csv));
  return store(ctx, { source: "csv", label: input.label, prices });
}

async function store(
  ctx: Ctx,
  input: { source: TableRow["source"]; label?: string | null; prices: readonly NewMinimumPrice[] },
): Promise<PriceTableCreatedView> {
  const label = input.label?.trim() || null;
  const created = await ctx.db.transaction(async (tx) => {
    const [table] = await tx
      .insert(schema.minimumPriceTable)
      .values({
        source: input.source,
        label,
        createdByUserId: ctx.principal.userId,
        // Not the transaction's start: the latest table that covers a day decides its price.
        createdAt: sql`clock_timestamp()`,
      })
      .returning();
    if (!table) throw new Error("The price table was not saved");
    await tx.insert(schema.minimumPrice).values(
      input.prices.map((p) => ({
        tableId: table.id,
        effectiveFrom: p.effectiveFrom,
        effectiveTo: p.effectiveTo,
        coffeeType: p.coffeeType,
        grade: p.grade,
        origin: p.origin,
        currency: p.currency,
        unit: p.unit,
        minPrice: String(p.minPrice),
      })),
    );
    const detail = await detailOf(tx, table.id);
    await tx.insert(schema.auditLog).values({
      actorUserId: ctx.principal.userId,
      platform: "clear",
      action: "minimum_price_table.record",
      entityType: "minimum_price_table",
      entityId: table.id,
      after: { source: detail.source, label, priceCount: detail.priceCount, effectiveFrom: detail.effectiveFrom, effectiveTo: detail.effectiveTo },
    });
    return detail;
  });

  return { ...created, casesRechecked: await recheckCases(ctx, input.prices) };
}

/**
 * The new prices may decide cases that were waiting with "no minimum price on file", or change the
 * answer for ones already checked. Looks at the open cases whose contract is for a coffee the table
 * prices on a day it covers, and runs their checks again. Returns how many it looked at.
 */
async function recheckCases(ctx: Ctx, prices: readonly NewMinimumPrice[]): Promise<number> {
  const contracts = await ctx.db
    .select({
      caseId: schema.exportCase.id,
      contractDate: schema.salesContract.contractDate,
      coffeeType: schema.salesContract.coffeeType,
      grade: schema.salesContract.grade,
    })
    .from(schema.exportCase)
    .innerJoin(schema.salesContract, eq(schema.exportCase.salesContractId, schema.salesContract.id))
    .where(inArray(schema.exportCase.status, ["open", "amendments_pending"]));

  const affected = contracts
    .filter((c) =>
      prices.some(
        (p) =>
          p.coffeeType === c.coffeeType &&
          p.grade.toLowerCase() === c.grade?.trim().toLowerCase() &&
          p.effectiveFrom <= c.contractDate &&
          c.contractDate <= p.effectiveTo,
      ),
    )
    .map((c) => c.caseId);
  if (affected.length === 0) return 0;

  const result = await syncOpenCases(ctx.db, ctx.now, { only: affected });
  return result.checked;
}
