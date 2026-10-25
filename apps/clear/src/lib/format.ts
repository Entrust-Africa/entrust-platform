const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Addis_Ababa",
  timeZoneName: "short",
});

/** "24 Oct 2026", from an ISO date or timestamp. */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso));

/** "24 Oct 2026, 14:30 GMT+3", in Addis Ababa time. */
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
