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
} from "drizzle-orm/pg-core";
import {
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
import { organization, user } from "./auth";
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

