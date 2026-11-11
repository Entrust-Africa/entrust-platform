import { TRADE_TIME_ZONE } from "@entrust/trade-engine";

// Session times are Addis Ababa time wherever the page is drawn. These pages render on a UTC server, so the browser's or
// server's own zone would show a 10:00 session as 07:00.

const day = new Intl.DateTimeFormat("en-GB", { timeZone: TRADE_TIME_ZONE, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: TRADE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Wed 18 Nov 2026" in Addis Ababa. */
export const sessionDay = (at: string | Date): string => day.format(new Date(at));
/** "10:00" in Addis Ababa. */
export const sessionClock = (at: string | Date): string => clock.format(new Date(at));
/** "Wed 18 Nov 2026, 10:00 – 12:00 (Addis Ababa time)". */
export const sessionWhen = (start: string | Date, end: string | Date): string =>
  `${sessionDay(start)}, ${sessionClock(start)} – ${sessionClock(end)} (Addis Ababa time)`;
