import { canonicalJson } from "@entrust/mizan-rules";
import { describe, expect, it } from "vitest";
import { analyseYears, inputErrors, levelForScore, ratingDepartures, scoreAssessment, suggestRating } from "../src";
import { allRated, cfg, criterion, dimensionCriteria, input, passGates, year } from "./helpers";

const dim = (r: ReturnType<typeof scoreAssessment>, id: string) => r.dimensions.find((d) => d.id === id)!;

describe("score and level", () => {
  it("gives 100 and level 5 when everything is rated 4", () => {
    const r = scoreAssessment(cfg, input(allRated(4)));
    expect(r).toMatchObject({ total: 100, computedLevel: 5, issuedLevel: 5, status: "LEVEL_ISSUED", reasons: [] });
  });

  it("gives 50 and level 3 when everything is rated 2", () => {
    expect(scoreAssessment(cfg, input(allRated(2)))).toMatchObject({ total: 50, issuedLevel: 3 });
  });

  it("reads the level from the rounded total, so the score shown and the level agree", () => {
    expect(levelForScore(cfg, 65)).toBe(4);
    expect(levelForScore(cfg, 64.9)).toBe(3);
    expect(levelForScore(cfg, 80)).toBe(5);
    expect(levelForScore(cfg, 0)).toBe(1);
  });

  it("gives the same result twice, and a result that can be frozen as JSON", () => {
    const ratings = { ...allRated(3), "D3.2": { rating: "NA" as const }, "D7.1": { rating: "UV" as const } };
    const a = scoreAssessment(cfg, input(ratings));
    expect(scoreAssessment(cfg, input(ratings))).toEqual(a);
    expect(() => canonicalJson(a)).not.toThrow();
    expect(() => canonicalJson(scoreAssessment(cfg, input({})))).not.toThrow();
  });
});

describe("missing evidence is not poor performance", () => {
  it("leaves a dimension with no evidence out of the total instead of scoring it 0", () => {
    const ratings = allRated(3);
    for (const c of dimensionCriteria("D3")) ratings[c.id] = { rating: "NE" };
    const r = scoreAssessment(cfg, input(ratings));
    // The 85 points outside D3, all at 3 of 4, are 75%. Counting D3 as 0 would have given 63.8.
    expect(r.total).toBe(75);
    expect(dim(r, "D3")).toMatchObject({ score: null, pct: null, coverage: 0, insufficient: true, counts: { ne: 3 } });
    expect(r.status).toBe("INSUFFICIENT_EVIDENCE");
    expect(r.issuedLevel).toBeNull();
    expect(r.reasons[0]).toContain("Missing evidence is not scored as poor performance");
  });

  it("scores a dimension over its rated criteria only", () => {
    const ratings = allRated(4);
    ratings["D1.3"] = { rating: "UV" }; // weight 1 of 5
    const r = scoreAssessment(cfg, input(ratings));
    expect(dim(r, "D1")).toMatchObject({ score: 10, pct: 1, coverage: 0.8, insufficient: false });
  });

  it("withholds the level below 70% coverage and issues it at 70%", () => {
    // D10 weighs 2+2+2+2+1 = 9. Three criteria of weight 2 not evidenced leaves 3/9; two leaves 5/9; one leaves 7/9.
    const some = (n: number) => {
      const ratings = allRated(4);
      for (const c of dimensionCriteria("D10").slice(0, n)) ratings[c.id] = { rating: "NE" };
      return scoreAssessment(cfg, input(ratings));
    };
    expect(dim(some(1), "D10").insufficient).toBe(false);
    expect(dim(some(2), "D10").insufficient).toBe(true);
    // A D2 reweighted 7/3/0: rating only the weight-7 criterion is exactly 70% coverage, which passes.
    const exact = { ...cfg, dimensions: cfg.dimensions.map((d) => (d.id === "D2" ? { ...d, criteria: d.criteria.map((c, i) => ({ ...c, weight: [7, 3, 0.000001][i]! })) } : d)) };
    const ratings = allRated(4);
    ratings["D2.2"] = { rating: "NE" };
    ratings["D2.3"] = { rating: "NA" };
    expect(dim(scoreAssessment(exact, input(ratings)), "D2")).toMatchObject({ coverage: 0.7, insufficient: false });
  });

  it("takes not applicable out of the denominator", () => {
    const ratings = allRated(4);
    ratings["D3.2"] = { rating: "NA" };
    const r = scoreAssessment(cfg, input(ratings));
    expect(dim(r, "D3")).toMatchObject({ score: 15, coverage: 1, counts: { na: 1 } });
  });

  it("has no total and no level when nothing is rated", () => {
    const ratings = Object.fromEntries(Object.keys(allRated(0)).map((id) => [id, { rating: "NE" as const }]));
    const r = scoreAssessment(cfg, input(ratings));
    expect(r).toMatchObject({ total: null, computedLevel: null, issuedLevel: null, status: "INSUFFICIENT_EVIDENCE" });
  });
});

describe("what stops or caps a level", () => {
  it("issues no level when a gate fails, whatever the score", () => {
    const r = scoreAssessment(cfg, input(allRated(4), { gates: { ...passGates, G2: "fail" } }));
    expect(r).toMatchObject({ status: "GATE_FAILED", issuedLevel: null, computedLevel: 5 });
  });

  it("is incomplete while a gate is pending, a mandatory criterion is unrated or an evidence level is missing", () => {
    const ratings = allRated(3);
    delete ratings["D10.3"];
    ratings["D1.1"] = { rating: 3 };
    const r = scoreAssessment(cfg, input(ratings, { gates: { G1: "pass", G2: "pending", G3: "pass" } }));
    expect(r.status).toBe("INCOMPLETE");
    expect(r.missingMandatory).toEqual(["D10.3"]);
    expect(r.missingEvidenceLevel).toEqual(["D1.1"]);
    expect(r.reasons.slice(0, 3)).toEqual([
      "Mandatory criteria not yet rated: D10.3.",
      "Gates pending: G2.",
      "Evidence level missing for: D1.1.",
    ]);
  });

  it("treats a gate with no entry as pending", () => {
    expect(scoreAssessment(cfg, input(allRated(4), { gates: {} })).status).toBe("INCOMPLETE");
  });

  it("caps the level at 2 for a manual override", () => {
    const r = scoreAssessment(cfg, input(allRated(4), { overrides: { O1: true } }));
    expect(r).toMatchObject({ computedLevel: 5, cappedLevel: 2, issuedLevel: 2 });
    expect(r.reasons).toEqual(["Level capped at 2: O1 Arrears over 90 days on existing debt."]);
  });

  it("triggers O2 by itself on negative equity and negative operating cash flow, and refuses it by hand", () => {
    const [, latest] = analyseYears([year("2024"), year("2025", { equity: -50, operatingCashFlow: -10, longTermDebt: 700 })]);
    const r = scoreAssessment(cfg, input(allRated(4), { latest }));
    expect(r.overridesTriggered).toEqual([{ id: "O2", title: "Negative equity with negative operating cash flow", capLevel: 2, automatic: true }]);
    expect(r.issuedLevel).toBe(2);
    expect(() => scoreAssessment(cfg, input(allRated(4), { overrides: { O2: false } }))).toThrow("O2 is worked out from the financials");
  });

  it("caps the level when a pillar is below the floor: a strong P1 can't hide a failed P4", () => {
    const ratings = allRated(4);
    for (const d of cfg.dimensions.filter((x) => x.pillar === "P4")) for (const c of d.criteria) ratings[c.id] = { rating: 0, evidence: "E3" };
    const r = scoreAssessment(cfg, input(ratings));
    expect(r).toMatchObject({ total: 80, computedLevel: 5, issuedLevel: 2 });
    expect(r.pillars.find((p) => p.id === "P4")).toMatchObject({ pct: 0, belowFloor: true });
  });

  it("only gives a capping reason when the cap lowers the level", () => {
    const r = scoreAssessment(cfg, input(allRated(0), { overrides: { O1: true } }));
    expect(r.issuedLevel).toBe(1);
    expect(r.reasons).toEqual([]);
  });

  it("puts an early-stage business on its own track: diagnostics, no level", () => {
    const r = scoreAssessment(cfg, input(allRated(3), { monthsOperating: 8 }));
    expect(r).toMatchObject({ status: "EARLY_STAGE", issuedLevel: null });
    expect(scoreAssessment(cfg, input(allRated(3), { monthsOperating: 12 })).status).toBe("LEVEL_ISSUED");
    expect(scoreAssessment(cfg, input(allRated(3), { monthsOperating: null })).status).toBe("LEVEL_ISSUED");
  });
});

describe("evidence confidence", () => {
  it("is graded apart from the score", () => {
    const audited = scoreAssessment(cfg, input(allRated(3, "E1")));
    const reported = scoreAssessment(cfg, input(allRated(3, "E4")));
    expect(audited.total).toBe(reported.total);
    expect([audited.confidenceGrade, reported.confidenceGrade]).toEqual(["A", "D"]);
    expect(scoreAssessment(cfg, input(allRated(3, "E5"))).confidenceGrade).toBe("E");
  });
});

describe("input that doesn't fit the configuration", () => {
  it("is refused, never scored", () => {
    expect(inputErrors(cfg, input({ "D99.1": { rating: 3, evidence: "E3" } }))).toEqual(["Unknown criterion D99.1"]);
    expect(inputErrors(cfg, input({ "D1.1": { rating: 5 as never, evidence: "E3" } }))).toEqual(["D1.1: 5 is not a rating"]);
    expect(inputErrors(cfg, input({}, { gates: { G9: "pass" }, overrides: { O9: true } }))).toEqual(["Unknown gate G9", "Unknown override O9"]);
    expect(() => scoreAssessment(cfg, input({ "D1.1": { rating: 3, evidence: "E9" as never } }))).toThrow("unknown evidence level E9");
  });
});

describe("suggested ratings", () => {
  it("follow the bands, with limits included", () => {
    const dscr = criterion("D3.2");
    expect([0.9, 1.0, 1.1, 1.249, 1.25, 1.5, 2].map((v) => suggestRating(dscr, { dscr: v }))).toEqual([0, 1, 2, 2, 3, 4, 4]);
  });

  it("read lower values as better for debt-to-equity and customer concentration", () => {
    const de = criterion("D4.1");
    expect([0.5, 1, 1.5, 2.5, 3, 5].map((v) => suggestRating(de, { debt_to_equity: v }))).toEqual([4, 4, 3, 2, 2, 1]);
    expect(suggestRating(de, {}, { negativeEquity: true })).toBe(0);
    const share = criterion("D7.2");
    expect([0.7, 0.6, 0.3, 0.25, 0.1, 0.05].map((v) => suggestRating(share, { top_customer_share: v }))).toEqual([0, 1, 2, 3, 4, 4]);
  });

  it("are null with no ratio, no bands or a qualitative criterion", () => {
    expect(suggestRating(criterion("D3.2"), { dscr: null })).toBeNull();
    expect(suggestRating(criterion("D1.1"), { net_margin: 0.2 })).toBeNull();
    expect(suggestRating(criterion("D10.1"), {})).toBeNull();
  });
});

describe("departures from the suggestion", () => {
  const [, latest] = analyseYears([year("2024"), year("2025", { revenue: 1320 })]); // DSCR 4.8 and current ratio 1.6 suggest 4

  it("are listed, and explained only with a written reason", () => {
    const ratings = { ...allRated(4), "D3.2": { rating: 2 as const, evidence: "E3" as const }, "D2.1": { rating: 3 as const, evidence: "E3" as const, note: "  " } };
    expect(ratingDepartures(cfg, ratings, latest)).toEqual([
      { criterionId: "D2.1", rating: 3, suggested: 4, explained: false },
      { criterionId: "D3.2", rating: 2, suggested: 4, explained: false },
    ]);
    ratings["D3.2"] = { rating: 2, evidence: "E3", note: "Two loans fall due next year; cover will drop." } as never;
    expect(ratingDepartures(cfg, ratings, latest).find((d) => d.criterionId === "D3.2")?.explained).toBe(true);
  });

  it("include debt-to-equity rated above 0 when equity is negative", () => {
    const [neg] = analyseYears([year("2025", { equity: -50, longTermDebt: 700 })]);
    expect(ratingDepartures(cfg, { "D4.1": { rating: 2, evidence: "E3" } }, neg)).toEqual([{ criterionId: "D4.1", rating: 2, suggested: 0, explained: false }]);
  });

  it("are empty without financials", () => {
    expect(ratingDepartures(cfg, allRated(0), null)).toEqual([]);
  });
});
