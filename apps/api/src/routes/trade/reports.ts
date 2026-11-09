import { createRoute, z } from "@hono/zod-openapi";
import { ProgrammeReport, ProgrammeReportParam, ReportFilterQuery } from "../../schemas/trade";
import { EXPORT_FORMATS } from "../../services/export";
import { exportCohortReport, exportCohortReportAs, exportProgramReport, exportProgramReportAs, getCohortReport, getProgramReport } from "../../services/trade-reports";
import { exportSmeReport, getSmeReport, SmeReport } from "../../services/trade-sme-report";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

// Programme and cohort reports (#72).

const tags = ["TRADE reports"];
const reports = clearRouter("trade");
const CSV = { "text/csv": { schema: z.string() } };

const description =
  "Reach, engagement, capability, pipeline, finance and export execution. Entrust staff see everything. A sponsor sees only its own cohorts: a figure that covers fewer than 5 SMEs is null unless all of them agreed to share that kind of data, and named rows appear only for SMEs that agreed. Amounts are per currency and never added across currencies.";

const programRoute = createRoute({
  method: "get",
  path: "/reports/programs/{id}",
  tags,
  summary: "A programme's report",
  description,
  request: { params: ProgrammeReportParam, query: ReportFilterQuery },
  responses: { 200: { description: "The report", content: json(ProgrammeReport) }, ...listErrors },
});

const cohortRoute = createRoute({
  method: "get",
  path: "/reports/cohorts/{id}",
  tags,
  summary: "A cohort's report",
  description,
  request: { params: ProgrammeReportParam, query: ReportFilterQuery },
  responses: { 200: { description: "The report", content: json(ProgrammeReport) }, ...listErrors },
});

const programCsvRoute = createRoute({
  method: "get",
  path: "/reports/programs/{id}/export.csv",
  tags,
  summary: "Export a programme's report",
  description: "One row per enrolment, for Entrust staff.",
  request: { params: ProgrammeReportParam, query: ReportFilterQuery },
  responses: { 200: { description: "The CSV file", content: CSV }, ...listErrors, 403: problem("Not Entrust staff") },
});

const cohortCsvRoute = createRoute({
  method: "get",
  path: "/reports/cohorts/{id}/export.csv",
  tags,
  summary: "Export a cohort's report",
  description: "One row per enrolment, for Entrust staff.",
  request: { params: ProgrammeReportParam, query: ReportFilterQuery },
  responses: { 200: { description: "The CSV file", content: CSV }, ...listErrors, 403: problem("Not Entrust staff") },
});

const FormatQuery = ReportFilterQuery.extend({ format: z.enum(EXPORT_FORMATS).default("xlsx") });
const BINARY = { "application/octet-stream": { schema: z.string() } };

const programExportRoute = createRoute({
  method: "get",
  path: "/reports/programs/{id}/export",
  tags,
  summary: "Export a programme's report as Excel, CSV or PDF",
  description: "One row per enrolment, with the report's name, period, filters, date, who made it and its confidentiality. For Entrust staff.",
  request: { params: ProgrammeReportParam, query: FormatQuery },
  responses: { 200: { description: "The file", content: BINARY }, ...listErrors, 403: problem("Not Entrust staff") },
});

const cohortExportRoute = createRoute({
  method: "get",
  path: "/reports/cohorts/{id}/export",
  tags,
  summary: "Export a cohort's report as Excel, CSV or PDF",
  request: { params: ProgrammeReportParam, query: FormatQuery },
  responses: { 200: { description: "The file", content: BINARY }, ...listErrors, 403: problem("Not Entrust staff") },
});

const smeReportRoute = createRoute({
  method: "get",
  path: "/reports/smes/{organizationId}",
  tags,
  summary: "One business's report of its activity",
  description: "Its profile, products, shipments, buyers, enrolments and pathway, module progress, outputs with their review status, assessment scores, action plan, referrals and integrations. For the business and Entrust staff who can reach it; a referral appears only to staff.",
  request: { params: z.object({ organizationId: z.string() }) },
  responses: { 200: { description: "The report", content: json(SmeReport) }, ...listErrors },
});

const smeExportRoute = createRoute({
  method: "get",
  path: "/reports/smes/{organizationId}/export",
  tags,
  summary: "Export one business's report as Excel, CSV or PDF",
  request: { params: z.object({ organizationId: z.string() }), query: z.object({ format: z.enum(EXPORT_FORMATS).default("pdf") }) },
  responses: { 200: { description: "The file", content: BINARY }, ...listErrors },
});

const fileResponse = ({ body, filename, contentType }: { body: Uint8Array; filename: string; contentType: string }) =>
  new Response(body as BodyInit, { status: 200, headers: { "Content-Type": contentType, "Content-Disposition": `attachment; filename="${filename}"` } });

const csvResponse = ({ csv, filename }: { csv: string; filename: string }) =>
  new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });

export const tradeReports = reports
  .openapi(programRoute, async (c) => c.json(await getProgramReport(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("query")), 200))
  .openapi(cohortRoute, async (c) => c.json(await getCohortReport(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("query")), 200))
  .openapi(programCsvRoute, async (c) => csvResponse(await exportProgramReport(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("query"))))
  .openapi(cohortCsvRoute, async (c) => csvResponse(await exportCohortReport(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("query"))))
  .openapi(programExportRoute, async (c) => {
    const { format, ...filters } = c.req.valid("query");
    return fileResponse(await exportProgramReportAs(await contextFor(c.get("user")), c.req.valid("param").id, format, filters));
  })
  .openapi(cohortExportRoute, async (c) => {
    const { format, ...filters } = c.req.valid("query");
    return fileResponse(await exportCohortReportAs(await contextFor(c.get("user")), c.req.valid("param").id, format, filters));
  })
  .openapi(smeReportRoute, async (c) => c.json(await getSmeReport(await contextFor(c.get("user")), c.req.valid("param").organizationId), 200))
  .openapi(smeExportRoute, async (c) => fileResponse(await exportSmeReport(await contextFor(c.get("user")), c.req.valid("param").organizationId, c.req.valid("query").format)));
