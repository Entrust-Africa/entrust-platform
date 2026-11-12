/**
 * The shape of a MIZAN scoring configuration: what an assessor rates, how ratings are weighted, and what caps or withholds a
 * readiness level. A configuration is data, published under a version, and never edited afterwards: every assessment stores
 * the version and fingerprint it was scored under, so an earlier result can always be explained.
 */

/** A rating on a criterion's written anchors, 0 (weakest) to 4 (strongest). */
export type RatingScore = 0 | 1 | 2 | 3 | 4;

/** Evidence levels, from audited (E1) to unsupported (E5). */
export const EVIDENCE_CODES = ["E1", "E2", "E3", "E4", "E5"] as const;
export type EvidenceCode = (typeof EVIDENCE_CODES)[number];

/** The financial indicators the engine computes (`@entrust/mizan-engine`); a quantitative criterion shows one of them. */
export const RATIO_KEYS = [
  "current_ratio",
  "quick_ratio",
  "gross_margin",
  "net_margin",
  "roa",
  "roe",
  "debt_to_equity",
  "interest_coverage",
  "operating_cash_flow",
  "working_capital",
  "ar_days",
  "inventory_days",
  "ap_days",
  "cash_conversion_cycle",
  "dscr",
  "revenue_growth",
  "ebitda",
  "ebitda_margin",
  "top_customer_share",
] as const;
export type RatioKey = (typeof RATIO_KEYS)[number];

/** Where an improvement action belongs in the report's plan. Each pillar has one. */
export const AREAS = ["financial", "operational", "commercial", "governance"] as const;
export type Area = (typeof AREAS)[number];

/**
 * The suggested rating for a ratio: a hint to the assessor, never the rating itself. Bands are listed from rating 0 up.
 * Higher is better: the suggestion is the band with the highest `atLeast` the value reaches (`null` is the floor).
 * Lower is better: the suggestion is the band with the lowest `atMost` the value stays within (`null` is no limit).
 * Limits are inclusive.
 */
export type RatingSuggestion =
  | { direction: "higher_is_better"; bands: { atLeast: number | null; rating: RatingScore }[] }
  | { direction: "lower_is_better"; bands: { atMost: number | null; rating: RatingScore }[] };

export interface Criterion {
  /** For example "D3.2": the dimension, then the criterion. */
  id: string;
  title: string;
  /** Weight relative to the other criteria in its dimension. */
  weight: number;
  /** Must be rated (0 to 4) or marked not applicable before the assessment can be submitted. */
  mandatory: boolean;
  kind: "quantitative" | "qualitative";
  /** Quantitative criteria: the ratio shown to the assessor. */
  ratio?: RatioKey;
  suggestion?: RatingSuggestion;
  /** The suggestion when equity is zero or negative, where the ratio itself is meaningless (debt-to-equity). */
  ratingWhenNegativeEquity?: RatingScore;
  /** When "not applicable" is expected, as guidance for the assessor. */
  naWhen?: string;
  /** The written anchor for each rating, 0 to 4. */
  anchors: [string, string, string, string, string];
  evidence: string[];
  /** The corrective action for the improvement plan when the criterion is rated low or not evidenced. */
  improvement: string;
}

export interface Dimension {
  id: string;
  title: string;
  pillar: string;
  /** Points out of 100. */
  weight: number;
  criteria: Criterion[];
}

export interface Pillar {
  id: string;
  title: string;
  area: Area;
}

export interface EvidenceLevel {
  code: EvidenceCode;
  label: string;
  /** Contribution to the Evidence Confidence index, 0 to 1. */
  value: number;
}

/** A condition that must pass before any level is issued, such as valid registration. */
export interface Gate {
  id: string;
  title: string;
  description: string;
}

/** A critical risk that caps the level when it is present. */
export interface Override {
  id: string;
  title: string;
  description: string;
  /** The highest level that can be issued while it is triggered. */
  capLevel: number;
  /** Set when the engine decides it from the financials; otherwise the assessor does. */
  automatic?: "negative_equity_and_negative_operating_cash_flow";
}

export interface ReadinessLevel {
  level: number;
  label: string;
  /** The lowest total score (out of 100, rounded to one decimal place) that reaches this level. */
  minScore: number;
  /** What the level means for the SME, in plain words. */
  meaning: string;
}

export interface MizanConfig {
  /** Version of this exact configuration, such as "0.2.1-interim". */
  version: string;
  /** The methodology it implements, such as "MIZAN-Core v0.2-interim". */
  methodology: string;
  status: string;
  /** Approved for assessments whose report is issued to the SME. */
  clientIssue: boolean;
  effectiveFrom: string;
  pillars: Pillar[];
  dimensions: Dimension[];
  evidenceLevels: EvidenceLevel[];
  gates: Gate[];
  overrides: Override[];
  levels: ReadinessLevel[];
  thresholds: {
    /** Share of a dimension's applicable criterion weight that must be rated for its score to count towards a level. */
    dimensionCoverage: number;
    /** A pillar scoring below this share of its points caps the level at `pillarFloorCapLevel`. */
    pillarFloor: number;
    pillarFloorCapLevel: number;
    /** A business operating for fewer months is on the early-stage track: diagnostics, but no level. */
    earlyStageMonths: number;
    /** Evidence Confidence grades by the lowest index that reaches them, highest first. */
    confidenceGrades: { grade: "A" | "B" | "C" | "D" | "E"; min: number }[];
  };
  /** How the strengths, weaknesses and improvement plan are drawn from the ratings. */
  diagnostics: {
    /** A dimension scoring at least this share of its points is a strength. */
    strengthAtLeast: number;
    /** A dimension scoring below this share of its points is a weakness. */
    weaknessBelow: number;
    /** A criterion rated at or below this gets an action. */
    actionAtOrBelow: RatingScore;
    /** Dimensions weighing at least this many points are key: their low mandatory criteria are high priority. */
    keyDimensionWeight: number;
    /** A mandatory criterion in a key dimension also gets an action when rated at or below this. */
    keyCriterionActionAtOrBelow: RatingScore;
    timelines: { high: string; medium: string; low: string };
    /** What each action's measurable indicator asks for at reassessment. */
    target: { rating: RatingScore; evidence: EvidenceCode };
  };
  /** Parts of the configuration Entrust has not yet validated, with their entry in Entrust's register. */
  provisional: { item: string; register: string; note: string }[];
}
