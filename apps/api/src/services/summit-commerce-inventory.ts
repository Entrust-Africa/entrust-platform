import { and, count, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { BOOKING_HOLDS_BOOTH } from "@entrust/summit-engine";
import type { Executor } from "./db";

/**
 * How many of each product of an edition are taken: the approved and confirmed exhibitor bookings for a package, and
 * confirmed sponsors for a level or opportunity and (as that flow is added) the registered delegates for a category. A pending application takes nothing, so it can't use up a booth before an administrator approves it.
 */
export async function takenCounts(db: Executor, editionId: string): Promise<Map<string, number>> {
  const booths = await db
    .select({ productId: schema.exhibitorBooking.productId, n: count() })
    .from(schema.exhibitorBooking)
    .where(and(eq(schema.exhibitorBooking.editionId, editionId), inArray(schema.exhibitorBooking.status, [...BOOKING_HOLDS_BOOTH])))
    .groupBy(schema.exhibitorBooking.productId);
  const sponsors = await db
    .select({ productId: schema.sponsorEnquiry.productId, n: count() })
    .from(schema.sponsorEnquiry)
    .where(and(eq(schema.sponsorEnquiry.editionId, editionId), eq(schema.sponsorEnquiry.status, "confirmed")))
    .groupBy(schema.sponsorEnquiry.productId);
  const taken = new Map(booths.map((row) => [row.productId, row.n]));
  for (const row of sponsors) taken.set(row.productId, (taken.get(row.productId) ?? 0) + row.n);
  return taken;
}

/** How many sponsors are confirmed for a level or opportunity right now, not counting `except`. */
export async function confirmedSponsors(db: Executor, productId: string, except?: string): Promise<number> {
  const rows = await db
    .select({ id: schema.sponsorEnquiry.id })
    .from(schema.sponsorEnquiry)
    .where(and(eq(schema.sponsorEnquiry.productId, productId), eq(schema.sponsorEnquiry.status, "confirmed")));
  return rows.filter((row) => row.id !== except).length;
}

/** The bookings that hold a booth of one package right now, not counting `except`. */
export async function heldBooths(db: Executor, productId: string, except?: string): Promise<number> {
  const rows = await db
    .select({ id: schema.exhibitorBooking.id })
    .from(schema.exhibitorBooking)
    .where(and(eq(schema.exhibitorBooking.productId, productId), inArray(schema.exhibitorBooking.status, [...BOOKING_HOLDS_BOOTH])));
  return rows.filter((row) => row.id !== except).length;
}
