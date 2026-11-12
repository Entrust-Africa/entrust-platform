import { getEvents } from "../../lib/getEvents";

/** An upcoming event as the hero panel needs it, from the Sanity `event` documents. */
export type UpcomingEvent = {
  id: string;
  title: string;
  /** "16 April 2026", or "16–17 April 2026" for a two-day event (Addis Ababa time). */
  dateLabel: string;
  day: string;
  month: string;
  location?: string;
  /** External page with more detail, when the CMS has one. */
  link?: string;
};

type SanityEvent = {
  _id?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  link?: string;
};

const TZ = "Africa/Addis_Ababa";

function fmt(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(new Date(iso));
}

function dateLabel(start: string, end?: string) {
  const full = { day: "numeric", month: "long", year: "numeric" } as const;
  if (!end || fmt(start, full) === fmt(end, full)) return fmt(start, full);
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...full }).formatRange(new Date(start), new Date(end));
}

/**
 * Upcoming events from Sanity. Returns an empty list when there are none or the
 * CMS can't be reached, so the page falls back to the "no dates yet" panel.
 */
export async function getUpcomingEvents(): Promise<UpcomingEvent[]> {
  try {
    const rows = ((await getEvents()) ?? []) as SanityEvent[];
    return rows
      .filter((e): e is SanityEvent & { _id: string; title: string; startDate: string } =>
        Boolean(e?._id && e.title && e.startDate),
      )
      .slice(0, 3)
      .map((e) => ({
        id: e._id,
        title: e.title,
        dateLabel: dateLabel(e.startDate, e.endDate),
        day: fmt(e.startDate, { day: "numeric" }),
        month: fmt(e.startDate, { month: "short" }),
        location: e.location ?? undefined,
        link: e.link ?? undefined,
      }));
  } catch (err) {
    console.error("Could not load events from Sanity:", err);
    return [];
  }
}
