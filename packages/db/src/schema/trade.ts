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
} from "drizzle-orm/pg-core";
import {
  ASSESSMENT_STATUSES,
  EVIDENCE_CONFIDENCE,
  EVIDENCE_REVIEW_STATUSES,
  ENROLLMENT_STATUSES,
  EXPORT_OUTCOME_STATUSES,
  FINANCING_OUTCOME_STATUSES,
  LEARNING_PLAN_STATUSES,
  MODULE_PROGRESS_STATUSES,
  MODULE_STATUSES,
  OPPORTUNITY_STATUSES,
} from "@entrust/trade-engine";
import { MODULE_IDS, PATHWAYS } from "@entrust/trade-rules";
import { organization, user } from "./auth";
import { file } from "./core";

// TRADE platform PostgreSQL schema (#55).
// All tables reference core (organization, smeProfile, user, file) and never clear.
export const trade = pgSchema("trade");

export const DELIVERY_MODES = ["self_paced", "live", "hybrid"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

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

// A capability score for one domain or trigger group from an assessment.
export const capabilityScore = trade.table(
  "capability_score",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => tradeAssessment.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    points: integer("points").notNull(),
    maxPoints: integer("max_points").notNull(),
    coverage: numeric("coverage", { precision: 5, scale: 4 }).notNull(),
    score: integer("score"),
    band: text("band"),
    evidenceStatus: text("evidence_status", { enum: EVIDENCE_CONFIDENCE }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("trade_capability_score_assessment_domain_uidx").on(t.assessmentId, t.domain),
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
    status: text("status", { enum: LEARNING_PLAN_STATUSES }).notNull().default("generated"),
    requiresHumanReview: boolean("requires_human_review").notNull().default(false),
    reviewReasons: text("review_reasons")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    supersededById: uuid("superseded_by_id"),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
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
    completedAt: timestamp("completed_at", { withTimezone: true }),
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
    status: text("status", { enum: EVIDENCE_REVIEW_STATUSES }).notNull().default("not_submitted"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_evidence_record_org_idx").on(t.organizationId),
    index("trade_evidence_record_enrollment_idx").on(t.enrollmentId),
  ],
);

// A commercial opportunity tracked for an enrolled SME.
export const commercialOpportunity = trade.table(
  "commercial_opportunity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id").references(() => enrollment.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    buyerName: text("buyer_name"),
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
  ],
);

export const OUTCOME_KINDS = ["financing", "export"] as const;
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

// A financing or export outcome for an enrolled SME.
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
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("trade_outcome_org_idx").on(t.organizationId),
    index("trade_outcome_enrollment_idx").on(t.enrollmentId),
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
}));

export const evidenceRecordRelations = relations(evidenceRecord, ({ one }) => ({
  organization: one(organization, {
    fields: [evidenceRecord.organizationId],
    references: [organization.id],
  }),
  enrollment: one(enrollment, { fields: [evidenceRecord.enrollmentId], references: [enrollment.id] }),
  file: one(file, { fields: [evidenceRecord.fileId], references: [file.id] }),
}));

export const commercialOpportunityRelations = relations(commercialOpportunity, ({ one }) => ({
  organization: one(organization, {
    fields: [commercialOpportunity.organizationId],
    references: [organization.id],
  }),
  enrollment: one(enrollment, {
    fields: [commercialOpportunity.enrollmentId],
    references: [enrollment.id],
  }),
}));

export const tradeOutcomeRelations = relations(outcome, ({ one }) => ({
  organization: one(organization, {
    fields: [outcome.organizationId],
    references: [organization.id],
  }),
  enrollment: one(enrollment, { fields: [outcome.enrollmentId], references: [enrollment.id] }),
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
