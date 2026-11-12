import { describe, expect, it } from "vitest";
import { buildDiagnostics, scoreAssessment } from "../src";
import { allRated, cfg, dimensionCriteria, input } from "./helpers";

const diagnose = (ratings: Parameters<typeof input>[0]) => {
  const i = input(ratings);
  return buildDiagnostics(cfg, i, scoreAssessment(cfg, i));
};

describe("improvement plan", () => {
  it("puts low ratings and missing evidence first, by priority then in configuration order", () => {
    const ratings = allRated(3);
    ratings["D10.3"] = { rating: 0, evidence: "E3" }; // mandatory, key dimension (15)
    ratings["D3.3"] = { rating: "NE" }; // mandatory, key dimension (15)
    ratings["D8.2"] = { rating: 1, evidence: "E4" }; // optional
    ratings["D9.1"] = { rating: 1, evidence: "E3" }; // mandatory, dimension weighs 5
    const dx = diagnose(ratings);
    expect(dx.actions.map((a) => `${a.criterionId}:${a.priority}`)).toEqual(["D3.3:high", "D10.3:high", "D9.1:medium", "D8.2:low"]);
  });

  it("writes the finding, the action, the timeline and a measurable indicator", () => {
    const ratings = allRated(3);
    ratings["D3.3"] = { rating: "NE" };
    ratings["D10.3"] = { rating: 0, evidence: "E3" };
    const [missing, low] = diagnose(ratings).actions;
    expect(missing).toMatchObject({
      area: "financial",
      finding: "No evidence was provided for this criterion.",
      timeline: "0-3 months",
      indicator: "D3.3 rated 3 or higher at reassessment, supported by evidence at level E3 (documentary evidence supplied) or better.",
    });
    expect(missing!.action).toMatch(/^Provide verifiable evidence: Credit bureau report; Lender reference letters/);
    expect(low).toMatchObject({ area: "governance", finding: "Rated 0 of 4: Business funds held in personal accounts; no separation." });
  });

  it("flags a 2 on a mandatory criterion only in a key dimension", () => {
    const ratings = allRated(3);
    ratings["D2.1"] = { rating: 2, evidence: "E3" }; // mandatory, D2 weighs 10
    ratings["D9.2"] = { rating: 2, evidence: "E3" }; // mandatory, D9 weighs 5
    expect(diagnose(ratings).actions.map((a) => `${a.criterionId}:${a.priority}`)).toEqual(["D2.1:medium"]);
  });

  it("gives unverified evidence a medium action, and nothing for not applicable", () => {
    const ratings = allRated(4);
    ratings["D1.2"] = { rating: "UV" };
    ratings["D3.2"] = { rating: "NA" };
    expect(diagnose(ratings).actions.map((a) => `${a.criterionId}:${a.priority}`)).toEqual(["D1.2:medium"]);
  });
});

describe("strengths and weaknesses", () => {
  it("come from each dimension's share of its points", () => {
    const ratings = allRated(2);
    for (const c of dimensionCriteria("D1")) ratings[c.id] = { rating: 4, evidence: "E3" };
    for (const c of dimensionCriteria("D9")) ratings[c.id] = { rating: 1, evidence: "E3" };
    const dx = diagnose(ratings);
    expect(dx.strengths).toEqual(["D1 Profitability and earnings quality: 100% of available points."]);
    expect(dx.weaknesses).toEqual(["D9 Legal, ownership and statutory compliance: 25% of available points."]);
  });

  it("name a dimension without enough evidence as a weakness", () => {
    const ratings = allRated(3);
    for (const c of dimensionCriteria("D5")) ratings[c.id] = { rating: "NE" };
    expect(diagnose(ratings).weaknesses).toEqual(["D5 Management capability and key-person risk: not enough evidence to assess (coverage 0%)."]);
  });
});
