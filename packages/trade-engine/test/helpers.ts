import { findTradeRules } from "@entrust/trade-rules";
import type { TradeRules } from "@entrust/trade-rules";
import type { Answer, Answers, PathwayInput } from "../src";
import { assignPathway, buildLearningPlan, scoreDomains } from "../src";

export const rules = findTradeRules("0.2.0") as TradeRules;
export const rules010 = findTradeRules("0.1.0") as TradeRules;

const CAPABILITY = rules.template.questions.filter((q) => q.kind === "capability").map((q) => q.id);

/** A complete set of placement answers: every capability question "repeatable" (a score of 2, so every group is functional), no deal, one buyer. */
export function answers(overrides: Record<string, Answer> = {}): Answers {
  return {
    A1: "never",
    A2: "none",
    A3: "1",
    A4: "no",
    A5: ["not_available"],
    C7: "never_applied",
    ...Object.fromEntries(CAPABILITY.map((id) => [id, 2])),
    ...overrides,
  };
}

/** Answers with a whole group of questions set to one score. */
export const setAll = (ids: readonly string[], score: Answer): Record<string, Answer> => Object.fromEntries(ids.map((id) => [id, score]));

export const noShipment: PathwayInput = { asOf: "2026-11-19", shipmentVerified: false, liveOrder: false };

/** Score, assign a pathway and build the plan for a set of answers. */
export function planFor(a: Answers, pathway: Partial<PathwayInput> = {}, extra: { recordsVerified?: boolean } = {}) {
  const input = { ...noShipment, ...pathway };
  const assignment = assignPathway(rules, input);
  const scores = scoreDomains(rules, { answers: a });
  return { assignment, scores, plan: buildLearningPlan(rules, { answers: a, scores, pathway: assignment, ...extra }) };
}

export const order = (plan: { modules: readonly { module: string }[] }): string[] => plan.modules.map((m) => m.module);
