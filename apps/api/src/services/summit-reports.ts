import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  REPORTS,
  applicationSeeksInvestment,
  applyFilters,
  documentAccessOf,
  exportScope,
  findReport,
  inScope,
  reportAnswers,
  selectionNumbers,
  waitlistPositions,
  type ApplicationStatus,
  type DocumentKind,
  type ExportRole,
  type ExportScope,
  type ReportApplication,
  type ReportDefinition,
  type ReportFilters,
  type ReportId,
} from "@entrust/summit-engine";
import type { ReportCatalogueView, ReportTableView } from "../schemas/summit";
import type { Ctx, Principal } from "./access";
import { COMMITTEE_ROLE } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { CONTENT_TYPES, render, type ExportFormat, type ExportTable } from "./export";
import { pickPeriod, type PeriodRow } from "./summit-committee";
import { templateOf } from "./summit-applications";
import { scoreApplications } from "./summit-scores";
import { recordSummitChange } from "./summit-status";

// The twelve reports of the specification's section 11 (#80). Every report is a view of the same application records the
// rest of the platform reads, gathered once here, so a change of status shows up in all of them. What a person's export
// holds is decided before anything is built: their role gives a scope, a filter can only narrow it, and every format and
// every request goes through the same check.

export const SUMMIT_NAME = "Africa Diaspora Trade and Investment Summit";

const CLASSIFICATIONS = {
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
  external_approved: "External (approved)",
} as const;

/** The role that decides what the caller may export, or null for anyone who may export nothing. */
function exportRole(principal: Principal): ExportRole | null {
  const { staffRole } = principal;
  if (staffRole === "admin" || staffRole === "facilitator" || staffRole === "reviewer") return staffRole;
  return principal.committee ? "committee" : null;
}

function requireExporter(ctx: Ctx, doing: string): ExportRole {
  const role = exportRole(ctx.principal);
  if (!role) throw new ServiceError("forbidden", `Only the selection committee and Entrust staff can ${doing}.`);
  return role;
}

const reportSummary = (report: ReportDefinition) => ({
  id: report.id,
  number: report.number,
  title: report.title,
  purpose: report.purpose,
  classification: report.classification,
});

/** The reports and what the caller's export of each would hold. */
export async function listReports(ctx: Ctx): Promise<ReportCatalogueView> {
  const role = requireExporter(ctx, "see the reports");
  return {
    items: REPORTS.map((report) => ({
      ...reportSummary(report),
      scope: exportScope(report, role),
      columns: report.columns.map((c) => ({ ...c })),
    })),
  };
}

type Latest<T> = Map<string, T>;
/** Rows oldest first, so the last of each application is the current one. */
function latestOf<T extends { applicationId: string }>(rows: readonly T[]): Latest<T> {
  return new Map(rows.map((r) => [r.applicationId, r]));
}

/** Every application of the period as the reports read it. Nothing is cut down here: the caller's scope does that. */
export async function loadApplications(db: Executor, period: PeriodRow): Promise<ReportApplication[]> {
  const rows = await db
    .select({ row: schema.application, businessName: schema.organization.name, smeId: schema.smeProfile.smeId, country: schema.smeProfile.country })
    .from(schema.application)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.application.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.application.organizationId))
    .where(eq(schema.application.periodId, period.id))
    .orderBy(asc(schema.application.number));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.row.id);

  const entrustOrganizationId = process.env.ENTRUST_ORG_ID;
  const [scored, eligibility, assignments, documents, reviews, recommendations, decisions, results, [finalList], verification, moves, comments] = await Promise.all([
    scoreApplications(db, period, rows.map((r) => r.row)),
    db
      .select({ result: schema.eligibilityResult, screener: schema.user.name })
      .from(schema.eligibilityResult)
      .leftJoin(schema.user, eq(schema.user.id, schema.eligibilityResult.screenedBy))
      .where(inArray(schema.eligibilityResult.applicationId, ids))
      .orderBy(asc(schema.eligibilityResult.screenedAt)),
    db
      .select({ applicationId: schema.officerAssignment.applicationId, id: schema.user.id, name: schema.user.name })
      .from(schema.officerAssignment)
      .innerJoin(schema.user, eq(schema.user.id, schema.officerAssignment.officerUserId))
      .where(and(inArray(schema.officerAssignment.applicationId, ids), isNull(schema.officerAssignment.endedAt))),
    db
      .select({ id: schema.applicationDocument.id, applicationId: schema.applicationDocument.applicationId, kind: schema.applicationDocument.kind, name: schema.file.originalName })
      .from(schema.applicationDocument)
      .innerJoin(schema.file, eq(schema.file.id, schema.applicationDocument.fileId))
      .where(inArray(schema.applicationDocument.applicationId, ids))
      .orderBy(asc(schema.applicationDocument.addedAt)),
    db.select().from(schema.assessmentReview).where(inArray(schema.assessmentReview.applicationId, ids)).orderBy(asc(schema.assessmentReview.reviewedAt)),
    db.select().from(schema.applicationRecommendation).where(inArray(schema.applicationRecommendation.applicationId, ids)).orderBy(asc(schema.applicationRecommendation.recordedAt)),
    db
      .select({ decision: schema.committeeDecision, by: schema.user.name })
      .from(schema.committeeDecision)
      .leftJoin(schema.user, eq(schema.user.id, schema.committeeDecision.decidedBy))
      .where(inArray(schema.committeeDecision.applicationId, ids))
      .orderBy(asc(schema.committeeDecision.decidedAt)),
    db.select().from(schema.applicationResult).where(inArray(schema.applicationResult.applicationId, ids)),
    db.select().from(schema.finalList).where(eq(schema.finalList.periodId, period.id)),
    db
      .select({ record: schema.verificationRecord, by: schema.user.name })
      .from(schema.verificationRecord)
      .leftJoin(schema.user, eq(schema.user.id, schema.verificationRecord.recordedBy))
      .where(inArray(schema.verificationRecord.applicationId, ids))
      .orderBy(asc(schema.verificationRecord.recordedAt)),
    db
      .select({ applicationId: schema.applicationStatusChange.applicationId, to: schema.applicationStatusChange.toStatus, at: schema.applicationStatusChange.changedAt })
      .from(schema.applicationStatusChange)
      .where(inArray(schema.applicationStatusChange.applicationId, ids))
      .orderBy(asc(schema.applicationStatusChange.changedAt)),
    // What members of the selection committee wrote about an application. An officer's notes are not the committee's.
    entrustOrganizationId
      ? db
          .select({ applicationId: schema.internalComment.applicationId, body: schema.internalComment.body })
          .from(schema.internalComment)
          .innerJoin(
            schema.member,
            and(
              eq(schema.member.userId, schema.internalComment.authorUserId),
              eq(schema.member.organizationId, entrustOrganizationId),
              eq(schema.member.role, COMMITTEE_ROLE),
            ),
          )
          .where(inArray(schema.internalComment.applicationId, ids))
          .orderBy(asc(schema.internalComment.createdAt))
      : [],
  ]);

  const latestEligibility = latestOf(eligibility.map((e) => ({ ...e.result, screener: e.screener })));
  const officerOf = new Map(assignments.map((a) => [a.applicationId, { id: a.id, name: a.name }]));
  const filesOf = new Map<string, { id: string; name: string; kind: DocumentKind }[]>();
  for (const d of documents) filesOf.set(d.applicationId, [...(filesOf.get(d.applicationId) ?? []), { id: d.id, name: d.name, kind: d.kind }]);
  const reviewOf = latestOf(reviews);
  const recommendationOf = latestOf(recommendations);
  const decisionOf = latestOf(decisions.map((d) => ({ ...d.decision, by: d.by })));
  const resultOf = new Map(results.map((r) => [r.applicationId, r.decision]));
  const verificationOf = new Map<string, typeof verification>();
  for (const v of verification) verificationOf.set(v.record.applicationId, [...(verificationOf.get(v.record.applicationId) ?? []), v]);
  const movedOf = new Map<string, Partial<Record<ApplicationStatus, Date>>>();
  for (const m of moves) movedOf.set(m.applicationId, { ...movedOf.get(m.applicationId), [m.to]: m.at });
  const commentsOf = new Map<string, string[]>();
  for (const c of comments) commentsOf.set(c.applicationId, [...(commentsOf.get(c.applicationId) ?? []), c.body]);

  const applications = rows.map(({ row, businessName, smeId, country }): ReportApplication => {
    const template = templateOf(row.templateVersion);
    const score = scored.get(row.id);
    const result = score?.result ?? null;
    const pathway = score?.pathway ?? row.pathway ?? null;
    const files = filesOf.get(row.id) ?? [];
    const required = pathway && score ? score.rules.eligibility.requiredDocuments[pathway] : [];
    const screened = latestEligibility.get(row.id);
    const review = reviewOf.get(row.id);
    const recommendation = recommendationOf.get(row.id);
    const decision = decisionOf.get(row.id);
    return {
      id: row.id,
      number: row.number,
      businessName,
      smeId,
      country,
      status: row.status,
      pathway,
      seeksInvestment: score?.assessment?.seekingInvestment ?? applicationSeeksInvestment(template, row.answers),
      createdAt: row.createdAt,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
      answers: reportAnswers(template, row.answers),
      officer: officerOf.get(row.id) ?? null,
      eligibility: screened
        ? {
            outcome: screened.outcome,
            criteria: screened.criteria,
            missingDocuments: screened.missingDocuments,
            screenedAt: screened.screenedAt,
            screenedBy: screened.screener,
          }
        : null,
      documents: { missing: required.filter((kind) => !files.some((f) => f.kind === kind)), files: files.map(({ name, kind }) => ({ name, kind })) },
      assessment: score?.assessment ? { startedAt: score.assessment.startedAt, completedAt: score.assessment.completedAt } : null,
      score: result
        ? {
            points: result.points ?? null,
            possible: result.possible,
            total: result.total ?? null,
            categories: result.categories.map((c) => ({ id: c.id, applicable: c.applicable, points: c.points ?? null })),
          }
        : null,
      review: review ? { decision: review.decision, at: review.reviewedAt } : null,
      recommendation: recommendation ? { id: recommendation.recommendation, suitable: recommendation.suitableOpportunity, at: recommendation.recordedAt } : null,
      decision: decision ? { decision: decision.decision, reason: decision.reason, by: decision.by, at: decision.decidedAt } : null,
      result: resultOf.get(row.id) ?? null,
      finalListApprovedAt: finalList?.approvedAt ?? null,
      verification: (verificationOf.get(row.id) ?? []).map(({ record, by }) => ({
        claim: record.claim,
        class: record.class,
        // The documents the officer named as support. A document that has since been removed is simply not listed.
        files: record.documentIds.flatMap((id) => files.filter((f) => f.id === id).map(({ name, kind }) => ({ name, kind }))),
        check: record.independentCheck,
        by,
        at: record.recordedAt,
      })),
      movedTo: movedOf.get(row.id) ?? {},
      committeeComments: commentsOf.get(row.id) ?? [],
      selectionNumber: null,
      waitlistPosition: null,
    };
  });

  // Numbered across the whole period, so a filter or a narrower scope never renumbers anyone.
  const selected = selectionNumbers(applications);
  const waiting = waitlistPositions(applications);
  return applications.map((a) => ({ ...a, selectionNumber: selected.get(a.id) ?? null, waitlistPosition: waiting.get(a.id) ?? null }));
}

export interface ReportQuery extends ReportFilters {
  periodId?: string | undefined;
}

const describeFilters = (filters: ReportFilters): string => {
  const parts = [
    filters.country && `Country: ${filters.country.toUpperCase()}`,
    filters.status && `Status: ${filters.status.replaceAll("_", " ")}`,
    filters.pathway && `Pathway: ${filters.pathway.replaceAll("_", " ")}`,
    filters.sector && `Industry contains: ${filters.sector}`,
  ].filter(Boolean);
  return parts.length ? parts.join("; ") : "None";
};

/** The filters that were set, without the ones that weren't. */
const setFilters = (query: ReportQuery): Record<string, string> =>
  Object.fromEntries(
    (["country", "status", "pathway", "sector"] as const).flatMap((key) => (query[key] ? [[key, key === "country" ? (query[key] as string).toUpperCase() : (query[key] as string)]] : [])),
  );

interface Built {
  definition: ReportDefinition;
  period: PeriodRow;
  role: ExportRole;
  scope: ExportScope;
  filters: Record<string, string>;
  table: ExportTable;
  generatedBy: string;
}

async function buildTable(ctx: Ctx, id: ReportId, query: ReportQuery): Promise<Built> {
  const role = requireExporter(ctx, "export reports");
  const definition = findReport(id);
  if (!definition) throw new ServiceError("not_found", "No such report.");
  const period = await pickPeriod(ctx.db, query.periodId);
  if (!period) throw new ServiceError("not_found", query.periodId ? "No such application period." : "There is no application period yet.");

  // The scope comes first. A filter, a format or a direct request for the file can only narrow what it lets through.
  const scope = exportScope(definition, role);
  const everything = await loadApplications(ctx.db, period);
  const filters = setFilters(query);
  const visible = applyFilters(inScope(everything, scope, ctx.principal.userId), filters);
  const rows = definition.build(visible, {
    period: { name: period.name, countries: period.countries },
    documents: documentAccessOf(role),
    filtered: Object.keys(filters).length > 0,
  });

  const [generator] = await ctx.db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
  const generatedBy = generator?.name ?? ctx.principal.userId;
  return {
    definition,
    period,
    role,
    scope,
    filters,
    generatedBy,
    table: {
      summit: SUMMIT_NAME,
      title: definition.title,
      purpose: definition.purpose,
      period: period.name,
      generatedAt: ctx.now,
      generatedBy,
      filters: describeFilters(filters),
      records: rows.length,
      classification: CLASSIFICATIONS[definition.classification],
      columns: definition.columns,
      rows,
      titleCells: definition.aggregate ? 1 : 2,
    },
  };
}

export interface ExportedFile {
  filename: string;
  contentType: string;
  body: Uint8Array;
}

const EXTENSIONS: Record<ExportFormat, string> = { csv: "csv", xlsx: "xlsx", pdf: "pdf" };
const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "period";

/** Records the export in the audit log: who, which report, in what format, with which filters, and how many records. */
async function auditExport(ctx: Ctx, built: Built, format: ExportFormat | "json"): Promise<void> {
  await recordSummitChange(ctx.db, ctx.principal.userId, {
    action: "summit.report.exported",
    entityType: "summit_period",
    entityId: built.period.id,
    organizationId: null,
    after: {
      report: built.definition.id,
      title: built.definition.title,
      format,
      filters: built.filters,
      records: built.table.records,
      scope: built.scope,
      classification: built.definition.classification,
      exportedAt: ctx.now.toISOString(),
    },
  });
}

/** A report as a file in the format asked for. Recorded in the audit log once it is made, and never without it. */
export async function exportReport(ctx: Ctx, id: ReportId, format: ExportFormat, query: ReportQuery): Promise<ExportedFile> {
  const built = await buildTable(ctx, id, query);
  const body = await render(built.table, format);
  await auditExport(ctx, built, format);
  return {
    filename: `summit-${built.definition.id}-${slug(built.period.name)}-${ctx.now.toISOString().slice(0, 10).replaceAll("-", "")}.${EXTENSIONS[format]}`,
    contentType: CONTENT_TYPES[format],
    body,
  };
}

/** The same report as data, for a screen to show. It is an export like any other: the same scope and the same audit entry. */
export async function viewReport(ctx: Ctx, id: ReportId, query: ReportQuery): Promise<ReportTableView> {
  const built = await buildTable(ctx, id, query);
  await auditExport(ctx, built, "json");
  return {
    report: reportSummary(built.definition),
    period: { id: built.period.id, name: built.period.name },
    generatedAt: built.table.generatedAt.toISOString(),
    generatedBy: built.generatedBy,
    filters: built.filters,
    scope: built.scope,
    records: built.table.records,
    columns: built.table.columns.map((c) => ({ ...c })),
    rows: built.table.rows.map((r) => [...r]),
  };
}
