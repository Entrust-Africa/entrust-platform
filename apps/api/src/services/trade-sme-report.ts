import { z } from "@hono/zod-openapi";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Ctx } from "./access";
import { CONTENT_TYPES, render, type ExportCell, type ExportFormat, type ExportTable } from "./export";
import { ServiceError } from "./errors";
import { listIntegrations } from "./trade-integrations";
import { getReadinessProfiles } from "./trade-readiness";
import { listReferrals } from "./trade-referrals";
import { accessTo } from "./trade-shared";
import { businessProfileHistory, getBusinessProfile, listExportHistory, listProducts } from "./trade-sme-record";
import { findWorksheetDefinition } from "./trade-worksheet-definitions";

// One business's report of what it has actually done (acceptance test REP-02): its details and every output tied to the
// business itself, so the figures belong to that business and no other. It is made from the records, not from anything typed
// in for the report.

const Row = z.record(z.string(), z.unknown());
export const SmeReport = z
  .object({
    organizationId: z.string(),
    generatedAt: z.string(),
    profile: Row,
    products: z.array(Row),
    shipments: z.array(Row),
    buyers: z.array(Row),
    enrolments: z.array(Row),
    modules: z.array(Row),
    outputs: z.array(Row),
    assessments: z.array(Row),
    readiness: z.array(Row),
    actionPlan: z.object({ total: z.number(), byStatus: z.record(z.string(), z.number()), overdue: z.number() }),
    referrals: z.array(Row).nullable(),
    integrations: z.array(Row),
    profileChanges: z.number(),
  })
  .openapi("TradeSmeReport");

export async function getSmeReport(ctx: Ctx, organizationId: string): Promise<z.infer<typeof SmeReport>> {
  const access = await accessTo(ctx.db, ctx.principal, organizationId);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  const db = ctx.db;

  const [profile, products, shipments, history, integrations] = await Promise.all([
    getBusinessProfile(ctx, { organizationId }),
    listProducts(ctx, { organizationId }),
    listExportHistory(ctx, { organizationId }),
    businessProfileHistory(ctx, { organizationId }),
    listIntegrations(ctx, { organizationId }),
  ]);

  const buyers = await db.select().from(schema.smeBuyer).where(eq(schema.smeBuyer.organizationId, organizationId)).orderBy(asc(schema.smeBuyer.name), asc(schema.smeBuyer.country));
  const enrolments = await db
    .select({ id: schema.enrollment.id, status: schema.enrollment.status, cohort: schema.cohort.name })
    .from(schema.enrollment)
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .where(eq(schema.enrollment.organizationId, organizationId))
    .orderBy(desc(schema.enrollment.createdAt));
  // With no enrolment the queries below match nothing, rather than being skipped, so they keep their types.
  const enrollmentIds = enrolments.length ? enrolments.map((e) => e.id) : ["00000000-0000-0000-0000-000000000000"];

  const [pathways, plans, progress, versions, assessments] = await Promise.all([
        db.select({ enrollmentId: schema.pathwayAssignment.enrollmentId, pathway: schema.pathwayAssignment.pathway, status: schema.pathwayAssignment.status }).from(schema.pathwayAssignment).where(and(inArray(schema.pathwayAssignment.enrollmentId, enrollmentIds), ne(schema.pathwayAssignment.status, "superseded"))),
        db.select({ enrollmentId: schema.learningPlan.enrollmentId, status: schema.learningPlan.status }).from(schema.learningPlan).where(and(inArray(schema.learningPlan.enrollmentId, enrollmentIds), ne(schema.learningPlan.status, "superseded"))),
        db.select({ moduleId: schema.moduleProgress.moduleId, status: schema.moduleProgress.status, score: schema.moduleProgress.knowledgeCheckScore, completedAt: schema.moduleProgress.completedAt }).from(schema.moduleProgress).where(inArray(schema.moduleProgress.enrollmentId, enrollmentIds)).orderBy(asc(schema.moduleProgress.moduleId)),
        db
          .select({ version: schema.worksheetVersion, reviewStatus: schema.worksheetVersionReview.status })
          .from(schema.worksheetVersion)
          .leftJoin(schema.worksheetVersionReview, eq(schema.worksheetVersionReview.worksheetVersionId, schema.worksheetVersion.id))
          .where(and(inArray(schema.worksheetVersion.enrollmentId, enrollmentIds), eq(schema.worksheetVersion.status, "submitted")))
          .orderBy(asc(schema.worksheetVersion.worksheetId), desc(schema.worksheetVersion.version)),
        db
          .select({ kind: schema.tradeAssessment.kind, assessedAt: schema.tradeAssessment.assessedAt, domain: schema.capabilityScore.domain, score: schema.capabilityScore.score })
          .from(schema.capabilityScore)
          .innerJoin(schema.tradeAssessment, eq(schema.tradeAssessment.id, schema.capabilityScore.assessmentId))
          .where(and(inArray(schema.tradeAssessment.enrollmentId, enrollmentIds), inArray(schema.tradeAssessment.kind, ["placement", "exit"]), ne(schema.tradeAssessment.status, "superseded"), eq(schema.capabilityScore.kind, "domain")))
          .orderBy(asc(schema.tradeAssessment.createdAt)),
  ]);

  // Only the newest submitted version of each output.
  const seen = new Set<string>();
  const outputs = versions
    .filter(({ version }) => (seen.has(version.worksheetId) ? false : (seen.add(version.worksheetId), true)))
    .map(({ version, reviewStatus }) => ({ worksheetId: version.worksheetId, title: findWorksheetDefinition(version.worksheetId)?.title ?? version.worksheetId, moduleId: version.moduleId, version: version.version, submittedAt: version.submittedAt?.toISOString() ?? null, reviewStatus: reviewStatus ?? "pending" }));

  const items = await db.select().from(schema.actionItem).where(eq(schema.actionItem.organizationId, organizationId));
  const today = ctx.now.toISOString().slice(0, 10);
  const byStatus: Record<string, number> = {};
  for (const item of items) byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;

  return {
    organizationId,
    generatedAt: ctx.now.toISOString(),
    profile: profile as Record<string, unknown>,
    products: products.items,
    shipments: shipments.items,
    buyers: buyers.map((b) => ({ name: b.name, country: b.country, verificationStatus: b.verificationStatus })),
    enrolments: enrolments.map((e) => ({
      cohort: e.cohort,
      status: e.status,
      pathway: pathways.find((p) => p.enrollmentId === e.id)?.pathway ?? null,
      pathwayStatus: pathways.find((p) => p.enrollmentId === e.id)?.status ?? null,
      plan: plans.find((p) => p.enrollmentId === e.id)?.status ?? null,
    })),
    modules: progress.map((m) => ({ moduleId: m.moduleId, status: m.status, knowledgeCheckScore: m.score === null ? null : Number(m.score), completedAt: m.completedAt?.toISOString() ?? null })),
    outputs,
    readiness: (await getReadinessProfiles(ctx, { organizationId })).current.map((a) => ({ area: a.label, score: a.score, classification: a.classification, reviewStatus: a.reviewStatus })),
    assessments: assessments.map((a) => ({ kind: a.kind, domain: a.domain, score: a.score === null ? null : Number(a.score), assessedAt: a.assessedAt?.toISOString() ?? null })),
    actionPlan: { total: items.length, byStatus, overdue: items.filter((i) => i.dueDate && i.dueDate < today && !["completed", "closed_without_completion", "cancelled"].includes(i.status)).length },
    // A referral is Entrust's record of who it referred the business to, so the business's own copy of its report leaves it out.
    referrals: access.staff ? (await listReferrals(ctx, { organizationId })).items.map((r) => ({ destination: r.destinationName, type: r.destinationType, status: r.status, consent: r.consentStatus })) : null,
    integrations: integrations.items,
    profileChanges: history.items.length,
  };
}

const cell = (value: unknown): ExportCell => (value === null || value === undefined ? null : typeof value === "number" ? value : String(value));

/** The report as one table of section, item and detail, in the format asked for. */
export async function exportSmeReport(ctx: Ctx, organizationId: string, format: ExportFormat): Promise<{ body: Uint8Array; filename: string; contentType: string }> {
  const report = await getSmeReport(ctx, organizationId);
  const rows: ExportCell[][] = [];
  const add = (section: string, item: unknown, detail: unknown, status?: unknown) => rows.push([section, cell(item), cell(detail), cell(status)]);
  const p = report.profile as Record<string, unknown>;
  for (const key of ["legalName", "tradingName", "registrationNumber", "sector", "country", "yearEstablished", "mainActivity", "businessEmail", "businessPhone", "address"]) if (p[key] !== null && p[key] !== undefined) add("Business", key, p[key]);
  for (const r of report.products) add("Products", r.name, r.category);
  for (const r of report.shipments) add("Completed shipments", r.product, [r.destination, r.shipmentDate].filter(Boolean).join(", "), r.evidenceStatus);
  for (const r of report.buyers) add("Buyers", r.name, r.country, r.verificationStatus);
  for (const r of report.enrolments) add("Enrolments", r.cohort, r.pathway ? `Pathway ${r.pathway}` : "No pathway yet", r.status);
  for (const r of report.modules) add("Modules", r.moduleId, r.knowledgeCheckScore === null ? null : `Knowledge check ${r.knowledgeCheckScore}%`, r.status);
  for (const r of report.outputs) add("Outputs", r.title, `${r.moduleId}, version ${r.version}`, r.reviewStatus);
  for (const r of report.readiness) add("Readiness", r.area, r.score === null ? "Not scored" : `${r.score}%`, r.reviewStatus);
  for (const r of report.assessments) add("Assessments", `${r.kind}: ${r.domain}`, r.score, null);
  add("Action plan", "Items", report.actionPlan.total, `${report.actionPlan.overdue} overdue`);
  for (const r of report.referrals ?? []) add("Referrals", r.destination, r.type, r.status);
  for (const r of report.integrations) add("Integrations", r.provider, r.recordType, r.syncStatus);
  const [user] = await ctx.db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, ctx.principal.userId));
  const table: ExportTable = {
    summit: "Entrust TRADE",
    title: `Business report: ${String(p.legalName ?? "")}`,
    purpose: "What this business has recorded and done on TRADE.",
    period: "To date",
    generatedAt: ctx.now,
    generatedBy: user?.name ?? "TRADE user",
    filters: "None",
    records: rows.length,
    classification: "Confidential: contains a business's own information",
    columns: [
      { key: "section", label: "Section", numeric: false },
      { key: "item", label: "Item", numeric: false },
      { key: "detail", label: "Detail", numeric: false },
      { key: "status", label: "Status", numeric: false },
    ],
    rows,
    titleCells: 2,
  };
  const slug = String(p.legalName ?? "business").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "business";
  return { body: await render(table, format), filename: `trade-business-report-${slug}-${ctx.now.toISOString().slice(0, 10)}.${format}`, contentType: CONTENT_TYPES[format] };
}
