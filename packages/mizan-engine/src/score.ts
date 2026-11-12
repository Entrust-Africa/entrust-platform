import { allCriteria, type Criterion, type EvidenceCode, type MizanConfig, type RatingScore } from "@entrust/mizan-rules";
import { formatPercent, roundTo } from "./format";
import type { RatioSet, YearAnalysis } from "./ratios";
import type { GateStatus, RatingCode } from "./statuses";

export type RatingValue = RatingScore | RatingCode;

export interface CriterionInput {
  rating: RatingValue;
  /** Required for a rating of 0 to 4. */
  evidence?: EvidenceCode | null;
  /** The assessor's note; required when the rating differs from the suggestion. */
  note?: string | null;
}

export interface ScoreInput {
  /** By criterion id. A criterion with no entry is unrated. */
  ratings: Readonly<Record<string, CriterionInput | undefined>>;
  /** By gate id. A gate with no entry is pending. */
  gates: Readonly<Record<string, GateStatus | undefined>>;
  /** Overrides the assessor triggered, by id. Automatic overrides come from `latest` and can't be set here. */
  overrides: Readonly<Record<string, boolean | undefined>>;
  /** The latest year's analysis, for automatic overrides. */
  latest?: YearAnalysis | null;
  /** Unknown months count as established, not early-stage. */
  monthsOperating?: number | null;
}

export interface DimensionResult {
  id: string;
  title: string;
  pillar: string;
  weight: number;
  /** False when every criterion is not applicable. */
  applicable: boolean;
  /** Points out of `weight`, over the rated criteria only. Null when nothing is rated: missing evidence is never 0. */
  score: number | null;
  pct: number | null;
  /** Rated criterion weight over applicable criterion weight. */
  coverage: number | null;
  /** Coverage below the threshold: the level is withheld. */
  insufficient: boolean;
  counts: { rated: number; ne: number; uv: number; na: number; unrated: number };
}

export interface PillarResult {
  id: string;
  title: string;
  /** Weight of the pillar's dimensions that have a score. */
  max: number;
  score: number;
  pct: number | null;
  belowFloor: boolean;
}

/** In order of precedence: the first that applies is the result's status. */
export const RESULT_STATUSES = ["GATE_FAILED", "INCOMPLETE", "EARLY_STAGE", "INSUFFICIENT_EVIDENCE", "LEVEL_ISSUED"] as const;
export type ResultStatus = (typeof RESULT_STATUSES)[number];

export interface ScoreResult {
  configVersion: string;
  methodology: string;
  /**
   * Out of 100, over the dimensions that have a score, rounded to one decimal place. The level is read from this rounded
   * figure, so the score the report shows and the level always agree. Null when nothing is rated.
   */
  total: number | null;
  dimensions: DimensionResult[];
  pillars: PillarResult[];
  overallCoverage: number | null;
  /** Evidence Confidence: separate from the score, never discounts it. */
  confidenceIndex: number | null;
  confidenceGrade: "A" | "B" | "C" | "D" | "E" | null;
  gates: { id: string; title: string; status: GateStatus }[];
  overridesTriggered: { id: string; title: string; capLevel: number; automatic: boolean }[];
  /** The level the score alone reaches. */
  computedLevel: number | null;
  /** After overrides and the pillar floor. */
  cappedLevel: number | null;
  /** Null unless the status is LEVEL_ISSUED. */
  issuedLevel: number | null;
  status: ResultStatus;
  reasons: string[];
  missingMandatory: string[];
  missingEvidenceLevel: string[];
}

const EPSILON = 1e-9;
const isScore = (r: unknown): r is RatingScore => r === 0 || r === 1 || r === 2 || r === 3 || r === 4;

/** Every way the input doesn't fit the configuration: unknown ids, impossible ratings. The API refuses such input before scoring. */
export function inputErrors(cfg: MizanConfig, input: ScoreInput): string[] {
  const errors: string[] = [];
  const criteria = new Set(allCriteria(cfg).map((c) => c.criterion.id));
  const evidence = new Set(cfg.evidenceLevels.map((e) => e.code));
  for (const [id, entry] of Object.entries(input.ratings)) {
    if (!entry) continue;
    if (!criteria.has(id)) errors.push(`Unknown criterion ${id}`);
    else if (!isScore(entry.rating) && !["NE", "UV", "NA"].includes(entry.rating as string)) errors.push(`${id}: ${String(entry.rating)} is not a rating`);
    if (entry.evidence && !evidence.has(entry.evidence)) errors.push(`${id}: unknown evidence level ${entry.evidence}`);
  }
  for (const id of Object.keys(input.gates)) if (!cfg.gates.some((g) => g.id === id)) errors.push(`Unknown gate ${id}`);
  for (const [id, on] of Object.entries(input.overrides)) {
    const o = cfg.overrides.find((x) => x.id === id);
    if (!o) errors.push(`Unknown override ${id}`);
    else if (o.automatic && on !== undefined) errors.push(`${id} is worked out from the financials and can't be set by hand`);
  }
  return errors;
}

export function scoreAssessment(cfg: MizanConfig, input: ScoreInput): ScoreResult {
  const problems = inputErrors(cfg, input);
  if (problems.length) throw new Error(`The ratings don't fit configuration ${cfg.version}: ${problems.join("; ")}`);

  const reasons: string[] = [];
  const missingMandatory: string[] = [];
  const missingEvidenceLevel: string[] = [];
  const evidenceValue = new Map(cfg.evidenceLevels.map((e) => [e.code, e.value]));
  let confidenceSum = 0;
  let confidenceWeight = 0;
  let coverageSum = 0;
  let coverageWeight = 0;

  const dimensions: DimensionResult[] = cfg.dimensions.map((d) => {
    const counts = { rated: 0, ne: 0, uv: 0, na: 0, unrated: 0 };
    const criteriaWeight = d.criteria.reduce((a, c) => a + c.weight, 0);
    let applicableWeight = 0;
    let ratedWeight = 0;
    let weightedRating = 0;

    for (const c of d.criteria) {
      const entry = input.ratings[c.id];
      const r = entry?.rating;
      if (r === "NA") {
        counts.na++;
        continue;
      }
      applicableWeight += c.weight;
      if (r === undefined) {
        counts.unrated++;
        if (c.mandatory) missingMandatory.push(c.id);
      } else if (r === "NE") counts.ne++;
      else if (r === "UV") counts.uv++;
      else {
        counts.rated++;
        ratedWeight += c.weight;
        weightedRating += c.weight * r;
        const share = d.weight * (c.weight / criteriaWeight); // the criterion's share of the 100 points
        const ev = entry?.evidence ? evidenceValue.get(entry.evidence) : undefined;
        if (ev === undefined) missingEvidenceLevel.push(c.id);
        confidenceSum += share * (ev ?? 0);
        confidenceWeight += share;
      }
    }

    const applicable = applicableWeight > 0;
    const score = ratedWeight > 0 ? d.weight * (weightedRating / (4 * ratedWeight)) : null;
    const coverage = applicable ? ratedWeight / applicableWeight : null;
    if (coverage !== null) {
      coverageSum += d.weight * coverage;
      coverageWeight += d.weight;
    }
    return {
      id: d.id,
      title: d.title,
      pillar: d.pillar,
      weight: d.weight,
      applicable,
      score,
      pct: score === null ? null : score / d.weight,
      coverage,
      insufficient: coverage !== null && coverage < cfg.thresholds.dimensionCoverage - EPSILON,
      counts,
    };
  });

  const scored = dimensions.filter((d) => d.score !== null);
  const scoredWeight = scored.reduce((a, d) => a + d.weight, 0);
  const total = scoredWeight > 0 ? roundTo((scored.reduce((a, d) => a + d.score!, 0) / scoredWeight) * 100, 1) : null;

  const pillars: PillarResult[] = cfg.pillars.map((p) => {
    const ds = scored.filter((d) => d.pillar === p.id);
    const max = ds.reduce((a, d) => a + d.weight, 0);
    const score = ds.reduce((a, d) => a + d.score!, 0);
    const pct = max > 0 ? score / max : null;
    return { id: p.id, title: p.title, max, score, pct, belowFloor: pct !== null && pct < cfg.thresholds.pillarFloor - EPSILON };
  });

  const confidenceIndex = confidenceWeight > 0 ? confidenceSum / confidenceWeight : null;
  const grades = [...cfg.thresholds.confidenceGrades].sort((a, b) => b.min - a.min);
  const confidenceGrade = confidenceIndex === null ? null : (grades.find((g) => confidenceIndex >= g.min - EPSILON)?.grade ?? grades.at(-1)!.grade);

  const gates = cfg.gates.map((g) => ({ id: g.id, title: g.title, status: input.gates[g.id] ?? ("pending" as const) }));

  const overridesTriggered: ScoreResult["overridesTriggered"] = [];
  for (const o of cfg.overrides) {
    if (o.automatic === "negative_equity_and_negative_operating_cash_flow") {
      const equity = input.latest?.derived.equity ?? null;
      const ocf = input.latest?.derived.operatingCashFlow ?? null;
      if (equity !== null && ocf !== null && equity <= 0 && ocf < 0) overridesTriggered.push({ id: o.id, title: o.title, capLevel: o.capLevel, automatic: true });
    } else if (input.overrides[o.id]) {
      overridesTriggered.push({ id: o.id, title: o.title, capLevel: o.capLevel, automatic: false });
    }
  }

  const computedLevel = total === null ? null : levelForScore(cfg, total);
  let cappedLevel = computedLevel;
  const cap = (to: number, why: string) => {
    if (cappedLevel !== null && to < cappedLevel) {
      cappedLevel = to;
      reasons.push(`Level capped at ${to}: ${why}.`);
    }
  };
  for (const o of overridesTriggered) cap(o.capLevel, `${o.id} ${o.title}`);
  for (const p of pillars.filter((x) => x.belowFloor)) {
    cap(cfg.thresholds.pillarFloorCapLevel, `pillar ${p.id} (${p.title}) is below the ${formatPercent(cfg.thresholds.pillarFloor)} floor`);
  }

  let status: ResultStatus = "LEVEL_ISSUED";
  const failed = gates.filter((g) => g.status === "fail");
  const pending = gates.filter((g) => g.status === "pending");
  const insufficient = dimensions.filter((d) => d.insufficient);
  const months = input.monthsOperating;
  if (failed.length) {
    status = "GATE_FAILED";
    reasons.unshift(`Gate failed: ${failed.map((g) => `${g.id} ${g.title}`).join("; ")}. No readiness level is issued.`);
  } else if (missingMandatory.length || pending.length || missingEvidenceLevel.length) {
    status = "INCOMPLETE";
    if (missingEvidenceLevel.length) reasons.unshift(`Evidence level missing for: ${missingEvidenceLevel.join(", ")}.`);
    if (pending.length) reasons.unshift(`Gates pending: ${pending.map((g) => g.id).join(", ")}.`);
    if (missingMandatory.length) reasons.unshift(`Mandatory criteria not yet rated: ${missingMandatory.join(", ")}.`);
  } else if (typeof months === "number" && months < cfg.thresholds.earlyStageMonths) {
    status = "EARLY_STAGE";
    reasons.unshift(
      `The business has operated for ${months} months, under the ${cfg.thresholds.earlyStageMonths}-month threshold: early-stage track, so no readiness level is issued.`,
    );
  } else if (insufficient.length || total === null) {
    status = "INSUFFICIENT_EVIDENCE";
    reasons.unshift(
      `Evidence covers less than ${formatPercent(cfg.thresholds.dimensionCoverage)} of ${insufficient.map((d) => d.id).join(", ") || "every dimension"}, so the level is withheld. Missing evidence is not scored as poor performance.`,
    );
  }

  return {
    configVersion: cfg.version,
    methodology: cfg.methodology,
    total,
    dimensions,
    pillars,
    overallCoverage: coverageWeight > 0 ? coverageSum / coverageWeight : null,
    confidenceIndex,
    confidenceGrade,
    gates,
    overridesTriggered,
    computedLevel,
    cappedLevel,
    issuedLevel: status === "LEVEL_ISSUED" ? cappedLevel : null,
    status,
    reasons,
    missingMandatory,
    missingEvidenceLevel,
  };
}

/** The level a total (already rounded to one decimal place) reaches. */
export function levelForScore(cfg: MizanConfig, total: number): number {
  const levels = [...cfg.levels].sort((a, b) => b.minScore - a.minScore);
  return (levels.find((l) => total >= l.minScore) ?? levels.at(-1)!).level;
}

/**
 * The interim suggested rating for a criterion from its ratio: a hint to the assessor, never the rating. Null when the
 * criterion has no suggestion or the ratio can't be computed.
 */
export function suggestRating(c: Criterion, ratios: Partial<RatioSet>, ctx: { negativeEquity?: boolean } = {}): RatingScore | null {
  if (ctx.negativeEquity && c.ratingWhenNegativeEquity !== undefined) return c.ratingWhenNegativeEquity;
  const s = c.suggestion;
  if (!s || !c.ratio) return null;
  const v = ratios[c.ratio];
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const reached =
    s.direction === "higher_is_better" ? s.bands.filter((b) => b.atLeast === null || v >= b.atLeast) : s.bands.filter((b) => b.atMost === null || v <= b.atMost);
  return reached.at(-1)?.rating ?? null;
}

export interface RatingDeparture {
  criterionId: string;
  rating: RatingScore;
  suggested: RatingScore;
  /** The assessor wrote a reason. Submission is blocked while any departure is unexplained. */
  explained: boolean;
}

/** Ratings that differ from the suggestion for the latest year. The financials can change after rating, so check again at submission. */
export function ratingDepartures(cfg: MizanConfig, ratings: ScoreInput["ratings"], latest: YearAnalysis | null | undefined): RatingDeparture[] {
  if (!latest) return [];
  const negativeEquity = latest.derived.equity !== null && latest.derived.equity <= 0;
  const out: RatingDeparture[] = [];
  for (const { criterion } of allCriteria(cfg)) {
    const entry = ratings[criterion.id];
    if (!entry || !isScore(entry.rating)) continue;
    const suggested = suggestRating(criterion, latest.ratios, { negativeEquity });
    if (suggested !== null && suggested !== entry.rating) {
      out.push({ criterionId: criterion.id, rating: entry.rating, suggested, explained: !!entry.note?.trim() });
    }
  }
  return out;
}
