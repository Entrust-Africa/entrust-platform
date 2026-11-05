import type { Executor } from "./db";

/**
 * How many of each product of an edition are taken: the approved and confirmed exhibitor bookings for a package, the
 * confirmed sponsors for a level or opportunity, the registered delegates for a category. A pending application takes
 * nothing, so it can't use up a booth before an administrator approves it. Nothing can be booked yet, so every
 * product has zero taken; each booking flow that follows adds its count here.
 */
export async function takenCounts(_db: Executor, _editionId: string): Promise<Map<string, number>> {
  return new Map();
}
