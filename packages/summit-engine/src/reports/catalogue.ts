import { COMMITTEE_STATUSES } from "../committee";
import { UNDER_ASSESSMENT } from "../dashboard";
import {
  COMMITTEE_DECISIONS,
  OPPORTUNITY_PATHWAYS,
  RECOMMENDATIONS,
  SUITABLE_OPPORTUNITIES,
  VERIFIABLE_CLAIMS,
  VERIFICATION_CLASSES,
  type ApplicationStatus,
  type CategoryId,
  type OpportunityPathway,
  type SuitableOpportunity,
  type VerificationClass,
} from "../types";
import { formatMoney } from "./answers";
import type { Cell, ReportApplication, ReportColumn, ReportContext, ReportDefinition, ReportFile } from "./types";

// The twelve reports of the specification's section 11, as data: which columns each has and which applications it lists.
// Each cell is read from the same ReportApplication, so the reports agree with one another and with the dashboard. A
// column the application form has no question for stays empty.

// ---- Words ----

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
export const statusLabel = (status: ApplicationStatus): string => capitalise(status.replaceAll("_", " "));

const PATHWAY_LABELS: Readonly<Record<OpportunityPathway, string>> = {
  trade_and_market_access: "Trade and market access",
  investment: "Investment",
  strategic_partnership: "Strategic partnership",
  combined_trade_and_investment: "Combined trade and investment",
};
const pathwayLabel = (a: ReportApplication): string | null => (a.pathway ? PATHWAY_LABELS[a.pathway] : null);

const OUTCOME_LABELS = { eligible: "Eligible", ineligible: "Ineligible", pending_clarification: "Pending clarification" } as const;
const outcomeLabel = (a: ReportApplication): string => (a.eligibility ? OUTCOME_LABELS[a.eligibility.outcome] : "Not screened");

const CLASS_LABELS: Readonly<Record<VerificationClass, string>> = {
  self_reported: "Self-reported",
  document_supported: "Document-supported",
  independently_verified: "Independently verified",
  not_verified: "Not verified",
  not_applicable: "Not applicable",
};

export function countryName(code: string | null): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** The opportunity an application is classified under: the officer's view of what suits it, else what the applicant chose. */
export function opportunityClassification(suitable: SuitableOpportunity | null | undefined, pathway: OpportunityPathway | null): string | null {
  if (suitable) return SUITABLE_OPPORTUNITIES.find((o) => o.id === suitable)?.label ?? suitable;
  switch (pathway) {
    case "trade_and_market_access":
      return "Trade opportunity";
    case "investment":
      return "Investment opportunity";
    case "strategic_partnership":
      return "Strategic partnership";
    case "combined_trade_and_investment":
      return "Combined opportunity";
    default:
      return null;
  }
}
const classification = (a: ReportApplication) => opportunityClassification(a.recommendation?.suitable, a.pathway);

const day = (date: Date | null | undefined): string | null => (date ? date.toISOString().slice(0, 10) : null);
const yesNo = (value: boolean | null): string | null => (value === null ? null : value ? "Yes" : "No");
const joined = (values: readonly string[], separator = "; "): string | null => (values.length ? values.join(separator) : null);
const documentLabel = (kind: string): string => capitalise(kind.replaceAll("_", " "));

/** Whether every document the pathway needs is in. */
function documentStatus(a: ReportApplication): string {
  if (!a.pathway) return "Pathway not chosen";
  return a.documents.missing.length === 0 ? "Complete" : `Missing: ${a.documents.missing.map(documentLabel).join(", ")}`;
}

/** How the claims of an application were classified, such as "2 independently verified, 1 document-supported". */
function verificationSummary(a: ReportApplication): string {
  if (a.verification.length === 0) return "Not yet classified";
  return VERIFICATION_CLASSES.flatMap((c) => {
    const n = a.verification.filter((v) => v.class === c).length;
    return n ? [`${n} ${CLASS_LABELS[c].toLowerCase()}`] : [];
  }).join(", ");
}

/** Where the application stands with the committee. */
function selectionStatus(a: ReportApplication): string {
  if (a.status === "selected" || a.status === "waitlisted" || a.status === "not_selected") return statusLabel(a.status);
  if (a.status === "committee_review") return a.decision?.decision === "further_review_required" ? "Further review required" : "In committee review";
  return a.status === "withdrawn" ? "Withdrawn" : "Not yet with the committee";
}

/** The category's points, empty when it doesn't apply or isn't scored. */
const categoryPoints = (a: ReportApplication, id: CategoryId): number | null => a.score?.categories.find((c) => c.id === id)?.points ?? null;

const submittedAndLive = (a: ReportApplication): boolean => a.submittedAt !== null && a.status !== "withdrawn";
const assessed = (a: ReportApplication): boolean => a.assessment?.completedAt != null;

/** How far the assessment has got and what the administrators made of it. */
function reviewStatus(a: ReportApplication): string {
  if (!a.assessment) return "Not started";
  if (!a.assessment.completedAt) return a.review?.decision === "returned" ? "Returned to the officer" : "In progress";
  if (a.review?.decision === "approved") return "Approved";
  return "Awaiting review";
}

const verificationOutcome = (c: VerificationClass): string =>
  ({
    independently_verified: "Verified",
    document_supported: "Supported by documents",
    self_reported: "Self-reported only",
    not_verified: "Not verified",
    not_applicable: "Not applicable",
  })[c];

const outstandingVerification = (c: VerificationClass): string | null =>
  ({
    independently_verified: null,
    document_supported: "An independent check",
    self_reported: "Supporting documents and an independent check",
    not_verified: "Supporting documents and an independent check",
    not_applicable: null,
  })[c];

/** File names the viewer may see. Financial statements are restricted, and the committee sees no files. */
function visibleFiles(files: readonly ReportFile[], access: ReportContext["documents"]): string[] {
  if (access === "none") return [];
  return files.filter((f) => access === "all" || f.kind !== "financial_statements").map((f) => f.name);
}

// ---- Columns ----

interface Column {
  label: string;
  numeric?: boolean;
  value(a: ReportApplication, context: ReportContext): Cell;
}
const text = (label: string, value: Column["value"]): Column => ({ label, value });
const figure = (label: string, value: Column["value"]): Column => ({ label, value, numeric: true });

const keyOf = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const columnsOf = (columns: readonly Column[]): ReportColumn[] => columns.map((c) => ({ key: keyOf(c.label), label: c.label, numeric: c.numeric ?? false }));

const byNumber = (a: ReportApplication, b: ReportApplication): number => a.number.localeCompare(b.number);

/** A report with a row for each application it lists. */
function perApplication(
  spec: Pick<ReportDefinition, "id" | "number" | "title" | "purpose" | "classification">,
  columns: readonly Column[],
  lists: (a: ReportApplication) => boolean,
): ReportDefinition {
  return {
    ...spec,
    aggregate: false,
    columns: columnsOf(columns),
    build: (applications, context) => applications.filter(lists).sort(byNumber).map((a) => columns.map((c) => c.value(a, context))),
  };
}

// Columns most reports start with.
const identity: Column[] = [
  text("Application ID", (a) => a.number),
  text("Business name", (a) => a.businessName),
  text("Country", (a) => countryName(a.country)),
];
const industry = text("Industry", (a) => a.answers.text("sector"));

// ---- Reports 1 and 2: the register and eligibility ----

const REGISTER = perApplication(
  { id: "application-register", number: 1, title: "Application Register", purpose: "A complete list of Summit applicants and their application progress.", classification: "internal" },
  [
    ...identity.slice(0, 3),
    text("City or region", (a) => a.answers.text("city")),
    industry,
    text("Main business activity", (a) => joined(a.answers.list("activities"))),
    text("Applicant name", (a) => a.answers.text("contactName")),
    text("Applicant position", (a) => a.answers.text("contactPosition")),
    text("Email address", (a) => a.answers.text("contactEmail")),
    text("Telephone number", (a) => a.answers.text("contactPhone")),
    text("Business registration status", (a) => a.answers.text("registration")),
    text("Primary applicant pathway", pathwayLabel),
    text("Date registered", (a) => day(a.createdAt)),
    text("Date submitted", (a) => day(a.submittedAt)),
    text("Application status", (a) => statusLabel(a.status)),
    text("Assigned assessment officer", (a) => a.officer?.name ?? null),
    text("Eligibility outcome", outcomeLabel),
    text("Document completeness status", documentStatus),
    text("Last updated date", (a) => day(a.updatedAt)),
  ],
  () => true,
);

/** What the screening found for one requirement. */
const criterion = (a: ReportApplication, id: string) => a.eligibility?.criteria.find((c) => c.id === id);
const met = (a: ReportApplication, id: string): string | null => {
  const result = criterion(a, id)?.result;
  return result === undefined ? null : result === "met" || result === "excepted" ? "Yes" : "No";
};

const ELIGIBILITY = perApplication(
  { id: "eligibility-screening", number: 2, title: "Eligibility Screening Report", purpose: "The applicants that meet the minimum eligibility requirements.", classification: "internal" },
  [
    ...identity,
    industry,
    text("Registration status", (a) => a.answers.text("registration")),
    text("Operating status", (a) => a.answers.text("operating")),
    text("Authorized representative confirmed", (a) => met(a, "representative")),
    text("Minimum documentation received", (a) => met(a, "documents")),
    text("Declaration completed", (a) => met(a, "declaration")),
    text("Eligibility outcome", outcomeLabel),
    text("Reason for ineligibility", (a) =>
      a.eligibility?.outcome === "ineligible" ? joined(a.eligibility.criteria.filter((c) => c.result === "not_met").map((c) => c.reason), " ") : null,
    ),
    text("Outstanding information", (a) => {
      if (!a.eligibility || a.eligibility.outcome === "eligible") return null;
      const unclear = a.eligibility.criteria.filter((c) => c.result === "unclear").map((c) => c.reason);
      const missing = a.eligibility.missingDocuments.length ? [`Documents missing: ${a.eligibility.missingDocuments.map(documentLabel).join(", ")}.`] : [];
      return joined([...unclear, ...missing], " ");
    }),
    text("Screening officer", (a) => (a.eligibility ? (a.eligibility.screenedBy ?? "Automatic screening") : null)),
    text("Screening date", (a) => day(a.eligibility?.screenedAt)),
    text("Review status", (a) => {
      if (!a.eligibility) return null;
      if (a.eligibility.outcome === "pending_clarification") return "Awaiting clarification";
      return a.eligibility.screenedBy ? "Screened again by staff" : "Screened automatically";
    }),
  ],
  submittedAndLive,
);

// ---- Reports 3 and 4: distribution ----

const average = (scores: readonly number[]): number | null =>
  scores.length === 0 ? null : Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10;

const recommended = (a: ReportApplication): boolean =>
  a.recommendation?.id === "recommend_selection" || a.recommendation?.id === "recommend_subject_to_verification";

/** The figures the country and sector reports share, over the applications that fall in one row. */
function tally(rows: readonly ReportApplication[]) {
  const live = rows.filter((a) => a.status !== "withdrawn");
  const submitted = live.filter((a) => a.submittedAt !== null);
  const count = (list: readonly ReportApplication[], ...statuses: ApplicationStatus[]) => list.filter((a) => statuses.includes(a.status)).length;
  const pathway = (p: OpportunityPathway) => submitted.filter((a) => a.pathway === p).length;
  return {
    live,
    submitted,
    drafts: live.filter((a) => a.submittedAt === null).length,
    eligible: submitted.filter((a) => a.eligibility?.outcome === "eligible").length,
    ineligible: submitted.filter((a) => a.eligibility?.outcome === "ineligible").length,
    underAssessment: count(submitted, ...UNDER_ASSESSMENT),
    assessed: submitted.filter(assessed).length,
    recommended: submitted.filter(recommended).length,
    selected: count(submitted, "selected"),
    waitlisted: count(submitted, "waitlisted"),
    notSelected: count(submitted, "not_selected"),
    averageScore: average(submitted.filter((a) => assessed(a) && a.score?.total != null).map((a) => a.score?.total as number)),
    trade: pathway("trade_and_market_access"),
    investment: pathway("investment"),
    combined: pathway("combined_trade_and_investment"),
    partnership: pathway("strategic_partnership"),
  };
}

function countryRows(applications: readonly ReportApplication[], context: ReportContext): Cell[][] {
  // The period's countries in their order, then any other an application is from, then those without one.
  const codes: (string | null)[] = [...new Set(context.period.countries.map((c) => c.toUpperCase()))];
  for (const a of applications) {
    const code = a.country?.toUpperCase() ?? null;
    if (!codes.includes(code)) codes.push(code);
  }
  return codes
    .map((code) => ({ code, rows: applications.filter((a) => (a.country?.toUpperCase() ?? null) === code) }))
    .filter(({ rows }) => !context.filtered || rows.length > 0)
    .map(({ code, rows }) => {
      const t = tally(rows);
      return [
        code === null ? "No country" : (countryName(code) ?? code),
        t.live.length,
        t.drafts,
        t.submitted.length,
        t.eligible,
        t.ineligible,
        t.underAssessment,
        t.assessed,
        t.recommended,
        t.selected,
        t.waitlisted,
        t.notSelected,
        t.averageScore,
        t.trade,
        t.investment,
        t.combined,
        t.partnership,
      ];
    });
}

const COUNTRY_LABELS = [
  "Country",
  "Total applications",
  "Draft applications",
  "Submitted applications",
  "Eligible applicants",
  "Ineligible applicants",
  "Applications under assessment",
  "Completed assessments",
  "Recommended applicants",
  "Selected SMEs",
  "Waitlisted SMEs",
  "Not-selected SMEs",
  "Average normalized score",
  "Number of trade applicants",
  "Number of investment applicants",
  "Number of combined applicants",
  "Number of strategic partnership applicants",
];

const COUNTRY: ReportDefinition = {
  id: "country-distribution",
  number: 3,
  title: "Country Distribution Report",
  purpose: "Applications, eligibility, assessment and selection by country.",
  classification: "internal",
  aggregate: true,
  columns: COUNTRY_LABELS.map((label, i) => ({ key: keyOf(label), label, numeric: i > 0 })),
  build: countryRows,
};

const normalise = (sector: string): string => sector.trim().replace(/\s+/g, " ").toLowerCase();

/** Money asked for, summed for each currency, since amounts in different currencies don't add up. */
function investmentAsked(rows: readonly ReportApplication[]): string | null {
  const totals = new Map<string, number>();
  for (const a of rows) {
    const amount = a.seeksInvestment ? a.answers.amount("investmentAmount") : null;
    const currency = a.answers.currency("investmentAmount");
    if (amount !== null && currency !== null) totals.set(currency, (totals.get(currency) ?? 0) + amount);
  }
  return joined([...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => formatMoney(amount, currency)));
}

function sectorRows(applications: readonly ReportApplication[]): Cell[][] {
  const groups = new Map<string, { sector: string | null; rows: ReportApplication[] }>();
  for (const a of applications) {
    const sector = a.answers.text("sector");
    const key = sector ? normalise(sector) : "";
    const group = groups.get(key) ?? { sector: sector ? sector.trim().replace(/\s+/g, " ") : null, rows: [] };
    group.rows.push(a);
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => (a.sector === null ? 1 : b.sector === null ? -1 : a.sector.localeCompare(b.sector)))
    .map(({ sector, rows }) => {
      const t = tally(rows);
      // The first activity each business names, so the row says what the industry's businesses do.
      const activities = [...new Set(t.live.flatMap((a) => a.answers.list("activities").slice(0, 1)))].sort((a, b) => a.localeCompare(b));
      return [
        sector ?? "Not stated",
        joined(activities),
        t.live.length,
        t.eligible,
        t.assessed,
        t.averageScore,
        t.trade,
        t.investment,
        t.combined,
        t.partnership,
        t.recommended,
        t.selected,
        t.waitlisted,
        investmentAsked(t.submitted),
        t.submitted.filter((a) => a.answers.yesNo("exported") === true).length,
      ];
    });
}

const SECTOR_LABELS = [
  "Industry",
  "Business activity",
  "Total applications",
  "Eligible applicants",
  "Completed assessments",
  "Average normalized score",
  "Trade applicants",
  "Investment applicants",
  "Combined applicants",
  "Strategic partnership applicants",
  "Recommended applicants",
  "Selected SMEs",
  "Waitlisted SMEs",
  "Total stated investment requested",
  "Number of businesses with export experience",
];

const SECTOR: ReportDefinition = {
  id: "sector-distribution",
  number: 4,
  title: "Sector Distribution Report",
  purpose: "Industry representation, and where the applicants concentrate.",
  classification: "internal",
  aggregate: true,
  columns: SECTOR_LABELS.map((label, i) => ({ key: keyOf(label), label, numeric: i > 1 && i !== 13 })),
  build: sectorRows,
};

// ---- Report 5: scores ----

const CATEGORY_COLUMNS: [CategoryId, string][] = [
  ["A", "Business legitimacy score"],
  ["B", "Commercial offering score"],
  ["C", "Trade opportunity score"],
  ["D", "Investment opportunity score"],
  ["E", "Financial and operational readiness score"],
  ["F", "Diaspora partnership score"],
  ["G", "Summit readiness score"],
];

const SCORES = perApplication(
  { id: "assessment-scores", number: 5, title: "Assessment Score Report", purpose: "How applicants performed across the seven assessment categories.", classification: "confidential" },
  [
    ...identity,
    industry,
    text("Applicant pathway", pathwayLabel),
    ...CATEGORY_COLUMNS.map(([id, label]) => figure(label, (a) => categoryPoints(a, id))),
    figure("Raw score", (a) => a.score?.points ?? null),
    figure("Applicable maximum score", (a) => a.score?.possible ?? null),
    figure("Normalized score", (a) => a.score?.total ?? null),
    text("Investment category status", (a) => (a.score ? (a.score.categories.find((c) => c.id === "D")?.applicable ? "Applicable" : "N/A") : null)),
    text("Evidence completeness status", documentStatus),
    text("Assessment officer", (a) => a.officer?.name ?? null),
    text("Assessment completion date", (a) => day(a.assessment?.completedAt)),
    text("Assessment review status", reviewStatus),
  ],
  (a) => a.assessment !== null && a.score !== null,
);

// ---- Report 6: verification (one row for each classified claim) ----

const VERIFICATION: ReportDefinition = (() => {
  const columns = [
    "Application ID",
    "Business name",
    "Country",
    "Claim or information being verified",
    "Evidence type",
    "Document name",
    "Evidence classification",
    "Verification outcome",
    "Verification comments",
    "Outstanding verification requirements",
    "Assigned verification officer",
    "Verification date",
    "Last updated date",
  ];
  return {
    id: "verification",
    number: 6,
    title: "Verification Report",
    purpose: "The evidence submitted and how the important claims were verified.",
    classification: "confidential",
    aggregate: false,
    columns: columns.map((label) => ({ key: keyOf(label), label, numeric: false })),
    build: (applications, context) =>
      applications
        .filter((a) => a.verification.length > 0)
        .sort(byNumber)
        .flatMap((a) =>
          a.verification.map((v): Cell[] => {
            const known = VERIFIABLE_CLAIMS.find((c) => c.id === v.claim);
            return [
              a.number,
              a.businessName,
              countryName(a.country),
              known?.label ?? v.claim,
              known?.evidence ?? null,
              joined(visibleFiles(v.files, context.documents)),
              CLASS_LABELS[v.class],
              verificationOutcome(v.class),
              v.check,
              outstandingVerification(v.class),
              v.by,
              day(v.at),
              day(v.at),
            ];
          }),
        ),
  };
})();

// ---- Reports 7 and 8: opportunities ----

const has = (a: ReportApplication, kind: string): boolean => a.documents.files.some((f) => f.kind === kind);

/** "Yes" with where the proof is, so an officer can tell an uploaded document from a promise. */
const available = (a: ReportApplication, kind: string, said: boolean | null): string | null =>
  has(a, kind) ? "Yes (uploaded)" : said === true ? "Yes (not uploaded)" : said === false ? "No" : null;

const INVESTMENT = perApplication(
  { id: "investment-opportunities", number: 7, title: "Investment Opportunity Report", purpose: "The SMEs seeking investment, to identify and compare.", classification: "confidential" },
  [
    ...identity,
    industry,
    text("Business description", (a) => a.answers.text("description")),
    figure("Investment amount requested", (a) => a.answers.amount("investmentAmount")),
    text("Currency", (a) => a.answers.currency("investmentAmount")),
    text("Investment type", (a) => joined(a.answers.list("investmentTypes"))),
    text("Existing investment secured", (a) => a.answers.text("investmentSecured")),
    text("Remaining funding requirement", (a) => a.answers.text("investmentRemaining")),
    text("Intended use of funds", (a) => a.answers.text("investmentUse")),
    text("Proposed implementation period", (a) => a.answers.text("investmentPeriod")),
    text("Expected business outcomes", (a) => a.answers.text("investmentOutcomes")),
    text("Revenue range", (a) => a.answers.text("revenue")),
    text("Financial statements available", (a) => available(a, "financial_statements", a.answers.yesNo("financialStatements"))),
    text("Business plan available", (a) => available(a, "business_plan", a.answers.yesNo("businessPlan"))),
    figure("Investment readiness score", (a) => categoryPoints(a, "D")),
    figure("Overall normalized score", (a) => a.score?.total ?? null),
    text("Verification status", verificationSummary),
    text("Assessment officer", (a) => a.officer?.name ?? null),
    text("Selection status", selectionStatus),
  ],
  (a) => submittedAndLive(a) && a.seeksInvestment,
);

const TRADE = perApplication(
  { id: "trade-opportunities", number: 8, title: "Trade Opportunity Report", purpose: "The SMEs with trade, sourcing, buyer and market-entry opportunities.", classification: "confidential" },
  [
    ...identity,
    industry,
    text("Main product or service", (a) => joined(a.answers.list("activities"))),
    text("Export experience", (a) => yesNo(a.answers.yesNo("exported"))),
    text("Existing export markets", (a) => joined(a.answers.list("exportMarkets"))),
    text("Target markets", (a) => joined(a.answers.list("targetMarkets"))),
    text("Current buyer relationships", (a) => (a.answers.yesNo("activeBuyer") === true ? (a.answers.text("buyerDetails") ?? "Yes") : yesNo(a.answers.yesNo("activeBuyer")))),
    text("Confirmed purchase orders", (a) => {
      const picked = a.answers.picked("buyerEvidence");
      return a.answers.yesNo("activeBuyer") === null ? null : yesNo(picked.includes("purchase_order") || picked.includes("signed_contract"));
    }),
    text("Active buyer enquiries", (a) => {
      const picked = a.answers.picked("buyerEvidence");
      return a.answers.yesNo("activeBuyer") === null ? null : yesNo(picked.includes("buyer_enquiries"));
    }),
    figure("Estimated trade opportunity value", (a) => a.answers.amount("transactionValue")),
    text("Currency", (a) => a.answers.currency("transactionValue")),
    text("Production or service capacity", (a) => a.answers.text("capacity")),
    text("Required certifications or standards", (a) => a.answers.text("requirements")),
    text("Main export constraints", (a) => a.answers.text("exportConstraints")),
    figure("Trade opportunity score", (a) => categoryPoints(a, "C")),
    figure("Overall normalized score", (a) => a.score?.total ?? null),
    text("Verification status", verificationSummary),
    text("Selection status", selectionStatus),
  ],
  (a) => submittedAndLive(a) && (a.pathway === "trade_and_market_access" || a.pathway === "combined_trade_and_investment"),
);

// ---- Reports 9 to 12: the committee's output ----

const selectionId = (a: ReportApplication): string | null => (a.selectionNumber === null ? null : `SEL-${String(a.selectionNumber).padStart(3, "0")}`);
const approval = (a: ReportApplication): string => (a.finalListApprovedAt ? `Approved ${day(a.finalListApprovedAt)}` : "Awaiting final list approval");

const SELECTED = perApplication(
  { id: "selected-smes", number: 9, title: "Selected SME Register", purpose: "The record of businesses selected for Summit participation.", classification: "internal" },
  [
    text("Selection number", selectionId),
    text("Application ID", (a) => a.number),
    text("Business name", (a) => a.businessName),
    text("Country", (a) => countryName(a.country)),
    text("City or region", (a) => a.answers.text("city")),
    industry,
    text("Main product or service", (a) => joined(a.answers.list("activities"))),
    text("Applicant pathway", pathwayLabel),
    text("Opportunity classification", classification),
    figure("Normalized assessment score", (a) => a.score?.total ?? null),
    text("Eligibility status", outcomeLabel),
    text("Verification status", verificationSummary),
    text("Primary commercial objective", (a) => a.answers.text("summitGoal")),
    text("Investment amount sought", (a) => (a.seeksInvestment ? a.answers.text("investmentAmount") : null)),
    text("Target market", (a) => joined(a.answers.list("askMarkets"))),
    text("Authorized representative", (a) => a.answers.text("representativeName") ?? a.answers.text("contactName")),
    text("Email address", (a) => a.answers.text("contactEmail")),
    text("Telephone number", (a) => a.answers.text("contactPhone")),
    text("Selection decision date", (a) => day(a.decision?.at)),
    text("Committee approval status", approval),
    text("Participation confirmation status", () => null),
  ],
  (a) => a.status === "selected",
);

const WAITLIST = perApplication(
  { id: "waitlist", number: 10, title: "Waitlist Report", purpose: "The qualified applicants who may be selected if places become available.", classification: "confidential" },
  [
    figure("Waitlist position", (a) => a.waitlistPosition),
    text("Application ID", (a) => a.number),
    text("Business name", (a) => a.businessName),
    text("Country", (a) => countryName(a.country)),
    industry,
    text("Applicant pathway", pathwayLabel),
    text("Opportunity classification", classification),
    figure("Normalized score", (a) => a.score?.total ?? null),
    text("Eligibility status", outcomeLabel),
    text("Verification status", verificationSummary),
    text("Reason for waitlisting", (a) => (a.decision?.decision === "waitlisted" ? a.decision.reason : null)),
    text("Selection committee comments", (a) => joined(a.committeeComments, " | ")),
    text("Date added to waitlist", (a) => day(a.movedTo.waitlisted)),
    text("Last reviewed date", (a) => day(a.decision?.at)),
    text("Current status", (a) => statusLabel(a.status)),
    text("Contact status", () => null),
  ],
  (a) => a.status === "waitlisted",
);

const DECISIONS = perApplication(
  { id: "committee-decisions", number: 11, title: "Committee Decision Report", purpose: "A formal record of the selection committee's decisions and why.", classification: "confidential" },
  [
    ...identity,
    industry,
    text("Applicant pathway", pathwayLabel),
    figure("Normalized assessment score", (a) => a.score?.total ?? null),
    text("Eligibility outcome", outcomeLabel),
    text("Verification outcome", verificationSummary),
    text("Assessment officer recommendation", (a) => (a.recommendation ? (RECOMMENDATIONS.find((r) => r.id === a.recommendation?.id)?.label ?? a.recommendation.id) : null)),
    text("Committee decision", (a) => (a.decision ? (COMMITTEE_DECISIONS.find((d) => d.id === a.decision?.decision)?.label ?? a.decision.decision) : null)),
    text("Committee justification", (a) => a.decision?.reason ?? null),
    text("Country representation consideration", () => null),
    text("Sector representation consideration", () => null),
    text("Opportunity classification", classification),
    text("Outstanding conditions", () => null),
    text("Committee member or authorized decision-maker", (a) => a.decision?.by ?? null),
    text("Decision date", (a) => day(a.decision?.at)),
    text("Approval status", (a) => (a.finalListApprovedAt ? "Approved" : "Awaiting final list approval")),
    text("Final selection status", (a) => (a.result ? statusLabel(a.result) : a.decision ? "Not yet published" : null)),
  ],
  (a) => a.decision !== null,
);

const B2B = perApplication(
  { id: "b2b-matching", number: 12, title: "B2B Matching Preparation Report", purpose: "The selected SME portfolio, ready for buyer, investor, distributor and diaspora business meetings.", classification: "confidential" },
  [
    text("SME selection number", selectionId),
    text("Application ID", (a) => a.number),
    text("Business name", (a) => a.businessName),
    text("Country", (a) => countryName(a.country)),
    industry,
    text("Main product or service", (a) => joined(a.answers.list("activities"))),
    text("Business description", (a) => a.answers.text("description")),
    text("Commercial opportunity", (a) => a.answers.text("commercialAsk")),
    text("Primary opportunity classification", classification),
    text("Target country or market", (a) => joined(a.answers.list("askMarkets"))),
    text("Buyer or partner type sought", (a) => joined(a.answers.list("partnersSought"))),
    text("Specific commercial ask", (a) => a.answers.text("commercialAsk")),
    text("Investment amount sought", (a) => (a.seeksInvestment ? a.answers.text("investmentAmount") : null)),
    text("Available supply or production capacity", (a) => a.answers.text("capacity")),
    text("Estimated transaction value", (a) => a.answers.text("askValue")),
    text("Relevant certifications", (a) => a.answers.text("requirements")),
    text("Export experience", (a) => {
      const exported = a.answers.yesNo("exported");
      return exported === true ? (joined(a.answers.list("exportMarkets")) ?? "Yes") : yesNo(exported);
    }),
    text("Preferred partner profile", (a) => joined([a.answers.text("partnerInterests"), a.answers.text("partnerBenefit")].filter((v): v is string => v !== null), " ")),
    // The meetings happen once and are followed up by hand, so these columns are for the matching team to fill in.
    text("Meeting priority", () => null),
    text("Assigned matching officer", () => null),
    text("Meeting status", () => null),
    text("Follow-up action", () => null),
    text("Follow-up owner", () => null),
    text("Post-Summit outcome", () => null),
  ],
  (a) => a.status === "selected",
);

export const REPORTS: readonly ReportDefinition[] = [REGISTER, ELIGIBILITY, COUNTRY, SECTOR, SCORES, VERIFICATION, INVESTMENT, TRADE, SELECTED, WAITLIST, DECISIONS, B2B];

export const findReport = (id: string): ReportDefinition | undefined => REPORTS.find((r) => r.id === id);

// ---- Who may export what ----

export type ExportRole = "admin" | "facilitator" | "reviewer" | "committee";

/**
 * Which applications a role's export lists: all of them, only those assigned to the officer, only those the committee
 * can open, or only the figures of the whole period. Applicants export nothing: they read their own application.
 */
export type ExportScope = "all" | "assigned" | "committee" | "aggregate";

export function exportScope(report: Pick<ReportDefinition, "aggregate">, role: ExportRole): ExportScope {
  if (role === "admin" || role === "facilitator") return "all";
  if (report.aggregate) return "aggregate";
  return role === "reviewer" ? "assigned" : "committee";
}

/** How much of the supporting documents a role's export may name. */
export const documentAccessOf = (role: ExportRole): ReportContext["documents"] =>
  role === "admin" || role === "reviewer" ? "all" : role === "facilitator" ? "unrestricted" : "none";

/** The applications a scope lets through. `userId` is the officer asking. */
export function inScope(applications: readonly ReportApplication[], scope: ExportScope, userId: string): ReportApplication[] {
  switch (scope) {
    case "assigned":
      return applications.filter((a) => a.officer?.id === userId);
    case "committee":
      return applications.filter((a) => (COMMITTEE_STATUSES as readonly string[]).includes(a.status));
    default:
      return [...applications];
  }
}

export interface ReportFilters {
  country?: string | undefined;
  status?: string | undefined;
  pathway?: string | undefined;
  sector?: string | undefined;
}

/** The applications that match the filters a person chose. Filters only narrow what the scope already allows. */
export function applyFilters(applications: readonly ReportApplication[], filters: ReportFilters): ReportApplication[] {
  const country = filters.country?.toUpperCase();
  const sector = filters.sector?.trim().toLowerCase();
  return applications.filter((a) => {
    if (country && a.country?.toUpperCase() !== country) return false;
    if (filters.status && a.status !== filters.status) return false;
    if (filters.pathway && a.pathway !== filters.pathway) return false;
    if (sector && !a.answers.text("sector")?.toLowerCase().includes(sector)) return false;
    return true;
  });
}

/** Positions for the waitlist, best score first. A tie keeps the application number's order. */
export function waitlistPositions(applications: readonly Pick<ReportApplication, "id" | "number" | "status" | "score">[]): Map<string, number> {
  const waiting = applications
    .filter((a) => a.status === "waitlisted")
    .sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1) || a.number.localeCompare(b.number));
  return new Map(waiting.map((a, i) => [a.id, i + 1]));
}

/** Numbers for the selected SMEs, in the order they were selected. Fixed once the final list is approved, since decisions then stop. */
export function selectionNumbers(applications: readonly Pick<ReportApplication, "id" | "number" | "status" | "decision">[]): Map<string, number> {
  const chosen = applications
    .filter((a) => a.status === "selected")
    .sort((a, b) => (a.decision?.at.getTime() ?? 0) - (b.decision?.at.getTime() ?? 0) || a.number.localeCompare(b.number));
  return new Map(chosen.map((a, i) => [a.id, i + 1]));
}
