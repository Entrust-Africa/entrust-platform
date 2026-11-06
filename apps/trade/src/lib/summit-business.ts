// A business applying to the Summit: creating its organisation, and remembering the details a visitor typed before they
// verified their email, so the application can carry on from them afterwards.

import { apiUrl } from "./summit-api";

/**
 * Which platform the new organisation is given with its first access: the Summit alone, so TRADE's learner screens
 * stay out of an applicant's way. Entrust can add TRADE later, for a selected SME.
 */
const FIRST_PLATFORM = "summit";

/** The African Union's member states, for the country list while no application period has set its own. */
export const AFRICAN_COUNTRIES = [
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD", "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET",
  "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW",
  "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
] as const;

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** `duplicate` is set when the API found a business with a similar name and wants the visitor to confirm theirs is another. */
export type CreateBusinessResult = { ok: true; id: string } | { ok: false; error: string; duplicate?: boolean };

/**
 * Creates the signed-in visitor's business as an organisation. `legalName` is the business name when left empty.
 * `platform` is the one the business gets first: the Summit for an applicant, TRADE for a training participant.
 */
export async function createBusiness(input: {
  name: string;
  legalName?: string;
  country: string;
  platform?: "summit" | "trade";
  confirmDuplicateName?: boolean;
}): Promise<CreateBusinessResult> {
  const name = input.name.trim();
  const slug = `${slugOf(name) || "business"}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    const response = await fetch(`${apiUrl}/v1/organizations`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        legalName: input.legalName?.trim() || name,
        slug,
        country: input.country,
        platform: input.platform ?? FIRST_PLATFORM,
        ...(input.confirmDuplicateName ? { confirmDuplicateName: true } : {}),
      }),
    });
    const data = (await response.json().catch(() => null)) as { id?: unknown; error?: unknown; code?: unknown } | null;
    if (response.ok && typeof data?.id === "string") return { ok: true, id: data.id };
    return {
      ok: false,
      error: typeof data?.error === "string" ? data.error : "We couldn't save your business. Please try again.",
      ...(data?.code === "duplicate_legal_name_warning" ? { duplicate: true } : {}),
    };
  } catch {
    return { ok: false, error: "We couldn't reach the server. Check your internet connection and try again." };
  }
}

// ---- The business a visitor typed before verifying their email ----

export const PENDING_BUSINESS_COOKIE = "summit-business";

export interface PendingBusiness {
  name: string;
  country: string;
}

/** The remembered business from the cookie's (URL-encoded JSON) value, or null if it is missing or not what we wrote. */
export function parsePendingBusiness(value: string | undefined): PendingBusiness | null {
  if (!value) return null;
  try {
    const data = JSON.parse(decodeURIComponent(value)) as Partial<PendingBusiness> | null;
    const name = typeof data?.name === "string" ? data.name.trim() : "";
    const country = typeof data?.country === "string" ? data.country : "";
    if (!name || name.length > 160 || !/^[A-Z]{2}$/.test(country)) return null;
    return { name, country };
  } catch {
    return null;
  }
}

/** Keeps the business for a week, in this browser only, while the visitor goes to their inbox and back. */
export function rememberBusiness(business: PendingBusiness): void {
  document.cookie = `${PENDING_BUSINESS_COOKIE}=${encodeURIComponent(JSON.stringify(business))}; path=/; max-age=604800; samesite=lax`;
}

export function forgetBusiness(): void {
  document.cookie = `${PENDING_BUSINESS_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
