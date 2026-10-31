import type { Band, TradeRules } from "@entrust/trade-rules";
import { EVIDENCE_CONFIDENCE, weakerConfidence } from "./statuses";
import type { EvidenceConfidence } from "./statuses";
import type { Answers } from "./responses";
import { pointsPerQuestion } from "./rules";

export interface ScoreInput {
  answers: Answers;
  /** Questions where staff approved "not applicable". Only these leave the denominator. */
  approvedNotApplicable?: readonly string[];
  /** How well each answer is backed. Questions not listed are self-reported. */
  evidence?: Readonly<Record<string, EvidenceConfidence>>;
}

export interface ScoreResult {
  id: string;
  /** Points earned on the questions with a valid answer. */
  points: number;
  /** Maximum applicable points: the top score for each question with a valid answer. */
  maxPoints: number;
  /** Questions in the domain or group. */
  eligible: number;
  /** Questions with a score from 0 to 3. */
  valid: number;
  approvedNotApplicable: number;
  /** Answered "not applicable" but not approved yet. They stay in the denominator and are flagged. */
  pendingNotApplicable: readonly string[];
  notKnown: readonly string[];
  unanswered: readonly string[];
  /** Valid answers over (eligible questions less approved not applicable), 0 to 1. */
  coverage: number;
  /** 0 to 100, or null when too few questions have a valid answer. Missing is never zero. */
  score: number | null;
  band: Band["id"] | null;
  /** The weakest backing among the answers scored. Never part of the score. */
  evidence: EvidenceConfidence;
}

export interface Scores {
  rulesVersion: string;
  domains: readonly ScoreResult[];
  groups: readonly ScoreResult[];
}

/** The band a score of points out of maxPoints falls in, compared exactly so a rounded score can't tip it over a boundary. */
function bandOfRatio(bands: readonly Band[], points: number, maxPoints: number): Band["id"] {
  const reached = bands.filter((b) => points * 100 >= b.from * maxPoints);
  return (reached.at(-1) ?? bands[0]!).id;
}

/** The band for a score from 0 to 100: the last band whose start it reaches. */
export function bandFor(rules: TradeRules, score: number): Band["id"] {
  return bandOfRatio(rules.bands, score, 100);
}

function scoreQuestions(rules: TradeRules, id: string, questions: readonly string[], input: ScoreInput): ScoreResult {
  const approved = new Set(input.approvedNotApplicable);
  let points = 0;
  let valid = 0;
  let confidence: EvidenceConfidence = EVIDENCE_CONFIDENCE.at(-1)!;
  const pendingNotApplicable: string[] = [];
  const notKnown: string[] = [];
  const unanswered: string[] = [];
  let approvedNotApplicable = 0;

  for (const q of questions) {
    const answer = input.answers[q];
    if (typeof answer === "number") {
      points += answer;
      valid += 1;
      confidence = weakerConfidence(confidence, input.evidence?.[q] ?? "self_reported");
    } else if (answer === "not_applicable") {
      if (approved.has(q)) approvedNotApplicable += 1;
      else pendingNotApplicable.push(q);
    } else if (answer === "not_known") notKnown.push(q);
    else unanswered.push(q);
  }

  const denominator = questions.length - approvedNotApplicable;
  const coverage = denominator > 0 ? valid / denominator : 0;
  const maxPoints = valid * pointsPerQuestion(rules);
  // A small tolerance keeps 4 of 5 questions at exactly 80% from missing on floating point.
  const scored = denominator > 0 && valid > 0 && valid >= rules.thresholds.minCoverage * denominator - 1e-9;
  return {
    id,
    points,
    maxPoints,
    eligible: questions.length,
    valid,
    approvedNotApplicable,
    pendingNotApplicable,
    notKnown,
    unanswered,
    coverage,
    score: scored ? Math.round((points / maxPoints) * 10000) / 100 : null,
    band: scored ? bandOfRatio(rules.bands, points, maxPoints) : null,
    evidence: valid ? confidence : "self_reported",
  };
}

/**
 * Score each domain and trigger group from placement answers. The same answers and rules version always
 * give the same scores. An answer of "not known" isn't scored and isn't zero, and a domain without enough
 * valid answers has no score.
 */
export function scoreDomains(rules: TradeRules, input: ScoreInput): Scores {
  return {
    rulesVersion: rules.version,
    domains: rules.domains.map((d) => scoreQuestions(rules, d.id, d.questions, input)),
    groups: rules.triggerGroups.map((g) => scoreQuestions(rules, g.id, g.questions, input)),
  };
}
