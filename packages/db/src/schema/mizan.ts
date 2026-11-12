import { sql } from "drizzle-orm";
import { boolean, check, date, doublePrecision, index, integer, jsonb, pgSchema, primaryKey, smallint, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { EvidenceCode } from "@entrust/mizan-rules";
import {
  ASSESSMENT_KINDS,
  ASSESSMENT_STATUSES,
  CONSENT_KINDS,
  CONSENT_METHODS,
  CONSENT_SOURCES,
  DOCUMENT_CATEGORIES,
  GATE_STATUSES,
  PROGRAMMES,
  REVIEW_DECISIONS,
  STATEMENT_BASES,
  SUPPORT_TYPES,
  type FinancialYear,
  type Programme,
} from "@entrust/mizan-engine";
import { organization, user } from "./auth";
import { file } from "./core";

// MIZAN, the SME Financial Readiness Standard (#219, #222). Its tables reference core (organisations, users, files, the SME
// profile by organisation) and never clear, trade or summit. The audit log is shared and lives in core, with platform = 'mizan'.
// The fixed lists come from @entrust/mizan-engine. No table has a column for a national ID or passport number, on purpose.
export const mizan = pgSchema("mizan");

/** Stored ratings: a score 0 to 4, or not evidenced, unverified, not applicable. */
export const STORED_RATINGS = ["0", "1", "2", "3", "4", "NE", "UV", "NA"] as const;
export type StoredRating = (typeof STORED_RATINGS)[number];

/** Where a document came from: uploaded by staff, or a TRADE or CLEAR export (needs the data permission). */
export const DOCUMENT_SOURCES = ["staff", "trade", "clear"] as const;
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];

/** Whether a support relationship was recorded in MIZAN or derived from TRADE's records (#226). */
export const SUPPORT_SOURCES = ["mizan", "trade"] as const;
export type SupportSource = (typeof SUPPORT_SOURCES)[number];

const now = (name: string) => timestamp(name, { withTimezone: true }).defaultNow().notNull();
const at = (name: string) => timestamp(name, { withTimezone: true });
const by = (name: string) => text(name).references(() => user.id, { onDelete: "set null" });
const smeOrg = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

// What MIZAN keeps about an SME beyond the shared profile (core.sme_profile): programme tags, legal form, the date it started
// trading (for months operating) and a business contact. One row per SME organisation.
export const mizanSme = mizan.table("sme", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  programmes: jsonb("programmes").$type<Programme[]>().notNull().default([]),
  legalForm: text("legal_form"),
  operatingSince: date("operating_since"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  createdBy: by("created_by"),
  createdAt: now("created_at"),
  updatedAt: now("updated_at").$onUpdate(() => new Date()),
});

// Owners and beneficial owners. Names, roles and shares only: never an identity document number.
export const mizanOwner = mizan.table(
  "owner",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: smeOrg(),
    name: text("name").notNull(),
    role: text("role"),
    ownershipPct: doublePrecision("ownership_pct"),
    beneficialOwner: boolean("beneficial_owner").notNull().default(false),
    createdBy: by("created_by"),
    createdAt: now("created_at"),
    // Removing an owner keeps the row, so an earlier assessment still shows who owned the business then.
    removedAt: at("removed_at"),
    removedBy: by("removed_by"),
  },
  (t) => [
    index("mizan_owner_org_idx").on(t.organizationId),
    check("mizan_owner_pct_check", sql`${t.ownershipPct} is null or (${t.ownershipPct} >= 0 and ${t.ownershipPct} <= 100)`),
  ],
);

// Who trained, advised, verified or onboarded an SME (control C-1). Anyone with a relationship, open or ended, can't assess or
// approve that SME. Ending one keeps the row.
export const mizanSupportLink = mizan.table(
  "support_link",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: smeOrg(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type", { enum: SUPPORT_TYPES }).notNull(),
    note: text("note"),
    source: text("source", { enum: SUPPORT_SOURCES }).notNull().default("mizan"),
    // For a relationship derived from TRADE: what it came from, such as a cohort or passport id, so a sync doesn't repeat it.
    sourceRef: text("source_ref"),
    recordedBy: by("recorded_by"),
    recordedAt: now("recorded_at"),
    endedAt: at("ended_at"),
    endedBy: by("ended_by"),
  },
  (t) => [
    index("mizan_support_link_org_user_idx").on(t.organizationId, t.userId),
    uniqueIndex("mizan_support_link_source_uidx")
      .on(t.organizationId, t.userId, t.source, t.sourceRef)
      .where(sql`${t.sourceRef} is not null`),
  ],
);

// The wording of the data collection notice and of the permission to use TRADE and CLEAR data (#227), as data so it can be
// reworded without a release. A new wording is a new version; the latest published version of a kind is the one shown, and
// every consent records the version it was given under. Versions are never edited or deleted.
export const mizanNotice = mizan.table(
  "notice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind", { enum: CONSENT_KINDS }).notNull(),
    version: text("version").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    publishedBy: by("published_by"),
    publishedAt: now("published_at"),
  },
  (t) => [uniqueIndex("mizan_notice_kind_version_uidx").on(t.kind, t.version), index("mizan_notice_kind_published_idx").on(t.kind, t.publishedAt)],
);

// The data collection notice (required to start an assessment) and the permission to use TRADE and CLEAR data (#227). Every
// acceptance and withdrawal is kept: the latest row for a kind is the one in force.
export const mizanConsent = mizan.table(
  "consent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: smeOrg(),
    kind: text("kind", { enum: CONSENT_KINDS }).notNull(),
    accepted: boolean("accepted").notNull(),
    signatoryName: text("signatory_name").notNull(),
    signatoryRole: text("signatory_role"),
    method: text("method", { enum: CONSENT_METHODS }).notNull(),
    noticeVersion: text("notice_version").notNull(),
    source: text("source", { enum: CONSENT_SOURCES }).notNull().default("mizan"),
    // For one accepted in TRADE: the diagnostic it came from.
    sourceRef: text("source_ref"),
    givenAt: at("given_at").notNull(),
    // A signed paper notice, scanned.
    fileId: uuid("file_id").references(() => file.id, { onDelete: "set null" }),
    capturedBy: by("captured_by"),
    capturedAt: now("captured_at"),
    withdrawnAt: at("withdrawn_at"),
    withdrawnBy: by("withdrawn_by"),
  },
  (t) => [
    index("mizan_consent_org_kind_idx").on(t.organizationId, t.kind, t.givenAt),
    uniqueIndex("mizan_consent_source_uidx")
      .on(t.organizationId, t.kind, t.source, t.sourceRef)
      .where(sql`${t.sourceRef} is not null`),
  ],
);

// One assessment of one SME, scored under the configuration version it pins. Approved assessments are frozen: a trigger in
// migration 0058 refuses any change to them or their inputs, apart from recording the assessment that supersedes them.
export const mizanAssessment = mizan.table(
  "assessment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: smeOrg(),
    // <SME ID>-A<sequence>, such as ET-SME-000001-A1. The sequence is per SME, unique, so two creates at once can't share a
    // number: the second one fails and retries with the next.
    sequence: integer("sequence").notNull(),
    assessmentNo: text("assessment_no").notNull().unique(),
    kind: text("kind", { enum: ASSESSMENT_KINDS }).notNull().default("initial"),
    previousAssessmentId: uuid("previous_assessment_id").references((): AnyPgColumn => mizanAssessment.id),
    supersededById: uuid("superseded_by_id").references((): AnyPgColumn => mizanAssessment.id),
    // Why a follow-on record was made (amendment, rescore or reassessment).
    reason: text("reason"),
    methodology: text("methodology").notNull(),
    configVersion: text("config_version").notNull(),
    configFingerprint: text("config_fingerprint").notNull(),
    engineVersion: text("engine_version").notNull(),
    countryModule: text("country_module").notNull(),
    industry: text("industry"),
    currency: text("currency").notNull(),
    status: text("status", { enum: ASSESSMENT_STATUSES }).notNull().default("draft"),
    assessorUserId: text("assessor_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    reviewerUserId: text("reviewer_user_id").references(() => user.id, { onDelete: "restrict" }),
    // The largest customer's share of revenue, 0 to 1.
    topCustomerShare: doublePrecision("top_customer_share"),
    monthsOperating: integer("months_operating"),
    // The exact text that was hashed at approval. Text, not jsonb: jsonb reorders keys and would break the hash.
    resultJson: text("result_json"),
    resultSha256: text("result_sha256"),
    // A random code printed on the report for the public verification page (#239). Never the guessable assessment number.
    verificationCode: text("verification_code").unique(),
    createdAt: now("created_at"),
    updatedAt: now("updated_at").$onUpdate(() => new Date()),
    submittedAt: at("submitted_at"),
    approvedAt: at("approved_at"),
  },
  (t) => [
    uniqueIndex("mizan_assessment_org_sequence_uidx").on(t.organizationId, t.sequence),
    // One open assessment per SME at a time (decision in #219).
    uniqueIndex("mizan_assessment_one_open_uidx")
      .on(t.organizationId)
      .where(sql`${t.status} in ('draft', 'in_review', 'returned')`),
    index("mizan_assessment_status_idx").on(t.status, t.submittedAt),
    index("mizan_assessment_assessor_idx").on(t.assessorUserId),
    check(
      "mizan_assessment_frozen_check",
      sql`(${t.status} = 'approved') = (${t.resultJson} is not null and ${t.resultSha256} is not null and ${t.verificationCode} is not null and ${t.approvedAt} is not null and ${t.reviewerUserId} is not null)`,
    ),
    check("mizan_assessment_share_check", sql`${t.topCustomerShare} is null or (${t.topCustomerShare} >= 0 and ${t.topCustomerShare} <= 1)`),
    check("mizan_assessment_reviewer_check", sql`${t.reviewerUserId} is null or ${t.reviewerUserId} <> ${t.assessorUserId}`),
    check("mizan_assessment_follow_on_check", sql`(${t.kind} = 'initial') = (${t.previousAssessmentId} is null)`),
  ],
);

// One fiscal year of statements for an assessment, as the engine reads it (amounts in the assessment's currency).
export const mizanFinancialYear = mizan.table(
  "financial_year",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => mizanAssessment.id, { onDelete: "cascade" }),
    fiscalYear: text("fiscal_year").notNull(),
    statementBasis: text("statement_basis", { enum: STATEMENT_BASES }).notNull(),
    data: jsonb("data").$type<Omit<FinancialYear, "fiscalYear">>().notNull(),
    updatedBy: by("updated_by"),
    updatedAt: now("updated_at").$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("mizan_financial_year_uidx").on(t.assessmentId, t.fiscalYear)],
);

export const mizanRating = mizan.table(
  "rating",
  {
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => mizanAssessment.id, { onDelete: "cascade" }),
    criterionId: text("criterion_id").notNull(),
    rating: text("rating", { enum: STORED_RATINGS }).notNull(),
    evidence: text("evidence").$type<EvidenceCode>(),
    note: text("note"),
    // The interim suggestion when the rating was saved, kept for the review.
    suggested: smallint("suggested"),
    updatedBy: by("updated_by"),
    updatedAt: now("updated_at").$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.assessmentId, t.criterionId] }),
    check("mizan_rating_value_check", sql`${t.rating} in ('0', '1', '2', '3', '4', 'NE', 'UV', 'NA')`),
    check("mizan_rating_evidence_check", sql`${t.evidence} is null or ${t.evidence} in ('E1', 'E2', 'E3', 'E4', 'E5')`),
    check("mizan_rating_suggested_check", sql`${t.suggested} is null or ${t.suggested} between 0 and 4`),
  ],
);

export const mizanGateResult = mizan.table(
  "gate_result",
  {
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => mizanAssessment.id, { onDelete: "cascade" }),
    gateId: text("gate_id").notNull(),
    status: text("status", { enum: GATE_STATUSES }).notNull(),
    note: text("note"),
    updatedBy: by("updated_by"),
    updatedAt: now("updated_at").$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.assessmentId, t.gateId] })],
);

// Overrides the assessor triggered. The automatic one (negative equity and cash flow) is never stored: the engine works it out.
export const mizanOverrideFlag = mizan.table(
  "override_flag",
  {
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => mizanAssessment.id, { onDelete: "cascade" }),
    overrideId: text("override_id").notNull(),
    triggered: boolean("triggered").notNull(),
    reason: text("reason"),
    updatedBy: by("updated_by"),
    updatedAt: now("updated_at").$onUpdate(() => new Date()),
  },
  (t) => [
    primaryKey({ columns: [t.assessmentId, t.overrideId] }),
    check("mizan_override_reason_check", sql`not ${t.triggered} or coalesce(trim(${t.reason}), '') <> ''`),
  ],
);

// Each review decision. Approval needs the reviewer's declaration that they didn't assess or support the SME.
export const mizanReview = mizan.table(
  "review",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => mizanAssessment.id, { onDelete: "restrict" }),
    reviewerUserId: text("reviewer_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    decision: text("decision", { enum: REVIEW_DECISIONS }).notNull(),
    comments: text("comments"),
    declarationConfirmed: boolean("declaration_confirmed").notNull(),
    createdAt: now("created_at"),
  },
  (t) => [
    index("mizan_review_assessment_idx").on(t.assessmentId, t.createdAt),
    check("mizan_review_declaration_check", sql`${t.decision} <> 'approved' or ${t.declarationConfirmed}`),
    check("mizan_review_comments_check", sql`${t.decision} <> 'returned' or coalesce(trim(${t.comments}), '') <> ''`),
  ],
);

// Evidence for an SME, optionally tied to one assessment and some of its criteria. The file itself is in core.file (R2).
export const mizanDocument = mizan.table(
  "document",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: smeOrg(),
    assessmentId: uuid("assessment_id").references(() => mizanAssessment.id, { onDelete: "restrict" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => file.id, { onDelete: "restrict" }),
    category: text("category", { enum: DOCUMENT_CATEGORIES }).notNull(),
    criterionIds: jsonb("criterion_ids").$type<string[]>().notNull().default([]),
    source: text("source", { enum: DOCUMENT_SOURCES }).notNull().default("staff"),
    uploadedBy: by("uploaded_by"),
    createdAt: now("created_at"),
    removedAt: at("removed_at"),
    removedBy: by("removed_by"),
  },
  (t) => [index("mizan_document_org_idx").on(t.organizationId), index("mizan_document_assessment_idx").on(t.assessmentId)],
);

// An assessment's own history, as clear.case_event is a case's: what happened, by whom, when. core.audit_log has the full
// before and after.
export const mizanAssessmentEvent = mizan.table(
  "assessment_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    assessmentId: uuid("assessment_id")
      .notNull()
      .references(() => mizanAssessment.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    data: jsonb("data"),
    actorUserId: by("actor_user_id"),
    occurredAt: now("occurred_at"),
  },
  (t) => [index("mizan_assessment_event_idx").on(t.assessmentId, t.occurredAt)],
);
