import { describe, expect, it } from "vitest";
import { SUMMIT_RULES, categoryNoteProblems, findSummitRules, scoreApplication, validateSummitRules } from "../src";
import type { Category, ScoreInput, SummitRules } from "../src";

// Version 1.0.0 is the Standardized SME Assessment Scorecard. These tests hold it to the scorecard's own table
// of categories, criteria and maximums, its worked example, and its rules for category D.
const rules = findSummitRules("1.0.0") as SummitRules;
const category = (id: string) => rules.rubric.categories.find((c) => c.id === id) as Category;

// Category, its maximum, and each criterion with its maximum, as the scorecard tabulates them.
const SCORECARD: [string, number, [string, number][]][] = [
  ["A", 10, [["Legal registration and operating status", 3], ["Ownership and management identification", 2], ["Evidence of active business operations", 3], ["Completeness and consistency of business information", 2]]],
  ["B", 15, [["Clarity and definition of products or services", 3], ["Demonstrated customer demand", 4], ["Competitive positioning and differentiation", 3], ["Pricing and commercial viability", 3], ["Product or service documentation", 2]]],
  ["C", 20, [["Target market identification", 3], ["Buyer identification and relationships", 5], ["Trade transaction history or opportunity evidence", 5], ["Supply and fulfillment capacity", 4], ["Export or market-entry preparation", 3]]],
  ["D", 20, [["Clarity of capital requirement", 4], ["Use-of-funds plan", 4], ["Commercial justification", 4], ["Financial information and projections", 4], ["Implementation plan and expected outcomes", 4]]],
  ["E", 15, [["Financial recordkeeping", 4], ["Revenue and financial performance evidence", 3], ["Management and organizational capacity", 2], ["Production or service delivery capacity", 4], ["Quality and operational controls", 2]]],
  ["F", 10, [["Clarity of partnership opportunity", 3], ["Commercial benefit to prospective partner", 3], ["Defined partner contribution or requirements", 2], ["Potential for sustainable partnership", 2]]],
  ["G", 10, [["Defined participation objectives", 2], ["Quality and completeness of business information", 2], ["Clear commercial ask", 2], ["Authorized and available representative", 2], ["Commitment to B2B participation and follow-up", 2]]],
];

/** Full marks on every criterion that scores for a trade applicant, or on every criterion. */
const full = (investment: boolean): Record<string, number> =>
  Object.fromEntries(rules.rubric.categories.filter((c) => investment || !c.investmentOnly).flatMap((c) => c.criteria.map((k) => [k.id, k.maxPoints])));
const score = (input: Partial<ScoreInput> & { scores: ScoreInput["scores"] }) => scoreApplication(rules, { pathway: "trade_and_market_access", seekingInvestment: false, ...input });

describe("the scorecard's rubric (version 1.0.0)", () => {
  it("is approved and valid", () => {
    expect(rules.status).toBe("approved");
    expect(validateSummitRules(SUMMIT_RULES)).toEqual([]);
  });

  it("has the scorecard's categories, criteria and maximums", () => {
    expect(rules.rubric.categories.map((c) => [c.id, c.maxPoints, c.criteria.map((k) => [k.text, k.maxPoints])])).toEqual(SCORECARD);
  });

  it("gives every criterion a scoring guidance that covers each score from 0 to its maximum", () => {
    for (const c of rules.rubric.categories) {
      for (const k of c.criteria) {
        const covered = (k.guidance ?? []).flatMap((b) => Array.from({ length: b.to - b.from + 1 }, (_, i) => b.from + i)).sort((a, b) => a - b);
        expect(covered, k.id).toEqual(Array.from({ length: k.maxPoints + 1 }, (_, i) => i));
      }
    }
  });

  it("keeps the scorecard's wording for the guidance", () => {
    expect(category("B").criteria[1]?.guidance).toEqual([
      { from: 4, to: 4, text: "Demonstrated demand through sales, contracts, repeat customers, or credible buyer enquiries." },
      { from: 2, to: 3, text: "Some customer traction or credible market validation." },
      { from: 1, to: 1, text: "General market interest without meaningful evidence." },
      { from: 0, to: 0, text: "No evidence of demand or market validation." },
    ]);
    expect(category("C").criteria[2]?.guidance?.map((b) => [b.from, b.to])).toEqual([[5, 5], [3, 4], [1, 2], [0, 0]]);
  });

  it("lists the evidence each category looks for", () => {
    expect(category("A").evidence).toEqual(["Registration certificate", "Business license", "TIN", "Ownership records", "Invoices", "Customer records", "Premises or facility evidence"]);
    expect(category("D").evidence).toContain("Cash-flow projections");
    expect(category("G").evidence).toContain("Participation confirmation");
    for (const c of rules.rubric.categories) expect(c.evidence?.length, c.id).toBeGreaterThan(0);
  });

  it("applies every criterion to every pathway, as the scorecard has one set", () => {
    expect(rules.rubric.categories.flatMap((c) => c.criteria).filter((k) => k.pathways)).toEqual([]);
  });

  it("makes only category D not applicable, and rescales the rest", () => {
    expect(rules.rubric.categories.filter((c) => c.investmentOnly).map((c) => c.id)).toEqual(["D"]);
    expect(rules.rubric.notApplicable).toBe("rescale");
  });
});

describe("scoring on the scorecard", () => {
  it("gives 100 for full marks when the applicant seeks investment", () => {
    expect(score({ pathway: "combined_trade_and_investment", scores: full(true) })).toMatchObject({ complete: true, points: 100, possible: 100, total: 100, normalized: false, notApplicable: [] });
  });

  it("works the scorecard's example: 64 points of 80 is an adjusted score of 80", () => {
    // 80 points are available without category D. Take 16 off them, spread over thirteen criteria, for 64.
    const scores = full(false);
    const taken: Record<string, number> = { A1: 1, A3: 1, B2: 2, C2: 2, C3: 2, C4: 1, E1: 1, E4: 1, F1: 1, F2: 1, G1: 1, G2: 1, G3: 1 };
    expect(Object.values(taken).reduce((sum, p) => sum + p, 0)).toBe(16);
    for (const [id, points] of Object.entries(taken)) scores[id] = (scores[id] as number) - points;
    const result = score({ scores });
    expect(result).toMatchObject({ complete: true, points: 64, possible: 80, total: 80, normalized: true, notApplicable: ["D"], pathway: "trade_and_market_access" });
    expect(result.categories.find((c) => c.id === "D")).toMatchObject({ applicable: false });
  });

  it("keeps what the scorecard says the system must retain", () => {
    const result = score({ scores: full(false) });
    expect({ earned: result.points, applicableMaximum: result.possible, adjusted: result.total, investment: result.notApplicable.includes("D") ? "N/A" : "scored", pathway: result.pathway }).toEqual({
      earned: 80,
      applicableMaximum: 80,
      adjusted: 100,
      investment: "N/A",
      pathway: "trade_and_market_access",
    });
  });

  it("does not leave category D out for an applicant that seeks investment, however little it shows", () => {
    // Trade pathway, but the form says it also seeks investment, and the evidence is thin: D scores low, not N/A.
    const scores = { ...full(true), D1: 0, D2: 0, D3: 0, D4: 0, D5: 0 };
    const result = score({ seekingInvestment: true, scores });
    expect(result).toMatchObject({ complete: true, notApplicable: [], possible: 100, normalized: false, points: 80, total: 80 });
    expect(result.categories.find((c) => c.id === "D")).toMatchObject({ applicable: true, points: 0 });
    // The investment pathway itself always seeks it.
    expect(score({ pathway: "investment", scores: { ...scores } })).toMatchObject({ notApplicable: [], possible: 100 });
  });

  it("is incomplete until category D is scored for an applicant that seeks investment", () => {
    const { D1: _, ...withoutD1 } = full(true);
    expect(score({ seekingInvestment: true, scores: withoutD1 }).categories.find((c) => c.id === "D")?.missing).toEqual(["D1"]);
  });

  it("refuses points on category D for an applicant that isn't seeking investment", () => {
    const result = score({ scores: { ...full(false), D1: 3 } });
    expect(result.problems).toEqual([{ criterion: "D1", code: "not_applicable", message: "D1: this criterion isn't scored for this applicant" }]);
    expect(result.complete).toBe(false);
  });

  it("accepts the intermediate scores the guidance gives, and refuses ones beyond a maximum", () => {
    expect(score({ scores: { ...full(false), B2: 3 } }).problems).toEqual([]);
    expect(score({ scores: { ...full(false), B2: 5 } }).problems.map((p) => p.code)).toEqual(["out_of_range"]);
    expect(score({ scores: { ...full(false), B2: 2.5 } }).problems.map((p) => p.code)).toEqual(["not_whole"]);
  });

  it("gives the same score for the same answers", () => {
    const scores = { ...full(true), A1: 2, C3: 4 };
    expect(score({ pathway: "investment", scores })).toEqual(score({ pathway: "investment", scores }));
  });
});

describe("the justification and evidence each category needs", () => {
  const complete = score({ scores: full(false) });

  it("asks for a justification for every scored category, and evidence where points were earned", () => {
    const problems = categoryNoteProblems(complete, {});
    expect(problems.map((p) => p.category)).toEqual(["A", "A", "B", "B", "C", "C", "E", "E", "F", "F", "G", "G"]);
    expect(problems.filter((p) => p.message.includes("justification")).map((p) => p.category)).toEqual(["A", "B", "C", "E", "F", "G"]);
  });

  it("asks for nothing on category D when it was left out", () => {
    expect(categoryNoteProblems(complete, {}).some((p) => p.category === "D")).toBe(false);
  });

  it("is satisfied by a justification and a piece of evidence per category", () => {
    const note = { justification: "Registered and trading.", evidence: ["Registration certificate"] };
    expect(categoryNoteProblems(complete, { A: note, B: note, C: note, E: note, F: note, G: note })).toEqual([]);
  });

  it("doesn't ask for evidence behind a category scored 0, but still asks why", () => {
    const zero = score({ scores: { ...full(false), ...Object.fromEntries(category("F").criteria.map((k) => [k.id, 0])) } });
    const note = { justification: "Registered and trading.", evidence: ["Registration certificate"] };
    expect(categoryNoteProblems(zero, { A: note, B: note, C: note, E: note, G: note })).toEqual([{ category: "F", message: "Category F: record a short justification." }]);
  });

  it("treats a blank justification or a blank evidence reference as missing", () => {
    const blank = { justification: "  ", evidence: [" "] };
    expect(categoryNoteProblems(complete, { A: blank }).filter((p) => p.category === "A")).toHaveLength(2);
  });
});
