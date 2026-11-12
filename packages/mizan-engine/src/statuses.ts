// The fixed lists MIZAN's tables and screens share. `packages/db` imports them for its column enums (#222), as it does the
// trade engine's, so a list is changed in one place.

/** Draft and returned are editable by the assessor; in review is locked; approved is frozen for good. */
export const ASSESSMENT_STATUSES = ["draft", "in_review", "returned", "approved"] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

/**
 * initial: the first assessment of an SME. reassessment: a fresh assessment at a later date, linked to the earlier one.
 * amendment: a documented correction under the same configuration. rescore: the same inputs under the current configuration.
 * None of them ever changes an approved assessment.
 */
export const ASSESSMENT_KINDS = ["initial", "reassessment", "amendment", "rescore"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export const REVIEW_DECISIONS = ["approved", "returned"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const GATE_STATUSES = ["pass", "fail", "pending"] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];

/** Ratings that are not a score: not evidenced, unverified, not applicable. NE and UV are never treated as 0. */
export const RATING_CODES = ["NE", "UV", "NA"] as const;
export type RatingCode = (typeof RATING_CODES)[number];

/** The data collection notice (required to start an assessment) and the permission to use TRADE and CLEAR data (#227). */
export const CONSENT_KINDS = ["assessment_notice", "platform_data"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_SOURCES = ["mizan", "trade"] as const;
export type ConsentSource = (typeof CONSENT_SOURCES)[number];

export const CONSENT_METHODS = ["in_platform", "paper", "trade"] as const;
export type ConsentMethod = (typeof CONSENT_METHODS)[number];

/** Who supported an SME, which bars them from assessing or approving it (#226). */
export const SUPPORT_TYPES = ["training", "passport_verification", "advisory", "onboarding", "other"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

export const PROGRAMMES = ["market_activation", "sme_passport"] as const;
export type Programme = (typeof PROGRAMMES)[number];

export const STATEMENT_BASES = ["audited", "reviewed", "management", "tax", "reconstructed"] as const;
export type StatementBasis = (typeof STATEMENT_BASES)[number];

export const STATEMENT_BASIS_LABELS: Readonly<Record<StatementBasis, string>> = {
  audited: "Audited",
  reviewed: "Reviewed or compiled by an accountant",
  management: "Management accounts",
  tax: "Tax-basis accounts",
  reconstructed: "Reconstructed from bank statements and records",
};

export const DOCUMENT_CATEGORIES = [
  "registration",
  "ownership",
  "financial_statements",
  "tax",
  "bank_statements",
  "ledgers",
  "loans",
  "contracts_orders",
  "management_hr",
  "controls_systems",
  "platform_export",
  "consent",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Readonly<Record<DocumentCategory, string>> = {
  registration: "Registration and licences",
  ownership: "Ownership and beneficial owners",
  financial_statements: "Financial statements",
  tax: "Tax returns and clearance",
  bank_statements: "Bank statements",
  ledgers: "Receivables, payables and inventory listings",
  loans: "Loan agreements and repayment records",
  contracts_orders: "Contracts and orders",
  management_hr: "Management and HR documents",
  controls_systems: "Policies, controls and systems evidence",
  platform_export: "TRADE or CLEAR export (needs the data permission)",
  consent: "Signed notice",
  other: "Other",
};

/** Country modules. Only labels for now: neither changes the scoring. */
export const COUNTRY_MODULES = { ET: "MIZAN-ET v0.1-draft", KE: "MIZAN-KE v0.1-draft" } as const;
export type MizanCountry = keyof typeof COUNTRY_MODULES;
