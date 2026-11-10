export type { UserProfile, UserOrganization } from "@entrust/account";
export {
  DELIVERY_MODES,
  type DeliveryMode,
  ENROLLMENT_STATUSES,
  type EnrollmentStatus,
  ATTENDANCE_STATUSES,
  type AttendanceStatus,
} from "@entrust/db";
import type { DeliveryMode, EnrollmentStatus, AttendanceStatus } from "@entrust/db";

export interface TradeProgram {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeCohort {
  id: string;
  programId: string;
  programName: string;
  name: string;
  deliveryMode: DeliveryMode;
  country: string;
  language: string;
  sponsorOrganizationId: string | null;
  sponsorName: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  enrolledCount: number;
  attendanceRequired?: boolean;
}

export interface TradeCohortEnrolment {
  enrollmentId: string;
  organizationId: string;
  organizationName: string;
  smeId: string | null;
  legalName: string | null;
  tradingName: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  withdrawnAt: string | null;
  plan: { id: string; status: string } | null;
  pathway: { pathway: string; status: string } | null;
}

export interface TradeCohortDetail extends Omit<TradeCohort, "enrolledCount"> {
  enrolments: TradeCohortEnrolment[];
  sessions?: TradeSessionSummary[];
}

export interface TradeEnrollmentSummary {
  id: string;
  cohortId: string;
  cohortName: string;
  programId: string;
  programName: string;
  organizationId: string;
  organizationName: string;
  smeId: string | null;
  legalName: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  withdrawnAt: string | null;
}

/** A business that has signed up to TRADE and is in no cohort yet. */
export interface WaitingSme {
  organizationId: string;
  organizationName: string;
  smeId: string | null;
  legalName: string | null;
  country: string | null;
  ownerEmail: string | null;
  createdAt: string;
}

/** A business found in the SME registry, for staff picking whom to enrol. */
export interface RegistrySme {
  organizationId: string;
  organizationName: string;
  smeId: string;
  legalName: string;
  tradingName: string | null;
  country: string;
  isMerged: boolean;
}

/** One row of the staff list of onboarding forms: who filled in what, and the avenue it gave. */
export interface StaffAssessmentRow {
  id: string;
  kind: "diagnostic" | "placement";
  status: string;
  enrollmentId: string;
  submittedAt: string | null;
  pathway: "A" | "B" | null;
  pathwayStatus: "provisional" | "confirmed" | null;
}

/** One form a person started through the public link, with how far they got if it is still open. */
export interface PublicDiagnosticSession {
  id: string;
  businessName: string | null;
  status: "draft" | "submitted";
  pathway: "A" | "B" | null;
  pathwayProvisional: boolean | null;
  liveOrder: boolean | null;
  submittedAt: string | null;
  startedAt: string;
  progress: { answered: number; total: number; percent: number } | null;
}

/** Everything one email address has started, as the staff list shows it: one line, with their forms underneath. */
export interface PublicDiagnosticPerson {
  email: string;
  phone: string | null;
  businessName: string | null;
  status: "draft" | "submitted";
  pathway: "A" | "B" | null;
  pathwayProvisional: boolean | null;
  liveOrder: boolean | null;
  latestAt: string;
  submittedCount: number;
  organization: { id: string; name: string } | null;
  sessions: PublicDiagnosticSession[];
}

export interface PublicDiagnosticCounts {
  submitted: number;
  draft: number;
  pathwayA: number;
  pathwayB: number;
  provisional: number;
  liveOrder: number;
  perDay: { date: string; started: number; submitted: number }[];
}

export interface PublicDiagnosticDetail {
  id: string;
  status: "draft" | "submitted";
  email: string;
  phone: string | null;
  businessName: string | null;
  startedAt: string;
  submittedAt: string | null;
  templateVersion: string;
  signedName: string | null;
  signedPosition: string | null;
  signedDate: string | null;
  progress: { total: number; answered: number; percent: number };
  pathway: { pathway: string; name: string; status: "provisional" | "confirmed"; liveOrder: boolean; reasons: string[] } | null;
  sections: { id: string; title: string; items: { id: string; text: string; answer: string }[] }[];
}

export interface SessionMaterial {
  title: string;
  url: string;
}

export interface TradeSessionSummary {
  id: string;
  cohortId: string;
  cohortName: string;
  title: string;
  description: string | null;
  moduleCodes: string[];
  facilitatorUserId: string | null;
  facilitatorName: string | null;
  startTime: string;
  endTime: string;
  venue: string | null;
  recordingUrl: string | null;
  learnerMaterials: SessionMaterial[];
  facilitatorMaterials: SessionMaterial[];
  createdAt: string;
}

export interface TradeSessionDetail extends TradeSessionSummary {
  programId: string;
  programName: string;
}

export interface FacilitatorRosterMember {
  userId: string;
  name: string;
  email: string;
  role: string;
  attendance: {
    id: string;
    status: AttendanceStatus;
    notes: string | null;
    recordedAt: string;
  } | null;
}

export interface FacilitatorRosterModule {
  moduleCode: string;
  status: string;
  completedAt: string | null;
}

export interface FacilitatorRosterSme {
  organizationId: string;
  organizationName: string;
  legalName: string | null;
  smeId: string | null;
  enrollmentStatus: EnrollmentStatus;
  members: FacilitatorRosterMember[];
  modules: FacilitatorRosterModule[];
}

export interface TradeFacilitatorRoster {
  session: TradeSessionDetail;
  smes: FacilitatorRosterSme[];
}

/** The placement report as `GET /v1/trade/assessments/{id}/report` sends it (#58). */
export interface PlacementReportData {
  rulesVersion: string;
  status: "current" | "superseded";
  baseline: { organisation: string; smeId: string; assessedOn: string; attempt: number };
  pathway: { id: "A" | "B"; name: string; provisional: boolean; liveOrder: boolean; reasons: { code: string; text: string }[] };
  domains: {
    id: string;
    title: string;
    score: number | null;
    band: string | null;
    bandLabel: string | null;
    guidance: string | null;
    coverage: number;
    answered: number;
    total: number;
    evidence: string;
    evidenceLabel: string;
  }[];
  plan: {
    modules: {
      sequence: number;
      module: string;
      title: string;
      deliverable: string;
      status: string;
      statusLabel: string;
      reasons: { code: string; text: string }[];
      contentStatus: "ready" | "draft" | "in_production";
    }[];
    requiresStaffReview: boolean;
    reviewNotes: string[];
  };
  objectives: {
    opportunity: { value: string; label: string } | null;
    target: { status: { value: string; label: string } | null; product: string | null; market: string | null; buyerType: string | null };
  };
}

export type {
  CohortKnowledgeCheckStats,
  CreateModuleSubmissionInput,
  KnowledgeCheckAttemptInput,
  KnowledgeCheckAttemptResult,
  KnowledgeCheckHistoryList,
  LearningPlanRecord,
  LearningPlanView,
  ModuleAssignmentView,
  ModuleExemptionView,
  ModuleProgressView,
  ModuleSubmissionListQueryInput,
  ModuleSubmissionView,
  OverrideScoreInput,
  RubricAssessmentView,
  ScoreSubmissionInput,
  SubmissionScoresList,
  AdminOverrideModuleInput,
  CertificateView,
  DomainComparisonView,
  ExitAssessmentReportView,
  PublicCertificateView,
  RevokeCertificateInput,
  ActivityView,
  CreateOpportunityActivityInput,
  CreateOpportunityInput,
  ExportJourneyStageView,
  OpportunityScorecardInput,
  OpportunityView,
  UpdateOpportunityStageInput,
  CreateExportOutcomeInput,
  CreateFinancingOutcomeInput,
  OutcomeEventView,
  OutcomeView,
  UpdateExportStatusInput,
  UpdateFinancingStatusInput,
} from "@entrust/api/client";

export interface ModuleItemSummary {
  id: string;
  title: string;
  deliverable: string;
  objectives: string[];
  contentStatus: "ready" | "draft" | "in_production";
  latestVersion: string | null;
  versions: string[];
}

export interface AdminModuleVersionSummary {
  id: string;
  moduleId: string;
  version: string;
  status: "draft" | "in_review" | "approved" | "archived";
  title: string;
  deliverable: string;
  objectives: string[];
  contentHash: string;
  changeSummary: string | null;
  createdByUserId: string | null;
  createdByUser?: { id: string; name: string | null; email: string } | null;
  updatedByUserId: string | null;
  submittedByUserId: string | null;
  submittedAt: string | null;
  approvedByUserId: string | null;
  approvedByUser?: { id: string; name: string | null; email: string } | null;
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModuleSummary {
  id: string;
  title: string;
  deliverable: string;
  objectives: string[];
  latestApprovedVersion: string | null;
  activeDraftVersion: string | null;
  inReviewVersion: string | null;
  versions: AdminModuleVersionSummary[];
}

export interface AdminModuleVersionDetail extends AdminModuleVersionSummary {
  content: Record<string, any>;
  validationErrors: string[];
}

