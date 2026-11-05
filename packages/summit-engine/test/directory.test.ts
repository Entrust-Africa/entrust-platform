import { describe, expect, it } from "vitest";
import { directoryDraft, findApplicationTemplate, profileProblems, reportAnswers, slugify } from "../src";
import type { ApplicationTemplate, ProfileContent, ReportApplication } from "../src";

const FORM = findApplicationTemplate("0.1.0") as ApplicationTemplate;

// The question IDs of version 0.1.0 of the application form.
const GIVEN = {
  "S2.1": "Coffee",
  "S2.2": "We grow, wash and export specialty green coffee from Sidama smallholders.",
  "S2.3": ["Green coffee", "Roasted coffee"],
  "S2.6": "40 tonnes a month in season",
  "S3.1": "yes",
  "S3.2": ["Germany", "United Arab Emirates"],
  "S3.4": ["Germany", "Japan"],
  "S3.9": "Fairtrade, Organic",
  "S1.10": "Amina Bekele",
  "S1.11": "Export manager",
  "S1.12": "amina@zebu.example",
  "S1.13": "+251 911 000 000",
};

function app(overrides: Partial<ReportApplication> = {}, given: Record<string, unknown> = GIVEN): ReportApplication {
  return {
    id: "id-1",
    number: "SUM-000001",
    businessName: "ZEBU Coffee",
    smeId: "ET-SME-1",
    country: "ET",
    status: "selected",
    pathway: "trade_and_market_access",
    seeksInvestment: false,
    createdAt: new Date("2030-01-02T10:00:00Z"),
    submittedAt: new Date("2030-01-03T10:00:00Z"),
    updatedAt: new Date("2030-01-04T10:00:00Z"),
    answers: reportAnswers(FORM, given as never),
    officer: null,
    eligibility: null,
    documents: { missing: [], files: [] },
    assessment: null,
    score: { points: 78, possible: 100, total: 78, categories: [] },
    review: null,
    recommendation: null,
    decision: { decision: "selected", reason: "Strong buyer evidence and a clear plan", by: "Committee member", at: new Date("2030-02-01T10:00:00Z") },
    result: "selected",
    finalListApprovedAt: new Date("2030-02-02T10:00:00Z"),
    verification: [],
    movedTo: {},
    committeeComments: ["Their financial statements look thin"],
    selectionNumber: 7,
    waitlistPosition: null,
    ...overrides,
  };
}

describe("a draft public profile", () => {
  it("takes what a business would put on a public page from its application", () => {
    const draft = directoryDraft(app());
    expect(draft).toMatchObject({
      displayName: "ZEBU Coffee",
      country: "ET",
      sector: "Coffee",
      productsServices: ["Green coffee", "Roasted coffee"],
      productionCapacity: "40 tonnes a month in season",
      targetMarkets: ["Germany", "Japan"],
      seeksInvestment: false,
      investmentRequirements: null,
      contactName: "Amina Bekele",
      contactPosition: "Export manager",
    });
    expect(draft.summary).toMatch(/specialty green coffee/);
    expect(draft.exportReadiness).toBe("Has exported to Germany, United Arab Emirates. Certifications and standards: Fairtrade, Organic.");
  });

  it("keeps the contact's email and telephone private until the business chooses to show them", () => {
    const draft = directoryDraft(app());
    expect(draft.contactEmail).toBeNull();
    expect(draft.contactPhone).toBeNull();
    expect(JSON.stringify(draft)).not.toMatch(/amina@zebu|911 000/);
  });

  it("holds no score, finding, committee reason, comment or financial figure", () => {
    const draft = directoryDraft(app({}, { ...GIVEN, "S2.7": { amount: 900000, currency: "USD" } }));
    const text = JSON.stringify(draft);
    expect(text).not.toMatch(/78|Strong buyer evidence|financial statements|committee|900000|900,000|SUM-000001|ET-SME/i);
    expect(Object.keys(draft).sort()).toEqual(
      [
        "city", "contactEmail", "contactName", "contactPhone", "contactPosition", "country", "displayName", "exportReadiness", "investmentRequirements",
        "productionCapacity", "productsServices", "sector", "seeksInvestment", "summary", "targetMarkets", "verification", "website",
      ].sort(),
    );
  });

  it("says what investment a business seeks only when it seeks one", () => {
    const given = { ...GIVEN, "S2.12": "trade_and_market_access", "S4.1": "yes", "S4.2": { amount: 250000, currency: "USD" }, "S4.3": "Buying a second washing station" };
    expect(directoryDraft(app({ seeksInvestment: false }, given)).investmentRequirements).toBeNull();
    const draft = directoryDraft(app({ seeksInvestment: true }, given));
    expect(draft.seeksInvestment).toBe(true);
    expect(draft.investmentRequirements).toBe("Seeking USD 250,000 for buying a second washing station.");
  });

  it("says a business has not exported when it says so, and nothing when the form was silent", () => {
    expect(directoryDraft(app({}, { ...GIVEN, "S3.1": "no", "S3.9": undefined })).exportReadiness).toBe("Has not exported yet.");
    expect(directoryDraft(app({}, { "S2.1": "Coffee" })).exportReadiness).toBeNull();
  });

  it("shows a business as verified only when its registration is supported by documents or checked independently", () => {
    const claim = (cls: "self_reported" | "document_supported" | "independently_verified" | "not_verified") => ({
      verification: [{ claim: "business_registration", class: cls, files: [], check: null, by: null, at: new Date() }],
    });
    expect(directoryDraft(app()).verification).toBe("pending");
    expect(directoryDraft(app(claim("self_reported") as never)).verification).toBe("pending");
    expect(directoryDraft(app(claim("not_verified") as never)).verification).toBe("pending");
    expect(directoryDraft(app(claim("document_supported") as never)).verification).toBe("verified");
    expect(directoryDraft(app(claim("independently_verified") as never)).verification).toBe("verified");
  });

  it("cuts a long description at a word instead of in the middle of one", () => {
    const long = Array.from({ length: 400 }, () => "coffee").join(" ");
    const draft = directoryDraft(app({}, { ...GIVEN, "S2.2": long }));
    expect(draft.summary.length).toBeLessThanOrEqual(1500);
    expect(draft.summary.endsWith("…")).toBe(true);
    expect(draft.summary.slice(0, -1).endsWith("coffee")).toBe(true);
  });
});

describe("whether a profile can be published", () => {
  const good = (): ProfileContent => ({ ...directoryDraft(app()) });

  it("accepts a complete profile", () => {
    expect(profileProblems(good())).toEqual([]);
  });

  it("asks for a name, a country, an industry, a description and at least one product", () => {
    const empty = { ...good(), displayName: " ", country: "", sector: "", summary: "short", productsServices: [] };
    expect(profileProblems(empty)).toHaveLength(5);
  });

  it("asks a business that seeks investment to say what it needs", () => {
    expect(profileProblems({ ...good(), seeksInvestment: true, investmentRequirements: null })).toEqual(["The business seeks investment, so say what it needs."]);
  });

  it("refuses a website that is not a web address", () => {
    expect(profileProblems({ ...good(), website: "javascript:alert(1)" })).toHaveLength(1);
    expect(profileProblems({ ...good(), website: "zebu.example" })).toHaveLength(1);
    expect(profileProblems({ ...good(), website: "https://zebu.example/en" })).toEqual([]);
  });
});

describe("slugs", () => {
  it("makes a web address from a business name", () => {
    expect(slugify("ZEBU Coffee")).toBe("zebu-coffee");
    expect(slugify("Éthiopie Café & Épices PLC")).toBe("ethiopie-cafe-and-epices-plc");
    expect(slugify("  --  ")).toBe("sme");
    expect(slugify("x".repeat(100)).length).toBeLessThanOrEqual(60);
  });
});
