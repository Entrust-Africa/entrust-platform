// Shared by the worksheet calculators. Amounts are plain numbers in one currency, and the worksheet adds
// the currency. A learner fills a worksheet in as they type, so a calculator takes a blank input and
// answers null for everything that depends on it: a missing figure is never taken as zero.

/** A figure the learner may not have entered yet. */
export type Amount = number | null | undefined;

/** Round to two decimals, so a sum like 0.1 + 0.2 shows as 0.3. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** The figure, or null if it is blank. Anything else that isn't a finite number is a mistake in the caller, so it throws. */
export function figure(label: string, value: Amount): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new RangeError(`${label} must be a finite number`);
  return value;
}

/** The sum of figures, or null if any is blank. */
export function sum(values: readonly (number | null)[]): number | null {
  let total = 0;
  for (const v of values) {
    if (v === null) return null;
    total += v;
  }
  return round2(total);
}

/** Part over whole as a percent to two decimals, or null if either is missing or the whole is zero. */
export function percentOf(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole === 0) return null;
  return round2((part / whole) * 100);
}
