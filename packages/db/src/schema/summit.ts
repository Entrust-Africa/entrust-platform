import { isNull, sql } from "drizzle-orm";
import { check, index, jsonb, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Answers } from "@entrust/forms";
import {
  APPLICATION_STATUSES,
  DOCUMENT_KINDS,
  ELIGIBILITY_OUTCOMES,
  OPPORTUNITY_PATHWAYS,
  type CriterionResult,
  type EligibilityCriterionId,
} from "@entrust/summit-engine";
import { organization, user } from "./auth";
import { file } from "./core";

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
