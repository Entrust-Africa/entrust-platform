import { createRoute, z } from "@hono/zod-openapi";
import { ProgrammeReport, ProgrammeReportParam } from "../../schemas/trade";
import { exportCohortReport, exportProgramReport, getCohortReport, getProgramReport } from "../../services/trade-reports";
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
  request: { params: ProgrammeReportParam },
  responses: { 200: { description: "The report", content: json(ProgrammeReport) }, ...listErrors },
});

const cohortRoute = createRoute({
  method: "get",
  path: "/reports/cohorts/{id}",
  tags,
  summary: "A cohort's report",
  description,
  request: { params: ProgrammeReportParam },
  responses: { 200: { description: "The report", content: json(ProgrammeReport) }, ...listErrors },
});

const programCsvRoute = createRoute({
  method: "get",
  path: "/reports/programs/{id}/export.csv",
  tags,
  summary: "Export a programme's report",
  description: "One row per enrolment, for Entrust staff.",
  request: { params: ProgrammeReportParam },
  responses: { 200: { description: "The CSV file", content: CSV }, ...listErrors, 403: problem("Not Entrust staff") },
});

const cohortCsvRoute = createRoute({
  method: "get",
  path: "/reports/cohorts/{id}/export.csv",
  tags,
  summary: "Export a cohort's report",
  description: "One row per enrolment, for Entrust staff.",
  request: { params: ProgrammeReportParam },
  responses: { 200: { description: "The CSV file", content: CSV }, ...listErrors, 403: problem("Not Entrust staff") },
});

const csvResponse = ({ csv, filename }: { csv: string; filename: string }) =>
  new Response(csv, { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });

export const tradeReports = reports
  .openapi(programRoute, async (c) => c.json(await getProgramReport(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(cohortRoute, async (c) => c.json(await getCohortReport(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(programCsvRoute, async (c) => csvResponse(await exportProgramReport(await contextFor(c.get("user")), c.req.valid("param").id)))
  .openapi(cohortCsvRoute, async (c) => csvResponse(await exportCohortReport(await contextFor(c.get("user")), c.req.valid("param").id)));
