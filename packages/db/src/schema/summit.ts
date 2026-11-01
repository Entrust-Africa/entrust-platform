import { isNull, sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Answers } from "@entrust/forms";
import {
  APPLICATION_STATUSES,
  COMMITTEE_DECISIONS,
  DOCUMENT_KINDS,
  ELIGIBILITY_OUTCOMES,
  OPPORTUNITY_PATHWAYS,
  RESULT_STATUSES,
  VERIFICATION_CLASSES,
  type CategoryId,
  type CommitteeDecision,
  type CriterionResult,
  type EligibilityCriterionId,
  type Recommendation,
  type ResultStatus,
  type SuitableOpportunity,
} from "@entrust/summit-engine";
import { organization, user } from "./auth";
import { file } from "./core";

// The decisions the committee can record, as a tuple for the column's enum.
const COMMITTEE_DECISION_IDS = COMMITTEE_DECISIONS.map((d) => d.id) as [CommitteeDecision, ...CommitteeDecision[]];

// The Summit SME application platform's tables (#79). They reference core (users, organisations, files) and
// never clear or trade. The audit log is shared and lives in core, with platform = 'summit'.
export const summit = pgSchema("summit");

// Applications take their number from here: SUM-000001, in the order they were started.
export const applicationNumberSeq = summit.sequence("application_number_seq");

// When SMEs can apply, from which countries, and on which version of the form and the rules. Set by a super
// administrator. An application is open for starting and submitting between `opensAt` and `closesAt`.
export const applicationPeriod = summit.table(
  "application_period",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    // ISO 3166-1 alpha-2 codes of the countries whose SMEs may apply, matched against the SME profile's country.
    countries: text("countries").array().notNull(),
    // The application form applicants answer, and the rules (eligibility documents and the scorecard) used.
    templateVersion: text("template_version").notNull(),
    rulesVersion: text("rules_version").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [check("application_period_window_check", sql`${t.closesAt} > ${t.opensAt}`)],
);

// One application per SME per period. A withdrawn one doesn't count, so an SME that withdrew can apply again.
export const application = summit.table(
  "application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // The unique application ID of section 3.
    number: text("number")
      .notNull()
      .unique()
      .default(sql`'SUM-' || lpad(nextval('summit.application_number_seq')::text, 6, '0')`),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    periodId: uuid("period_id")
      .notNull()
      .references(() => applicationPeriod.id),
    // Who started it.
    applicantUserId: text("applicant_user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: APPLICATION_STATUSES }).notNull().default("draft"),
    // The version of the form these answers were given on.
    templateVersion: text("template_version").notNull(),
    // Answers by question ID, saved as the applicant goes. A hidden question's old answer stays here and is ignored.
    answers: jsonb("answers").$type<Answers>().notNull().default({}),
    // Copied from the answer to the pathway question when it is saved, so lists can filter on it.
    pathway: text("pathway", { enum: OPPORTUNITY_PATHWAYS }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("application_org_idx").on(t.organizationId),
    index("application_period_status_idx").on(t.periodId, t.status),
    uniqueIndex("application_org_period_uidx")
      .on(t.organizationId, t.periodId)
      .where(sql`${t.status} <> 'withdrawn'`),
  ],
);

// Every change of status, with when and by whom (section 3). A null user is the platform itself, such as
// the eligibility screening that runs on submit. Rows are only added.
export const applicationStatusChange = summit.table(
  "application_status_change",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    fromStatus: text("from_status", { enum: APPLICATION_STATUSES }),
    toStatus: text("to_status", { enum: APPLICATION_STATUSES }).notNull(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    reason: text("reason"),
  },
  (t) => [index("application_status_change_idx").on(t.applicationId, t.changedAt)],
);

// A file from the files API attached to an application as one kind of supporting document. The file belongs to
// the applicant's organisation. Removing a document removes this row and leaves the file.
export const applicationDocument = summit.table(
  "application_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => file.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: DOCUMENT_KINDS }).notNull(),
    addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("application_document_file_uidx").on(t.applicationId, t.fileId)],
);

// What the applicant agreed to: one row for each declaration question of the form (S9.1 to S9.3 in version 0.1.0)
// answered yes, with who agreed and which version of the form the wording is in. Written when the application is
// submitted and never changed.
export const consentRecord = summit.table(
  "consent_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    termsVersion: text("terms_version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("consent_record_question_uidx").on(t.applicationId, t.question)],
);

// One row each time an application is screened, so the history of eligibility stays. The newest decides.
export const eligibilityResult = summit.table(
  "eligibility_result",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    rulesVersion: text("rules_version").notNull(),
    outcome: text("outcome", { enum: ELIGIBILITY_OUTCOMES }).notNull(),
    // The six requirements, each met, not met, unclear or excepted, with the reason.
    criteria: jsonb("criteria").$type<CriterionResult[]>().notNull(),
    missingDocuments: text("missing_documents").array().notNull(),
    screenedAt: timestamp("screened_at", { withTimezone: true }).defaultNow().notNull(),
    // Null when the platform screened it on its own, on submit.
    screenedBy: text("screened_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("eligibility_result_idx").on(t.applicationId, t.screenedAt)],
);

// An administrator accepts an applicant that doesn't meet a requirement, and says why. One per requirement.
export const eligibilityException = summit.table(
  "eligibility_exception",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    criterion: text("criterion").$type<EligibilityCriterionId>().notNull(),
    reason: text("reason").notNull(),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("eligibility_exception_criterion_uidx").on(t.applicationId, t.criterion)],
);

// The assessment officer an application is assigned to. At most one is current; reassigning closes the
// old row, so who held the application and when stays on record.
export const officerAssignment = summit.table(
  "officer_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    officerUserId: text("officer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by").references(() => user.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    index("officer_assignment_officer_idx").on(t.officerUserId),
    uniqueIndex("officer_assignment_current_uidx").on(t.applicationId).where(isNull(t.endedAt)),
  ],
);

// ---- Assessment (the officer's workspace) ----

// One assessment of an application, started when its first score or note is recorded. It keeps the rules version,
// the pathway and the investment answer it was scored under, so the same answers and rules always give the same
// score. An officer taking over from another continues the same assessment.
export const assessment = summit.table("assessment", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id")
    .notNull()
    .unique()
    .references(() => application.id, { onDelete: "cascade" }),
  rulesVersion: text("rules_version").notNull(),
  pathway: text("pathway", { enum: OPPORTUNITY_PATHWAYS }).notNull(),
  seekingInvestment: boolean("seeking_investment").notNull(),
  startedBy: text("started_by").references(() => user.id, { onDelete: "set null" }),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedBy: text("completed_by").references(() => user.id, { onDelete: "set null" }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// An officer's points for one criterion. Written once and never overwritten: a later change is a score adjustment.
export const criterionScore = summit.table(
  "criterion_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id").notNull(),
    points: integer("points").notNull(),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("criterion_score_criterion_uidx").on(t.assessmentId, t.criterionId), check("criterion_score_points_check", sql`${t.points} >= 0`)],
);

// A manual change to a recorded score, with the score before and after, why, who and when. The newest one for a
// criterion is the score that counts; the original stays in `criterion_score`.
export const scoreAdjustment = summit.table(
  "score_adjustment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id").notNull(),
    previousPoints: integer("previous_points").notNull(),
    newPoints: integer("new_points").notNull(),
    reason: text("reason").notNull(),
    adjustedBy: text("adjusted_by").references(() => user.id, { onDelete: "set null" }),
    adjustedAt: timestamp("adjusted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("score_adjustment_idx").on(t.assessmentId, t.criterionId, t.adjustedAt)],
);

// The short justification and the evidence an officer relies on for a category, which the scorecard asks for.
export const categoryNote = summit.table(
  "category_note",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    category: text("category").$type<CategoryId>().notNull(),
    justification: text("justification").notNull(),
    evidence: text("evidence").array().notNull(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("category_note_category_uidx").on(t.assessmentId, t.category)],
);

// The officer's classification of one claim (section 7). Reclassifying replaces the row; the audit log keeps the old one.
export const verificationRecord = summit.table(
  "verification_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    claim: text("claim").notNull(),
    class: text("class", { enum: VERIFICATION_CLASSES }).notNull(),
    // The application documents that support the claim.
    documentIds: uuid("document_ids").array().notNull(),
    // What the officer checked outside the application, which independent verification needs.
    independentCheck: text("independent_check"),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("verification_record_claim_uidx").on(t.applicationId, t.claim)],
);

// A request for more information. The application waits in "awaiting additional information" until the applicant
// responds, then returns to the status it left. At most one is open at a time.
export const clarificationRequest = summit.table(
  "clarification_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    // Where the application goes back to when the applicant responds.
    returnStatus: text("return_status", { enum: APPLICATION_STATUSES }).notNull(),
    // When the email to the applicant was queued. Null if it could not be.
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    response: text("response"),
    respondedBy: text("responded_by").references(() => user.id, { onDelete: "set null" }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("clarification_request_idx").on(t.applicationId, t.requestedAt),
    uniqueIndex("clarification_request_open_uidx").on(t.applicationId).where(isNull(t.respondedAt)),
  ],
);

// Notes between staff. The applicant never sees them.
export const internalComment = summit.table(
  "internal_comment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("internal_comment_idx").on(t.applicationId, t.createdAt)],
);

// The officer's recommendation once the assessment is complete (the scorecard's last section). Added to, so the
// newest is the current one and an earlier one is not lost.
export const applicationRecommendation = summit.table(
  "application_recommendation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    recommendation: text("recommendation").$type<Recommendation>().notNull(),
    suitableOpportunity: text("suitable_opportunity").$type<SuitableOpportunity>(),
    rationale: text("rationale").notNull(),
    recordedBy: text("recorded_by").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("application_recommendation_idx").on(t.applicationId, t.recordedAt)],
);

// ---- Selection (the committee) ----

// An administrator's quality review of a completed assessment and its recommendation: approved for the committee, or
// returned to the officer with the reason. Rows are only added, so every round of review stays on record.
export const assessmentReview = summit.table(
  "assessment_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    decision: text("decision", { enum: ["approved", "returned"] }).notNull(),
    // Required when returned, so the officer knows what to fix.
    reason: text("reason"),
    reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("assessment_review_idx").on(t.applicationId, t.reviewedAt)],
);

// A committee member's decision on an application, with the reason. Rows are only added; the newest is the current
// one, and a decision can be replaced until the final list is approved.
export const committeeDecision = summit.table(
  "committee_decision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => application.id, { onDelete: "cascade" }),
    decision: text("decision", { enum: COMMITTEE_DECISION_IDS }).notNull(),
    reason: text("reason").notNull(),
    decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("committee_decision_idx").on(t.applicationId, t.decidedAt)],
);

// The committee's approval of the final list for a period (#80). It closes the committee's work: decisions can no
// longer change and the applicants are told. Once per period, and never undone.
export const finalList = summit.table("final_list", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodId: uuid("period_id")
    .notNull()
    .unique()
    .references(() => applicationPeriod.id, { onDelete: "cascade" }),
  // What was approved, kept as approved.
  selected: integer("selected").notNull(),
  waitlisted: integer("waitlisted").notNull(),
  notSelected: integer("not_selected").notNull(),
  note: text("note"),
  approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { withTimezone: true }).defaultNow().notNull(),
});

// What one applicant is told once the final list is approved, and whether the email went. The applicant's status page
// shows a result only when a row is here. Written when the list is approved and never changed except for `notifiedAt`.
export const applicationResult = summit.table("application_result", {
  applicationId: uuid("application_id")
    .primaryKey()
    .references(() => application.id, { onDelete: "cascade" }),
  decision: text("decision", { enum: RESULT_STATUSES }).notNull().$type<ResultStatus>(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  // When the email was queued. Null if it could not be, and the committee can send it again.
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
});

// How many SMEs the committee plans to select from each country of a period (#80). The specification's planning target
// is 10 for each of 10 countries, which is what a period has until the committee changes it. A row exists once it has.
export const selectionTarget = summit.table("selection_target", {
  periodId: uuid("period_id")
    .primaryKey()
    .references(() => applicationPeriod.id, { onDelete: "cascade" }),
  // For every country without a figure of its own.
  perCountry: integer("per_country").notNull(),
  // Countries with a figure of their own, by ISO 3166-1 alpha-2 code.
  overrides: jsonb("overrides").$type<Record<string, number>>().notNull().default({}),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
