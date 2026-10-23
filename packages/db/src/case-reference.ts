import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { caseReferenceCounter } from "./schema";

/** CLR-ET-2026-000145: origin country, year, and the case's number within them. */
export function formatCaseReference(country: string, year: number, number: number): string {
  return `CLR-${country}-${year}-${String(number).padStart(6, "0")}`;
}

/**
 * Takes the next case reference for an origin country and year. Call it in the transaction
 * that inserts the case: the counter row stays locked until it ends, so concurrent cases get
 * consecutive numbers and a rolled-back case gives its number back. A committed number is
 * never handed out again, even after its case is deleted.
 */
export async function allocateCaseReference(
  db: Pick<Database, "insert">,
  { country, year }: { country: string; year: number },
): Promise<string> {
  if (!/^[A-Z]{2}$/.test(country)) throw new Error(`Not an ISO country code: ${country}`);
  const [row] = await db
    .insert(caseReferenceCounter)
    .values({ country, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [caseReferenceCounter.country, caseReferenceCounter.year],
      set: { lastNumber: sql`${caseReferenceCounter.lastNumber} + 1` },
    })
    .returning({ number: caseReferenceCounter.lastNumber });
  if (!row) throw new Error("Case reference counter returned no row");
  return formatCaseReference(country, year, row.number);
}
