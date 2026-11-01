import { describe, expect, it } from "vitest";
import { DEFAULT_SELECTION_TARGET, summarise, targetFor, validTarget } from "../src";
import type { ApplicationStatus, DashboardInput, DashboardRow } from "../src";

const row = (overrides: Partial<DashboardRow> = {}): DashboardRow => ({
  country: "ET",
  status: "under_assessment",
  submitted: true,
  eligible: true,
  assessed: false,
  score: null,
  sector: "Coffee",
  pathway: "trade_and_market_access",
  suitableOpportunity: null,
  womanOwned: false,
  youthOwned: false,
  ...overrides,
});
const done = (status: ApplicationStatus, score: number, overrides: Partial<DashboardRow> = {}) => row({ status, assessed: true, score, ...overrides });

const NO_VERIFICATION = { self_reported: 0, document_supported: 0, independently_verified: 0, not_verified: 0, not_applicable: 0 };
const input = (rows: DashboardRow[], overrides: Partial<DashboardInput> = {}): DashboardInput => ({
  rows,
  countries: ["ET", "KE", "GH"],
  target: { perCountry: DEFAULT_SELECTION_TARGET, overrides: {} },
  verification: NO_VERIFICATION,
  classifiedApplications: 0,
  ...overrides,
});

describe("the dashboard's totals", () => {
  it("counts submitted applications that weren't withdrawn, and keeps drafts and withdrawn apart", () => {
    const d = summarise(
      input([
        row(),
        row({ status: "submitted", eligible: false }),
        row({ status: "draft", submitted: false, eligible: false }),
        row({ status: "withdrawn", assessed: true, score: 80 }),
        row({ status: "ineligible", eligible: false }),
      ]),
    );
    expect(d.totals).toMatchObject({ applications: 3, drafts: 1, withdrawn: 1, ineligible: 1, eligible: 1 });
  });

  it("counts each stage of the workflow", () => {
    const d = summarise(
      input([
        row({ status: "under_assessment" }),
        row({ status: "under_verification" }),
        row({ status: "awaiting_additional_information" }),
        done("assessment_completed", 70),
        done("recommended", 75),
        done("committee_review", 80),
        done("selected", 90),
        done("waitlisted", 60),
        done("not_selected", 40),
      ]),
    );
    expect(d.totals).toMatchObject({
      applications: 9,
      underAssessment: 2,
      awaitingInformation: 1,
      assessed: 6,
      inCommitteeReview: 1,
      selected: 1,
      waitlisted: 1,
      notSelected: 1,
    });
  });

  it("averages the adjusted score of the assessed applications to one decimal", () => {
    const d = summarise(input([done("recommended", 80), done("selected", 91), done("not_selected", 50), row()]));
    expect(d.totals.averageScore).toBe(73.7);
    expect(summarise(input([row()])).totals.averageScore).toBeNull();
    expect(summarise(input([])).totals).toMatchObject({ applications: 0, averageScore: null });
  });

  it("doesn't count an assessment that was sent back, or a withdrawn application's score", () => {
    const d = summarise(input([row({ status: "under_assessment", assessed: false, score: 77 }), done("withdrawn", 99), done("selected", 60)]));
    expect(d.totals).toMatchObject({ assessed: 1, averageScore: 60 });
  });
});

describe("by country", () => {
  it("lists the period's countries in its order, with zeros for a country nobody applied from", () => {
    const d = summarise(input([row({ country: "KE" }), row({ country: "KE" })]));
    expect(d.byCountry.map((c) => [c.country, c.applications])).toEqual([["ET", 0], ["KE", 2], ["GH", 0]]);
    expect(d.byCountry[0]).toMatchObject({ eligible: 0, assessed: 0, averageScore: null, selected: 0, remaining: 10 });
  });

  it("gives each country's applications, eligible, under assessment, assessed, average score and selections", () => {
    const d = summarise(
      input([
        row({ country: "ET" }),
        row({ country: "ET", eligible: false, status: "ineligible" }),
        done("selected", 90, { country: "ET" }),
        done("waitlisted", 70, { country: "ET" }),
        done("selected", 85, { country: "KE" }),
      ]),
    );
    expect(d.byCountry[0]).toEqual({
      country: "ET",
      applications: 4,
      eligible: 3,
      underAssessment: 1,
      assessed: 2,
      averageScore: 80,
      selected: 1,
      waitlisted: 1,
      notSelected: 0,
      target: 10,
      remaining: 9,
    });
    expect(d.byCountry[1]).toMatchObject({ country: "KE", applications: 1, averageScore: 85, selected: 1 });
  });

  it("matches countries whatever their case, and adds any country the period doesn't list", () => {
    const d = summarise(input([row({ country: "et" }), row({ country: "ZA" }), row({ country: null })], { countries: ["et", "KE"] }));
    expect(d.byCountry.map((c) => [c.country, c.applications])).toEqual([["ET", 1], ["KE", 0], ["ZA", 1], [null, 1]]);
    // Only the period's countries have a target.
    expect(d.byCountry.map((c) => c.target)).toEqual([10, 10, 0, 0]);
  });
});

describe("the selection target", () => {
  it("is the same for every country unless the committee set one for it", () => {
    const target = { perCountry: 10, overrides: { KE: 4, gh: 15 } };
    expect(targetFor(target, "ET")).toBe(10);
    expect(targetFor(target, "ke")).toBe(4);
    expect(targetFor(target, "GH")).toBe(10);
    expect(targetFor(target, null)).toBe(10);
  });

  it("is counted against the period's countries, not against any other", () => {
    const d = summarise(
      input([done("selected", 90), done("selected", 80), done("selected", 70, { country: "KE" }), done("selected", 60, { country: "ZA" })], {
        target: { perCountry: 3, overrides: { KE: 1 } },
      }),
    );
    expect(d.target).toEqual({ perCountry: 3, total: 3 + 1 + 3, selected: 3, remaining: 4 });
    expect(d.byCountry.map((c) => [c.country, c.target, c.selected, c.remaining])).toEqual([["ET", 3, 2, 1], ["KE", 1, 1, 0], ["GH", 3, 0, 3], ["ZA", 0, 1, 0]]);
  });

  it("never shows a negative number remaining", () => {
    const d = summarise(input([done("selected", 90), done("selected", 80)], { target: { perCountry: 1, overrides: {} } }));
    expect(d.byCountry[0]).toMatchObject({ target: 1, selected: 2, remaining: 0 });
    // Three countries at 1 each, two selected.
    expect(d.target).toMatchObject({ total: 3, selected: 2, remaining: 1 });
  });

  it("accepts whole numbers from 0 to 1000", () => {
    expect([0, 10, 1000].every(validTarget)).toBe(true);
    expect([-1, 1.5, 1001, Number.NaN].some(validTarget)).toBe(false);
  });
});

describe("the other figures", () => {
  it("groups industries ignoring case and spacing, most applications first", () => {
    const d = summarise(
      input([
        row({ sector: "Coffee" }),
        row({ sector: "  coffee " }),
        done("selected", 90, { sector: "COFFEE" }),
        row({ sector: "Leather  goods" }),
        row({ sector: null }),
        row({ sector: "Honey" }),
      ]),
    );
    expect(d.byIndustry).toEqual([
      { sector: "Coffee", applications: 3, selected: 1 },
      { sector: "Honey", applications: 1, selected: 0 },
      { sector: "Leather goods", applications: 1, selected: 0 },
      { sector: null, applications: 1, selected: 0 },
    ]);
  });

  it("counts the pathways applicants chose, and what the officers thought suited them", () => {
    const d = summarise(
      input([
        row({ pathway: "investment", suitableOpportunity: "investment" }),
        row({ pathway: "combined_trade_and_investment", suitableOpportunity: "combined" }),
        row(),
        row({ pathway: null }),
      ]),
    );
    expect(d.byPathway).toEqual({ trade_and_market_access: 1, investment: 1, strategic_partnership: 0, combined_trade_and_investment: 1 });
    expect(d.bySuitableOpportunity).toEqual({ trade: 0, investment: 1, strategic_partnership: 0, combined: 1 });
  });

  it("counts women-owned and youth-owned businesses, and how many of them were selected", () => {
    const d = summarise(
      input([
        row({ womanOwned: true }),
        done("selected", 90, { womanOwned: true, youthOwned: true }),
        done("selected", 80, { womanOwned: false, youthOwned: true }),
        row({ womanOwned: null, youthOwned: null }),
      ]),
    );
    expect(d.ownership).toEqual({ womanOwned: { applications: 2, selected: 1 }, youthOwned: { applications: 2, selected: 2 } });
  });

  it("passes on the verification counts, with every class present", () => {
    const d = summarise(input([], { verification: { ...NO_VERIFICATION, independently_verified: 3, self_reported: 5 }, classifiedApplications: 4 }));
    expect(d.verification).toEqual({ byClass: { self_reported: 5, document_supported: 0, independently_verified: 3, not_verified: 0, not_applicable: 0 }, classifiedApplications: 4 });
  });
});
