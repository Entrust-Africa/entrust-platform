// The Summit's public application period, from the API's unauthenticated GET /v1/summit/period.
// The landing page shows whatever the API says, so dates and countries are set by Entrust in one place.

export interface SummitPeriod {
  id: string;
  name: string;
  opensAt: string;
  closesAt: string;
  /** ISO 3166-1 alpha-2 codes of the countries whose SMEs may apply. */
  countries: string[];
  state: "upcoming" | "open" | "closed";
}

/** The Entrust platform API, server side only. */
export function apiBase(): string {
  return (process.env.API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");
}

/** The period open now, else the next to open, else the latest to close. Null before any is set, or if the API can't be reached. */
export async function getPeriod(): Promise<SummitPeriod | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/summit/period`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { period: SummitPeriod | null };
    return body.period;
  } catch {
    return null;
  }
}

/** Where applicants sign in and apply: the platform that hosts the Summit application and dashboard. */
export function platformUrl(): string {
  const fallback = process.env.NODE_ENV === "production" ? "https://trade.entrust-africa.com" : "http://localhost:3001";
  return (process.env.SUMMIT_APP_URL?.trim() || fallback).replace(/\/+$/, "");
}

/** The SME application. A visitor who isn't signed in is sent to sign in first and comes back to it. */
export function applyUrl(): string {
  return `${platformUrl()}/summit/apply`;
}

/** One line on where the application window stands, or null before a period is set. */
export function applicationsLine(period: SummitPeriod | null): string | null {
  if (!period) return null;
  if (period.state === "open") return `Applications open until ${formatDate(period.closesAt)}`;
  if (period.state === "upcoming") return `Applications open ${formatDate(period.opensAt)}`;
  return `Applications closed ${formatDate(period.closesAt)}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** Country names, sorted, from ISO codes. A code the runtime doesn't know is shown as given. */
export function countryNames(codes: readonly string[]): string[] {
  return codes
    .map((code) => {
      try {
        return regionNames.of(code.toUpperCase()) ?? code;
      } catch {
        return code;
      }
    })
    .sort((a, b) => a.localeCompare(b, "en"));
}
