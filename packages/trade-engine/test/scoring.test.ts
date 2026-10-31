import { describe, expect, it } from "vitest";
import { bandFor, scoreDomains } from "../src";
import type { ScoreResult } from "../src";
import { answers, rules, rules010, setAll } from "./helpers";

const domain = (a: Record<string, unknown>, id: string, extra: object = {}): ScoreResult =>
  scoreDomains(rules, { answers: a as never, ...extra }).domains.find((d) => d.id === id)!;
const group = (a: Record<string, unknown>, id: string, extra: object = {}): ScoreResult =>
  scoreDomains(rules, { answers: a as never, ...extra }).groups.find((g) => g.id === id)!;

const BUYER = ["B1", "B2", "B3", "B4", "B5"];

describe("scoreDomains", () => {
  it("scores the six domains and eight trigger groups, recording the rules version", () => {
    const scores = scoreDomains(rules, { answers: answers() });
    expect(scores.rulesVersion).toBe("0.2.0");
    expect(scores.domains.map((d) => d.id)).toEqual([
      "buyer_development",
      "financial_records",
      "transaction_finance",
      "costing_execution",
      "digital_productivity",
      "operational_readiness",
    ]);
    expect(scores.groups.map((g) => g.id)).toEqual(["buyer", "financial", "trade_finance", "costing", "execution", "operations", "digital", "ai_productivity"]);
    expect(scoreDomains(rules010, { answers: answers() }).rulesVersion).toBe("0.1.0");
  });

  it("gives points over maximum applicable points, times 100", () => {
    const all3 = answers(setAll(BUYER, 3));
    expect(domain(all3, "buyer_development")).toMatchObject({ points: 15, maxPoints: 15, score: 100, band: "demonstrated", coverage: 1 });
    expect(domain(answers(setAll(BUYER, 0)), "buyer_development")).toMatchObject({ points: 0, maxPoints: 15, score: 0, band: "critical_gap" });
    expect(domain(answers(), "buyer_development")).toMatchObject({ points: 10, maxPoints: 15, score: 66.67, band: "functional" });
    // A group is scored like a domain: operations is G1, G2 and C4.
    expect(group(answers({ G1: 3, G2: 3, C4: 0 }), "operations")).toMatchObject({ points: 6, maxPoints: 9, score: 66.67 });
  });

  it("puts boundary scores in the right band", () => {
    const band = (score: number) => bandFor(rules, score);
    expect([0, 39, 39.99, 40, 59, 59.99, 60, 79, 79.99, 80, 100].map(band)).toEqual([
      "critical_gap",
      "critical_gap",
      "critical_gap",
      "developing",
      "developing",
      "developing",
      "functional",
      "functional",
      "functional",
      "demonstrated",
      "demonstrated",
    ]);
    // Spread a number of points over the five buyer questions, 3 at a time.
    const buyer = (points: number) =>
      domain(answers(Object.fromEntries(BUYER.map((id, i) => [id, Math.max(0, Math.min(3, points - i * 3))]))), "buyer_development");
    expect([buyer(6), buyer(8), buyer(9), buyer(12)].map((r) => [r.score, r.band])).toEqual([
      [40, "developing"],
      [53.33, "developing"],
      [60, "functional"],
      [80, "demonstrated"],
    ]);
  });

  it("agrees with its own band for every combination of answers", () => {
    // The score is rounded to two decimals, the band is compared exactly: they must never disagree.
    for (const d of rules.domains) {
      const n = d.questions.length;
      for (let combo = 0; combo < 4 ** n; combo++) {
        const given = Object.fromEntries(d.questions.map((id, i) => [id, Math.floor(combo / 4 ** i) % 4]));
        const result = domain(answers(given), d.id);
        expect(result.band).toBe(bandFor(rules, result.score!));
      }
    }
  });

  it("never counts a missing answer as zero", () => {
    const result = group(answers({ ...setAll(BUYER, 3), B5: "not_known" }), "buyer");
    expect(result).toMatchObject({ points: 12, maxPoints: 12, score: 100, coverage: 0.8, notKnown: ["B5"], valid: 4, eligible: 5 });
    const unanswered = Object.fromEntries(Object.entries(answers(setAll(BUYER, 3))).filter(([id]) => id !== "B5"));
    expect(group(unanswered, "buyer")).toMatchObject({ score: 100, unanswered: ["B5"] });
  });

  it("scores a domain at 80% coverage and not just under it", () => {
    // Five questions: 4 valid is exactly 80%, 3 is 60%.
    expect(group(answers({ ...setAll(BUYER, 3), B5: "not_known" }), "buyer").score).toBe(100);
    const sixty = group(answers({ ...setAll(BUYER, 3), B4: "not_known", B5: "not_known" }), "buyer");
    expect(sixty).toMatchObject({ coverage: 0.6, score: null, band: null, valid: 3 });
    // Six questions: 5 valid is 83%, 4 is 67%.
    const costing = ["E1", "E2", "E3", "E4", "E5", "E6"];
    expect(domain(answers({ ...setAll(costing, 2), E6: "not_known" }), "costing_execution")).toMatchObject({ coverage: 5 / 6, score: 66.67 });
    expect(domain(answers({ ...setAll(costing, 2), E5: "not_known", E6: "not_known" }), "costing_execution")).toMatchObject({ coverage: 4 / 6, score: null });
  });

  it("takes 'not applicable' out of the denominator only once staff approve it", () => {
    const given = { ...setAll(BUYER, 3), B5: "not_applicable" };
    // Not approved: it stays in the denominator, so 4 of 5 is 80% and the question is flagged.
    expect(group(answers(given), "buyer")).toMatchObject({ coverage: 0.8, pendingNotApplicable: ["B5"], approvedNotApplicable: 0 });
    // Approved: 4 of the 4 left.
    expect(group(answers(given), "buyer", { approvedNotApplicable: ["B5"] })).toMatchObject({ coverage: 1, approvedNotApplicable: 1, pendingNotApplicable: [], score: 100 });
    // Approved, but one more is not known: 3 of 4 is 75%, just under.
    const under = { ...given, B4: "not_known" };
    expect(group(answers(under), "buyer", { approvedNotApplicable: ["B5"] })).toMatchObject({ coverage: 0.75, score: null });
    // Every question not applicable and approved leaves nothing to score.
    const none = answers(setAll(BUYER, "not_applicable"));
    expect(group(none, "buyer", { approvedNotApplicable: BUYER })).toMatchObject({ coverage: 0, score: null });
  });

  it("returns no score for a domain with no answers", () => {
    expect(group({ A1: "never" }, "buyer")).toMatchObject({ score: null, band: null, valid: 0, unanswered: BUYER, evidence: "self_reported" });
  });

  it("returns the evidence status beside the score and never mixes it in", () => {
    const plain = group(answers(setAll(BUYER, 3)), "buyer");
    expect(plain.evidence).toBe("self_reported");
    const backed = { B1: "verified", B2: "reviewed", B3: "verified", B4: "documented", B5: "verified" } as const;
    const withEvidence = group(answers(setAll(BUYER, 3)), "buyer", { evidence: backed });
    expect(withEvidence.evidence).toBe("documented");
    expect({ ...withEvidence, evidence: "self_reported" }).toEqual(plain);
    // Only the answers scored count: a question that isn't scored doesn't weaken it.
    const notKnown = group(answers({ ...setAll(BUYER, 3), B4: "not_known" }), "buyer", { evidence: backed });
    expect(notKnown.evidence).toBe("reviewed");
  });

  it("gives the same scores for the same answers", () => {
    const given = answers({ B1: 0, C3: "not_known", E4: 3 });
    expect(JSON.stringify(scoreDomains(rules, { answers: given }))).toBe(JSON.stringify(scoreDomains(rules, { answers: given })));
  });
});
