// The Summit SME application platform's rules as data: how an application is screened for eligibility,
// how it is scored, and how a claim is verified. Nothing here reads a database or does I/O. The source
// is the Developer Requirements Specification for the Africa Diaspora Trade and Investment Summit SME
// Application, Assessment and Selection Platform; section numbers below are its.

/** The primary opportunity pathway an applicant picks (spec section 6). */
export const OPPORTUNITY_PATHWAYS = ["trade_and_market_access", "investment", "strategic_partnership", "combined_trade_and_investment"] as const;
export type OpportunityPathway = (typeof OPPORTUNITY_PATHWAYS)[number];

/** The suggested statuses of section 3, in the order of the workflow. Every change is stored with when and by whom. */
export const APPLICATION_STATUSES = [
  "draft",
  "submitted",
  "incomplete",
  "under_eligibility_review",
  "eligible",
  "ineligible",
  "under_assessment",
  "awaiting_additional_information",
  "under_verification",
  "assessment_completed",
  "recommended",
  "committee_review",
  "selected",
  "waitlisted",
  "not_selected",
  "withdrawn",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Eligibility (section 5). It is separate from the 100-point commercial assessment.

export const ELIGIBILITY_OUTCOMES = ["eligible", "ineligible", "pending_clarification"] as const;
export type EligibilityOutcome = (typeof ELIGIBILITY_OUTCOMES)[number];

/** The spec's outcome "pending clarification" has no status of its own, so it maps to "awaiting additional information". */
export const ELIGIBILITY_STATUS: Readonly<Record<EligibilityOutcome, ApplicationStatus>> = {
  eligible: "eligible",
  ineligible: "ineligible",
  pending_clarification: "awaiting_additional_information",
};

/** The six proposed requirements of section 5, in its order. */
export const ELIGIBILITY_CRITERIA = [
  { id: "registered", text: "The business is registered or has an accepted legal operating status in its country." },
  { id: "operating", text: "The business is currently operating, or has a clearly documented commercial venture ready for launch." },
  { id: "representative", text: "The applicant is an authorized representative." },
  { id: "offering", text: "The business provides sufficient information to identify its commercial offering." },
  { id: "declaration", text: "The applicant accepts the application declaration and data-use terms." },
  { id: "documents", text: "The business provides the minimum required supporting documentation." },
] as const;
export type EligibilityCriterionId = (typeof ELIGIBILITY_CRITERIA)[number]["id"];

/** The kinds of supporting document (sections 4 and 7). Financial documents are restricted. */
export const DOCUMENT_KINDS = [
  "registration_certificate",
  "financial_statements",
  "product_information",
  "business_plan",
  "export_records",
  "buyer_contracts",
  "certifications",
  "use_of_funds_schedule",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface EligibilityRules {
  /** The minimum documents for each pathway. */
  requiredDocuments: Readonly<Record<OpportunityPathway, readonly DocumentKind[]>>;
}

// The assessment (section 6).

export const CATEGORY_IDS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** The total the commercial assessment is out of. */
export const TOTAL_POINTS = 100;

export interface Criterion {
  /** Permanent ID, stored with every score. */
  id: string;
  text: string;
  maxPoints: number;
  /** What an officer needs to see to give the points. Required before a version is approved. */
  evidence: readonly string[];
  /** The pathways this criterion scores. Absent means all of them. */
  pathways?: readonly OpportunityPathway[];
}

export interface Category {
  id: CategoryId;
  title: string;
  maxPoints: number;
  /** What the spec says to assess. */
  assess: readonly string[];
  criteria: readonly Criterion[];
  /** Not applicable to an applicant that isn't seeking investment (category D). */
  investmentOnly?: boolean;
}

export interface Rubric {
  categories: readonly Category[];
  /**
   * What replaces an investment-only category for an applicant that isn't seeking investment. `rescale`
   * leaves the category out and scales the points left up to 100, so the applicant is neither penalized
   * nor given the points. The spec calls for "an approved alternative scoring rule" without defining one.
   */
  notApplicable: "rescale";
}

/**
 * One version of the Summit's rules. A draft can still change, and officers can't score against it. An
 * approved version never changes, because every score stores the version it used.
 */
export interface SummitRules {
  /** major.minor.patch */
  version: string;
  status: "draft" | "approved";
  eligibility: EligibilityRules;
  rubric: Rubric;
}

// Verification (section 7).

export const VERIFICATION_CLASSES = ["self_reported", "document_supported", "independently_verified", "not_verified", "not_applicable"] as const;
export type VerificationClass = (typeof VERIFICATION_CLASSES)[number];

export interface VerifiableClaim {
  id: string;
  label: string;
  /** What section 7 gives as the evidence for it. */
  evidence: string;
}

/** The claims section 7 gives as examples. An officer classifies these and any other important claim. */
export const VERIFIABLE_CLAIMS: readonly VerifiableClaim[] = [
  { id: "business_registration", label: "Business registration", evidence: "Registration certificate" },
  { id: "annual_revenue", label: "Annual revenue", evidence: "Financial statements or management accounts" },
  { id: "export_history", label: "Export history", evidence: "Export declarations, shipping records, invoices" },
  { id: "buyer_relationship", label: "Buyer relationship", evidence: "Contract, purchase order, correspondence" },
  { id: "production_capacity", label: "Production capacity", evidence: "Production records, facility evidence" },
  { id: "investment_requirement", label: "Investment requirement", evidence: "Business plan, financial model, use-of-funds schedule" },
  { id: "product_quality", label: "Product quality", evidence: "Relevant certifications or test reports" },
];
