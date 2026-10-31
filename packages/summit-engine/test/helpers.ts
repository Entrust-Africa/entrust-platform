import type { Answer, Answers, FormQuestion } from "@entrust/forms";
import { APPLICATION_0_1_0 } from "../src/application/v1";
import { SUMMIT_RULES_0_1_0 } from "../src/versions/v0-1-0";
import type { ApplicationTemplate, Category, OpportunityPathway, SummitRules } from "../src";

export const draftRules: SummitRules = SUMMIT_RULES_0_1_0;
export const template: ApplicationTemplate = APPLICATION_0_1_0;

/** An approved version with real-looking criteria: two a category, evidence on each, and category D split by pathway. */
export const approvedRules: SummitRules = {
  ...draftRules,
  version: "1.0.0",
  status: "approved",
  rubric: {
    ...draftRules.rubric,
    categories: draftRules.rubric.categories.map((category): Category => {
      if (category.id === "D") {
        return {
          ...category,
          criteria: [
            { id: "D1", text: "Clarity of the investment requirement and use of funds", maxPoints: 10, evidence: ["Business plan"] },
            { id: "D2T", text: "Investor-facing plan, trade applicants", maxPoints: 10, evidence: ["Use-of-funds schedule"], pathways: ["trade_and_market_access", "combined_trade_and_investment"] },
            { id: "D2I", text: "Investor-facing plan, investment applicants", maxPoints: 10, evidence: ["Financial model"], pathways: ["investment", "strategic_partnership"] },
          ],
        };
      }
      const first = Math.ceil(category.maxPoints / 2);
      return {
        ...category,
        criteria: [
          { id: `${category.id}1`, text: `${category.title}, part one`, maxPoints: first, evidence: ["Document"] },
          { id: `${category.id}2`, text: `${category.title}, part two`, maxPoints: category.maxPoints - first, evidence: ["Document"] },
        ],
      };
    }),
  },
};

/** A valid answer to a question: the first option, yes, some text, or the least number. */
export function answerFor(q: FormQuestion): Answer {
  switch (q.type) {
    case "single_choice":
      return q.options?.[0]?.value as string;
    case "multiple_choice":
      return [q.options?.[0]?.value as string];
    case "yes_no":
      return "yes";
    case "short_text":
    case "long_text":
      return "An answer";
    case "number":
      return q.min ?? 1;
    case "money":
      return { amount: 1000, currency: "USD" };
    case "date":
      return "2026-10-01";
    case "list":
      return ["one", "two"];
  }
}

/** Every question answered, as a trade applicant that isn't seeking investment. */
export const application = (overrides: Answers = {}): Answers => ({
  ...Object.fromEntries(template.questions.map((q) => [q.id, answerFor(q)])),
  "S4.1": "no",
  ...overrides,
});

/** Full marks on every criterion that scores. */
export function fullMarks(rules: SummitRules, pathway: OpportunityPathway, seekingInvestment: boolean): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const category of rules.rubric.categories) {
    if (category.investmentOnly && !seekingInvestment && pathway !== "investment" && pathway !== "combined_trade_and_investment") continue;
    for (const c of category.criteria) if (!c.pathways || c.pathways.includes(pathway)) scores[c.id] = c.maxPoints;
  }
  return scores;
}
