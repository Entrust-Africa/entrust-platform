import { createRoute } from "@hono/zod-openapi";
import {
  SaveWorksheetBody,
  WorksheetDefinitionList,
  WorksheetDefinitionView,
  WorksheetParam,
  WorksheetQuery,
  WorksheetSummaryList,
  WorksheetVersionList,
  WorksheetVersionParam,
  WorksheetVersionView,
} from "../../schemas/trade";
import { getDefinition, getVersion, listDefinitions, listVersions, listWorksheets, saveValues, startDraft, submitVersion } from "../../services/trade-worksheets";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

// Worksheets (#64, #65): the structured forms an SME fills in. One set of routes for every worksheet, chosen by its ID.

const tags = ["TRADE worksheets"];
const worksheets = clearRouter("trade");

const definitionsRoute = createRoute({
  method: "get",
  path: "/worksheets/definitions",
  tags,
  summary: "List the worksheets",
  description: "Every worksheet's fields, tables, results and layout, in the shape a worksheet screen renders.",
  responses: { 200: { description: "The worksheets", content: json(WorksheetDefinitionList) }, ...listErrors },
});

const definitionRoute = createRoute({
  method: "get",
  path: "/worksheets/definitions/{id}",
  tags,
  summary: "View a worksheet's definition",
  request: { params: WorksheetParam },
  responses: { 200: { description: "The worksheet", content: json(WorksheetDefinitionView) }, ...listErrors, 404: problem("No such worksheet") },
});

const listRoute = createRoute({
  method: "get",
  path: "/worksheets",
  tags,
  summary: "An enrolment's worksheets",
  description: "Each worksheet with its newest submitted version and the draft in progress, if any. Entrust staff can read any SME's.",
  request: { query: WorksheetQuery },
  responses: { 200: { description: "The worksheets", content: json(WorksheetSummaryList) }, ...listErrors },
});

const versionsRoute = createRoute({
  method: "get",
  path: "/worksheets/{id}/versions",
  tags,
  summary: "The versions of a worksheet",
  description: "Every version of one worksheet for an enrolment, newest first: the submitted ones, which are kept as they were, and the draft.",
  request: { params: WorksheetParam, query: WorksheetQuery },
  responses: { 200: { description: "The versions", content: json(WorksheetVersionList) }, ...listErrors, 404: problem("No such worksheet") },
});

const draftRoute = createRoute({
  method: "post",
  path: "/worksheets/{id}/draft",
  tags,
  summary: "Open a worksheet's draft",
  description:
    "Returns the draft already open, or starts one. A new draft starts from the newest submitted version, so editing a submitted version starts the next. The first draft starts from the worksheet it builds on (the M03 working-capital brief prefills M04's brief) and from the registry.",
  request: { params: WorksheetParam, body: { content: json(WorksheetQuery), required: false } },
  responses: { 200: { description: "The draft", content: json(WorksheetVersionView) }, ...writeErrors, 404: problem("No such worksheet") },
});

const getRoute = createRoute({
  method: "get",
  path: "/worksheet-versions/{id}",
  tags,
  summary: "View a worksheet version",
  description: "The values, what the worksheet works out from them (live for a draft, as kept for a submitted version), the warnings and critical-failure candidates, and where the figures came from.",
  request: { params: WorksheetVersionParam },
  responses: { 200: { description: "The version", content: json(WorksheetVersionView) }, ...listErrors },
});

const saveRoute = createRoute({
  method: "put",
  path: "/worksheet-versions/{id}/values",
  tags,
  summary: "Save values",
  description: "A partial save as the learner types: a value sets a field, null clears it, fields not named stay. Only a draft changes. The reply carries the result worked out from the values so far.",
  request: { params: WorksheetVersionParam, body: { content: json(SaveWorksheetBody), required: true } },
  responses: { 200: { description: "The draft", content: json(WorksheetVersionView) }, ...writeErrors },
});

const submitRoute = createRoute({
  method: "post",
  path: "/worksheet-versions/{id}/submit",
  tags,
  summary: "Submit a worksheet",
  description: "Turns the draft into a numbered version that is kept and can't be edited, with what the worksheet worked out. Needs every required field and no figure that can't be used. Warnings and critical-failure candidates don't stop it; the assessor sees them.",
  request: { params: WorksheetVersionParam },
  responses: { 200: { description: "The submitted version", content: json(WorksheetVersionView) }, ...writeErrors },
});

export const tradeWorksheets = worksheets
  .openapi(definitionsRoute, async (c) => {
    return c.json({ items: listDefinitions(await contextFor(c.get("user"))) }, 200);
  })
  .openapi(definitionRoute, async (c) => {
    return c.json(getDefinition(await contextFor(c.get("user")), c.req.valid("param").id), 200);
  })
  .openapi(listRoute, async (c) => c.json(await listWorksheets(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(versionsRoute, async (c) => c.json(await listVersions(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("query")), 200))
  .openapi(draftRoute, async (c) => c.json(await startDraft(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json") ?? {}), 200))
  .openapi(getRoute, async (c) => c.json(await getVersion(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(saveRoute, async (c) => c.json(await saveValues(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json").values), 200))
  .openapi(submitRoute, async (c) => c.json(await submitVersion(await contextFor(c.get("user")), c.req.valid("param").id), 200));
