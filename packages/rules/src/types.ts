// The shape of CLEAR's canonical workflow data. The GATE engine reads these definitions;
// rule packs for a corridor (product + destination) build on them.

export type PhaseId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** STEP-001 to STEP-125, as numbered in Entrust's Technical Alignment Specification. */
export type StepId = `STEP-${string}`;

/** MC-01 to MC-14, from the Operational Control Matrix. */
export type MasterControlId = `MC-${string}`;

/**
 * - mandatory: applies to every case.
 * - conditional: applies only when `appliesWhen` holds for the case facts.
 * - exception: applies only after it has been raised on the case (by a failure rule or a person).
 */
export type StepClass = "mandatory" | "conditional" | "exception";

/**
 * Who has to act for the step to move. Maps onto the task statuses
 * "Awaiting SME", "Awaiting buyer", "Awaiting bank" and "Awaiting authority".
 * - entrust: Entrust facilitator or reviewer (verification, sign-off)
 * - system: CLEAR does it (lookups, timers, scoring)
 */
export type StepOwner = "sme" | "entrust" | "system" | "buyer" | "bank" | "authority";

/**
 * How far a completed step carries.
 * - company: done once per SME (licences, tax clearance)
 * - product: done once per product (identity, HS code)
 * - shipment: done for every export case
 */
export type StepScope = "company" | "product" | "shipment";

/** Case facts that drive branching. A fact that has not been recorded yet is unknown. */
export type FactKey =
  | "product"
  | "destinationCountry"
  | "transportMode"
  | "coldChain"
  | "paymentTerms"
  | "incoterm"
  | "sourcingChannel"
  | "phytoCertificateRequired"
  | "healthCertificateRequired"
  | "customsChannel";

/**
 * Applicability condition over case facts.
 * A leaf holds when the fact's value (or, for multi-valued facts, any of its values) is in `in`.
 */
export type Condition =
  | { fact: FactKey; in: readonly string[] }
  | { all: readonly Condition[] }
  | { any: readonly Condition[] }
  | { not: Condition };

export interface FactDefinition {
  key: FactKey;
  label: string;
  help: string;
  /** Allowed values. Absent for free values such as an ISO country code. */
  options?: readonly { value: string; label: string }[];
  /** True when a case can hold several values at once (for example 10% advance + 90% CAD). */
  multiple?: boolean;
  /** The step where this fact is normally established, if it is not known when the case opens. */
  determinedAt?: StepId;
}

export interface SourceRef {
  title: string;
  url?: string;
  /** What the source supports, so a general page is not read as proof of everything. */
  note?: string;
}

export interface EvidenceType {
  id: string;
  name: string;
  issuer: string;
  /**
   * Physical certificates, bank permit stamps and customs release notes always need a human
   * reviewer. Automated checks can pre-validate them but not approve them (Entrust, Q9).
   */
  humanReviewRequired: boolean;
  /** How long the evidence stays valid after it is issued. Only set where a source gives it. */
  validity?: { days: number; source: SourceRef };
}

export interface EvidenceRequirement {
  type: string;
  /** Required only when this holds. */
  when?: { condition: Condition; description: string };
}

/** A date the clock can run from, other than a step's completion. */
export type CaseDate = "plannedLoading" | "estimatedArrival";

export interface Deadline {
  description: string;
  starts: { afterStep: StepId } | { caseDate: CaseDate };
  /** Negative values mean "before" the start point (for example 24 hours before loading). */
  due: { days: number } | { hours: number };
  source: SourceRef;
}

export interface StepDefinition {
  id: StepId;
  phase: PhaseId;
  name: string;
  /** The name in Entrust's specification, when we changed it. */
  specName?: string;
  class: StepClass;
  /** The class in Entrust's specification, when we changed it. */
  specClass?: StepClass;
  owner: StepOwner;
  /** The authority or outside party involved, if any. */
  authority: string | null;
  scope: StepScope;
  masterControl: MasterControlId;
  /** Steps that must be completed or not applicable first. A milestone lists the previous milestone. */
  prerequisites: readonly StepId[];
  /** Required for conditional steps, and only allowed on them. */
  appliesWhen?: { condition: Condition; description: string };
  /** Required for exception steps: what raises it. */
  raisedWhen?: string;
  evidence: readonly EvidenceRequirement[];
  deadline?: Deadline;
  /** The phase's milestone sign-off. It also waits on every other step in its phase. */
  milestone?: true;
  /** Why this step differs from Entrust's specification, when it does. */
  correction?: string;
  sources?: readonly SourceRef[];
}

export interface PhaseDefinition {
  id: PhaseId;
  name: string;
  /** The milestone that the phase's gate step locks. */
  milestone: string;
  firstStep: StepId;
  lastStep: StepId;
}

export interface MasterControl {
  id: MasterControlId;
  name: string;
  objective: string;
  /** Classification from the Operational Control Matrix. */
  classification: "mandatory" | "conditional" | "advisory";
  /** The pilot checkpoint stages (S01 to S14 of each CE case) this control covers. */
  checkpointStages: readonly string[];
}

export const FAILURE_RULE_IDS = [
  "FL-01", "FL-02", "FL-03", "FL-04", "FL-05", "FL-06", "FL-07",
  "FL-08", "FL-09", "FL-10", "FL-11", "FL-12", "FL-13", "FL-14",
] as const;
export type FailureRuleId = (typeof FAILURE_RULE_IDS)[number];

export type FlagSeverity = "critical" | "high" | "medium";

/** A failure rule: a situation that raises a flag on a case and holds the steps it would carry forward. */
export interface FailureRuleDefinition {
  id: FailureRuleId;
  name: string;
  severity: FlagSeverity;
  /**
   * - matrix: defined in Entrust's Operational Control Matrix (FL-01 to FL-08)
   * - proposed: ours, written from a failure point in the Six-SME Reconstruction Register, because
   *   the specification refers to FL-01 to FL-14 but only defines eight
   */
  origin: "matrix" | "proposed";
  /** The Register failure point a proposed rule comes from, such as FP-05. */
  basis?: string;
  /** What raises the flag, in words Entrust can check against their specification. */
  description: string;
  /** Exception steps raised on the case with the flag. They stay raised after the flag is resolved. */
  raises: readonly StepId[];
  /** Steps held while the flag is open. Waiving or resolving the flag releases them. */
  blocks: readonly StepId[];
  /**
   * What the rule needs that a case does not hold yet. A rule with no check in the GATE engine is
   * defined but dormant until that data exists; one with a check works on what it can see.
   */
  waitingOn?: string;
  sources?: readonly SourceRef[];
}

/**
 * The 24 points of the shipping document comparison (#12), which Entrust's spec calls a "24-point
 * check" without listing them, plus the quantity tolerance a letter of credit states.
 */
export const DOCUMENT_FIELD_KEYS = [
  "exporter", "consignee", "notifyParty", "buyer", "goodsDescription", "hsCode", "quantity", "netWeight",
  "grossWeight", "packages", "shippingMarks", "containerNumbers", "sealNumbers", "portOfLoading",
  "portOfDischarge", "vesselOrFlight", "shippedOnBoardDate", "invoiceReference", "unitPrice", "totalValue",
  "currency", "incotermPlace", "paymentReference", "countryOfOrigin", "quantityTolerance",
] as const;
export type DocumentFieldKey = (typeof DOCUMENT_FIELD_KEYS)[number];

/**
 * How a field's value is read and compared:
 * - text: names, addresses, descriptions and marks; case, accents and punctuation don't matter
 * - code: references; only letters and digits count
 * - codes: a list of container or seal numbers, compared as a set
 * - hs_code: digits, at least 6; an 8-digit national code matches its 6-digit prefix
 * - date: an ISO date
 * - count: a whole number
 * - quantity: a number and a unit (19200 kg, 19.2 mt, 320 bags)
 * - weight: a number and a weight unit (kg, lb, mt)
 * - price: a unit price such as 6.80 USD/kg
 * - amount: a money amount without its currency
 * - currency: an ISO 4217 code
 * - country: a country name or its ISO alpha-2 code
 * - tolerance: what a letter of credit says about the quantity (a percentage, "about", "none", "not stated")
 */
export type DocumentFieldKind =
  | "text" | "code" | "codes" | "hs_code" | "date" | "count" | "quantity" | "weight" | "price"
  | "amount" | "currency" | "country" | "tolerance";

export interface DocumentFieldDefinition {
  key: DocumentFieldKey;
  /** Its place in the 24 points, 1 to 24. Ours have none. */
  number: number | null;
  label: string;
  help: string;
  kind: DocumentFieldKind;
  /** The quantity tolerance applies when this field is compared across documents. */
  tolerance?: true;
}

export interface DocumentFieldRequirement {
  fields: readonly DocumentFieldKey[];
  /** Needed only when this holds. */
  when?: { condition: Condition; description: string };
}

/**
 * A document in the comparison. Its id is the evidence type, so the document and its evidence are
 * one thing.
 * - shipping: compared with the others on every field they share
 * - reference: carries what the rules need to check the shipping documents against (the bank
 *   permit's value, the letter of credit's tolerance)
 */
export interface ReconciliationDocument {
  id: string;
  name: string;
  role: "shipping" | "reference";
  /** Needed only when this holds. */
  requiredWhen?: { condition: Condition; description: string };
  /**
   * The fields this document may carry. Not every field is on every document: whoever enters
   * the values leaves blank what the document doesn't show, and only a field that two or more
   * documents carry is compared.
   */
  fields: readonly DocumentFieldKey[];
  /** Fields that must be entered before the comparison can come out clear. */
  requires?: readonly DocumentFieldRequirement[];
}
