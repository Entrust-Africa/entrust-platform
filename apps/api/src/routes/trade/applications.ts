import { createRoute } from "@hono/zod-openapi";
import { ApplicationDetail, ApplicationList, ApplicationParam, ApplicationsImported, ImportApplicationsBody } from "../../schemas/trade";
import { getApplication, importApplications, listApplications } from "../../services/trade-applications";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

// Applications to a programme, from the form's responses. Staff only, and only responses from Ethiopia are listed.

const tags = ["TRADE applications"];
const applications = clearRouter("trade");
const forbidden = problem("The caller isn't Entrust staff, or their role can't do this");

const listRoute = createRoute({
  method: "get",
  path: "/applications",
  tags,
  summary: "The applications from Ethiopia",
  description:
    "Responses to the application forms, newest first, with every answer as typed. Only responses from Ethiopia are listed; responses from elsewhere are kept but never shown, and `summary.notShown` says how many there are. Entrust staff only.",
  responses: { 200: { description: "The applications", content: json(ApplicationList) }, ...listErrors, 403: forbidden },
});

const detailRoute = createRoute({
  method: "get",
  path: "/applications/{id}",
  tags,
  summary: "One application from Ethiopia",
  description:
    "The response with every answer as typed, the business's other responses, and the SME register record it matches, if any. A response from outside Ethiopia, or that doesn't say where it is from, is 404 like an id that doesn't exist. Entrust staff only.",
  request: { params: ApplicationParam },
  responses: { 200: { description: "The application", content: json(ApplicationDetail) }, ...listErrors, 403: forbidden },
});

const importRoute = createRoute({
  method: "post",
  path: "/applications/import",
  tags,
  summary: "Load a form's responses",
  description:
    "Takes the form's responses as an .xlsx file (Google Forms: File, Download, Microsoft Excel), base64 encoded, for a named programme. Every response is kept. A response is matched on its programme, time sent and email address: new ones are added, changed ones updated, and any the file leaves out are kept. Each response's country is worked out from where the business says it is, its email address and its phone number. Entrust admins and facilitators only.",
  request: { body: { required: true, content: json(ImportApplicationsBody) } },
  responses: {
    201: { description: "What was loaded", content: json(ApplicationsImported) },
    ...listErrors,
    403: forbidden,
    422: problem("The file isn't a form's responses. The message says why."),
  },
});

export const tradeApplications = applications
  .openapi(listRoute, async (c) => c.json(await listApplications(await contextFor(c.get("user"))), 200))
  .openapi(detailRoute, async (c) => c.json(await getApplication(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(importRoute, async (c) => c.json(await importApplications(await contextFor(c.get("user")), c.req.valid("json")), 201));
