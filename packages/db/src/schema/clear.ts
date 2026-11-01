import { isNull, relations, sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { COFFEE_TYPES, EVIDENCE_STATUSES, PRICE_UNITS, RECORDED_STATUSES, type CaseFacts, type FieldChange } from "@entrust/gate-engine";
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
    // The unit price as the parties wrote it, such as 6.61 USD per kg. All three are set or none.
    unitPrice: numeric("unit_price", { precision: 14, scale: 4 }),
    priceCurrency: text("price_currency"),
    priceUnit: text("price_unit", { enum: PRICE_UNITS }),
    // What the contract sells, for the minimum export price check (coffee).
    coffeeType: text("coffee_type", { enum: COFFEE_TYPES }),
    grade: text("grade"),
    origin: text("origin"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("sales_contract_org_idx").on(t.organizationId),
    check(
      "sales_contract_unit_price_check",
      sql`(${t.unitPrice} is null) = (${t.priceCurrency} is null) and (${t.unitPrice} is null) = (${t.priceUnit} is null) and (${t.unitPrice} is null or ${t.unitPrice} > 0)`,
    ),
  ],
);

/**
 * - csv: uploaded as a file
 * - manual: typed in
 */
export const PRICE_TABLE_SOURCES = ["csv", "manual"] as const;

// One upload or one manual entry of ECTA's weekly minimum export prices. Tables are never edited
// or deleted: a corrected table is a new one, and the latest table that covers a day decides.
export const minimumPriceTable = clear.table("minimum_price_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  source: text("source", { enum: PRICE_TABLE_SOURCES }).notNull(),
  // The file name, or a note the admin gave.
  label: text("label"),
  createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One price: a minimum for a coffee, valid from effective_from to effective_to, both days included.
export const minimumPrice = clear.table(
  "minimum_price",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tableId: uuid("table_id")
      .notNull()
      .references(() => minimumPriceTable.id, { onDelete: "cascade" }),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }).notNull(),
    coffeeType: text("coffee_type", { enum: COFFEE_TYPES }).notNull(),
    grade: text("grade").notNull(),
    // Null applies to every origin.
    origin: text("origin"),
    currency: text("currency").notNull(),
    unit: text("unit", { enum: PRICE_UNITS }).notNull(),
    minPrice: numeric("min_price", { precision: 14, scale: 4 }).notNull(),
  },
  (t) => [
    index("minimum_price_lookup_idx").on(t.coffeeType, t.effectiveFrom, t.effectiveTo),
    index("minimum_price_table_idx").on(t.tableId),
    check("minimum_price_dates_check", sql`${t.effectiveTo} >= ${t.effectiveFrom}`),
    check("minimum_price_amount_check", sql`${t.minPrice} > 0`),
  ],
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
    // Set on a practice case: TRADE's M08 runs a simulated export on a CLEAR case, and this names the
    // scenario it was started from. Null on every real case. A practice case is left out of CLEAR's lists,
    // queues, checks and reports (see realCase), and no real case number is spent on it.
    practiceScenario: text("practice_scenario"),
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
    // One practice case per scenario for an organisation. Resetting it starts the scenario again.
    uniqueIndex("export_case_practice_uidx")
      .on(t.organizationId, t.practiceScenario)
      .where(sql`${t.practiceScenario} is not null`),
    check(
      "export_case_rule_pack_check",
      sql`(${t.rulePackId} is null) = (${t.rulePackVersion} is null)`,
    ),
  ],
);

/**
 * Keeps practice cases out of a query. Every CLEAR reader of export_case that isn't about one case the
 * caller asked for by id uses it: lists, queues, the scheduled flag check, deadline reminders and reports.
 * A practice case never counts as an outcome.
 */
export const realCase = isNull(exportCase.practiceScenario);

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

// A value read off a document, for the shipping document comparison (STEP-099): what the commercial
// invoice says the quantity is, what the bill of lading says the consignee is. A person enters
// them; there is no OCR yet. One row per case, document and field, replaced when it is corrected
// (the change is in the audit log and the case history).
export const documentField = clear.table(
  "document_field",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => exportCase.id, { onDelete: "cascade" }),
    // An evidence type id from @entrust/rules: the document the value is read from.
    document: text("document").notNull(),
    // A document field key from @entrust/rules.
    field: text("field").notNull(),
    // As the document writes it.
    value: text("value").notNull(),
    enteredByUserId: text("entered_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("document_field_case_uidx").on(t.caseId, t.document, t.field),
    check("document_field_value_check", sql`btrim(${t.value}) <> ''`),
  ],
);

/** What an amendment set back, as stored with it. */
export interface AmendmentImpact {
  /** Steps that depend on what changed and still apply. */
  affected: StepId[];
  /** Completed steps among them, which were reopened. */
  reopened: StepId[];
  /** What has to be done again before the amendment is complete: reopened steps, newly applicable ones, reopened gates. */
  reverify: StepId[];
  /** Evidence types sent back for review, if they were approved. */
  evidence: string[];
  /** Milestone sign-offs that were reopened. */
  unlocked: StepId[];
}

// A change to a case's facts, contract or letter of credit after a phase gate was signed. Version 1
// is the case as it was first recorded; each amendment is the next version and keeps the fields it
// changed, before and after, and why. An amendment is pending until everything it set back is done
// again (resolved_at), and the case is "amendments pending" while any is.
export const caseAmendment = clear.table(
  "case_amendment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => exportCase.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    reason: text("reason").notNull(),
    changes: jsonb("changes").$type<FieldChange[]>().notNull(),
    impact: jsonb("impact").$type<AmendmentImpact>().notNull(),
    madeByUserId: text("made_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("case_amendment_version_uidx").on(t.caseId, t.version),
    check("case_amendment_version_check", sql`${t.version} >= 2`),
    check("case_amendment_reason_check", sql`btrim(${t.reason}) <> ''`),
  ],
);

/**
 * - open: the situation holds, and the steps the flag lists are held
 * - waived: the situation holds, but an Entrust reviewer or admin accepted it, with a reason; nothing is held
 * - resolved: the situation cleared
 */
export const FLAG_STATUSES = ["open", "waived", "resolved"] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];
export const FLAG_SEVERITIES = ["critical", "high", "medium"] as const;

// A failure rule (FL-01 to FL-14) that fired on a case. A case has at most one active (open or
// waived) flag per rule: when the rule stops firing the flag resolves, and if it fires again it
// is a new flag, so the history of each occurrence stays.
export const caseFlag = clear.table(
  "case_flag",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => exportCase.id, { onDelete: "cascade" }),
    // A failure rule id from @entrust/rules.
    rule: text("rule").notNull(),
    // The rule's severity when it fired, so a later change to the rule leaves the flag alone.
    severity: text("severity", { enum: FLAG_SEVERITIES }).notNull(),
    status: text("status", { enum: FLAG_STATUSES }).notNull().default("open"),
    // Why it fired, in words.
    message: text("message").notNull(),
    // The steps held while the flag is open.
    blocks: jsonb("blocks").$type<StepId[]>().notNull().default([]),
    raisedAt: timestamp("raised_at", { withTimezone: true }).defaultNow().notNull(),
    waivedAt: timestamp("waived_at", { withTimezone: true }),
    waivedByUserId: text("waived_by_user_id").references(() => user.id, { onDelete: "set null" }),
    waiveReason: text("waive_reason"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    index("case_flag_case_idx").on(t.caseId, t.raisedAt),
    uniqueIndex("case_flag_active_uidx")
      .on(t.caseId, t.rule)
      .where(sql`${t.status} <> 'resolved'`),
    check(
      "case_flag_waiver_check",
      sql`${t.status} <> 'waived' or (${t.waiveReason} is not null and ${t.waivedAt} is not null)`,
    ),
    check("case_flag_resolved_check", sql`(${t.status} = 'resolved') = (${t.resolvedAt} is not null)`),
  ],
);

export const salesContractRelations = relations(salesContract, ({ many }) => ({
  cases: many(exportCase),
}));

export const minimumPriceTableRelations = relations(minimumPriceTable, ({ many }) => ({
  prices: many(minimumPrice),
}));

export const minimumPriceRelations = relations(minimumPrice, ({ one }) => ({
  table: one(minimumPriceTable, { fields: [minimumPrice.tableId], references: [minimumPriceTable.id] }),
}));

export const exportCaseRelations = relations(exportCase, ({ one, many }) => ({
  salesContract: one(salesContract, {
    fields: [exportCase.salesContractId],
    references: [salesContract.id],
  }),
  steps: many(caseStep),
  evidence: many(evidence),
  events: many(caseEvent),
  flags: many(caseFlag),
  documentFields: many(documentField),
  amendments: many(caseAmendment),
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

export const caseAmendmentRelations = relations(caseAmendment, ({ one }) => ({
  case: one(exportCase, { fields: [caseAmendment.caseId], references: [exportCase.id] }),
}));

export const documentFieldRelations = relations(documentField, ({ one }) => ({
  case: one(exportCase, { fields: [documentField.caseId], references: [exportCase.id] }),
}));

export const caseFlagRelations = relations(caseFlag, ({ one }) => ({
  case: one(exportCase, { fields: [caseFlag.caseId], references: [exportCase.id] }),
}));
