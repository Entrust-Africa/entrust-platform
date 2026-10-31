import type { PathwayRules, PlanRules, TradeRules } from "@entrust/trade-rules";

/** The pathway and plan rules a version carries. 0.1.0 can score but has none, so it can't assign or plan. */
export function planningRules(rules: TradeRules): { pathway: PathwayRules; plan: PlanRules } {
  if (!rules.pathway || !rules.plan) {
    throw new Error(`TRADE rules ${rules.version} have no pathway and plan rules; use 0.2.0 or later`);
  }
  return { pathway: rules.pathway, plan: rules.plan };
}

/** The most a question can score: the top of the capability scale. */
export const pointsPerQuestion = (rules: TradeRules): number => Math.max(...rules.template.scale.map((s) => s.score));
