// TRADE's rules as data: the placement assessment, how its answers become domain scores, and the
// module catalogue. Nothing here reads a database or does I/O. The rules engine (@entrust/trade-engine)
// and the screens read these types; a published version never changes.

export const PATHWAYS = ["A", "B"] as const;
/** A is Export Entry and Readiness, B is Export Execution and Scale. */
export type Pathway = (typeof PATHWAYS)[number];

export const MODULE_IDS = ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10", "M11", "M12"] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const SECTION_IDS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

export const REASON_CODES = [
  "REQUIRED_ALL",
  "REQUIRED_TO_GRADUATE",
  "GAP_BUYER",
  "GAP_FINANCIAL",
  "GAP_TRADE_FINANCE",
  "GAP_COSTING",
  "GAP_EXECUTION",
  "GAP_OPERATIONS",
  "GAP_DIGITAL",
  "GAP_AI_PRODUCTIVITY",
  "LIVE_ORDER",
  "ACTIVE_QUOTATION",
  "NO_QUALIFIED_BUYER",
  "HAS_EXPORTED_RETENTION",
  "ASSESSMENT_NEEDED",
  "RECORDS_BEFORE_FINANCE",
  "TEST_OUT_OFFERED",
  "STAFF_OVERRIDE",
  "PATHWAY_RECENT_SHIPMENT",
  "PATHWAY_NO_RECENT_SHIPMENT",
  "PATHWAY_SHIPMENT_UNVERIFIED",
  "PATHWAY_ORDER_PRIORITY",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

/** The codes an assigned pathway can carry. A version with pathway rules defines all four. */
export const PATHWAY_REASON_CODES = [
  "PATHWAY_RECENT_SHIPMENT",
  "PATHWAY_NO_RECENT_SHIPMENT",
  "PATHWAY_SHIPMENT_UNVERIFIED",
  "PATHWAY_ORDER_PRIORITY",
] as const satisfies readonly ReasonCode[];

export interface ReasonCodeDefinition {
  code: ReasonCode;
  /** The sentence the SME sees next to the module. */
  text: string;
}

// The placement assessment.

/** The 0 to 3 capability scale used by sections B to G. */
export interface ScaleStep {
  score: 0 | 1 | 2 | 3;
  key: "not_in_place" | "informal" | "repeatable" | "documented_reviewed";
  label: string;
  definition: string;
}

/** An answer to a capability question that carries no points. */
export interface UnscoredAnswer {
  value: "not_applicable" | "not_known";
  label: string;
  /** What it does to the score, for assessors and screens. */
  effect: string;
}

export interface Option {
  value: string;
  label: string;
  /** In a multiple-choice question: if chosen, no other option can be (A5's "not available"). */
  exclusive?: boolean;
}

/**
 * choice and multi_choice have options, capability takes a scale step or an unscored answer, and
 * text is free text. Only capability questions earn points.
 */
export type QuestionKind = "choice" | "multi_choice" | "capability" | "text";

export interface Question {
  /** Stable ID shown to staff and stored with answers: A1, B3, G4. */
  id: string;
  /** Readable name for the stored answer. */
  key: string;
  section: SectionId;
  kind: QuestionKind;
  text: string;
  options?: readonly Option[];
  /** The form asks whether supporting documents are available. */
  evidenceBased: boolean;
  /** Asked only when an earlier question has one of these answers. */
  askWhen?: { question: string; in: readonly string[] };
  /** The spec doesn't give this wording, so Entrust should confirm it. */
  drafted?: boolean;
}

export interface Section {
  id: SectionId;
  title: string;
  /** Sections B to G score capability. Section A is context and never becomes a score. */
  scored: boolean;
  notes?: readonly string[];
  evidenceExamples?: string;
}

export interface PlacementTemplate {
  sections: readonly Section[];
  questions: readonly Question[];
  scale: readonly ScaleStep[];
  unscoredAnswers: readonly UnscoredAnswer[];
}

// Scoring.

export type DomainId =
  | "buyer_development"
  | "financial_records"
  | "transaction_finance"
  | "costing_execution"
  | "digital_productivity"
  | "operational_readiness";

/** One of the six scored domains, sections B to G. */
export interface Domain {
  id: DomainId;
  title: string;
  questions: readonly string[];
  /** 3 points a question. Kept as data so a question added without updating it fails validation. */
  maxPoints: number;
}

export type TriggerGroupId =
  | "buyer"
  | "financial"
  | "trade_finance"
  | "costing"
  | "execution"
  | "operations"
  | "digital"
  | "ai_productivity";

/**
 * A named set of questions scored like a domain. Modules trigger on these, because the spec's reference
 * code triggers on keys that don't match the six domains.
 */
export interface TriggerGroup {
  id: TriggerGroupId;
  title: string;
  questions: readonly string[];
  /** The module assigned when the group scores below the threshold. */
  module: ModuleId;
}

export interface Band {
  id: "critical_gap" | "developing" | "functional" | "demonstrated";
  label: string;
  /** Lowest score in the band. A score is in the last band whose `from` it reaches. */
  from: number;
  action: string;
}

export interface Thresholds {
  /** A domain or group below this assigns its module. */
  assignBelow: number;
  /** At or above this, the SME is offered a test-out. It never exempts by itself. */
  testOutFrom: number;
  /** M10 is assigned to an SME that has exported when the buyer group scores below this. */
  retentionBelow: number;
  /** Share of a domain's questions that need a valid answer before it is scored. */
  minCoverage: number;
}

// The module catalogue.

export type ContentStatus = "ready" | "draft" | "in_production";

export type CompletionCriterionId =
  | "lessons_complete"
  | "knowledge_check_passed"
  | "practical_output_passed"
  | "placement_submitted"
  | "pathway_acknowledged"
  | "assessor_signoff";

export interface CompletionCriterion {
  id: CompletionCriterionId;
  text: string;
}

export interface ModuleTrigger {
  /** Permanent ID of the rule, stored with every assignment. */
  ruleId: string;
  text: string;
  /** The reason codes this trigger can give. */
  reasonCodes: readonly ReasonCode[];
}

export interface Prerequisite {
  /** The module that has to come first. */
  module: ModuleId;
  ruleId: string;
  when: string;
  reasonCode: ReasonCode;
}

export interface ModuleDefinition {
  id: ModuleId;
  title: string;
  deliverable: string;
  /** The pathways that can be assigned the module. */
  pathways: readonly Pathway[];
  requiredForAll: boolean;
  /** The module's content differs by pathway (M11). */
  adaptedToPathway: boolean;
  trigger: ModuleTrigger;
  prerequisites: readonly Prerequisite[];
  completion: readonly CompletionCriterion[];
  contentStatus: ContentStatus;
}

/** How the pathway is assigned. Added in 0.2.0. */
export interface PathwayRules {
  /** A shipment on or after this many months before the assessment date counts as recent experience. */
  shipmentWindowMonths: number;
}

/**
 * How answers become an ordered learning plan. Added in 0.2.0. The values name answers to the
 * placement questions, so a version can't point at an answer the template doesn't have.
 */
export interface PlanRules {
  /** A2 answers that mean a confirmed order or a shipment in progress: urgent modules go straight after M01. */
  liveOrderStages: readonly string[];
  /** A2 answers that mean a quotation is out. */
  quotationStages: readonly string[];
  /** A2 answers that, with no active buyer in A3, mean there is no qualified buyer yet. */
  noBuyerStages: readonly string[];
  /** A1 answers that mean the SME has exported before. */
  exportedHistory: readonly string[];
  /** The modules a live order moves forward, in order. */
  urgentModules: readonly ModuleId[];
  /**
   * The order modules take in a plan: first, then gating prerequisites and urgent modules (placed by
   * the engine), then bottlenecks, enablers, and the relationship and closing modules. Every module
   * appears once.
   */
  sequence: {
    first: readonly ModuleId[];
    bottleneck: readonly ModuleId[];
    enabler: readonly ModuleId[];
    closing: readonly ModuleId[];
  };
}

/** One published version of TRADE's rules. */
export interface TradeRules {
  /** major.minor.patch. Every score and plan stores the one it used. */
  version: string;
  template: PlacementTemplate;
  domains: readonly Domain[];
  triggerGroups: readonly TriggerGroup[];
  bands: readonly Band[];
  thresholds: Thresholds;
  modules: readonly ModuleDefinition[];
  reasonCodes: readonly ReasonCodeDefinition[];
  /** Absent in 0.1.0, which can score but not assign a pathway or build a plan. */
  pathway?: PathwayRules;
  plan?: PlanRules;
}
