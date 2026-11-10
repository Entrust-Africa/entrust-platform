import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  PASSPORT_STATUSES,
  PASSPORT_TIERS,
  ASSESSMENT_STATUSES,
  SPONSOR_DATA_KINDS,
  SUMMIT_DATA_KINDS,
  EVIDENCE_CONFIDENCE,
  EVIDENCE_REVIEW_STATUSES,
  EVIDENCE_TARGET_TYPES,
  MODULE_EXEMPTION_STATUSES,
  ENROLLMENT_STATUSES,
  EXPORT_OUTCOME_STATUSES,
  FINANCING_OUTCOME_STATUSES,
  LEARNING_PLAN_STATUSES,
  MODULE_PROGRESS_STATUSES,
  MODULE_STATUSES,
  OPPORTUNITY_STATUSES,
  OUTCOME_EVIDENCE_TIERS,
  COMMERCIAL_ACTIVITY_TYPES,
  PIPELINE_STAGES,
  QUALIFICATION_BANDS,
  VERIFICATION_LADDER_STATUSES,
} from "@entrust/trade-engine";
import { MODULE_IDS, PATHWAYS } from "@entrust/trade-rules";
import { organization, session, user } from "./auth";
import { exportCase } from "./clear";
import { file } from "./core";

// TRADE platform PostgreSQL schema (#55).
// All tables reference core (organization, smeProfile, user, file) and never clear.
export const trade = pgSchema("trade");

export const DELIVERY_MODES = ["self_paced", "live", "hybrid"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export { ENROLLMENT_STATUSES, type EnrollmentStatus } from "@entrust/trade-engine";

// A TRADE program, for example "TRADE Ethiopia, Zemen Bank pilot".
export const program = trade.table("program", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// A cohort within a TRADE program, sponsored by an organisation and delivered in a given mode.
export const cohort = trade.table(
  "cohort",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => program.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sponsorOrganizationId: text("sponsor_organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    country: text("country").notNull().default("ET"),
    language: text("language").notNull().default("en"),
    deliveryMode: text("delivery_mode", { enum: DELIVERY_MODES }).notNull().default("self_paced"),
    attendanceRequired: boolean("attendance_required").notNull().default(true),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_cohort_program_idx").on(t.programId),
    index("trade_cohort_sponsor_idx").on(t.sponsorOrganizationId),
  ],
);

// The Entrust facilitators and reviewers assigned to a cohort. They reach only the SMEs in their cohorts; an administrator reaches all.
export const cohortStaff = trade.table(
  "cohort_staff",
  {
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohort.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.cohortId, t.userId] }), index("trade_cohort_staff_user_idx").on(t.userId)],
);

// An SME organisation's enrolment in a cohort. One per SME per cohort; an SME may enrol in several cohorts.
export const enrollment = trade.table(
  "enrollment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohort.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status", { enum: ENROLLMENT_STATUSES }).notNull().default("invited"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_enrollment_cohort_org_uidx").on(t.cohortId, t.organizationId),
    index("trade_enrollment_org_idx").on(t.organizationId),
  ],
);

export const ATTENDANCE_STATUSES = ["present", "late", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// A live workshop or training session within a cohort.
export const liveSession = trade.table(
  "live_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => cohort.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    moduleCodes: jsonb("module_codes").$type<string[]>().notNull().default([]),
    facilitatorUserId: text("facilitator_user_id").references(() => user.id, { onDelete: "set null" }),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    venue: text("venue"),
    recordingUrl: text("recording_url"),
    learnerMaterials: jsonb("learner_materials").$type<{ title: string; url: string }[]>().notNull().default([]),
    facilitatorMaterials: jsonb("facilitator_materials").$type<{ title: string; url: string }[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_session_cohort_idx").on(t.cohortId),
    index("trade_session_start_idx").on(t.startTime),
  ],
);

// Attendance record of a person for a live session.
export const attendance = trade.table(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => liveSession.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    status: text("status", { enum: ATTENDANCE_STATUSES }).notNull(),
    notes: text("notes"),
    recordedByUserId: text("recorded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_attendance_session_user_uidx").on(t.sessionId, t.userId),
    index("trade_attendance_org_idx").on(t.organizationId),
  ],
);

export const ASSESSMENT_KINDS = ["placement", "exit", "diagnostic"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

// An assessment of an enrolment (placement, exit or the onboarding diagnostic). Scores are written once; a new assessment
// supersedes the old one, and nothing is overwritten.
// At most one placement assessment and one diagnostic per enrolment is live (not superseded) at a time.
// Exported as tradeAssessment to avoid colliding with Summit's assessment table in schema.
export const tradeAssessment = trade.table(
  "assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ASSESSMENT_KINDS }).notNull(),
    templateVersion: text("template_version").notNull(),
    status: text("status", { enum: ASSESSMENT_STATUSES }).notNull().default("draft"),
    assessedByUserId: text("assessed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    assessedAt: timestamp("assessed_at", { withTimezone: true }),
    supersededById: uuid("superseded_by_id"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_assessment_enrollment_idx").on(t.enrollmentId),
    uniqueIndex("trade_assessment_live_placement_uidx")
      .on(t.enrollmentId)
      .where(sql`${t.kind} = 'placement' and ${t.status} <> 'superseded'`),
    uniqueIndex("trade_assessment_live_diagnostic_uidx")
      .on(t.enrollmentId)
      .where(sql`${t.kind} = 'diagnostic' and ${t.status} <> 'superseded'`),
  ],
);

export const UNSCORED_REASONS = ["not_known", "not_applicable"] as const;
export type UnscoredReason = (typeof UNSCORED_REASONS)[number];

// One response to an assessment question.
export const assessmentResponse = trade.table(
  "assessment_response",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => tradeAssessment.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    answer: jsonb("answer"),
    unscored: text("unscored", { enum: UNSCORED_REASONS }),
    // Why the question doesn't apply. Required for "not applicable"; staff approve it later.
    unscoredReason: text("unscored_reason"),
    approvedByUserId: text("approved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    documentsAvailable: boolean("documents_available").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("trade_assessment_response_question_uidx").on(t.assessmentId, t.questionId),
  ],
);
export const tradeAssessmentResponse = assessmentResponse;

export const SCORE_KINDS = ["domain", "group"] as const;
export type ScoreKind = (typeof SCORE_KINDS)[number];

// A capability score for one domain or trigger group from an assessment. `domain` holds the domain's or the group's ID,
// and `kind` says which. The score is 0 to 100 with two decimals; null while too few questions have a valid answer.
// Rescoring after staff approve a "does not apply" answer replaces the assessment's rows.
export const capabilityScore = trade.table(
  "capability_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => tradeAssessment.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: SCORE_KINDS }).notNull().default("domain"),
    domain: text("domain").notNull(),
    points: integer("points").notNull(),
    maxPoints: integer("max_points").notNull(),
    coverage: numeric("coverage", { precision: 5, scale: 4 }).notNull(),
    score: numeric("score", { precision: 5, scale: 2 }),
    band: text("band"),
    evidenceStatus: text("evidence_status", { enum: EVIDENCE_CONFIDENCE }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("trade_capability_score_assessment_domain_uidx").on(t.assessmentId, t.kind, t.domain),
  ],
);

// An SME's learning plan, prescribing modules and sequence. One plan per enrolment is live
// (not superseded) at a time. A new plan supersedes the old one, and nothing is overwritten.
export const learningPlan = trade.table(
  "learning_plan",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id").references(() => tradeAssessment.id, {
      onDelete: "set null",
    }),
    rulesVersion: text("rules_version").notNull(),
    pathway: text("pathway", { enum: PATHWAYS }).notNull(),
    // The avenue the plan was built from. A later confirmation or change of the avenue is another row, so this one stays true.
    pathwayAssignmentId: uuid("pathway_assignment_id").references(() => pathwayAssignment.id, { onDelete: "set null" }),
    status: text("status", { enum: LEARNING_PLAN_STATUSES }).notNull().default("generated"),
    requiresHumanReview: boolean("requires_human_review").notNull().default(false),
    reviewReasons: text("review_reasons")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    supersededById: uuid("superseded_by_id"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_learning_plan_enrollment_idx").on(t.enrollmentId),
    uniqueIndex("trade_learning_plan_live_uidx")
      .on(t.enrollmentId)
      .where(sql`${t.status} <> 'superseded'`),
  ],
);

export const MODULE_ASSIGNMENT_SOURCES = ["engine", "staff_override"] as const;
export type ModuleAssignmentSource = (typeof MODULE_ASSIGNMENT_SOURCES)[number];

// A module assigned to an SME as part of a learning plan.
export const moduleAssignment = trade.table(
  "module_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => learningPlan.id, { onDelete: "cascade" }),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    status: text("status", { enum: MODULE_STATUSES }).notNull(),
    sequence: integer("sequence").notNull(),
    reasonCodes: text("reason_codes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    source: text("source", { enum: MODULE_ASSIGNMENT_SOURCES }).notNull().default("engine"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("trade_module_assignment_plan_module_uidx").on(t.planId, t.moduleId),
    index("trade_module_assignment_plan_seq_idx").on(t.planId, t.sequence),
  ],
);

export const WORKSHEET_VERSION_STATUSES = ["draft", "submitted"] as const;
export type WorksheetVersionStatus = (typeof WORKSHEET_VERSION_STATUSES)[number];

// What an SME enters in a worksheet (#64, #65). Values save as they type and are labelled self-reported. Submitting turns a draft into
// a numbered version that never changes; editing starts the next draft from it. `values` holds the structured figures, so MIZAN can
// read them later. `result` is what the worksheet worked out at submit, kept so a submitted version reads the same forever.
export const worksheetVersion = trade.table(
  "worksheet_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    worksheetId: text("worksheet_id").notNull(),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    // 1 for the first, counted per enrolment and worksheet. A draft has the number its submit will keep.
    version: integer("version").notNull(),
    status: text("status", { enum: WORKSHEET_VERSION_STATUSES }).notNull().default("draft"),
    values: jsonb("values").$type<Record<string, unknown>>().notNull().default({}),
    result: jsonb("result").$type<Record<string, unknown>>(),
    confidence: text("confidence", { enum: EVIDENCE_CONFIDENCE }).notNull().default("self_reported"),
    // The submitted version a draft was started from, or the other worksheet's version that prefilled it.
    basedOnVersionId: uuid("based_on_version_id"),
    prefilledFromVersionId: uuid("prefilled_from_version_id"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_worksheet_version_uidx").on(t.enrollmentId, t.worksheetId, t.version),
    // One draft at a time for a worksheet.
    uniqueIndex("trade_worksheet_version_draft_uidx")
      .on(t.enrollmentId, t.worksheetId)
      .where(sql`${t.status} = 'draft'`),
    index("trade_worksheet_version_enrollment_idx").on(t.enrollmentId),
  ],
);

// Progress made by an enrolled SME on a specific module.
export const moduleProgress = trade.table(
  "module_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    contentVersion: text("content_version").notNull(),
    status: text("status", { enum: MODULE_PROGRESS_STATUSES }).notNull().default("not_started"),
    lessonProgress: jsonb("lesson_progress").notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }),
    theoryCompletedAt: timestamp("theory_completed_at", { withTimezone: true }),
    knowledgeCheckScore: numeric("knowledge_check_score", { precision: 5, scale: 2 }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    adminOverrideByUserId: text("admin_override_by_user_id").references(() => user.id, { onDelete: "set null" }),
    adminOverrideReason: text("admin_override_reason"),
    adminOverrideAt: timestamp("admin_override_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_module_progress_enrollment_module_uidx").on(t.enrollmentId, t.moduleId),
  ],
);

// An attempt by an enrolled learner at a module's knowledge check.
export const knowledgeCheckAttempt = trade.table(
  "knowledge_check_attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    contentVersion: text("content_version").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    score: numeric("score", { precision: 5, scale: 2 }).notNull(),
    passed: boolean("passed").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    correctCount: integer("correct_count").notNull(),
    answers: jsonb("answers").notNull().default({}),
    results: jsonb("results").notNull().default([]),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trade_kc_attempt_enrollment_idx").on(t.enrollmentId),
    index("trade_kc_attempt_enr_module_idx").on(t.enrollmentId, t.moduleId),
  ],
);

export const MODULE_SUBMISSION_STATUSES = ["submitted", "scored", "revision_required", "passed"] as const;
export type ModuleSubmissionStatus = (typeof MODULE_SUBMISSION_STATUSES)[number];

export const RUBRIC_SCORE_OUTCOMES = ["passed", "revision_required"] as const;
export type RubricScoreOutcome = (typeof RUBRIC_SCORE_OUTCOMES)[number];

// A practical deliverable submission by an SME for a module (#67).
export const moduleSubmission = trade.table(
  "module_submission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    contentVersion: text("content_version").notNull(),
    version: integer("version").notNull().default(1),
    status: text("status", { enum: MODULE_SUBMISSION_STATUSES }).notNull().default("submitted"),
    worksheetVersionId: uuid("worksheet_version_id").references(() => worksheetVersion.id, { onDelete: "set null" }),
    evidenceRecordIds: text("evidence_record_ids")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    worksheetSnapshot: jsonb("worksheet_snapshot").$type<Record<string, unknown>>().notNull().default({}),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_module_submission_enrollment_idx").on(t.enrollmentId),
    index("trade_module_submission_enr_mod_idx").on(t.enrollmentId, t.moduleId),
    index("trade_module_submission_status_idx").on(t.status),
    index("trade_module_submission_submitted_at_idx").on(t.submittedAt),
  ],
);

// An assessor's rubric scoring of a practical module submission (#67).
export const rubricAssessment = trade.table(
  "rubric_assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => moduleSubmission.id, { onDelete: "cascade" }),
    assessorUserId: text("assessor_user_id").references(() => user.id, { onDelete: "set null" }),
    isFirstScore: boolean("is_first_score").notNull().default(true),
    scores: jsonb("scores").$type<Record<string, { points: number; comment?: string }>>().notNull().default({}),
    criterionResults: jsonb("criterion_results").$type<unknown[]>().notNull().default([]),
    confirmedCriticalFailures: text("confirmed_critical_failures")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    totalPoints: integer("total_points").notNull(),
    maxPoints: integer("max_points").notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    band: text("band").notNull(),
    passed: boolean("passed").notNull(),
    outcome: text("outcome", { enum: RUBRIC_SCORE_OUTCOMES }).notNull(),
    feedback: text("feedback"),
    overriddenByUserId: text("overridden_by_user_id").references(() => user.id, { onDelete: "set null" }),
    overrideReason: text("override_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_rubric_assessment_submission_idx").on(t.submissionId),
    index("trade_rubric_assessment_assessor_idx").on(t.assessorUserId),
  ],
);

// A certificate issued to an SME upon completion of the TRADE program (#71).
export const certificate = trade.table(
  "certificate",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    recipientName: text("recipient_name").notNull(),
    recipientOrganizationName: text("recipient_organization_name").notNull(),
    programName: text("program_name").notNull(),
    cohortName: text("cohort_name").notNull(),
    pathway: text("pathway").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: text("revoked_by_user_id").references(() => user.id, { onDelete: "set null" }),
    revocationReason: text("revocation_reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_certificate_enrollment_idx").on(t.enrollmentId),
    uniqueIndex("trade_certificate_code_uidx").on(t.code),
  ],
);

// An exemption granted or requested for a module, backed by an evidence record.
export const moduleExemption = trade.table(
  "module_exemption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    evidenceRecordId: uuid("evidence_record_id")
      .notNull()
      .references(() => evidenceRecord.id, { onDelete: "cascade" }),
    status: text("status", { enum: MODULE_EXEMPTION_STATUSES }).notNull().default("pending"),
    reason: text("reason").notNull(),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_module_exemption_enrollment_idx").on(t.enrollmentId),
    index("trade_module_exemption_enr_module_idx").on(t.enrollmentId, t.moduleId),
    index("trade_module_exemption_evidence_idx").on(t.evidenceRecordId),
  ],
);

// An evidence artifact uploaded or submitted by an SME.
export const evidenceRecord = trade.table(
  "evidence_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollment.id, { onDelete: "set null" }),
    fileId: uuid("file_id").references(() => file.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    targetType: text("target_type", { enum: EVIDENCE_TARGET_TYPES }).notNull().default("assessment_question"),
    targetId: text("target_id"),
    confidence: text("confidence", { enum: EVIDENCE_CONFIDENCE }).notNull().default("self_reported"),
    status: text("status", { enum: EVIDENCE_REVIEW_STATUSES }).notNull().default("not_submitted"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewComment: text("review_comment"),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    requestPrompt: text("request_prompt"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_evidence_record_org_idx").on(t.organizationId),
    index("trade_evidence_record_enrollment_idx").on(t.enrollmentId),
    index("trade_evidence_record_target_idx").on(t.targetType, t.targetId),
  ],
);

// A commercial opportunity tracked for an enrolled SME (#68).
export const commercialOpportunity = trade.table(
  "commercial_opportunity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollment.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    companyName: text("company_name").notNull().default(""),
    buyerName: text("buyer_name"),
    /** The business's one record of this buyer (spec 10.2), shared with its other opportunities and its transactions. */
    buyerId: uuid("buyer_id").references((): AnyPgColumn => smeBuyer.id, { onDelete: "set null" }),
    country: text("country").notNull().default(""),
    website: text("website"),
    sourceLinks: jsonb("source_links").$type<string[]>().default([]),
    decisionMakerRole: text("decision_maker_role"),
    notes: text("notes"),
    verificationStatus: text("verification_status", { enum: VERIFICATION_LADDER_STATUSES })
      .notNull()
      .default("unverified"),
    scorecard: jsonb("scorecard").$type<Record<string, number>>(),
    scorecardTotal: integer("scorecard_total"),
    scorecardBand: text("scorecard_band", { enum: QUALIFICATION_BANDS }),
    stage: text("stage", { enum: PIPELINE_STAGES }).notNull().default("lead_discovered"),
    estimatedValue: numeric("estimated_value", { precision: 14, scale: 2 }),
    currency: text("currency").default("USD"),
    status: text("status", { enum: OPPORTUNITY_STATUSES }).notNull().default("identified"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_opportunity_org_idx").on(t.organizationId),
    index("trade_opportunity_enrollment_idx").on(t.enrollmentId),
    index("trade_opportunity_stage_idx").on(t.stage),
  ],
);

// Commercial activities and touchpoints recorded against an opportunity (#68).
export const commercialActivity = trade.table(
  "commercial_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => commercialOpportunity.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    type: text("type", { enum: COMMERCIAL_ACTIVITY_TYPES }).notNull(),
    summary: text("summary").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    followUpDate: timestamp("follow_up_date", { withTimezone: true }),
    evidenceUrl: text("evidence_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trade_activity_opportunity_idx").on(t.opportunityId),
    index("trade_activity_org_idx").on(t.organizationId),
  ],
);

export const OUTCOME_KINDS = ["financing", "export"] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

// A financing or export outcome for an enrolled SME (#69).
export const outcome = trade.table(
  "outcome",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollment.id, { onDelete: "set null" }),
    kind: text("kind", { enum: OUTCOME_KINDS }).notNull(),
    status: text("status").notNull(),
    // Financing outcome fields
    lenderName: text("lender_name"),
    financingType: text("financing_type"),
    amountRequested: numeric("amount_requested", { precision: 14, scale: 2 }),
    amountApproved: numeric("amount_approved", { precision: 14, scale: 2 }),
    amountDisbursed: numeric("amount_disbursed", { precision: 14, scale: 2 }),
    currency: text("currency").default("USD"),
    approvalDate: timestamp("approval_date", { withTimezone: true }),
    disbursementDate: timestamp("disbursement_date", { withTimezone: true }),
    // Export outcome fields
    opportunityId: uuid("opportunity_id").references(() => commercialOpportunity.id, { onDelete: "set null" }),
    buyerName: text("buyer_name"),
    destinationCountry: text("destination_country"),
    productDescription: text("product_description"),
    valuePlanned: numeric("value_planned", { precision: 14, scale: 2 }),
    valueShipped: numeric("value_shipped", { precision: 14, scale: 2 }),
    valuePaid: numeric("value_paid", { precision: 14, scale: 2 }),
    shipmentDate: timestamp("shipment_date", { withTimezone: true }),
    deliveryDate: timestamp("delivery_date", { withTimezone: true }),
    paymentDate: timestamp("payment_date", { withTimezone: true }),
    // Shared metadata
    notes: text("notes"),
    evidenceTier: text("evidence_tier", { enum: OUTCOME_EVIDENCE_TIERS }).notNull().default("self_reported"),
    evidenceUrl: text("evidence_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_outcome_org_idx").on(t.organizationId),
    index("trade_outcome_enrollment_idx").on(t.enrollmentId),
    index("trade_outcome_opp_idx").on(t.opportunityId),
    check(
      "trade_outcome_financing_status_check",
      sql`${t.kind} <> 'financing' or ${t.status} in ('not_started', 'application_prepared', 'submitted', 'approved', 'declined', 'disbursed', 'cancelled')`,
    ),
    check(
      "trade_outcome_export_status_check",
      sql`${t.kind} <> 'export' or ${t.status} in ('planned', 'preparing', 'shipped', 'delivered', 'payment_pending', 'paid', 'disputed', 'cancelled')`,
    ),
  ],
);
export const tradeOutcome = outcome;

export const AI_EXCHANGE_STATUSES = ["completed", "refused", "failed"] as const;
export type AiExchangeStatus = (typeof AI_EXCHANGE_STATUSES)[number];

// One request to the AI assistant for module exercises (#76), kept for review. It records what was sent and what came
// back, and the tokens the month's cost cap is counted from. Nothing reads it to set a score, a plan or an evidence status.
export const aiExchange = trade.table(
  "ai_exchange",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "set null" }),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    contentVersion: text("content_version").notNull(),
    promptId: text("prompt_id").notNull(),
    input: jsonb("input").$type<Record<string, string>>().notNull(),
    output: text("output"),
    status: text("status", { enum: AI_EXCHANGE_STATUSES }).notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_ai_exchange_user_created_idx").on(t.userId, t.createdAt), index("trade_ai_exchange_created_idx").on(t.createdAt)],
);

// Audit history for financing and export outcome status changes (#69).
export const outcomeEvent = trade.table(
  "outcome_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    outcomeId: uuid("outcome_id")
      .notNull()
      .references(() => outcome.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    evidenceTier: text("evidence_tier", { enum: OUTCOME_EVIDENCE_TIERS }).notNull().default("self_reported"),
    evidenceUrl: text("evidence_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trade_outcome_event_outcome_idx").on(t.outcomeId),
    index("trade_outcome_event_org_idx").on(t.organizationId),
  ],
);

// ---- Table Relations ----

export const programRelations = relations(program, ({ many }) => ({
  cohorts: many(cohort),
}));

export const cohortRelations = relations(cohort, ({ one, many }) => ({
  program: one(program, { fields: [cohort.programId], references: [program.id] }),
  sponsorOrganization: one(organization, {
    fields: [cohort.sponsorOrganizationId],
    references: [organization.id],
  }),
  enrollments: many(enrollment),
}));

export const enrollmentRelations = relations(enrollment, ({ one, many }) => ({
  cohort: one(cohort, { fields: [enrollment.cohortId], references: [cohort.id] }),
  organization: one(organization, {
    fields: [enrollment.organizationId],
    references: [organization.id],
  }),
  assessments: many(tradeAssessment),
  learningPlans: many(learningPlan),
  moduleProgress: many(moduleProgress),
  submissions: many(moduleSubmission),
  certificates: many(certificate),
  moduleExemptions: many(moduleExemption),
  evidenceRecords: many(evidenceRecord),
  commercialOpportunities: many(commercialOpportunity),
  outcomes: many(outcome),
}));

export const tradeAssessmentRelations = relations(tradeAssessment, ({ one, many }) => ({
  enrollment: one(enrollment, { fields: [tradeAssessment.enrollmentId], references: [enrollment.id] }),
  responses: many(assessmentResponse),
  scores: many(capabilityScore),
  learningPlans: many(learningPlan),
}));

export const assessmentResponseRelations = relations(assessmentResponse, ({ one }) => ({
  assessment: one(tradeAssessment, {
    fields: [assessmentResponse.assessmentId],
    references: [tradeAssessment.id],
  }),
}));

export const capabilityScoreRelations = relations(capabilityScore, ({ one }) => ({
  assessment: one(tradeAssessment, {
    fields: [capabilityScore.assessmentId],
    references: [tradeAssessment.id],
  }),
}));

export const learningPlanRelations = relations(learningPlan, ({ one, many }) => ({
  enrollment: one(enrollment, { fields: [learningPlan.enrollmentId], references: [enrollment.id] }),
  assessment: one(tradeAssessment, {
    fields: [learningPlan.assessmentId],
    references: [tradeAssessment.id],
  }),
  reviewedByUser: one(user, { fields: [learningPlan.reviewedByUserId], references: [user.id] }),
  moduleAssignments: many(moduleAssignment),
}));

export const moduleAssignmentRelations = relations(moduleAssignment, ({ one }) => ({
  learningPlan: one(learningPlan, {
    fields: [moduleAssignment.planId],
    references: [learningPlan.id],
  }),
}));

export const moduleProgressRelations = relations(moduleProgress, ({ one }) => ({
  enrollment: one(enrollment, { fields: [moduleProgress.enrollmentId], references: [enrollment.id] }),
  adminOverrideByUser: one(user, { fields: [moduleProgress.adminOverrideByUserId], references: [user.id] }),
}));

export const knowledgeCheckAttemptRelations = relations(knowledgeCheckAttempt, ({ one }) => ({
  enrollment: one(enrollment, { fields: [knowledgeCheckAttempt.enrollmentId], references: [enrollment.id] }),
  submittedByUser: one(user, { fields: [knowledgeCheckAttempt.submittedByUserId], references: [user.id] }),
}));

export const moduleSubmissionRelations = relations(moduleSubmission, ({ one, many }) => ({
  enrollment: one(enrollment, { fields: [moduleSubmission.enrollmentId], references: [enrollment.id] }),
  worksheetVersion: one(worksheetVersion, { fields: [moduleSubmission.worksheetVersionId], references: [worksheetVersion.id] }),
  submittedByUser: one(user, { fields: [moduleSubmission.submittedByUserId], references: [user.id] }),
  scores: many(rubricAssessment),
}));

export const rubricAssessmentRelations = relations(rubricAssessment, ({ one }) => ({
  submission: one(moduleSubmission, { fields: [rubricAssessment.submissionId], references: [moduleSubmission.id] }),
  assessorUser: one(user, { fields: [rubricAssessment.assessorUserId], references: [user.id] }),
  overriddenByUser: one(user, { fields: [rubricAssessment.overriddenByUserId], references: [user.id] }),
}));

export const certificateRelations = relations(certificate, ({ one }) => ({
  enrollment: one(enrollment, { fields: [certificate.enrollmentId], references: [enrollment.id] }),
  revokedByUser: one(user, { fields: [certificate.revokedByUserId], references: [user.id] }),
}));

export const moduleExemptionRelations = relations(moduleExemption, ({ one }) => ({
  enrollment: one(enrollment, { fields: [moduleExemption.enrollmentId], references: [enrollment.id] }),
  evidenceRecord: one(evidenceRecord, { fields: [moduleExemption.evidenceRecordId], references: [evidenceRecord.id] }),
  requestedByUser: one(user, { fields: [moduleExemption.requestedByUserId], references: [user.id] }),
  reviewedByUser: one(user, { fields: [moduleExemption.reviewedByUserId], references: [user.id] }),
}));

export const evidenceRecordRelations = relations(evidenceRecord, ({ one }) => ({
  organization: one(organization, {
    fields: [evidenceRecord.organizationId],
    references: [organization.id],
  }),
  enrollment: one(enrollment, { fields: [evidenceRecord.enrollmentId], references: [enrollment.id] }),
  file: one(file, { fields: [evidenceRecord.fileId], references: [file.id] }),
  reviewedByUser: one(user, { fields: [evidenceRecord.reviewedByUserId], references: [user.id] }),
  requestedByUser: one(user, { fields: [evidenceRecord.requestedByUserId], references: [user.id] }),
}));

export const commercialOpportunityRelations = relations(commercialOpportunity, ({ one, many }) => ({
  organization: one(organization, {
    fields: [commercialOpportunity.organizationId],
    references: [organization.id],
  }),
  enrollment: one(enrollment, {
    fields: [commercialOpportunity.enrollmentId],
    references: [enrollment.id],
  }),
  activities: many(commercialActivity),
}));

export const commercialActivityRelations = relations(commercialActivity, ({ one }) => ({
  opportunity: one(commercialOpportunity, {
    fields: [commercialActivity.opportunityId],
    references: [commercialOpportunity.id],
  }),
  organization: one(organization, {
    fields: [commercialActivity.organizationId],
    references: [organization.id],
  }),
  actorUser: one(user, {
    fields: [commercialActivity.actorUserId],
    references: [user.id],
  }),
}));

export const tradeOutcomeRelations = relations(outcome, ({ one, many }) => ({
  organization: one(organization, {
    fields: [outcome.organizationId],
    references: [organization.id],
  }),
  enrollment: one(enrollment, { fields: [outcome.enrollmentId], references: [enrollment.id] }),
  opportunity: one(commercialOpportunity, { fields: [outcome.opportunityId], references: [commercialOpportunity.id] }),
  events: many(outcomeEvent),
}));

export const outcomeEventRelations = relations(outcomeEvent, ({ one }) => ({
  outcome: one(outcome, {
    fields: [outcomeEvent.outcomeId],
    references: [outcome.id],
  }),
  organization: one(organization, {
    fields: [outcomeEvent.organizationId],
    references: [organization.id],
  }),
  actorUser: one(user, {
    fields: [outcomeEvent.actorUserId],
    references: [user.id],
  }),
}));






export const PATHWAY_STATUSES = ["provisional", "confirmed", "superseded"] as const;
export type PathwayStatus = (typeof PATHWAY_STATUSES)[number];

// The avenue an enrolment is on, from the onboarding diagnostic (#78). Rows are written once: a new
// diagnostic or a staff confirmation adds a row and supersedes the old one.
export const pathwayAssignment = trade.table(
  "pathway_assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    assessmentId: uuid("assessment_id").references(() => tradeAssessment.id, { onDelete: "set null" }),
    pathway: text("pathway", { enum: PATHWAYS }).notNull(),
    status: text("status", { enum: PATHWAY_STATUSES }).notNull(),
    liveOrder: boolean("live_order").notNull().default(false),
    rulesVersion: text("rules_version").notNull(),
    reasonCodes: jsonb("reason_codes").$type<string[]>().notNull(),
    // Set when staff confirm or change the pathway; null when the rules assigned it.
    decidedByUserId: text("decided_by_user_id").references(() => user.id, { onDelete: "set null" }),
    decisionReason: text("decision_reason"),
    supersededById: uuid("superseded_by_id"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trade_pathway_assignment_enrollment_idx").on(t.enrollmentId),
    uniqueIndex("trade_pathway_assignment_live_uidx")
      .on(t.enrollmentId)
      .where(sql`${t.status} <> 'superseded'`),
  ],
);

// What a person agreed to at the end of the onboarding diagnostic (section 10): who, when, the wording
// version they saw, and the electronic signature.
export const assessmentConsent = trade.table(
  "assessment_consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => tradeAssessment.id, { onDelete: "cascade" }),
    questionId: text("question_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    termsVersion: text("terms_version").notNull(),
    // Whether they agreed. A "no" to an optional consent is recorded too.
    accepted: boolean("accepted").notNull().default(true),
    signedName: text("signed_name"),
    signedPosition: text("signed_position"),
    signedDate: date("signed_date"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("trade_assessment_consent_question_uidx").on(t.assessmentId, t.questionId)],
);

// What an SME's owner lets a sponsor see by name (#70). One live row (not withdrawn) per sponsor, SME and kind; a
// withdrawal sets `withdrawn_at` and the sponsor loses access on the next request. Rows are never deleted, and
// they keep the words that were agreed to.
export const sponsorConsent = trade.table(
  "sponsor_consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sponsorOrganizationId: text("sponsor_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    smeOrganizationId: text("sme_organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: [...SPONSOR_DATA_KINDS, ...SUMMIT_DATA_KINDS] }).notNull(),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    wordingVersion: text("wording_version").notNull(),
    wording: text("wording").notNull(),
    withdrawnByUserId: text("withdrawn_by_user_id").references(() => user.id, { onDelete: "set null" }),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("trade_sponsor_consent_live_uidx")
      .on(t.sponsorOrganizationId, t.smeOrganizationId, t.kind)
      .where(sql`${t.withdrawnAt} is null`),
    index("trade_sponsor_consent_sme_idx").on(t.smeOrganizationId),
    index("trade_sponsor_consent_sponsor_idx").on(t.sponsorOrganizationId),
  ],
);

// A business in Entrust's register of pilot SMEs: what staff recorded about it in the export readiness diagnostic
// workbook before it had an account. The code is the workbook's own SME ID (TRADE-ETH-LEA-002) and what a re-import
// matches on. Totals, the readiness score and levels are worked out when read, from these inputs, so they can't
// disagree with them. Amounts are as the workbook gives them (Ethiopian birr); the five scores are 1 to 5.
// Staff only: a sponsor sees none of this unless the SME agrees, through `sponsor_consent`.
export const smeRegister = trade.table(
  "sme_register",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    companyName: text("company_name").notNull(),
    participantName: text("participant_name"),
    phone: text("phone"),
    email: text("email"),
    yearEstablished: integer("year_established"),
    location: text("location"),
    employees: integer("employees"),
    exportLicence: boolean("export_licence"),
    currentBank: text("current_bank"),
    mainProduct: text("main_product"),
    monthlyProductionCapacity: numeric("monthly_production_capacity", { precision: 16, scale: 2, mode: "number" }),
    averageMonthlyRevenue: numeric("average_monthly_revenue", { precision: 16, scale: 2, mode: "number" }),
    largestOrderCompleted: numeric("largest_order_completed", { precision: 16, scale: 2, mode: "number" }),
    currentMarkets: text("current_markets"),
    targetExportMarket: text("target_export_market"),
    monthlyOperatingCost: numeric("monthly_operating_cost", { precision: 16, scale: 2, mode: "number" }),
    estimatedMonthlyProfit: numeric("estimated_monthly_profit", { precision: 16, scale: 2, mode: "number" }),
    existingLoan: boolean("existing_loan"),
    loanAmount: numeric("loan_amount", { precision: 16, scale: 2, mode: "number" }),
    cashflowStability: text("cashflow_stability"),
    workingCapitalGap: numeric("working_capital_gap", { precision: 16, scale: 2, mode: "number" }),
    equipmentInvestmentNeeded: numeric("equipment_investment_needed", { precision: 16, scale: 2, mode: "number" }),
    exportLogisticsGap: numeric("export_logistics_gap", { precision: 16, scale: 2, mode: "number" }),
    costingKnowledge: integer("costing_knowledge"),
    productionCapacityStrength: integer("production_capacity_strength"),
    documentationKnowledge: integer("documentation_knowledge"),
    financialRecordKeeping: integer("financial_record_keeping"),
    marketReadiness: integer("market_readiness"),
    entrustSupportNeeded: text("entrust_support_needed"),
    bankOpportunity: text("bank_opportunity"),
    serviceNotes: text("service_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_sme_register_code_uidx").on(t.code),
    check(
      "trade_sme_register_scores_ck",
      sql`(${t.costingKnowledge} is null or ${t.costingKnowledge} between 1 and 5)
        and (${t.productionCapacityStrength} is null or ${t.productionCapacityStrength} between 1 and 5)
        and (${t.documentationKnowledge} is null or ${t.documentationKnowledge} between 1 and 5)
        and (${t.financialRecordKeeping} is null or ${t.financialRecordKeeping} between 1 and 5)
        and (${t.marketReadiness} is null or ${t.marketReadiness} between 1 and 5)`,
    ),
  ],
);

// A response to a programme's application form (a Google Form exported as a workbook), kept as it was sent. The fields staff
// search on are columns; the answers to every question are kept as typed in `answers` (an object of text by question), so a
// form that changes still loads. `country` is worked out when the response is loaded, from where the business says it is,
// its email address and its phone number: null when that can't be told. Only responses from Ethiopia are shown to anyone
// (the API filters on it); the rest are kept here and never listed. A re-import matches a response on programme, time and email.
export const programApplication = trade.table(
  "program_application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    program: text("program").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
    email: text("email").notNull(),
    businessName: text("business_name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    location: text("location"),
    country: text("country"),
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("trade_program_application_response_uidx").on(t.program, t.submittedAt, t.email),
    index("trade_program_application_country_idx").on(t.country),
  ],
);

export const PUBLIC_DIAGNOSTIC_STATUSES = ["draft", "submitted"] as const;
export type PublicDiagnosticStatus = (typeof PUBLIC_DIAGNOSTIC_STATUSES)[number];

// The onboarding diagnostic filled in without an account: anyone with the public link starts a draft, keeps it by
// its private link (only a hash of the token is stored), and submits it. It belongs to no enrolment, so the
// avenue is kept on the row. Staff read the submissions and match each to a business when they enrol it.
export const publicDiagnostic = trade.table(
  "public_diagnostic",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    businessName: text("business_name"),
    // Asked with the email and the business name before the form opens. Null only on rows from before it was asked.
    phone: text("phone"),
    templateVersion: text("template_version").notNull(),
    status: text("status", { enum: PUBLIC_DIAGNOSTIC_STATUSES }).notNull().default("draft"),
    // One object, question ID to the answer as the screen sends it. Kept whole, not row by row, so a bare
    // string or number never goes through a jsonb scalar.
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
    pathway: text("pathway", { enum: PATHWAYS }),
    pathwayProvisional: boolean("pathway_provisional"),
    liveOrder: boolean("live_order"),
    rulesVersion: text("rules_version"),
    reasonCodes: jsonb("reason_codes").$type<string[]>(),
    // The declaration's signature (section 10) and the wording version they agreed to.
    signedName: text("signed_name"),
    signedPosition: text("signed_position"),
    signedDate: text("signed_date"),
    // A hash of the visitor's address, only to limit how many forms one address starts in an hour.
    ipHash: text("ip_hash"),
    linkEmailedAt: timestamp("link_emailed_at", { withTimezone: true }),
    // The link on screen proves nothing about the email; the copy in the email carries a one-time proof, and opening
    // it sets emailVerifiedAt. Only then does the visitor get an account (on AfriConnect and Entrust, as userId).
    emailProofHash: text("email_proof_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_public_diagnostic_email_idx").on(t.email),
    index("trade_public_diagnostic_status_idx").on(t.status, t.submittedAt),
    index("trade_public_diagnostic_created_idx").on(t.createdAt),
  ],
);

// An action in an SME's 90-day plan (FR-11, M12). It belongs to the organisation, so it stays available after the certificate.
export const actionItem = trade.table(
  "action_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    priority: text("priority"),
    responsible: text("responsible").notNull(),
    startDate: date("start_date", { mode: "string" }),
    dueDate: date("due_date", { mode: "string" }),
    resources: text("resources"),
    expectedResult: text("expected_result"),
    performanceIndicator: text("performance_indicator"),
    status: text("status").notNull().default("not_started"),
    evidence: text("evidence"),
    reviewComments: text("review_comments"),
    milestone: integer("milestone").notNull().default(90),
    sourceWorksheetVersionId: uuid("source_worksheet_version_id").references(() => worksheetVersion.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("trade_action_item_org_idx").on(t.organizationId, t.milestone)],
);

// A 30, 60 or 90-day follow-up on the plan: the answers to M12's questions at that point.
export const actionReview = trade.table(
  "action_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    answers: jsonb("answers").$type<Record<string, string>>().notNull().default({}),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_action_review_org_idx").on(t.organizationId, t.createdAt)],
);

// One planned or active export (FR-10, M08), with the reference a CLEAR case shares when the business runs it there. It records what
// the business says and has done; it never certifies compliance or approves a shipment.
export const exportTransaction = trade.table(
  "export_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    reference: text("reference").notNull().unique(),
    isPractice: boolean("is_practice").notNull().default(false),
    stage: text("stage").notNull().default("enquiry"),
    product: text("product").notNull(),
    destination: text("destination"),
    quantity: text("quantity"),
    buyerName: text("buyer_name"),
    buyerId: uuid("buyer_id").references((): AnyPgColumn => smeBuyer.id, { onDelete: "set null" }),
    buyerStatus: text("buyer_status"),
    orderDocument: text("order_document"),
    agreedPrice: text("agreed_price"),
    currency: text("currency"),
    incoterm: text("incoterm"),
    namedPlace: text("named_place"),
    costingAndMargin: text("costing_and_margin"),
    paymentTerms: text("payment_terms"),
    paymentRisk: text("payment_risk"),
    productionStatus: text("production_status"),
    documentChecklist: text("document_checklist"),
    logistics: text("logistics"),
    customsStatus: text("customs_status"),
    insuranceStatus: text("insurance_status"),
    exceptions: text("exceptions"),
    outstandingActions: text("outstanding_actions"),
    responsible: text("responsible"),
    paymentStatus: text("payment_status"),
    actualCosts: text("actual_costs"),
    closeout: text("closeout"),
    clearCaseId: uuid("clear_case_id").references(() => exportCase.id, { onDelete: "set null" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("trade_export_transaction_org_idx").on(t.organizationId, t.createdAt)],
);


// Staff sign-in codes (spec sections 17 and 21). Entrust staff sign in through AfriConnect or Google, so their second
// step is our own authenticator app (TOTP). One row per person who has started setting it up; `confirmedAt` is set
// when they prove they hold the secret. The secret is stored encrypted and never leaves the API.
export const staffMfa = trade.table("staff_mfa", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /** SHA-256 of each recovery code not yet used. */
  recoveryHashes: jsonb("recovery_hashes").$type<string[]>().notNull().default([]),
  /** The 30-second step of the last code accepted, so one code can't be used twice. */
  lastStep: integer("last_step"),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// A sign-in session that has passed the second step. Deleting the session (signing out, expiry) deletes this.
export const staffMfaSession = trade.table("staff_mfa_session", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => session.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---- The SME record (architecture spec sections 5 and 6.7) ----

export const EXPORT_EVIDENCE_STATUSES = ["self_reported", "document_supported", "independently_verified"] as const;
export type ExportEvidenceStatus = (typeof EXPORT_EVIDENCE_STATUSES)[number];

// The single record of a business's completed shipments (spec 5.5). A row is written when a real transaction is closed out
// (never for a confirmed order, and never for a practice transaction), or when staff or the business add an earlier shipment.
// The evidence status says how far the shipment has been checked; only staff move it up from `self_reported`.
export const smeExportHistory = trade.table(
  "sme_export_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** The transaction that was closed out, if this row came from one. One row per transaction. */
    transactionId: uuid("transaction_id")
      .unique()
      .references(() => exportTransaction.id, { onDelete: "set null" }),
    product: text("product").notNull(),
    destination: text("destination"),
    buyerName: text("buyer_name"),
    /** The day the shipment left, as the business or staff gave it. */
    shipmentDate: date("shipment_date"),
    evidenceStatus: text("evidence_status", { enum: EXPORT_EVIDENCE_STATUSES }).notNull().default("self_reported"),
    evidenceNote: text("evidence_note"),
    recordedByUserId: text("recorded_by_user_id").references(() => user.id, { onDelete: "set null" }),
    statusChangedByUserId: text("status_changed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("trade_export_history_org_idx").on(t.organizationId, t.createdAt)],
);

export const PATHWAY_REVIEW_STATUSES = ["open", "resolved"] as const;

// Raised when a business records its first completed shipment (spec 6.7). It asks staff to look at the enrolment's pathway.
// Nothing changes the pathway on its own: staff confirm or change it as they do today, and resolve the review.
export const pathwayReview = trade.table(
  "pathway_review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    exportHistoryId: uuid("export_history_id").references(() => smeExportHistory.id, { onDelete: "set null" }),
    status: text("status", { enum: PATHWAY_REVIEW_STATUSES }).notNull().default("open"),
    resolvedByUserId: text("resolved_by_user_id").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolution: text("resolution"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trade_pathway_review_enrollment_idx").on(t.enrollmentId),
    // One open review per enrolment at a time.
    uniqueIndex("trade_pathway_review_open_uidx").on(t.enrollmentId).where(sql`${t.status} = 'open'`),
  ],
);

// What a business sells (spec 5.3). One business can hold several.
export const smeProduct = trade.table(
  "sme_product",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    hsCode: text("hs_code"),
    /** Kept, not deleted, once a business stops selling it, so the history still makes sense. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("trade_sme_product_org_idx").on(t.organizationId)],
);

// The history of changes to a business's profile (spec 5.4): who changed which detail, from what, to what. A change to
// the legal name, registration number, tax number, sector or country is material and flagged so staff can see it.
export const smeProfileChange = trade.table(
  "sme_profile_change",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    changedByUserId: text("changed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    material: boolean("material").notNull().default(false),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_sme_profile_change_org_idx").on(t.organizationId, t.changedAt)],
);

// The Entrust Africa Verified SME Passport (one per business). The page the QR code opens is built from this row only, so
// nothing private (scores, finances, the diagnostic) can reach it: staff type or confirm each public line, the employee range
// included. `passportId` is the number printed on the passport (EA-ETH-0002) and never changes.
export const smePassport = trade.table(
  "sme_passport",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Where the passport's details started from, if anywhere: a business on the platform, or an application in the SME
    // register (a business can have a passport before it has an account). Neither is public. Either can be missing.
    organizationId: text("organization_id")
      .unique()
      .references(() => organization.id, { onDelete: "set null" }),
    applicationId: uuid("application_id")
      .unique()
      .references((): AnyPgColumn => programApplication.id, { onDelete: "set null" }),
    passportId: text("passport_id").notNull().unique(),
    tier: text("tier", { enum: PASSPORT_TIERS }).notNull(),
    status: text("status", { enum: PASSPORT_STATUSES }).notNull().default("active"),
    statusReason: text("status_reason"),
    verifiedOn: date("verified_on").notNull(),
    validUntil: date("valid_until").notNull(),
    displayName: text("display_name").notNull(),
    tagline: text("tagline"),
    logoUrl: text("logo_url"),
    country: text("country").notNull(),
    sector: text("sector"),
    established: integer("established"),
    employeesRange: text("employees_range"),
    ownership: text("ownership"),
    founder: text("founder"),
    headline: text("headline"),
    overview: text("overview"),
    products: jsonb("products").$type<{ name: string; detail: string | null; code: string | null }[]>().notNull().default([]),
    womenInTrade: jsonb("women_in_trade").$type<string[]>().notNull().default([]),
    targetMarkets: jsonb("target_markets").$type<{ label: string; places: string[] }[]>().notNull().default([]),
    seeking: text("seeking"),
    checks: jsonb("checks").$type<string[]>().notNull().default([]),
    website: text("website"),
    email: text("email"),
    phones: jsonb("phones").$type<string[]>().notNull().default([]),
    address: text("address"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
);

// ---- Buyers and transactions (spec sections 10.2 to 10.5) ----

// A business's one record of each buyer, so M05's pipeline, M10's relationship register and a transaction all point at the same
// buyer and the same evidence status. It is found or made from the company name and country, so typing a buyer twice doesn't
// make two. The evidence status uses the verification ladder; only staff set it down or up by hand.
export const smeBuyer = trade.table(
  "sme_buyer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Lower-case name and country with the spaces squeezed, which is what two spellings of the same buyer share. */
    nameKey: text("name_key").notNull(),
    country: text("country").notNull().default(""),
    website: text("website"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    verificationStatus: text("verification_status", { enum: VERIFICATION_LADDER_STATUSES }).notNull().default("unverified"),
    evidenceNote: text("evidence_note"),
    statusChangedByUserId: text("status_changed_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [uniqueIndex("trade_sme_buyer_key_uidx").on(t.organizationId, t.nameKey, t.country)],
);

export const TRANSACTION_EVENT_TYPES = ["stage_change", "note", "exception", "payment", "document", "cost"] as const;

// What happened on a transaction, in order. Stage changes are written by the platform; a business adds notes, exceptions and payments.
export const transactionEvent = trade.table(
  "transaction_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => exportTransaction.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    type: text("type", { enum: TRANSACTION_EVENT_TYPES }).notNull(),
    summary: text("summary").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [index("trade_transaction_event_tx_idx").on(t.transactionId, t.occurredAt)],
);

export const TRANSACTION_DOCUMENT_KINDS = ["purchase_order", "proforma_invoice", "commercial_invoice", "packing_list", "transport_document", "insurance", "certificate", "payment_proof", "other"] as const;

// A document on a transaction: its kind and name, and the uploaded file when there is one.
export const transactionDocument = trade.table(
  "transaction_document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => exportTransaction.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: TRANSACTION_DOCUMENT_KINDS }).notNull(),
    name: text("name").notNull(),
    fileId: uuid("file_id").references(() => file.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_transaction_document_tx_idx").on(t.transactionId)],
);

export const TRANSACTION_COST_BASES = ["quoted", "expected", "actual"] as const;
export const TRANSACTION_COST_CATEGORIES = ["production", "materials", "packaging", "inspection", "inland_transport", "freight", "insurance", "customs", "finance", "other"] as const;

// A cost figure for a transaction. Nothing is overwritten: a new figure for the same category and basis is a revision, and the
// newest one counts. Quoted is what was offered, expected is the business's own estimate, actual is what was paid.
export const transactionCost = trade.table(
  "transaction_cost",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => exportTransaction.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    category: text("category", { enum: TRANSACTION_COST_CATEGORIES }).notNull(),
    basis: text("basis", { enum: TRANSACTION_COST_BASES }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull(),
    note: text("note"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_transaction_cost_tx_idx").on(t.transactionId, t.createdAt)],
);

// ---- Notifications (FRD section 8) ----

export const NOTIFICATION_KINDS = [
  "diagnostic_completed",
  "module_assigned",
  "learning_incomplete",
  "assessment_result",
  "session_reminder",
  "output_review",
  "overdue_action",
  "referral_status",
  "admin_alert",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

// One message to one person, shown in the platform and, unless they turned it off, emailed. `dedupeKey` keeps a reminder that
// repeats from being sent twice for the same thing.
export const notification = trade.table(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Where in the TRADE app the message leads, such as /modules/M04. */
    path: text("path"),
    dedupeKey: text("dedupe_key"),
    /** queued: handed to the email queue. skipped: the person turned email off for this kind. failed: the queue refused it. */
    emailStatus: text("email_status", { enum: ["queued", "skipped", "failed"] }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("trade_notification_user_idx").on(t.userId, t.createdAt),
    uniqueIndex("trade_notification_dedupe_uidx").on(t.userId, t.dedupeKey).where(sql`${t.dedupeKey} is not null`),
  ],
);

// What a person wants for each kind of notification. No row means both on.
export const notificationPreference = trade.table(
  "notification_preference",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    email: boolean("email").notNull().default(true),
    inApp: boolean("in_app").notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })],
);

// ---- Partner referrals (FRD FR-13, spec 13 and 16) ----

export const REFERRAL_DESTINATION_TYPES = ["bank", "insurer", "service_provider"] as const;
export const REFERRAL_DATA_KINDS = ["profile", "products", "export_history", "financial_worksheets"] as const;
export const REFERRAL_CONSENT_STATUSES = ["not_requested", "requested", "granted", "declined", "withdrawn"] as const;
export const REFERRAL_STATUSES = ["draft", "awaiting_consent", "ready", "shared", "accepted", "declined", "completed", "closed"] as const;

// Staff refer a business to a bank, an insurer or a service provider. Nothing about the business goes to the partner until the
// business has agreed to that recipient, for that purpose and for those kinds of information; agreeing to TRADE's terms is not
// enough. The business can withdraw at any time, and a withdrawn consent closes the door again.
export const partnerReferral = trade.table(
  "partner_referral",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    destinationName: text("destination_name").notNull(),
    destinationType: text("destination_type", { enum: REFERRAL_DESTINATION_TYPES }).notNull(),
    reason: text("reason").notNull(),
    /** What the business is asked to let the partner have. Only these kinds are ever in the package. */
    sharedDataKinds: jsonb("shared_data_kinds").$type<string[]>().notNull().default([]),
    consentStatus: text("consent_status", { enum: REFERRAL_CONSENT_STATUSES }).notNull().default("not_requested"),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    consentByUserId: text("consent_by_user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: REFERRAL_STATUSES }).notNull().default("draft"),
    referralDate: date("referral_date", { mode: "string" }),
    responsibleUserId: text("responsible_user_id").references(() => user.id, { onDelete: "set null" }),
    outcome: text("outcome"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("trade_partner_referral_org_idx").on(t.organizationId, t.createdAt)],
);

// The history of a referral: who asked, who agreed, what was shared and when (acceptance test INT-07).
export const partnerReferralEvent = trade.table(
  "partner_referral_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => partnerReferral.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    note: text("note"),
    /** For a share, the kinds that were in the package. */
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_partner_referral_event_idx").on(t.referralId, t.createdAt)],
);

// ---- Integration records (spec 12.4) ----

export const INTEGRATION_PROVIDERS = ["mizan", "clear", "africonnect"] as const;
export const INTEGRATION_SYNC_STATUSES = ["pending", "synced", "failed", "disabled"] as const;

// One row for each thing TRADE holds that lives in another system, with how its last sync went. A failure is recorded here and
// never stops learning or the business profile.
export const integrationRecord = trade.table(
  "integration_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: INTEGRATION_PROVIDERS }).notNull(),
    externalReference: text("external_reference"),
    recordType: text("record_type").notNull(),
    syncStatus: text("sync_status", { enum: INTEGRATION_SYNC_STATUSES }).notNull().default("pending"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorDescription: text("error_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [index("trade_integration_record_org_idx").on(t.organizationId, t.provider)],
);

// ---- Business outputs, action evidence and learning resources (spec 7.5, 9.1, 9.2, 11.3) ----

export const OUTPUT_REVIEW_STATUSES = ["pending", "under_review", "reviewed", "changes_requested"] as const;

// How far staff have got with one submitted version of a business output. A version with no row here is `pending`.
export const worksheetVersionReview = trade.table("worksheet_version_review", {
  worksheetVersionId: uuid("worksheet_version_id")
    .primaryKey()
    .references(() => worksheetVersion.id, { onDelete: "cascade" }),
  status: text("status", { enum: OUTPUT_REVIEW_STATUSES }).notNull().default("pending"),
  reviewerUserId: text("reviewer_user_id").references(() => user.id, { onDelete: "set null" }),
  comments: text("comments"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

// A document a business attaches to a version of one of its outputs, such as a costing sheet or a signed plan. It is the
// business's own file, and a version can take attachments only while it is a draft: a submitted version is what was reviewed.
export const worksheetAttachment = trade.table(
  "worksheet_attachment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worksheetVersionId: uuid("worksheet_version_id")
      .notNull()
      .references(() => worksheetVersion.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => file.id, { onDelete: "cascade" }),
    description: text("description"),
    attachedByUserId: text("attached_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_worksheet_attachment_version_idx").on(t.worksheetVersionId), uniqueIndex("trade_worksheet_attachment_file_uidx").on(t.worksheetVersionId, t.fileId)],
);

// Evidence that an action item was done: a file and what it shows.
export const actionEvidence = trade.table(
  "action_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actionItemId: uuid("action_item_id")
      .notNull()
      .references(() => actionItem.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => file.id, { onDelete: "cascade" }),
    description: text("description"),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("trade_action_evidence_item_idx").on(t.actionItemId), uniqueIndex("trade_action_evidence_file_uidx").on(t.actionItemId, t.fileId)],
);

export const RESOURCE_TYPES = ["template", "guide", "worksheet", "checklist", "video", "other"] as const;
export const RESOURCE_ACCESS_LEVELS = ["learner", "staff"] as const;

// A downloadable resource for a module or one of its lessons, uploaded by Entrust staff. `staff` resources (facilitator packs,
// answer keys) never reach a learner. The file belongs to the Entrust organisation, so a learner reaches it only through the
// resource's own download, which checks that the learner can see the module.
export const learningResource = trade.table(
  "learning_resource",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    moduleId: text("module_id", { enum: MODULE_IDS }).notNull(),
    lessonId: text("lesson_id"),
    name: text("name").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => file.id, { onDelete: "cascade" }),
    resourceType: text("resource_type", { enum: RESOURCE_TYPES }).notNull().default("other"),
    version: text("version").notNull().default("1.0.0"),
    accessLevel: text("access_level", { enum: RESOURCE_ACCESS_LEVELS }).notNull().default("learner"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [index("trade_learning_resource_module_idx").on(t.moduleId)],
);
