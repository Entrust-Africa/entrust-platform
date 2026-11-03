import type { FormDefinition } from "@entrust/forms";

/** A question whose answer is one of a set of options that mean yes, no or "not decided" to a rule. */
export interface OptionRule {
  question: string;
  /** Answers that satisfy the requirement. */
  met: readonly string[];
  /** Answers that fail it. Any other answer leaves it unclear. */
  notMet: readonly string[];
}

/** The questions eligibility and scoring read, named here so a new version can move them. */
export interface ApplicationInputs {
  /** The primary opportunity pathway: a single-choice question offering exactly the four pathways. */
  pathway: string;
  /** "Are you seeking investment?" Asked only of a trade or partnership applicant, since the other two pathways seek it. */
  seekingInvestment: string;
  registration: OptionRule;
  operating: OptionRule;
  /** A yes/no question: the applicant is an authorized representative. */
  representative: string;
  /** Questions that have to hold a real answer for the commercial offering to be identifiable. */
  offering: readonly string[];
  /** Yes/no questions that have to be yes for the declaration and data-use terms to be accepted. */
  declaration: readonly string[];
  /** What the committee compares and filters applicants on. */
  profile: ProfileInputs;
  /** What the reports read beyond the above. */
  report: ReportInputs;
}

/**
 * The questions the reports of the specification's section 11 read, named here so a new version can move them. Each is
 * optional: a version that doesn't ask a question leaves that column of the report empty.
 */
export interface ReportInputs {
  /** City or region of the business. */
  city?: string;
  contactName?: string;
  contactPosition?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** The authorized representative who signed the declaration. */
  representativeName?: string;
  representativePosition?: string;
  description?: string;
  /** Main products or services: a list. */
  activities?: string;
  capacity?: string;
  /** Has the business exported: yes/no. */
  exported?: string;
  exportMarkets?: string;
  targetMarkets?: string;
  /** Has an active buyer, enquiry, contract or purchase order: yes/no. */
  activeBuyer?: string;
  /** What the applicant has from buyers: a multiple choice whose values include "signed_contract" and "purchase_order". */
  buyerEvidence?: string;
  buyerDetails?: string;
  transactionValue?: string;
  /** The buyers' requirements the business meets: certifications, standards and volumes. */
  requirements?: string;
  exportConstraints?: string;
  investmentAmount?: string;
  investmentTypes?: string;
  investmentUse?: string;
  investmentOutcomes?: string;
  investmentSecured?: string;
  investmentRemaining?: string;
  investmentPeriod?: string;
  /** Has a business plan or financial model for the investment: yes/no. */
  businessPlan?: string;
  /** Can provide financial statements: yes/no. */
  financialStatements?: string;
  partnerInterests?: string;
  partnerBenefit?: string;
  summitGoal?: string;
  partnersSought?: string;
  askMarkets?: string;
  askValue?: string;
}

/** The questions behind the committee's filters and comparison. An answer a version doesn't ask for reads as unknown. */
export interface ProfileInputs {
  /** Industry or sector: a text question. */
  sector: string;
  /** Yes/no: the business is woman-owned or woman-led. */
  womanOwned: string;
  /** Yes/no: the business is youth-owned or youth-led. */
  youthOwned: string;
  /** Annual revenue: a money question. */
  revenue: string;
  /** Number of employees: a number question. */
  employees: string;
  /** The commercial ask for the Summit: a text question. */
  commercialAsk: string;
}

/**
 * The Summit application form. A draft can change and can't take applications yet. A published version
 * never changes, because every application stores the version it was answered on.
 */
export interface ApplicationTemplate extends FormDefinition {
  status: "draft" | "published";
  /** Questions the SME registry fills in ahead of time, so the applicant isn't asked again. Edits write back to it. */
  registry: readonly string[];
  inputs: ApplicationInputs;
}
