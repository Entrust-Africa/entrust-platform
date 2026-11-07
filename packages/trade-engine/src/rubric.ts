export interface RubricCriterionDef {
  id: string;
  title: string;
  description?: string;
  maxPoints: number;
  mustHave: boolean;
}

export interface RubricBandDef {
  label: string;
  from: number;
}

export interface RubricCriticalFailureDef {
  id: string;
  text: string;
  worksheetFlag?: string;
  autoCheck?: string;
}

export interface RubricDef {
  criteria: readonly RubricCriterionDef[];
  passMark: number;
  mustHaveMinimum: number;
  bands: readonly RubricBandDef[];
  criticalFailures?: readonly RubricCriticalFailureDef[];
}

export interface CriterionScoreInput {
  points: number;
  comment?: string;
}

export interface CriterionScoredResult {
  criterionId: string;
  title: string;
  points: number;
  maxPoints: number;
  mustHave: boolean;
  comment?: string;
  passed: boolean;
}

export interface RubricEvaluation {
  totalPoints: number;
  maxPoints: number;
  percentage: number;
  band: string;
  mustHavePassed: boolean;
  hasCriticalFailure: boolean;
  confirmedCriticalFailures: string[];
  passed: boolean;
  outcome: "passed" | "revision_required";
  criterionResults: CriterionScoredResult[];
}

/**
 * Evaluates assessor scores and confirmed critical failures against a module rubric.
 *
 * Requirements (#67, #48):
 * - Follows rubric data with no thresholds in code.
 * - Under unified standard, a submission passes if:
 *   1. No confirmed critical failure
 *   2. Total score >= rubric.passMark
 *   3. Every must-have criterion >= rubric.mustHaveMinimum
 * - Bands: Critical, Developing, Functional, Demonstrated (selected by score percentage).
 */
export function evaluateRubric(
  rubric: RubricDef,
  scores: Record<string, CriterionScoreInput | undefined>,
  confirmedCriticalFailures: readonly string[] = []
): RubricEvaluation {
  let totalPoints = 0;
  let maxPoints = 0;
  let mustHavePassed = true;

  const criterionResults: CriterionScoredResult[] = rubric.criteria.map((crit) => {
    const input = scores[crit.id];
    const points = Math.max(0, Math.min(crit.maxPoints, Math.round(input?.points ?? 0)));
    totalPoints += points;
    maxPoints += crit.maxPoints;

    const criterionPassed = !crit.mustHave || points >= rubric.mustHaveMinimum;
    if (!criterionPassed) {
      mustHavePassed = false;
    }

    return {
      criterionId: crit.id,
      title: crit.title,
      points,
      maxPoints: crit.maxPoints,
      mustHave: crit.mustHave,
      comment: input?.comment?.trim() || undefined,
      passed: criterionPassed,
    };
  });

  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  // Determine band by finding the highest band threshold <= percentage
  const sortedBands = [...rubric.bands].sort((a, b) => a.from - b.from);
  let band = sortedBands[0]?.label ?? "Critical";
  for (const b of sortedBands) {
    if (percentage >= b.from) {
      band = b.label;
    }
  }

  const hasCriticalFailure = confirmedCriticalFailures.length > 0;
  const meetsPassMark = totalPoints >= rubric.passMark;
  const passed = !hasCriticalFailure && meetsPassMark && mustHavePassed;

  return {
    totalPoints,
    maxPoints,
    percentage,
    band,
    mustHavePassed,
    hasCriticalFailure,
    confirmedCriticalFailures: [...confirmedCriticalFailures],
    passed,
    outcome: passed ? "passed" : "revision_required",
    criterionResults,
  };
}
