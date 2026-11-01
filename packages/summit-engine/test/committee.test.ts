import { describe, expect, it } from "vitest";
import {
  APPLICANT_RESULTS,
  COMMITTEE_STATUSES,
  RESULT_STATUSES,
  COMMITTEE_DECISION_STATUS,
  applicantProfile,
  rankByScore,
  readinessPercent,
  scoreApplication,
  validateApplicationTemplates,
} from "../src";
import type { ApplicationTemplate } from "../src";
import { application, approvedRules, fullMarks, template } from "./helpers";

const score = (scores: Record<string, number>, pathway = "trade_and_market_access" as const) =>
  scoreApplication(approvedRules, { pathway, seekingInvestment: false, scores });

describe("the statuses the committee works with", () => {
  it("run from the start of its review to its decision", () => {
    expect([...COMMITTEE_STATUSES]).toEqual(["committee_review", "selected", "waitlisted", "not_selected"]);
  });

  it("include every status a committee decision leads to", () => {
    for (const status of Object.values(COMMITTEE_DECISION_STATUS)) expect(COMMITTEE_STATUSES).toContain(status);
  });
});

describe("what an applicant is told", () => {
  it("covers every decision that closes the committee's work, and no other", () => {
    expect([...RESULT_STATUSES]).toEqual(["selected", "waitlisted", "not_selected"]);
    expect(Object.keys(APPLICANT_RESULTS)).toEqual([...RESULT_STATUSES]);
    for (const status of RESULT_STATUSES) expect(COMMITTEE_STATUSES).toContain(status);
    expect(COMMITTEE_DECISION_STATUS.further_review_required).not.toBeOneOf([...RESULT_STATUSES]);
  });

  it("names no score and no reason", () => {
    for (const { label, message } of Object.values(APPLICANT_RESULTS)) {
      expect(label.length).toBeGreaterThan(0);
      expect(message).not.toMatch(/score|point|rank|reason|committee/i);
    }
  });
});

describe("readiness", () => {
  it("is the share of the readiness categories' points an applicant earned", () => {
    const full = fullMarks(approvedRules, "trade_and_market_access", false);
    expect(readinessPercent(score(full))).toBe(100);
    // E and G are worth 15 and 10 points, in two criteria each.
    const zero = { ...full, E1: 0, E2: 0, G1: 0, G2: 0 };
    expect(readinessPercent(score(zero))).toBe(0);
    const some = { ...full, E1: 4, E2: 4, G1: 2, G2: 2 };
    expect(readinessPercent(score(some))).toBe(48);
  });

  it("is null until both categories are scored", () => {
    const partial = fullMarks(approvedRules, "trade_and_market_access", false);
    delete partial.G2;
    expect(readinessPercent(score(partial))).toBeNull();
    expect(readinessPercent(score({}))).toBeNull();
  });

  it("is the same for an applicant that isn't seeking investment, since neither category is investment-only", () => {
    const withInvestment = scoreApplication(approvedRules, {
      pathway: "investment",
      seekingInvestment: true,
      scores: fullMarks(approvedRules, "investment", true),
    });
    expect(readinessPercent(withInvestment)).toBe(100);
  });
});

describe("ranking by score", () => {
  it("puts the highest score first", () => {
    const ranks = rankByScore([
      { id: "a", total: 61.5 },
      { id: "b", total: 88 },
      { id: "c", total: 72 },
    ]);
    expect([ranks.get("b"), ranks.get("c"), ranks.get("a")]).toEqual([1, 2, 3]);
  });

  it("gives equal scores the same place and skips the next", () => {
    const ranks = rankByScore([
      { id: "a", total: 80 },
      { id: "b", total: 90 },
      { id: "c", total: 80 },
      { id: "d", total: 70 },
    ]);
    expect([ranks.get("b"), ranks.get("a"), ranks.get("c"), ranks.get("d")]).toEqual([1, 2, 2, 4]);
  });

  it("gives an applicant without a score no place, and doesn't count them", () => {
    const ranks = rankByScore([
      { id: "a", total: null },
      { id: "b", total: 50 },
    ]);
    expect(ranks.has("a")).toBe(false);
    expect(ranks.get("b")).toBe(1);
  });

  it("is empty for nobody", () => {
    expect(rankByScore([]).size).toBe(0);
  });
});

describe("the applicant's profile", () => {
  it("reads the answers the committee compares", () => {
    const profile = applicantProfile(
      template,
      application({ "S2.1": "  Coffee  ", "S1.8": "yes", "S1.9": "no", "S2.4": { amount: 250000, currency: "USD" }, "S2.5": 12, "S7.3": "Seeking buyers in Germany" }),
    );
    expect(profile).toEqual({
      sector: "Coffee",
      womanOwned: true,
      youthOwned: false,
      annualRevenue: { amount: 250000, currency: "USD" },
      employees: 12,
      commercialAsk: "Seeking buyers in Germany",
    });
  });

  it("is null for what wasn't answered, or was answered 'not known'", () => {
    const profile = applicantProfile(template, { "S2.1": "   ", "S1.8": { notKnown: true }, "S2.5": { notKnown: true } });
    expect(profile).toEqual({ sector: null, womanOwned: null, youthOwned: null, annualRevenue: null, employees: null, commercialAsk: null });
  });

  it("is read from the questions the template names", () => {
    const moved: ApplicationTemplate = { ...template, inputs: { ...template.inputs, profile: { ...template.inputs.profile, sector: "S2.2" } } };
    expect(applicantProfile(moved, application({ "S2.1": "Coffee", "S2.2": "A roaster" })).sector).toBe("A roaster");
  });

  it("is checked when a template is validated", () => {
    const broken: ApplicationTemplate = { ...template, inputs: { ...template.inputs, profile: { ...template.inputs.profile, sector: "S9.9", revenue: "S2.5" } } };
    const errors = validateApplicationTemplates([broken]);
    expect(errors.some((e) => e.includes("profile.sector names missing question S9.9"))).toBe(true);
    expect(errors.some((e) => e.includes("profile.revenue: S2.5 is a number question, not money"))).toBe(true);
  });
});
