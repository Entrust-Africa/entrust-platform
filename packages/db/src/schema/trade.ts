import { sql } from "drizzle-orm";
import {
  boolean,
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
  ENROLLMENT_STATUSES,
  LEARNING_PLAN_STATUSES,
} from "@entrust/trade-engine";
import { PATHWAYS } from "@entrust/trade-rules";
import { organization, user } from "./auth";

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

export const ASSESSMENT_KINDS = ["placement", "exit"] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

// An assessment of an enrolment (placement or exit). Scores are written once; a new assessment
// supersedes the old one, and nothing is overwritten.
// At most one placement assessment per enrolment is live (not superseded) at a time.
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



