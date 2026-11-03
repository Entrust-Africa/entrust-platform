import { describe, expect, it } from "vitest";
import {
  REPORTS,
  applyFilters,
  documentAccessOf,
  exportScope,
  findApplicationTemplate,
  findReport,
  inScope,
  opportunityClassification,
  reportAnswers,
  selectionNumbers,
  validateApplicationTemplates,
  waitlistPositions,
} from "../src";
import type { ApplicationStatus, ApplicationTemplate, Cell, ReportApplication, ReportContext, ReportDefinition } from "../src";

const FORM = findApplicationTemplate("0.1.0") as ApplicationTemplate;
const answers = (given: Record<string, unknown> = {}) => reportAnswers(FORM, given as never);

let n = 0;
/** An application that has been submitted and screened, with answers that make it a trade applicant. */
function app(overrides: Partial<ReportApplication> = {}, given: Record<string, unknown> = {}): ReportApplication {
  n += 1;
  const number = `SUM-${String(n).padStart(6, "0")}`;
  return {
    id: `id-${n}`,
    number,
    businessName: `Business ${n}`,
    smeId: `ET-SME-${n}`,
    country: "ET",
    status: "under_assessment",
    pathway: "trade_and_market_access",
    seeksInvestment: false,
    createdAt: new Date("2030-01-02T10:00:00Z"),
    submittedAt: new Date("2030-01-03T10:00:00Z"),
    updatedAt: new Date("2030-01-04T10:00:00Z"),
    answers: answers({ "S2.1": "Coffee", "S2.12": "trade_and_market_access", ...given }),
    officer: null,
    eligibility: { outcome: "eligible", criteria: [], missingDocuments: [], screenedAt: new Date("2030-01-03T11:00:00Z"), screenedBy: null },
    documents: { missing: [], files: [] },
    assessment: null,
    score: null,
    review: null,
    recommendation: null,
    decision: null,
    result: null,
    finalListApprovedAt: null,
    verification: [],
    movedTo: {},
    committeeComments: [],
    selectionNumber: null,
    waitlistPosition: null,
    ...overrides,
  };
}

const context = (overrides: Partial<ReportContext> = {}): ReportContext => ({ period: { name: "Summit", countries: ["ET", "KE"] }, documents: "all", filtered: false, ...overrides });
const report = (id: string): ReportDefinition => findReport(id) as ReportDefinition;
const rowsOf = (id: string, applications: ReportApplication[], ctx = context()) => report(id).build(applications, ctx);
/** A row as an object by column label. */
const asObjects = (id: string, applications: ReportApplication[], ctx = context()) =>
  rowsOf(id, applications, ctx).map((row) => Object.fromEntries(report(id).columns.map((c, i) => [c.label, row[i]])) as Record<string, Cell>);

const scored = (total: number, categories: Partial<Record<string, number | null>> = {}): NonNullable<ReportApplication["score"]> => ({
  points: total,
  possible: 100,
  total,
  categories: (["A", "B", "C", "D", "E", "F", "G"] as const).map((id) => ({ id, applicable: true, points: categories[id] ?? 1 })),
});
const assessment = { startedAt: new Date("2030-01-05T10:00:00Z"), completedAt: new Date("2030-01-06T10:00:00Z") };
const decided = (decision: "selected" | "waitlisted" | "not_selected" | "further_review_required", at = "2030-01-10T10:00:00Z", reason = "Because.") => ({
  decision,
  reason,
  by: "Cora Committee",
  at: new Date(at),
});

describe("the catalogue", () => {
  it("holds the twelve reports of section 11, in order, with the columns it lists", () => {
    expect(REPORTS.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(REPORTS.map((r) => r.id)).size).toBe(12);
    expect(REPORTS.map((r) => r.columns.length)).toEqual([19, 15, 17, 15, 20, 13, 21, 20, 21, 16, 19, 24]);
    expect(REPORTS.map((r) => r.title)).toEqual([
      "Application Register",
      "Eligibility Screening Report",
      "Country Distribution Report",
      "Sector Distribution Report",
      "Assessment Score Report",
      "Verification Report",
      "Investment Opportunity Report",
      "Trade Opportunity Report",
      "Selected SME Register",
      "Waitlist Report",
      "Committee Decision Report",
      "B2B Matching Preparation Report",
    ]);
  });

  it("gives every column a distinct key within its report", () => {
    for (const r of REPORTS) expect(new Set(r.columns.map((c) => c.key)).size, r.id).toBe(r.columns.length);
  });

  it("produces rows as wide as the columns, whatever the application holds", () => {
    const everything = [
      app(),
      app({ status: "selected", decision: decided("selected"), score: scored(80), assessment, selectionNumber: 1, recommendation: { id: "recommend_selection", suitable: "trade", at: new Date() } }),
      app({ status: "waitlisted", decision: decided("waitlisted"), waitlistPosition: 1, movedTo: { waitlisted: new Date("2030-01-11T10:00:00Z") } }),
      app({ verification: [{ claim: "annual_revenue", class: "document_supported", files: [{ name: "a.pdf", kind: "financial_statements" }], check: null, by: null, at: new Date() }] }),
    ];
    for (const r of REPORTS) {
      for (const row of r.build(everything, context())) expect(row.length, r.id).toBe(r.columns.length);
    }
  });

  it("is valid against the application form it reads", () => {
    expect(validateApplicationTemplates([FORM])).toEqual([]);
  });

  it("refuses a form whose report questions don't exist or are the wrong kind, so a new version can't silently empty a column", () => {
    const withReport = (report: Record<string, string>): ApplicationTemplate => ({ ...FORM, inputs: { ...FORM.inputs, report } });
    expect(validateApplicationTemplates([withReport({ exported: "S9.9" })])).toEqual(["0.1.0: report.exported names missing question S9.9"]);
    expect(validateApplicationTemplates([withReport({ exported: "S2.1" })])).toEqual(["0.1.0: report.exported: S2.1 is a short_text question, not yes_no"]);
    expect(validateApplicationTemplates([withReport({ investmentAmount: "S1.1" })])).toEqual(["0.1.0: report.investmentAmount: S1.1 is a short_text question, not money"]);
    expect(validateApplicationTemplates([withReport({ unheardOf: "S2.1" })])).toEqual(["0.1.0: report: unheardOf isn't something a report reads"]);
    // A version may leave out what it doesn't ask.
    expect(validateApplicationTemplates([withReport({})])).toEqual([]);
  });
});

describe("the application register", () => {
  it("lists every application, drafts included, with the contact and progress", () => {
    const submitted = app(
      { officer: { id: "u1", name: "Olive Officer" }, documents: { missing: ["financial_statements"], files: [] } },
      { "S1.10": "Abebe", "S1.11": "Founder", "S1.12": "abebe@example.com", "S1.13": "+251911000000", "S1.4": "registered", "S2.3": ["Green coffee", "Roasted coffee"] },
    );
    const draft = app({ status: "draft", submittedAt: null, eligibility: null });
    const rows = asObjects("application-register", [draft, submitted]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "Application ID": submitted.number,
      "Business name": submitted.businessName,
      Country: "Ethiopia",
      Industry: "Coffee",
      "Main business activity": "Green coffee; Roasted coffee",
      "Applicant name": "Abebe",
      "Applicant position": "Founder",
      "Email address": "abebe@example.com",
      "Telephone number": "+251911000000",
      "Business registration status": "Registered in my country",
      "Primary applicant pathway": "Trade and market access",
      "Date registered": "2030-01-02",
      "Date submitted": "2030-01-03",
      "Application status": "Under assessment",
      "Assigned assessment officer": "Olive Officer",
      "Eligibility outcome": "Eligible",
      "Document completeness status": "Missing: Financial statements",
      "Last updated date": "2030-01-04",
    });
    expect(rows[1]).toMatchObject({ "Date submitted": null, "Application status": "Draft", "Eligibility outcome": "Not screened" });
    // The form asks for no city, so the column is there and empty.
    expect(rows[0]!["City or region"]).toBeNull();
  });

  it("lists applications in the order of their numbers", () => {
    const [first, second] = [app(), app()];
    expect(asObjects("application-register", [second!, first!]).map((r) => r["Application ID"])).toEqual([first!.number, second!.number]);
  });
});

describe("the eligibility report", () => {
  const criteria = (results: Record<string, "met" | "not_met" | "unclear" | "excepted">) =>
    Object.entries(results).map(([id, result]) => ({ id, text: id, result, reason: `${id} is ${result}.` })) as never;

  it("lists submitted applications with what each requirement found", () => {
    const ineligible = app({
      status: "ineligible",
      eligibility: {
        outcome: "ineligible",
        criteria: criteria({ registered: "not_met", operating: "met", representative: "met", offering: "met", declaration: "met", documents: "unclear" }),
        missingDocuments: ["registration_certificate"],
        screenedAt: new Date("2030-01-03T11:00:00Z"),
        screenedBy: null,
      },
    });
    const draft = app({ status: "draft", submittedAt: null, eligibility: null });
    const rows = asObjects("eligibility-screening", [ineligible, draft]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Eligibility outcome": "Ineligible",
      "Authorized representative confirmed": "Yes",
      "Declaration completed": "Yes",
      "Minimum documentation received": "No",
      "Reason for ineligibility": "registered is not_met.",
      "Outstanding information": "documents is unclear. Documents missing: Registration certificate.",
      "Screening officer": "Automatic screening",
      "Screening date": "2030-01-03",
      "Review status": "Screened automatically",
    });
  });

  it("counts an exception as a requirement met, and names the officer who screened again", () => {
    const rows = asObjects("eligibility-screening", [
      app({
        eligibility: {
          outcome: "eligible",
          criteria: criteria({ documents: "excepted" }),
          missingDocuments: [],
          screenedAt: new Date("2030-01-04T11:00:00Z"),
          screenedBy: "Adam Admin",
        },
      }),
    ]);
    expect(rows[0]).toMatchObject({ "Minimum documentation received": "Yes", "Screening officer": "Adam Admin", "Review status": "Screened again by staff", "Outstanding information": null });
  });
});

describe("the country distribution report", () => {
  it("counts the period's countries, each with zeros if empty, then any other", () => {
    const rows = asObjects("country-distribution", [
      app({ country: "ET", score: scored(80), assessment, status: "selected" }),
      app({ country: "ET", score: scored(60), assessment, status: "waitlisted", pathway: "investment" }),
      app({ country: "ET", status: "draft", submittedAt: null, eligibility: null }),
      app({ country: "ET", status: "withdrawn" }),
      app({ country: "GH", status: "under_assessment", pathway: "combined_trade_and_investment" }),
    ]);
    expect(rows.map((r) => r.Country)).toEqual(["Ethiopia", "Kenya", "Ghana"]);
    expect(rows[0]).toMatchObject({
      "Total applications": 3,
      "Draft applications": 1,
      "Submitted applications": 2,
      "Eligible applicants": 2,
      "Completed assessments": 2,
      "Selected SMEs": 1,
      "Waitlisted SMEs": 1,
      "Average normalized score": 70,
      "Number of trade applicants": 1,
      "Number of investment applicants": 1,
    });
    expect(rows[1]).toMatchObject({ "Total applications": 0, "Average normalized score": null });
    expect(rows[2]).toMatchObject({ "Total applications": 1, "Applications under assessment": 1, "Number of combined applicants": 1 });
  });

  it("agrees with the dashboard on who is under assessment and who is selected", () => {
    const [row] = asObjects("country-distribution", [
      app({ status: "under_assessment" }),
      app({ status: "under_verification" }),
      app({ status: "awaiting_additional_information" }),
      app({ status: "committee_review" }),
    ]);
    expect(row!["Applications under assessment"]).toBe(2);
    expect(row!["Selected SMEs"]).toBe(0);
  });

  it("lists only countries with applications once a filter has narrowed them", () => {
    const rows = asObjects("country-distribution", [app({ country: "ET" })], context({ filtered: true }));
    expect(rows.map((r) => r.Country)).toEqual(["Ethiopia"]);
  });

  it("counts recommended applicants by the officer's recommendation", () => {
    const rec = (id: "recommend_selection" | "do_not_recommend") => ({ id, suitable: null, at: new Date() });
    const [row] = asObjects("country-distribution", [app({ recommendation: rec("recommend_selection") }), app({ recommendation: rec("do_not_recommend") }), app()]);
    expect(row!["Recommended applicants"]).toBe(1);
  });
});

describe("the sector distribution report", () => {
  it("groups industries however they are typed, with the unstated last, and sums the money asked for by currency", () => {
    const asks = (amount: number, currency: string) => ({ "S4.2": { amount, currency }, "S2.12": "investment" });
    const rows = asObjects("sector-distribution", [
      app({ seeksInvestment: true, pathway: "investment" }, { "S2.1": "Coffee", ...asks(100, "USD") }),
      app({ seeksInvestment: true, pathway: "investment" }, { "S2.1": " coffee ", ...asks(50, "USD") }),
      app({ seeksInvestment: true, pathway: "investment" }, { "S2.1": "Coffee", ...asks(1000, "ETB") }),
      app({ pathway: "trade_and_market_access" }, { "S2.1": "Honey", "S3.1": "yes", "S2.3": ["Raw honey"] }),
      app({}, { "S2.1": "" }),
    ]);
    expect(rows.map((r) => r.Industry)).toEqual(["Coffee", "Honey", "Not stated"]);
    expect(rows[0]).toMatchObject({ "Total applications": 3, "Investment applicants": 3, "Total stated investment requested": "ETB 1,000; USD 150" });
    expect(rows[1]).toMatchObject({ "Total applications": 1, "Business activity": "Raw honey", "Number of businesses with export experience": 1, "Total stated investment requested": null });
  });
});

describe("the assessment score report", () => {
  it("lists assessed applications with each category's points, the total and where review stands", () => {
    const withD = scored(80, { A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 5 });
    const trade = { ...scored(100), categories: scored(100).categories.map((c) => (c.id === "D" ? { ...c, applicable: false, points: null } : c)) };
    const rows = asObjects("assessment-scores", [
      app({ score: withD, assessment, review: { decision: "approved", at: new Date() }, officer: { id: "u", name: "Olive" } }),
      app({ score: trade, assessment: { ...assessment, completedAt: null } }),
      app(), // not started
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "Business legitimacy score": 10,
      "Commercial offering score": 11,
      "Trade opportunity score": 12,
      "Investment opportunity score": 13,
      "Financial and operational readiness score": 14,
      "Diaspora partnership score": 15,
      "Summit readiness score": 5,
      "Raw score": 80,
      "Applicable maximum score": 100,
      "Normalized score": 80,
      "Investment category status": "Applicable",
      "Assessment completion date": "2030-01-06",
      "Assessment review status": "Approved",
    });
    expect(rows[1]).toMatchObject({ "Investment opportunity score": null, "Investment category status": "N/A", "Assessment review status": "In progress", "Assessment completion date": null });
  });

  it("says an assessment the officer finished is awaiting review, and one sent back was returned", () => {
    const statuses = asObjects("assessment-scores", [
      app({ score: scored(70), assessment }),
      app({ score: scored(70), assessment: { ...assessment, completedAt: null }, review: { decision: "returned", at: new Date() } }),
    ]).map((r) => r["Assessment review status"]);
    expect(statuses).toEqual(["Awaiting review", "Returned to the officer"]);
  });
});

describe("the verification report", () => {
  const claim = (overrides: Partial<ReportApplication["verification"][number]> = {}) => ({
    claim: "annual_revenue",
    class: "document_supported" as const,
    files: [
      { name: "accounts.pdf", kind: "financial_statements" as const },
      { name: "certificate.pdf", kind: "registration_certificate" as const },
    ],
    check: "Called the bank.",
    by: "Olive Officer",
    at: new Date("2030-01-07T10:00:00Z"),
    ...overrides,
  });

  it("has a row for each classified claim, with what is still outstanding", () => {
    const rows = asObjects("verification", [
      app({ verification: [claim(), claim({ claim: "export_history", class: "independently_verified", files: [] }), claim({ claim: "something else", class: "self_reported" })] }),
      app(),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      "Claim or information being verified": "Annual revenue",
      "Evidence type": "Financial statements or management accounts",
      "Evidence classification": "Document-supported",
      "Verification outcome": "Supported by documents",
      "Verification comments": "Called the bank.",
      "Outstanding verification requirements": "An independent check",
      "Assigned verification officer": "Olive Officer",
      "Verification date": "2030-01-07",
    });
    expect(rows[1]).toMatchObject({ "Verification outcome": "Verified", "Outstanding verification requirements": null, "Document name": null });
    // A claim the officer named in their own words has no evidence type from the specification.
    expect(rows[2]).toMatchObject({ "Claim or information being verified": "something else", "Evidence type": null });
  });

  it("names a document only to those allowed to open it: financial statements are restricted, and the committee sees no files", () => {
    const applications = [app({ verification: [claim()] })];
    const names = (documents: ReportContext["documents"]) => asObjects("verification", applications, context({ documents }))[0]!["Document name"];
    expect(names("all")).toBe("accounts.pdf; certificate.pdf");
    expect(names("unrestricted")).toBe("certificate.pdf");
    expect(names("none")).toBeNull();
  });
});

describe("the investment and trade reports", () => {
  const investor = (given: Record<string, unknown> = {}, overrides: Partial<ReportApplication> = {}) =>
    app(
      { seeksInvestment: true, pathway: "investment", ...overrides },
      { "S2.12": "investment", "S4.2": { amount: 250000, currency: "USD" }, "S4.3": "A new plant", "S4.4": ["equity", "other"], "S4.6": "Twice the output", "S2.4": { amount: 90000, currency: "ETB" }, ...given },
    );

  it("lists those seeking investment, with the amount and currency apart", () => {
    const rows = asObjects("investment-opportunities", [
      investor({ "S4.7": "yes" }, { documents: { missing: [], files: [{ name: "plan.pdf", kind: "business_plan" }] }, score: scored(75, { D: 13 }) }),
      investor({ "S5.2": "yes", "S4.7": "no" }),
      app(), // trade only
      investor({}, { status: "draft", submittedAt: null }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "Investment amount requested": 250000,
      Currency: "USD",
      "Investment type": "Equity; Other",
      "Intended use of funds": "A new plant",
      "Expected business outcomes": "Twice the output",
      "Revenue range": "ETB 90,000",
      "Business plan available": "Yes (uploaded)",
      "Financial statements available": null,
      "Investment readiness score": 13,
      "Overall normalized score": 75,
      "Verification status": "Not yet classified",
      "Selection status": "Not yet with the committee",
    });
    expect(rows[1]).toMatchObject({ "Financial statements available": "Yes (not uploaded)", "Business plan available": "No" });
    // Questions the form doesn't ask.
    expect(rows[0]!["Existing investment secured"]).toBeNull();
  });

  it("lists the trade applicants, with what they have from buyers", () => {
    const rows = asObjects("trade-opportunities", [
      app({}, { "S3.1": "yes", "S3.2": ["Kenya"], "S3.4": ["UAE", "UK"], "S3.5": "yes", "S3.6": ["purchase_order", "buyer_enquiries"], "S3.7": "A Dubai importer", "S3.8": { amount: 40000, currency: "USD" }, "S2.6": "10 tonnes a month" }),
      app({ pathway: "combined_trade_and_investment" }, { "S3.1": "no", "S3.5": "no" }),
      app({ pathway: "strategic_partnership" }, {}),
      app({ pathway: "investment" }, {}),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      "Export experience": "Yes",
      "Existing export markets": "Kenya",
      "Target markets": "UAE; UK",
      "Current buyer relationships": "A Dubai importer",
      "Confirmed purchase orders": "Yes",
      "Active buyer enquiries": "Yes",
      "Estimated trade opportunity value": 40000,
      Currency: "USD",
      "Production or service capacity": "10 tonnes a month",
    });
    expect(rows[1]).toMatchObject({ "Export experience": "No", "Current buyer relationships": "No", "Confirmed purchase orders": "No" });
  });
});

describe("the selected, waitlist, decision and matching reports", () => {
  const selected = (overrides: Partial<ReportApplication> = {}, given: Record<string, unknown> = {}) =>
    app(
      {
        status: "selected",
        decision: decided("selected", "2030-01-10T10:00:00Z", "Strong buyer interest."),
        score: scored(88),
        selectionNumber: 3,
        recommendation: { id: "recommend_selection", suitable: "combined", at: new Date() },
        result: "selected",
        finalListApprovedAt: new Date("2030-01-12T10:00:00Z"),
        ...overrides,
      },
      { "S7.1": "Meet buyers", "S7.2": ["investors", "importers_and_distributors"], "S7.3": "Seeking USD 250,000", "S7.4": ["UAE"], "S7.5": { amount: 250000, currency: "USD" }, "S9.4": "Abebe Kebede", ...given },
    );

  it("registers the selected SMEs with their numbers, classification and contact", () => {
    const rows = asObjects("selected-smes", [selected({}, { "S1.12": "a@example.com" }), app({ status: "waitlisted" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Selection number": "SEL-003",
      "Opportunity classification": "Combined opportunity",
      "Normalized assessment score": 88,
      "Primary commercial objective": "Meet buyers",
      "Target market": "UAE",
      "Authorized representative": "Abebe Kebede",
      "Email address": "a@example.com",
      "Selection decision date": "2030-01-10",
      "Committee approval status": "Approved 2030-01-12",
      "Participation confirmation status": null,
    });
    expect(asObjects("selected-smes", [selected({ finalListApprovedAt: null })])[0]!["Committee approval status"]).toBe("Awaiting final list approval");
  });

  it("lists the waitlist with the reason and comments, and when the applicant was added", () => {
    const rows = asObjects("waitlist", [
      app({
        status: "waitlisted",
        waitlistPosition: 2,
        decision: decided("waitlisted", "2030-01-10T10:00:00Z", "Strong, but the country is full."),
        committeeComments: ["Revisit if a place opens.", "Good fit for Kenya."],
        movedTo: { waitlisted: new Date("2030-01-09T10:00:00Z") },
        score: scored(71),
      }),
    ]);
    expect(rows[0]).toMatchObject({
      "Waitlist position": 2,
      "Reason for waitlisting": "Strong, but the country is full.",
      "Selection committee comments": "Revisit if a place opens. | Good fit for Kenya.",
      "Date added to waitlist": "2030-01-09",
      "Last reviewed date": "2030-01-10",
      "Current status": "Waitlisted",
      "Normalized score": 71,
    });
  });

  it("records every committee decision, and says whether the result is published", () => {
    const rows = asObjects("committee-decisions", [
      selected(),
      app({ status: "committee_review", decision: decided("further_review_required", "2030-01-11T10:00:00Z", "Need the audit.") }),
      app({ status: "waitlisted", decision: decided("waitlisted"), result: null }),
      app(), // undecided
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      "Assessment officer recommendation": "Recommend for Summit selection",
      "Committee decision": "Selected",
      "Committee justification": "Strong buyer interest.",
      "Committee member or authorized decision-maker": "Cora Committee",
      "Decision date": "2030-01-10",
      "Approval status": "Approved",
      "Final selection status": "Selected",
    });
    expect(rows[1]).toMatchObject({ "Committee decision": "Further review required", "Approval status": "Awaiting final list approval", "Final selection status": "Not yet published" });
    // Nothing is recorded for what the decision form doesn't ask.
    expect(rows[0]!["Outstanding conditions"]).toBeNull();
  });

  it("prepares the selected portfolio for matching, with the tracking columns left to fill in", () => {
    const rows = asObjects("b2b-matching", [selected({}, { "S2.2": "Roasts coffee", "S6.4": ["joint_venture"], "S6.6": "Access to the market." })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "SME selection number": "SEL-003",
      "Primary opportunity classification": "Combined opportunity",
      "Target country or market": "UAE",
      "Buyer or partner type sought": "Investors; Importers and distributors",
      "Specific commercial ask": "Seeking USD 250,000",
      "Estimated transaction value": "USD 250,000",
      "Preferred partner profile": "Joint venture Access to the market.",
      "Business description": "Roasts coffee",
    });
    for (const label of ["Meeting priority", "Assigned matching officer", "Meeting status", "Follow-up action", "Follow-up owner", "Post-Summit outcome"]) {
      expect(rows[0]![label], label).toBeNull();
    }
  });
});

describe("who may export what", () => {
  const aggregate = ["country-distribution", "sector-distribution"];

  it("gives administrators and facilitators every report in full", () => {
    for (const r of REPORTS) for (const role of ["admin", "facilitator"] as const) expect(exportScope(r, role), `${r.id} ${role}`).toBe("all");
  });

  it("gives an assessment officer their own applications, and the figures of the whole period for the two distribution reports", () => {
    for (const r of REPORTS) expect(exportScope(r, "reviewer"), r.id).toBe(aggregate.includes(r.id) ? "aggregate" : "assigned");
  });

  it("gives the committee the applications it can open, and the whole period's figures for the two distribution reports", () => {
    for (const r of REPORTS) expect(exportScope(r, "committee"), r.id).toBe(aggregate.includes(r.id) ? "aggregate" : "committee");
  });

  it("limits the supporting documents each role may name", () => {
    expect(["admin", "facilitator", "reviewer", "committee"].map((r) => documentAccessOf(r as never))).toEqual(["all", "unrestricted", "all", "none"]);
  });

  it("cuts the applications down to the scope, and a filter only narrows them further", () => {
    const mine = app({ officer: { id: "me", name: "Me" } });
    const theirs = app({ officer: { id: "you", name: "You" } });
    const review = app({ status: "committee_review", officer: { id: "you", name: "You" } });
    const early = app({ status: "recommended" });
    const all = [mine, theirs, review, early];
    expect(inScope(all, "assigned", "me")).toEqual([mine]);
    expect(inScope(all, "committee", "x")).toEqual([review]);
    expect(inScope(all, "all", "x")).toHaveLength(4);
    expect(inScope(all, "aggregate", "x")).toHaveLength(4);
    // A filter for what is out of scope finds nothing, since the scope was applied first.
    expect(applyFilters(inScope(all, "assigned", "me"), { status: "committee_review" })).toEqual([]);
  });

  it("filters by country, status, pathway and sector", () => {
    const ke = app({ country: "KE", status: "selected", pathway: "investment" }, { "S2.1": "Textiles and apparel" });
    const et = app({ country: "ET" }, { "S2.1": "Coffee" });
    expect(applyFilters([ke, et], { country: "ke" })).toEqual([ke]);
    expect(applyFilters([ke, et], { status: "under_assessment" })).toEqual([et]);
    expect(applyFilters([ke, et], { pathway: "investment" })).toEqual([ke]);
    expect(applyFilters([ke, et], { sector: "textile" })).toEqual([ke]);
    expect(applyFilters([ke, et], {})).toEqual([ke, et]);
  });
});

describe("numbering", () => {
  it("numbers the selected SMEs in the order they were selected, then by application number", () => {
    const first = app({ status: "selected", decision: decided("selected", "2030-01-10T10:00:00Z") });
    const second = app({ status: "selected", decision: decided("selected", "2030-01-09T10:00:00Z") });
    const tied = app({ status: "selected", decision: decided("selected", "2030-01-10T10:00:00Z") });
    const other = app({ status: "waitlisted" });
    const numbers = selectionNumbers([first, second, tied, other]);
    expect([numbers.get(second.id), numbers.get(first.id), numbers.get(tied.id), numbers.get(other.id)]).toEqual([1, 2, 3, undefined]);
  });

  it("puts the best-scoring waitlisted applicant first, and an unscored one last", () => {
    const low = app({ status: "waitlisted", score: scored(60) });
    const high = app({ status: "waitlisted", score: scored(90) });
    const none = app({ status: "waitlisted" });
    const tie = app({ status: "waitlisted", score: scored(90) });
    const positions = waitlistPositions([low, none, tie, high, app({ status: "selected", score: scored(99) })]);
    expect([high, tie, low, none].map((a) => positions.get(a.id))).toEqual([1, 2, 3, 4]);
  });
});

describe("the opportunity classification", () => {
  it("is the officer's view of what suits the applicant, else what the applicant chose", () => {
    expect(opportunityClassification("investment", "trade_and_market_access")).toBe("Investment opportunity");
    expect(opportunityClassification(null, "trade_and_market_access")).toBe("Trade opportunity");
    expect(opportunityClassification(undefined, "combined_trade_and_investment")).toBe("Combined opportunity");
    expect(opportunityClassification(null, "strategic_partnership")).toBe("Strategic partnership");
    expect(opportunityClassification(null, null)).toBeNull();
  });
});

describe("reading the answers", () => {
  it("puts an option's label, a figure with its currency, and yes or no into words", () => {
    const a = answers({ "S1.4": "registered", "S2.12": "investment", "S4.2": { amount: 1234.5, currency: "USD" }, "S3.1": "yes", "S4.4": ["equity"] });
    expect(a.text("registration")).toBe("Registered in my country");
    expect(a.text("investmentAmount")).toBe("USD 1,234.5");
    expect([a.amount("investmentAmount"), a.currency("investmentAmount")]).toEqual([1234.5, "USD"]);
    expect(a.yesNo("exported")).toBe(true);
    expect(a.list("investmentTypes")).toEqual(["Equity"]);
    expect(a.picked("investmentTypes")).toEqual(["equity"]);
    expect(a.text("city")).toBeNull();
    expect(a.yesNo("activeBuyer")).toBeNull();
  });

  it("ignores an answer to a question the form hides", () => {
    // The investment questions are shown to those seeking investment, and this applicant chose trade and didn't say yes to S4.1.
    const a = answers({ "S2.12": "trade_and_market_access", "S4.2": { amount: 5, currency: "USD" }, "S4.4": ["equity"] });
    expect([a.text("investmentAmount"), a.amount("investmentAmount"), a.list("investmentTypes")]).toEqual([null, null, []]);
  });

  it("treats 'not known' as no answer", () => {
    expect(answers({ "S2.1": { notKnown: true } }).text("sector")).toBeNull();
  });
});

describe("a status the report doesn't know", () => {
  it("is still a row: the label is the status in words", () => {
    const status: ApplicationStatus = "awaiting_additional_information";
    expect(asObjects("application-register", [app({ status })])[0]!["Application status"]).toBe("Awaiting additional information");
  });
});
