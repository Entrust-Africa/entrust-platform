import { apiBase } from "@/lib/period";

// The ADTIS commercial pages read the current edition's catalogue, the SME directory and a delegate's badge from the API's
// public endpoints. Everything here runs on the server: the pages never call the API from the browser.

export interface Availability {
  remaining: number | null;
  soldOut: boolean;
}

export interface Product {
  id: string;
  slug: string;
  kind: "exhibition_package" | "sponsorship_level" | "delegate_category" | "opportunity";
  name: string;
  summary: string;
  priceCents: number;
  price: string;
  complimentary: boolean;
  features: string[];
  benefits: { area: string; label: string; text: string }[];
  attributes: Record<string, string>;
  availability: Availability;
}

export interface Catalogue {
  edition: {
    slug: string;
    name: string;
    venue: string;
    datesNote: string;
    days: number;
    expectedAttendance: number | null;
    selectedSmes: number | null;
    currency: string;
    pricesIncludeTax: boolean | null;
    taxNote: string;
    exhibitionZones: string[];
  } | null;
  benefitAreas: { id: string; label: string }[];
  comparisonRows: { id: string; label: string }[];
  exhibition: Product[];
  sponsorship: Product[];
  delegates: Product[];
  opportunities: Product[];
}

/** The catalogue of the current edition, or null if the API can't be reached. An edition that isn't set up has `edition: null`. */
export async function getCatalogue(): Promise<Catalogue | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/summit/commerce/catalogue`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as Catalogue) : null;
  } catch {
    return null;
  }
}

/** What to say about how many are left: nothing for plenty, a nudge for a few, and "Sold out". */
export function availabilityNote(a: Availability): string | null {
  if (a.soldOut) return "Sold out";
  if (a.remaining !== null && a.remaining <= 5) return `Only ${a.remaining} left`;
  return null;
}

export interface DirectoryCard {
  slug: string;
  name: string;
  country: string;
  countryName: string;
  city: string | null;
  sector: string;
  summary: string;
  productsServices: string[];
  targetMarkets: string[];
  seeksInvestment: boolean;
  verification: "verified" | "pending";
  verificationLabel: string;
}

export interface Directory {
  items: DirectoryCard[];
  total: number;
  facets: {
    countries: { code: string; name: string; count: number }[];
    sectors: { value: string; count: number }[];
    markets: { value: string; count: number }[];
    investment: number;
    all: number;
  };
}

export interface PublicProfile extends DirectoryCard {
  edition: { name: string; venue: string; datesNote: string };
  productionCapacity: string | null;
  exportReadiness: string | null;
  investmentRequirements: string | null;
  website: string | null;
  contact: { name: string | null; position: string | null; email: string | null; phone: string | null };
  url: string;
}

export const DIRECTORY_PAGE = 24;

export async function getDirectory(query: Record<string, string | undefined>, offset: number): Promise<Directory | null> {
  const params = new URLSearchParams({ limit: String(DIRECTORY_PAGE), offset: String(offset) });
  for (const key of ["country", "sector", "market", "q", "investment"]) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  try {
    const res = await fetch(`${apiBase()}/v1/summit/commerce/smes?${params}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as Directory) : null;
  } catch {
    return null;
  }
}

export async function getProfile(slug: string): Promise<PublicProfile | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/summit/commerce/smes/${encodeURIComponent(slug)}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as PublicProfile) : null;
  } catch {
    return null;
  }
}

export interface Badge {
  number: string;
  fullName: string;
  organisation: string;
  country: string;
  category: string;
  edition: { name: string; venue: string; datesNote: string };
  valid: boolean;
  reason: string | null;
  url: string | null;
}

export async function getBadge(token: string): Promise<Badge | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/summit/commerce/badges/${encodeURIComponent(token)}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as Badge) : null;
  } catch {
    return null;
  }
}

/** A prices note under every price: the tax answer, or that it is not yet confirmed. */
export function taxLine(edition: NonNullable<Catalogue["edition"]>): string {
  return edition.taxNote;
}
