import { describe, expect, it } from "vitest";
import { APPLICATION_TEMPLATES, ELIGIBILITY_STATUS, SUMMIT_RULES, TOTAL_POINTS, canAssess, findApplicationTemplate, findSummitRules, latestApprovedRules, latestPublishedTemplate, validateSummitRules } from "../src";
import type { Category, SummitRules } from "../src";
import { approvedRules, draftRules } from "./helpers";

const errorsFor = (...versions: SummitRules[]) => validateSummitRules(versions);
const changed = (change: Partial<SummitRules>): SummitRules => ({ ...draftRules, ...change });
const withCategory = (id: string, change: Partial<Category>, base: SummitRules = draftRules): SummitRules => ({
  ...base,
  rubric: { ...base.rubric, categories: base.rubric.categories.map((c) => (c.id === id ? { ...c, ...change } : c)) },
});

// The content of every approved rules version and published application form. Every score and application
// stores the version it used, so an approved or published version must not change: put a correction in a new
// version instead. Add a line here when a version is approved or published. Drafts can change.
const PUBLISHED_RULES: Record<string, string> = {};
const PUBLISHED_TEMPLATES: Record<string, string> = {};

const sha256 = async (value: unknown) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value))))].map((b) => b.toString(16).padStart(2, "0")).join("");

describe("the Summit rules", () => {
  it("all validate", () => {
    expect(errorsFor(...SUMMIT_RULES)).toEqual([]);
    expect(errorsFor(approvedRules)).toEqual([]);
  });

  it("never change once approved", async () => {
    const approved = SUMMIT_RULES.filter((r) => r.status === "approved");
    expect(Object.fromEntries(await Promise.all(approved.map(async (r) => [r.version, await sha256(r)])))).toEqual(PUBLISHED_RULES);
  });

  it("never change once an application form is published", async () => {
    const published = APPLICATION_TEMPLATES.filter((t) => t.status === "published");
    expect(Object.fromEntries(await Promise.all(published.map(async (t) => [t.version, await sha256(t)])))).toEqual(PUBLISHED_TEMPLATES);
  });

  it("start as a draft that nobody can score against", () => {
    expect(draftRules.status).toBe("draft");
    expect(canAssess(draftRules)).toBe(false);
    expect(canAssess(approvedRules)).toBe(true);
    expect(latestApprovedRules()).toBeUndefined();
    expect(latestPublishedTemplate()).toBeUndefined();
  });

  it("finds a version", () => {
    expect(findSummitRules("0.1.0")).toBe(draftRules);
    expect(findSummitRules("9.9.9")).toBeUndefined();
    expect(findApplicationTemplate("0.1.0")?.status).toBe("draft");
  });

  it("have the seven categories and the maximums of section 6", () => {
    expect(draftRules.rubric.categories.map((c) => [c.id, c.maxPoints])).toEqual([["A", 10], ["B", 15], ["C", 20], ["D", 20], ["E", 15], ["F", 10], ["G", 10]]);
    expect(draftRules.rubric.categories.reduce((sum, c) => sum + c.maxPoints, 0)).toBe(TOTAL_POINTS);
  });

  it("make only the investment category not applicable", () => {
    expect(draftRules.rubric.categories.filter((c) => c.investmentOnly).map((c) => c.id)).toEqual(["D"]);
    expect(draftRules.rubric.notApplicable).toBe("rescale");
  });

  it("give pending clarification the status awaiting additional information", () => {
    expect(ELIGIBILITY_STATUS).toEqual({ eligible: "eligible", ineligible: "ineligible", pending_clarification: "awaiting_additional_information" });
  });

  describe("when changed", () => {
    it("fail on a bad version, or one published twice", () => {
      expect(errorsFor(changed({ version: "1.0" }))).toEqual(["1.0: the version is major.minor.patch"]);
      expect(errorsFor(draftRules, draftRules)).toEqual(["0.1.0: published twice"]);
    });

    it("fail when the categories don't add up to 100", () => {
      expect(errorsFor(withCategory("A", { maxPoints: 12, criteria: [{ id: "A1", text: "x", maxPoints: 12, evidence: [] }] }))).toEqual([
        "0.1.0: the categories add up to 102 points, not 100",
      ]);
    });

    it("fail when a category is missing or out of order", () => {
      const [first, ...rest] = draftRules.rubric.categories;
      expect(errorsFor(changed({ rubric: { ...draftRules.rubric, categories: [...rest, first as Category] } }))[0]).toBe("0.1.0: the categories are A, B, C, D, E, F, G, in that order");
    });

    it("fail when a pathway can't earn a category's full points", () => {
      const rules = withCategory("D", { criteria: [{ id: "D1", text: "x", maxPoints: 20, evidence: [], pathways: ["investment"] }] });
      expect(errorsFor(rules)).toEqual([
        "0.1.0: category D: the trade_and_market_access criteria add up to 0 points, not 20",
        "0.1.0: category D: the strategic_partnership criteria add up to 0 points, not 20",
        "0.1.0: category D: the combined_trade_and_investment criteria add up to 0 points, not 20",
      ]);
      expect(errorsFor(withCategory("D", { criteria: [{ id: "D1", text: "x", maxPoints: 15, evidence: [] }] }))[0]).toContain("add up to 15 points, not 20");
    });

    it("fail on a criterion used twice, or with bad points", () => {
      expect(errorsFor(withCategory("B", { criteria: [{ id: "A1", text: "x", maxPoints: 15, evidence: [] }] }))).toEqual(["0.1.0: criterion A1 is used twice"]);
      expect(errorsFor(withCategory("B", { criteria: [{ id: "B1", text: "x", maxPoints: 7.5, evidence: [] }, { id: "B2", text: "x", maxPoints: 7.5, evidence: [] }] }))).toContain(
        "0.1.0: criterion B1: max points is a whole number above 0",
      );
    });

    it("fail on a criterion for a pathway that doesn't exist", () => {
      const rules = withCategory("D", { criteria: [{ id: "D1", text: "x", maxPoints: 20, evidence: [], pathways: ["barter" as never] }] });
      expect(errorsFor(rules)).toContain("0.1.0: criterion D1: unknown pathway barter");
    });

    it("fail when every category is investment-only", () => {
      const rules: SummitRules = { ...draftRules, rubric: { ...draftRules.rubric, categories: draftRules.rubric.categories.map((c) => ({ ...c, investmentOnly: true })) } };
      expect(errorsFor(rules)).toContain("0.1.0: every category is investment-only, so a trade applicant would have nothing to score");
    });

    it("fail when an approved version has no evidence requirements", () => {
      const rules = withCategory("A", { criteria: [{ id: "A1", text: "x", maxPoints: 10, evidence: [] }] }, approvedRules);
      expect(errorsFor(rules)).toEqual(["1.0.0: criterion A1: an approved version needs its evidence requirements"]);
    });

    it("fail on a document that doesn't exist, or a pathway with none listed", () => {
      expect(errorsFor(changed({ eligibility: { requiredDocuments: { ...draftRules.eligibility.requiredDocuments, investment: ["passport" as never] } } }))).toEqual([
        "0.1.0: eligibility: investment requires unknown document passport",
      ]);
      const { investment: _, ...rest } = draftRules.eligibility.requiredDocuments;
      expect(errorsFor(changed({ eligibility: { requiredDocuments: rest as never } }))).toEqual(["0.1.0: eligibility: no required documents for investment"]);
    });
  });
});
