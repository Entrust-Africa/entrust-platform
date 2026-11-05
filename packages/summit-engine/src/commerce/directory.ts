import type { ReportApplication } from "../reports/types";

// The ADTIS SME digital directory (section 9): a public page for each of the selected SMEs. A public profile is its own
// record, made from the application as a draft that staff edit and the business approves, so what the public sees is only
// what was approved. It never holds a score, a finding, a financial record or anything from the assessment: the draft is
// built from the fields below and nothing else.

export const PROFILE_STATUSES = ["draft", "published"] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

/** How far the business's identity has been checked, in the two words the public sees. */
export const PROFILE_VERIFICATION = ["verified", "pending"] as const;
export type ProfileVerification = (typeof PROFILE_VERIFICATION)[number];

export const PROFILE_VERIFICATION_LABELS: Readonly<Record<ProfileVerification, string>> = {
  verified: "Business registration verified",
  pending: "Verification in progress",
};

/** What a public profile says. Every field here can be edited, and is shown only once the business has approved it. */
export interface ProfileContent {
  displayName: string;
  /** ISO 3166-1 alpha-2 code. */
  country: string;
  city: string | null;
  sector: string;
  summary: string;
  productsServices: string[];
  productionCapacity: string | null;
  exportReadiness: string | null;
  targetMarkets: string[];
  seeksInvestment: boolean;
  investmentRequirements: string | null;
  verification: ProfileVerification;
  website: string | null;
  contactName: string | null;
  contactPosition: string | null;
  /** Private until the business chooses to show them: a draft leaves these empty. */
  contactEmail: string | null;
  contactPhone: string | null;
}

export const PROFILE_TEXT_LIMITS = { summary: 1500, short: 300, name: 160, list: 40, listItem: 120 } as const;

const clip = (text: string | null, max: number): string | null => {
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max / 2))}…`;
};

/** A name for a web address: lower case, accents dropped, words joined by hyphens. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return slug || "sme";
}

/**
 * The first draft of a public profile, from a selected SME's application. It takes only what a business would put on a
 * public page: who it is, what it makes, its capacity, whether it exports and where it wants to sell, and what investment it
 * wants. Revenue, employees, finances, documents, scores and findings are not read, and the contact's email and telephone are
 * left empty for the business to decide on.
 */
export function directoryDraft(a: ReportApplication): ProfileContent {
  const answers = a.answers;
  const exported = answers.yesNo("exported");
  const exportedTo = answers.list("exportMarkets");
  const certifications = answers.text("requirements");
  const readiness = [
    exported === null ? null : exported ? (exportedTo.length ? `Has exported to ${exportedTo.join(", ")}.` : "Has exported.") : "Has not exported yet.",
    certifications ? `Certifications and standards: ${certifications}.` : null,
  ].filter((part): part is string => part !== null);

  const registration = a.verification.find((v) => v.claim === "business_registration");
  const verified = registration !== undefined && (registration.class === "document_supported" || registration.class === "independently_verified");

  const amount = a.seeksInvestment ? answers.text("investmentAmount") : null;
  const use = a.seeksInvestment ? answers.text("investmentUse") : null;
  const investment = [amount ? `Seeking ${amount}` : null, use ? `for ${use.charAt(0).toLowerCase()}${use.slice(1)}` : null].filter((p): p is string => p !== null).join(" ");

  return {
    displayName: a.businessName,
    country: a.country ?? "",
    city: clip(answers.text("city"), PROFILE_TEXT_LIMITS.short),
    sector: answers.text("sector") ?? "",
    summary: clip(answers.text("description"), PROFILE_TEXT_LIMITS.summary) ?? "",
    productsServices: answers.list("activities").slice(0, PROFILE_TEXT_LIMITS.list),
    productionCapacity: clip(answers.text("capacity"), PROFILE_TEXT_LIMITS.short),
    exportReadiness: readiness.length ? clip(readiness.join(" "), PROFILE_TEXT_LIMITS.short) : null,
    targetMarkets: answers.list("targetMarkets").slice(0, PROFILE_TEXT_LIMITS.list),
    seeksInvestment: a.seeksInvestment,
    investmentRequirements: investment ? clip(`${investment}.`, PROFILE_TEXT_LIMITS.short) : null,
    verification: verified ? "verified" : "pending",
    website: null,
    contactName: answers.text("representativeName") ?? answers.text("contactName"),
    contactPosition: answers.text("representativePosition") ?? answers.text("contactPosition"),
    contactEmail: null,
    contactPhone: null,
  };
}

/** What a profile still lacks before it can be shown to the public. */
export function profileProblems(c: ProfileContent): string[] {
  const problems: string[] = [];
  if (!c.displayName.trim()) problems.push("The business needs a name.");
  if (!/^[A-Z]{2}$/.test(c.country)) problems.push("The business needs a country.");
  if (!c.sector.trim()) problems.push("The business needs an industry.");
  if (c.summary.trim().length < 20) problems.push("The business needs a short description (at least 20 characters).");
  if (c.productsServices.length === 0) problems.push("List at least one product or service.");
  if (c.seeksInvestment && !c.investmentRequirements?.trim()) problems.push("The business seeks investment, so say what it needs.");
  if (c.website && !/^https?:\/\/[^\s]+$/i.test(c.website)) problems.push("The website must start with http:// or https://.");
  return problems;
}

/** The enquiries a visitor can make of a business, as the interest they come with. */
export const B2B_INTERESTS = ["buyer", "investor", "distributor", "partner", "other"] as const;
export type B2bInterest = (typeof B2B_INTERESTS)[number];
export const B2B_INTEREST_LABELS: Readonly<Record<B2bInterest, string>> = {
  buyer: "Buying products or services",
  investor: "Investing",
  distributor: "Distribution",
  partner: "Strategic partnership",
  other: "Something else",
};

export const B2B_STATUSES = ["new", "handled"] as const;
export type B2bStatus = (typeof B2B_STATUSES)[number];
