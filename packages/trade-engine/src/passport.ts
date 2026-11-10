// The Entrust Africa Verified SME Passport: a one-page, public record that a business has been checked, with a QR code on the
// printed passport that opens it. These are the pure rules (tiers, standing, the employee range); the API stores and serves them.

export const PASSPORT_TIERS = ["bronze", "silver", "gold"] as const;
export type PassportTier = (typeof PASSPORT_TIERS)[number];

/** What each tier says about the business, as printed in the footer of the passport. */
export const PASSPORT_TIER_LABELS: Record<PassportTier, { name: string; meaning: string }> = {
  bronze: { name: "Bronze", meaning: "legitimate" },
  silver: { name: "Silver", meaning: "trade-ready" },
  gold: { name: "Gold", meaning: "export-capable" },
};

export const PASSPORT_STATUSES = ["active", "suspended", "revoked"] as const;
export type PassportStatus = (typeof PASSPORT_STATUSES)[number];

/** What a person scanning the code is told: `expired` is worked out from the date, the others are set by staff. */
export type PassportStanding = PassportStatus | "expired";

export const PASSPORT_STANDING_LABELS: Record<PassportStanding, string> = {
  active: "Active",
  expired: "Expired",
  suspended: "Suspended",
  revoked: "Revoked",
};

/** The checks Entrust can tick on a passport, in the order the passport lists them. */
export const PASSPORT_CHECKS = [
  "Company registration",
  "Ownership & shareholders",
  "Trade & export licences",
  "Site visit",
  "Management interview",
  "Buyer reference check",
  "Financial statements review",
] as const;

/** A passport number such as EA-ETH-0002: the country's three letters, then a four-digit number. */
export const PASSPORT_ID_PATTERN = /^EA-[A-Z]{3}-\d{4}$/;

export function normalisePassportId(input: string): string {
  return input.trim().toUpperCase();
}

export function isPassportId(input: string): boolean {
  return PASSPORT_ID_PATTERN.test(normalisePassportId(input));
}

/** A revoked or suspended passport stays that way whatever the date; an active one lapses after its last day (`validUntil`, YYYY-MM-DD). */
export function passportStanding(status: PassportStatus, validUntil: string, now: Date = new Date()): PassportStanding {
  if (status !== "active") return status;
  const today = now.toISOString().slice(0, 10);
  return today > validUntil ? "expired" : "active";
}

const EMPLOYEE_BANDS: readonly { max: number; label: string }[] = [
  { max: 0, label: "No employees" },
  { max: 5, label: "1–5" },
  { max: 10, label: "6–10" },
  { max: 20, label: "11–20" },
  { max: 50, label: "21–50" },
  { max: 100, label: "51–100" },
  { max: 250, label: "101–250" },
];

/**
 * The range a headcount falls in, for the "Employees" cell. The diagnostic keeps permanent and temporary staff apart; the passport
 * says one range for both. It returns null when the business gave neither figure.
 */
export function employeeRange(permanent: number | null | undefined, temporary: number | null | undefined): string | null {
  if (permanent == null && temporary == null) return null;
  const total = Math.max(0, (permanent ?? 0) + (temporary ?? 0));
  return EMPLOYEE_BANDS.find((band) => total <= band.max)?.label ?? "251+";
}
