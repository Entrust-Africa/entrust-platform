import { isDate } from "@entrust/forms";

const DAY = 24 * 60 * 60 * 1000;

/**
 * A YYYY-MM-DD date as a day count, so two dates compare and subtract. A blank date is null, since the
 * learner may not have entered it yet. A date that isn't real throws, because the worksheet's date field
 * should have refused it first.
 */
export function dayNumber(label: string, value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (!isDate(value)) throw new RangeError(`${label} must be a real date as YYYY-MM-DD, not "${value}"`);
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY;
}
