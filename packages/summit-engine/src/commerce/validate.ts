import { BENEFIT_AREA_IDS, EXHIBITION_COMPARISON, type ProductDefinition } from "./types";

// The checks a product must pass before it is saved, so the same rules hold for the API, the standard catalogue and a
// copy of last year's edition.

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** No single price above a million dollars: a larger figure is a typo (an extra zero), not a package. */
export const MAX_PRICE_CENTS = 1_000_000 * 100;
export const MAX_FEATURES = 20;

export function productProblems(p: ProductDefinition): string[] {
  const problems: string[] = [];
  if (!SLUG_PATTERN.test(p.slug) || p.slug.length > 60) problems.push(`${p.slug || "(no slug)"}: use lower-case letters, numbers and hyphens for the address.`);
  if (!p.name.trim() || p.name.length > 120) problems.push(`${p.slug}: the name needs 1 to 120 characters.`);
  if (p.summary.length > 400) problems.push(`${p.slug}: the summary is too long (400 characters at most).`);
  if (!Number.isInteger(p.priceCents) || p.priceCents < 0 || p.priceCents > MAX_PRICE_CENTS) problems.push(`${p.slug}: the price must be between $0 and $1,000,000.`);
  if (p.capacity !== null && (!Number.isInteger(p.capacity) || p.capacity < 0)) problems.push(`${p.slug}: the capacity must be a whole number, or empty for no limit.`);
  if (p.features.length > MAX_FEATURES || p.features.some((f) => !f.trim() || f.length > 200)) {
    problems.push(`${p.slug}: use up to ${MAX_FEATURES} benefits of 1 to 200 characters each.`);
  }
  const areas = Object.keys(p.benefits);
  if (areas.some((a) => !(BENEFIT_AREA_IDS as readonly string[]).includes(a))) problems.push(`${p.slug}: a benefit names an area that doesn't exist.`);
  if (areas.length && p.kind !== "sponsorship_level") problems.push(`${p.slug}: only sponsorship levels have benefits by area.`);
  if (Object.values(p.benefits).some((text) => (text ?? "").length > 400)) problems.push(`${p.slug}: a benefit is too long (400 characters at most).`);
  if (Object.entries(p.attributes).some(([key, value]) => key.length > 40 || value.length > 200)) problems.push(`${p.slug}: an attribute is too long.`);
  if (p.kind === "exhibition_package") {
    const missing = EXHIBITION_COMPARISON.filter((row) => p.attributes[row.id] === undefined);
    if (missing.length) problems.push(`${p.slug}: an exhibition package needs a value (even an empty one) for ${missing.map((m) => m.label.toLowerCase()).join(", ")}.`);
  }
  return problems;
}

/** The problems of a whole catalogue: each product's own, and two products sharing an address. */
export function catalogueProblems(products: readonly ProductDefinition[]): string[] {
  const seen = new Set<string>();
  const problems = products.flatMap(productProblems);
  for (const { slug } of products) {
    if (seen.has(slug)) problems.push(`${slug}: two products have this address.`);
    seen.add(slug);
  }
  return problems;
}
