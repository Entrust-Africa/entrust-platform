import type { CriterionResult } from "../eligibility";
import type {
  ApplicationStatus,
  CategoryId,
  CommitteeDecision,
  DocumentKind,
  EligibilityOutcome,
  OpportunityPathway,
  Recommendation,
  SuitableOpportunity,
  VerificationClass,
} from "../types";
import type { ResultStatus } from "../committee";
import type { ReportAnswers } from "./answers";

/** One cell of a report: text, a figure, or nothing. Dates are YYYY-MM-DD. */
export type Cell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  /** A figure, so a spreadsheet can add it up and align it. */
  numeric: boolean;
}

export interface ReportFile {
  name: string;
  kind: DocumentKind;
}

/**
 * Everything the reports say about one application, gathered from the database by the API. Each report reads from here,
 * so a report is a view of the same record as every other and changes with it. Nothing here reads a database.
 */
export interface ReportApplication {
  id: string;
  /** The application ID of section 3, such as SUM-000001. */
  number: string;
  businessName: string;
  smeId: string | null;
  /** ISO 3166-1 alpha-2 code from the SME profile. */
  country: string | null;
  status: ApplicationStatus;
  pathway: OpportunityPathway | null;
  /** Whether the applicant is seeking investment: the investment and combined pathways, or a yes to the form's question. */
  seeksInvestment: boolean;
  createdAt: Date;
  submittedAt: Date | null;
  updatedAt: Date;
  answers: ReportAnswers;
  /** The assessment officer it is assigned to now. */
  officer: { id: string; name: string } | null;
  eligibility: {
    outcome: EligibilityOutcome;
    criteria: readonly CriterionResult[];
    missingDocuments: readonly string[];
    screenedAt: Date;
    /** Null when the platform screened it on its own. */
    screenedBy: string | null;
  } | null;
  documents: {
    /** Required for the pathway and not yet provided. */
    missing: readonly DocumentKind[];
    files: readonly ReportFile[];
  };
  assessment: { startedAt: Date; completedAt: Date | null } | null;
  score: {
    /** The points earned, once every applicable criterion is scored. */
    points: number | null;
    /** What the points could have been out of: 100, less a category that doesn't apply. */
    possible: number;
    /** Out of 100, adjusted for a category left out. */
    total: number | null;
    categories: readonly { id: CategoryId; applicable: boolean; points: number | null }[];
  } | null;
  /** The administrators' latest quality review. */
  review: { decision: "approved" | "returned"; at: Date } | null;
  recommendation: { id: Recommendation; suitable: SuitableOpportunity | null; at: Date } | null;
  /** The committee's latest decision. */
  decision: { decision: CommitteeDecision; reason: string; by: string | null; at: Date } | null;
  /** What was published to the applicant. Set when the final list is approved. */
  result: ResultStatus | null;
  /** When the period's final list was approved. */
  finalListApprovedAt: Date | null;
  verification: readonly {
    claim: string;
    class: VerificationClass;
    files: readonly ReportFile[];
    check: string | null;
    by: string | null;
    at: Date;
  }[];
  /** When the application last moved into each status. */
  movedTo: Readonly<Partial<Record<ApplicationStatus, Date>>>;
  /** What committee members wrote about it. */
  committeeComments: readonly string[];
  /** Its place among the period's selected SMEs, once selected. */
  selectionNumber: number | null;
  /** Its place on the waitlist, best score first, once waitlisted. */
  waitlistPosition: number | null;
}

/** How much of the supporting documents the person asking may see. Financial statements are restricted. */
export type DocumentAccess = "all" | "unrestricted" | "none";

export interface ReportContext {
  period: { name: string; countries: readonly string[] };
  documents: DocumentAccess;
  /** A filter narrowed the applications, so a country or industry with none shouldn't be listed with zeros. */
  filtered: boolean;
}

export const REPORT_IDS = [
  "application-register",
  "eligibility-screening",
  "country-distribution",
  "sector-distribution",
  "assessment-scores",
  "verification",
  "investment-opportunities",
  "trade-opportunities",
  "selected-smes",
  "waitlist",
  "committee-decisions",
  "b2b-matching",
] as const;
export type ReportId = (typeof REPORT_IDS)[number];

/** The classifications of section 11. */
export type Classification = "internal" | "confidential" | "restricted" | "external_approved";

export interface ReportDefinition {
  id: ReportId;
  /** Report 1 to 12 of section 11. */
  number: number;
  title: string;
  purpose: string;
  classification: Classification;
  /** Figures worked out over the whole period, with no one applicant in them. */
  aggregate: boolean;
  columns: readonly ReportColumn[];
  /** One row per record, for the applications given. */
  build(applications: readonly ReportApplication[], context: ReportContext): Cell[][];
}
