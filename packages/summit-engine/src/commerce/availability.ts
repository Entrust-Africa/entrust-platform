// How many of a product can still be taken. A package is sold out when an administrator says so, or when what has
// been approved fills what was set aside for it (section 11). With no capacity set there is no limit to run out of.

export interface Availability {
  capacity: number | null;
  /** Approved or confirmed, so a pending application doesn't use up a booth. */
  taken: number;
  /** Null when the capacity is unlimited. */
  remaining: number | null;
  soldOut: boolean;
}

export function availability(input: { capacity: number | null; taken: number; markedSoldOut: boolean }): Availability {
  const { capacity, taken, markedSoldOut } = input;
  const remaining = capacity === null ? null : Math.max(0, capacity - taken);
  return { capacity, taken, remaining, soldOut: markedSoldOut || remaining === 0 };
}
