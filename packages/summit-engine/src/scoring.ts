import type { Category, CategoryId, Criterion, OpportunityPathway, SummitRules } from "./types";
import { TOTAL_POINTS } from "./types";

/** The criteria of a category that score an applicant on this pathway. */
export function applicableCriteria(category: Category, pathway: OpportunityPathway): Criterion[] {
  return category.criteria.filter((c) => !c.pathways || c.pathways.includes(pathway));
}

/** The investment and combined pathways seek investment; a trade or partnership applicant says so in the form. */
export function seeksInvestment(pathway: OpportunityPathway, saidYes: boolean): boolean {
  return pathway === "investment" || pathway === "combined_trade_and_investment" || saidYes;
}

/** An officer's points. */
export interface ScoreInput {
  pathway: OpportunityPathway;
  /** A trade or partnership applicant's answer to "Are you also seeking investment?". The other pathways seek it already. */
  seekingInvestment: boolean;
  /** Whole points by criterion ID. */
  scores: Readonly<Record<string, number>>;
}

export type ScoreProblemCode = "unknown_criterion" | "not_applicable" | "not_whole" | "out_of_range";

export interface ScoreProblem {
  criterion: string;
  code: ScoreProblemCode;
  message: string;
}

export interface CategoryScore {
  id: CategoryId;
  maxPoints: number;
  /** False for an investment-only category when the applicant isn't seeking investment. */
  applicable: boolean;
  /** Set once every criterion of an applicable category has a valid score. */
  points?: number;
  /** Criteria still to score. */
  missing: readonly string[];
}

export interface ScoreResult {
  rulesVersion: string;
  /** The pathway scored, kept with the result because the scorecard asks for it beside an adjusted score. */
  pathway: OpportunityPathway;
  /** Whether the rules are approved. Officers can't record a score against a draft. */
  approved: boolean;
  categories: readonly CategoryScore[];
  notApplicable: readonly CategoryId[];
  problems: readonly ScoreProblem[];
  /** Every applicable criterion has a valid score. */
  complete: boolean;
  /** The points an applicant could earn: 100, less the categories that don't apply. */
  possible: number;
  /** True when a category was left out, so `total` is the points earned scaled up from `possible` (the scorecard's adjusted score). */
  normalized: boolean;
  /** The points earned, once complete. */
  points?: number;
  /** Out of 100, once complete. With a category left out it is the points earned scaled up from `possible`, to one decimal. */
  total?: number;
}

/** True when officers may score against these rules. */
export const canAssess = (rules: SummitRules): boolean => rules.status === "approved";

/**
 * Add up an officer's points under the rubric. A criterion scores whole points from 0 to its maximum.
 * An investment-only category isn't scored for an applicant that isn't seeking investment, and the rest
 * is scaled to 100, so a trade applicant is neither penalized nor given the points: 64 of 80 is 80 out of
 * 100. The earned points (`points`), what they were out of (`possible`) and the adjusted score (`total`) are
 * all in the result to be kept. An applicant that is seeking investment is scored on every category, however
 * little evidence it gave. The same input and rules always give the same answer. This says nothing about
 * eligibility.
 */
export function scoreApplication(rules: SummitRules, input: ScoreInput): ScoreResult {
  const investment = seeksInvestment(input.pathway, input.seekingInvestment);
  const problems: ScoreProblem[] = [];
  const known = new Map<string, { category: Category; criterion: Criterion; counts: boolean }>();
  for (const category of rules.rubric.categories) {
    const applicable = !category.investmentOnly || investment;
    for (const criterion of category.criteria) {
      const onPathway = !criterion.pathways || criterion.pathways.includes(input.pathway);
      known.set(criterion.id, { category, criterion, counts: applicable && onPathway });
    }
  }

  for (const [id, points] of Object.entries(input.scores)) {
    const found = known.get(id);
    const bad = (code: ScoreProblemCode, message: string) => problems.push({ criterion: id, code, message: `${id}: ${message}` });
    if (!found) bad("unknown_criterion", "the rubric has no such criterion");
    else if (!found.counts) bad("not_applicable", "this criterion isn't scored for this applicant");
    else if (!Number.isInteger(points)) bad("not_whole", "score whole points");
    else if (points < 0 || points > found.criterion.maxPoints) bad("out_of_range", `score 0 to ${found.criterion.maxPoints}`);
  }
  const invalid = new Set(problems.map((p) => p.criterion));

  const categories: CategoryScore[] = rules.rubric.categories.map((category) => {
    const applicable = !category.investmentOnly || investment;
    if (!applicable) return { id: category.id, maxPoints: category.maxPoints, applicable, missing: [] };
    const criteria = applicableCriteria(category, input.pathway);
    const missing = criteria.filter((c) => input.scores[c.id] === undefined || invalid.has(c.id)).map((c) => c.id);
    const points = missing.length ? undefined : criteria.reduce((sum, c) => sum + (input.scores[c.id] as number), 0);
    return { id: category.id, maxPoints: category.maxPoints, applicable, missing, ...(points === undefined ? {} : { points }) };
  });

  const scored = categories.filter((c) => c.applicable);
  const possible = scored.reduce((sum, c) => sum + c.maxPoints, 0);
  const complete = problems.length === 0 && scored.every((c) => c.points !== undefined);
  const points = complete ? scored.reduce((sum, c) => sum + (c.points as number), 0) : undefined;
  const total = points === undefined ? undefined : Math.round(((points / possible) * TOTAL_POINTS) * 10) / 10;
  return {
    rulesVersion: rules.version,
    pathway: input.pathway,
    approved: canAssess(rules),
    categories,
    notApplicable: categories.filter((c) => !c.applicable).map((c) => c.id),
    problems,
    complete,
    possible,
    normalized: possible !== TOTAL_POINTS,
    ...(points === undefined ? {} : { points }),
    ...(total === undefined ? {} : { total }),
  };
}
