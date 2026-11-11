// TRADE runs in Ethiopia, so a time a person types or reads is Addis Ababa time (UTC+3, no daylight saving). The servers
// run in UTC: a datetime-local value read with `new Date()` there lands three hours late, and a date compared with the
// UTC date is a day off between midnight and 03:00. These turn one into the other.

export const TRADE_TIME_ZONE = "Africa/Addis_Ababa";
const OFFSET = "+03:00";
const OFFSET_MS = 3 * 3_600_000;

/** A `datetime-local` value (2026-11-18T10:00, seconds optional) read as Addis Ababa time. Null when it isn't one. */
export function parseTradeLocalDateTime(value: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}${match[3] ?? ":00"}${OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The `datetime-local` value for a moment, in Addis Ababa time: what a form field shows for a stored time. */
export function toTradeLocalDateTime(date: Date | string): string {
  const at = new Date(new Date(date).getTime() + OFFSET_MS);
  return at.toISOString().slice(0, 16);
}

/** Today's date in Addis Ababa, as YYYY-MM-DD. */
export function tradeToday(now: Date = new Date()): string {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** A moment as a person reads it: "Wednesday 18 November 2026 at 10:00 (Addis Ababa time)". */
export function formatTradeDateTime(date: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TRADE_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(date));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")} at ${part("hour")}:${part("minute")} (Addis Ababa time)`;
}
