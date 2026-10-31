import { describe, expect, it } from "vitest";
import { applicableCriteria, scoreApplication, seeksInvestment } from "../src";
import type { ScoreInput } from "../src";
import { approvedRules, draftRules, fullMarks } from "./helpers";

const score = (input: Partial<ScoreInput> & { scores: ScoreInput["scores"] }) =>
  scoreApplication(approvedRules, { pathway: "investment", seekingInvestment: false, ...input });

describe("scoring an application", () => {
  it("gives 100 for full marks", () => {
    const result = score({ scores: fullMarks(approvedRules, "investment", true) });
    expect(result).toMatchObject({ complete: true, problems: [], possible: 100, points: 100, total: 100, notApplicable: [], approved: true, rulesVersion: "1.0.0" });
  });

  it("adds up the points by category", () => {
    const scores = { ...fullMarks(approvedRules, "investment", true), A1: 3, A2: 2 };
    const result = score({ scores });
    expect(result.categories[0]).toEqual({ id: "A", maxPoints: 10, applicable: true, points: 5, missing: [] });
    expect(result).toMatchObject({ points: 95, total: 95 });
  });

  it("says what is left to score, and gives no total until it is scored", () => {
    const scores = fullMarks(approvedRules, "investment", true);
    delete scores.C2;
    delete scores.G1;
    const result = score({ scores });
    expect(result.complete).toBe(false);
    expect(result.categories.find((c) => c.id === "C")).toEqual({ id: "C", maxPoints: 20, applicable: true, missing: ["C2"] });
    expect(result.categories.find((c) => c.id === "G")?.missing).toEqual(["G1"]);
    expect(result.points).toBeUndefined();
    expect(result.total).toBeUndefined();
  });

  it("scores nothing for an empty sheet", () => {
    expect(score({ scores: {} })).toMatchObject({ complete: false, possible: 100 });
  });

  describe("category D", () => {
    it("is left out for a trade applicant that isn't seeking investment, and the rest scaled to 100", () => {
      const scores = fullMarks(approvedRules, "trade_and_market_access", false);
      expect(Object.keys(scores).some((id) => id.startsWith("D"))).toBe(false);
      const result = score({ pathway: "trade_and_market_access", scores });
      expect(result).toMatchObject({ complete: true, notApplicable: ["D"], possible: 80, points: 80, total: 100 });
      expect(result.categories.find((c) => c.id === "D")).toEqual({ id: "D", maxPoints: 20, applicable: false, missing: [] });
    });

    it("doesn't penalize a trade applicant: the same share of the points gives the same total", () => {
      const half = (scores: Record<string, number>) => Object.fromEntries(Object.entries(scores).map(([id, p]) => [id, Math.floor(p / 2)]));
      const trade = score({ pathway: "trade_and_market_access", scores: half(fullMarks(approvedRules, "trade_and_market_access", false)) });
      expect(trade.total).toBeCloseTo(((trade.points as number) / 80) * 100, 1);
      expect(trade.total).toBeGreaterThan(trade.points as number);
    });

    it("rounds the scaled total to one decimal", () => {
      const scores = { ...fullMarks(approvedRules, "trade_and_market_access", false), A1: 4, A2: 4 };
      // 80 - 2 = 78 of 80, which is 97.5. Take one more point off for 77 of 80 = 96.25, rounded to 96.3.
      expect(score({ pathway: "trade_and_market_access", scores }).total).toBe(97.5);
      expect(score({ pathway: "trade_and_market_access", scores: { ...scores, A1: 3 } }).total).toBe(96.3);
    });

    it("is scored when a trade applicant says it is seeking investment", () => {
      const scores = fullMarks(approvedRules, "trade_and_market_access", true);
      expect(Object.keys(scores)).toContain("D1");
      expect(score({ pathway: "trade_and_market_access", seekingInvestment: true, scores })).toMatchObject({ complete: true, notApplicable: [], possible: 100, total: 100 });
    });

    it("is always scored on the investment and combined pathways", () => {
      expect(score({ pathway: "combined_trade_and_investment", seekingInvestment: false, scores: fullMarks(approvedRules, "combined_trade_and_investment", true) })).toMatchObject({ notApplicable: [], total: 100 });
      expect(seeksInvestment("investment", false)).toBe(true);
      expect(seeksInvestment("combined_trade_and_investment", false)).toBe(true);
      expect(seeksInvestment("trade_and_market_access", false)).toBe(false);
      expect(seeksInvestment("strategic_partnership", true)).toBe(true);
    });

    it("rejects a score for it when it doesn't apply", () => {
      const result = score({ pathway: "trade_and_market_access", scores: { ...fullMarks(approvedRules, "trade_and_market_access", false), D1: 10 } });
      expect(result.problems).toEqual([{ criterion: "D1", code: "not_applicable", message: "D1: this criterion isn't scored for this applicant" }]);
      expect(result.complete).toBe(false);
      expect(result.total).toBeUndefined();
    });
  });

  describe("pathway-specific criteria", () => {
    it("score only the criteria for the pathway", () => {
      expect(applicableCriteria(approvedRules.rubric.categories[3] as never, "investment").map((c) => c.id)).toEqual(["D1", "D2I"]);
      expect(applicableCriteria(approvedRules.rubric.categories[3] as never, "combined_trade_and_investment").map((c) => c.id)).toEqual(["D1", "D2T"]);
    });

    it("keep every pathway out of the same 100 points", () => {
      for (const pathway of ["trade_and_market_access", "investment", "strategic_partnership", "combined_trade_and_investment"] as const) {
        const result = score({ pathway, seekingInvestment: true, scores: fullMarks(approvedRules, pathway, true) });
        expect(result).toMatchObject({ complete: true, possible: 100, total: 100 });
      }
    });

    it("reject a criterion of another pathway", () => {
      const result = score({ pathway: "investment", scores: { ...fullMarks(approvedRules, "investment", true), D2T: 5 } });
      expect(result.problems.map((p) => p.code)).toEqual(["not_applicable"]);
    });
  });

  describe("an invalid sheet", () => {
    const problems = (scores: Record<string, number>) => score({ scores: { ...fullMarks(approvedRules, "investment", true), ...scores } }).problems;

    it("names a criterion the rubric doesn't have", () => {
      expect(problems({ Z9: 1 })).toEqual([{ criterion: "Z9", code: "unknown_criterion", message: "Z9: the rubric has no such criterion" }]);
    });

    it("keeps to whole points between 0 and the maximum", () => {
      expect(problems({ A1: 5.5 })[0]).toMatchObject({ code: "not_whole", message: "A1: score whole points" });
      expect(problems({ A1: -1 })[0]).toMatchObject({ code: "out_of_range", message: "A1: score 0 to 5" });
      expect(problems({ A1: 6 })[0]).toMatchObject({ code: "out_of_range" });
      expect(problems({ A1: Number.NaN })[0]).toMatchObject({ code: "not_whole" });
    });

    it("gives no total, and counts the invalid criterion as still to score", () => {
      const result = score({ scores: { ...fullMarks(approvedRules, "investment", true), A1: 6 } });
      expect(result.complete).toBe(false);
      expect(result.total).toBeUndefined();
      expect(result.categories[0]?.missing).toEqual(["A1"]);
    });
  });

  it("gives the same answer for the same sheet", () => {
    const input = { pathway: "investment", seekingInvestment: false, scores: fullMarks(approvedRules, "investment", true) } as const;
    expect(scoreApplication(approvedRules, input)).toEqual(scoreApplication(approvedRules, input));
  });

  it("says when the rules are only a draft, so a score can't be recorded", () => {
    const result = scoreApplication(draftRules, { pathway: "investment", seekingInvestment: true, scores: { A1: 10 } });
    expect(result.approved).toBe(false);
    expect(result.problems).toEqual([]);
  });

  it("doesn't look at eligibility: an ineligible applicant is simply not scored, never scored zero", () => {
    // There is no eligibility input. A sheet with nothing on it is incomplete, not zero.
    expect(score({ scores: {} }).total).toBeUndefined();
  });
});
