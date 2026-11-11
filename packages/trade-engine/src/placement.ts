import type { TradeRules } from "@entrust/trade-rules";
import { buildLearningPlan } from "./plan";
import type { LearningPlan } from "./plan";
import type { PathwayAssignment } from "./pathway";
import { validateResponses } from "./responses";
import type { Answers } from "./responses";
import { scoreDomains } from "./scoring";
import type { Scores } from "./scoring";
import type { AssessmentStatus, EvidenceConfidence, LearningPlanStatus } from "./statuses";

export interface PlacementInput {
  answers: Answers;
  /** From the onboarding diagnostic (Q135 and Q137): the placement assessment doesn't ask for it again. */
  pathway: PathwayAssignment;
  /** Questions where staff approved "not applicable". */
  approvedNotApplicable?: readonly string[];
  /** How well each answer is backed. Questions not listed are self-reported. */
  evidence?: Readonly<Record<string, EvidenceConfidence>>;
  /** Whether the financial records have been verified. Leave it out while that isn't known. */
  recordsVerified?: boolean | undefined;
}

export interface PlacementOutcome {
  rulesVersion: string;
  scores: Scores;
  plan: LearningPlan;
  /** scored, or review_required when the engine sends the assessment to staff. */
  assessmentStatus: Extract<AssessmentStatus, "scored" | "review_required">;
  /** generated, or review_required for the same reason. */
  planStatus: Extract<LearningPlanStatus, "generated" | "review_required">;
}

/**
 * What happens when a placement assessment is submitted: score the domains and trigger groups, then build
 * the learning plan from the scores, the answers and the pathway. The assessment becomes scored and the
 * plan generated, unless the engine finds a reason for staff to look (a provisional pathway, a "not
 * applicable" waiting for approval, answers that disagree), when both wait for review. The same answers,
 * pathway and rules version always give the same outcome, so the stored result can be reproduced.
 * Throws if the answers aren't a complete, valid submission: check them with `validateResponses` first.
 */
export function evaluatePlacement(rules: TradeRules, input: PlacementInput): PlacementOutcome {
  const check = validateResponses(rules, input.answers, { submit: true });
  if (check.errors.length) {
    throw new RangeError(`The placement answers can't be scored: ${check.errors.map((e) => e.message).join("; ")}`);
  }
  const scores = scoreDomains(rules, {
    answers: input.answers,
    ...(input.approvedNotApplicable ? { approvedNotApplicable: input.approvedNotApplicable } : {}),
    ...(input.evidence ? { evidence: input.evidence } : {}),
  });
  const plan = buildLearningPlan(rules, { answers: input.answers, scores, pathway: input.pathway, recordsVerified: input.recordsVerified ?? recordsVerifiedFrom(scores, input.evidence) });
  return {
    rulesVersion: rules.version,
    scores,
    plan,
    assessmentStatus: plan.requiresHumanReview ? "review_required" : "scored",
    planStatus: plan.requiresHumanReview ? "review_required" : "generated",
  };
}

/** Evidence staff have looked at. Self-reported and merely documented answers don't verify anything. */
const VERIFIED: readonly EvidenceConfidence[] = ["reviewed", "verified"];

/**
 * Whether the financial records are verified, for Priority Rule 1 (RULE-01: records before finance), once the evidence
 * behind the answers is known: the financial records domain's evidence, its weakest question's, has been reviewed or
 * verified by staff. Without evidence it isn't known, and unknown is not a gap.
 */
export function recordsVerifiedFrom(scores: Scores, evidence: PlacementInput["evidence"]): boolean | undefined {
  if (!evidence) return undefined;
  const records = scores.domains.find((d) => d.id === "financial_records");
  return records ? VERIFIED.includes(records.evidence) : undefined;
}
