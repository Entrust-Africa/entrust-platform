import { relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { EVIDENCE_STATUSES, RECORDED_STATUSES, type CaseFacts } from "@entrust/gate-engine";
import type { PhaseId, StepId } from "@entrust/rules";
import { organization, user } from "./auth";

// CLEAR Export's tables. Users, organisations and the audit log are shared and live in core.
export const clear = pgSchema("clear");

/**
 * - open: being worked
 * - amendments_pending: the contract or LC changed after a phase gate locked; dependent steps are re-verified
 * - closed: payment reconciled and the case closed
 * - cancelled: stopped before closure
 */
export const CASE_STATUSES = ["open", "amendments_pending", "closed", "cancelled"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

// A buyer contract. One contract can produce several cases, each one shipment with its own
// bank permit and 90-day repatriation clock (Entrust, Q4).
export const salesContract = clear.table(
  "sales_contract",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    // The contract or purchase order number, as the parties wrote it.
    number: text("number").notNull(),
    buyerName: text("buyer_name").notNull(),
    contractDate: date("contract_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("sales_contract_org_idx").on(t.organizationId)],
);

// The last case number handed out per origin country and year. It only goes up, so a
// deleted case's reference is never reused. See allocateCaseReference.
export const caseReferenceCounter = clear.table(
  "case_reference_counter",
  {
    country: text("country").notNull(),
    year: integer("year").notNull(),
    lastNumber: integer("last_number").notNull(),
  },
  (t) => [primaryKey({ columns: [t.country, t.year] })],
);

// One export case: one shipment of one product to one destination.
export const exportCase = clear.table(
  "export_case",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // CLR-ET-2026-000145, from allocateCaseReference.
    reference: text("reference").notNull().unique(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id),
    // Set once the contract is recorded in phase 2.
    salesContractId: uuid("sales_contract_id").references(() => salesContract.id),
    // The facts the GATE engine evaluates. Product and destination are read from them, so a
    // list filter and the engine never disagree; both are known when the case opens.
    facts: jsonb("facts").$type<CaseFacts>().notNull().default({}),
    product: text("product")
      .notNull()
      .generatedAlwaysAs(sql`facts ->> 'product'`),
    destinationCountry: text("destination_country")
      .notNull()
      .generatedAlwaysAs(sql`facts ->> 'destinationCountry'`),
    // The rule pack version the case was created with. Publishing a new version leaves it alone.
    // Both are null while the case runs on the canonical steps only.
    rulePackId: text("rule_pack_id"),
    rulePackVersion: text("rule_pack_version"),
    // Updated from the engine's phase gates, so lists can filter without evaluating every case.
    currentPhase: smallint("current_phase").$type<PhaseId>().notNull().default(1),
    status: text("status", { enum: CASE_STATUSES }).notNull().default("open"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("export_case_org_idx").on(t.organizationId, t.status),
    index("export_case_status_idx").on(t.status, t.currentPhase),
    check(
      "export_case_rule_pack_check",
      sql`(${t.rulePackId} is null) = (${t.rulePackVersion} is null)`,
    ),
  ],
);

// What has been recorded for a step on a case. A step with nothing recorded has no row.
export const caseStep = clear.table(
  "case_step",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => exportCase.id, { onDelete: "cascade" }),
    stepId: text("step_id").$type<StepId>().notNull(),
    status: text("status", { enum: RECORDED_STATUSES }).notNull().default("not_started"),
    notApplicableReason: text("not_applicable_reason"),
    // The person responsible on this case. The step definition says which party acts.
    ownerUserId: text("owner_user_id").references(() => user.id, { onDelete: "set null" }),
    // Exception steps only: when it was raised. It stays set after the exception is resolved.
    raisedAt: timestamp("raised_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("case_step_case_step_uidx").on(t.caseId, t.stepId),
    check(
      "case_step_not_applicable_reason_check",
      sql`${t.status} <> 'not_applicable' or ${t.notApplicableReason} is not null`,
    ),
  ],
);

// A document or record submitted for a case. Each submission is a new row; for each type the
// latest one decides whether the requirement is met. Only approved evidence satisfies it.
export const evidence = clear.table(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => exportCase.id, { onDelete: "cascade" }),
    // An evidence type id from @entrust/rules.
    type: text("type").notNull(),
    // The uploaded file in core.file (the foreign key comes with file uploads). Null for
    // evidence recorded without a file, such as a lookup result.
    fileId: uuid("file_id"),
    status: text("status", { enum: EVIDENCE_STATUSES }).notNull().default("submitted"),
    // The issue date on the document. The type's validity period runs from it.
    issuedOn: date("issued_on", { mode: "string" }),
    // Approved evidence counts as expired after this day.
    validUntil: date("valid_until", { mode: "string" }),
    submittedByUserId: text("submitted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).defaultNow().notNull(),
    reviewerUserId: text("reviewer_user_id").references(() => user.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("evidence_case_type_idx").on(t.caseId, t.type)],
);

// Append-only history of a case. Deadline clocks run from it, so occurredAt is when the thing
// happened (a permit's issue date, the on-board date), which can be before it was recorded.
export const caseEvent = clear.table(
  "case_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => exportCase.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    stepId: text("step_id").$type<StepId>(),
    evidenceId: uuid("evidence_id").references(() => evidence.id, { onDelete: "set null" }),
    data: jsonb("data"),
    // Null when CLEAR did it.
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("case_event_case_idx").on(t.caseId, t.occurredAt)],
);

export const salesContractRelations = relations(salesContract, ({ many }) => ({
  cases: many(exportCase),
}));

export const exportCaseRelations = relations(exportCase, ({ one, many }) => ({
  salesContract: one(salesContract, {
    fields: [exportCase.salesContractId],
    references: [salesContract.id],
  }),
  steps: many(caseStep),
  evidence: many(evidence),
  events: many(caseEvent),
}));

export const caseStepRelations = relations(caseStep, ({ one }) => ({
  case: one(exportCase, { fields: [caseStep.caseId], references: [exportCase.id] }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  case: one(exportCase, { fields: [evidence.caseId], references: [exportCase.id] }),
}));

export const caseEventRelations = relations(caseEvent, ({ one }) => ({
  case: one(exportCase, { fields: [caseEvent.caseId], references: [exportCase.id] }),
  evidence: one(evidence, { fields: [caseEvent.evidenceId], references: [evidence.id] }),
}));
