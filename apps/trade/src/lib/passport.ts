export type PassportTier = "bronze" | "silver" | "gold";
export type PassportStanding = "active" | "expired" | "suspended" | "revoked";

export interface PassportContent {
  passportId: string;
  tier: PassportTier;
  status: "active" | "suspended" | "revoked";
  statusReason: string | null;
  verifiedOn: string;
  validUntil: string;
  displayName: string;
  tagline: string | null;
  country: string;
  sector: string | null;
  established: number | null;
  employeesRange: string | null;
  ownership: string | null;
  founder: string | null;
  headline: string | null;
  overview: string | null;
  products: { name: string; detail: string | null; code: string | null }[];
  womenInTrade: string[];
  targetMarkets: { label: string; places: string[] }[];
  seeking: string | null;
  checks: string[];
  website: string | null;
  email: string | null;
  phones: string[];
  address: string | null;
}

export interface PublicPassport {
  passportId: string;
  standing: PassportStanding;
  displayName: string;
  tier: PassportTier;
  verifiedOn: string;
  validUntil: string;
  details: Omit<PassportContent, "passportId" | "tier" | "status" | "statusReason" | "verifiedOn" | "validUntil" | "displayName"> | null;
}

export interface PassportEditorData {
  business: { organizationId: string; smeId: string; legalName: string };
  passport: PassportContent | null;
  suggestion: Pick<PassportContent, "displayName" | "country" | "sector" | "established" | "employeesRange" | "ownership" | "website" | "email" | "phones" | "address">;
}

export interface PassportListItem {
  passportId: string;
  smeId: string;
  displayName: string;
  tier: PassportTier;
  standing: PassportStanding;
  verifiedOn: string;
  validUntil: string;
}

export const TIERS: Record<PassportTier, { name: string; meaning: string }> = {
  bronze: { name: "Bronze", meaning: "legitimate" },
  silver: { name: "Silver", meaning: "trade-ready" },
  gold: { name: "Gold", meaning: "export-capable" },
};

export const STANDING_LABEL: Record<PassportStanding, string> = { active: "Active", expired: "Expired", suspended: "Suspended", revoked: "Revoked" };

/** "13 Nov 2026" from a YYYY-MM-DD date, the way the printed passport writes it. */
export function passportDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** The address the QR code holds, from the host the request came in on (behind Railway's proxy, the forwarded one). */
export function passportAddress(headers: Headers, passportId: string): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/passport/${encodeURIComponent(passportId)}`;
}
