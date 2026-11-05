import { createRoute } from "@hono/zod-openapi";
import { ImportRegisterBody, RegisterDetail, RegisterImported, RegisterList, RegisterParam } from "../../schemas/trade";
import { getRegisterRecord, importRegister, listRegister } from "../../services/trade-register";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

// Entrust's register of pilot SMEs, from the diagnostic workbook. Staff only.

const tags = ["TRADE SME register"];
const register = clearRouter("trade");
const forbidden = problem("The caller isn't Entrust staff, or their role can't do this");

const listRoute = createRoute({
  method: "get",
  path: "/register",
  tags,
  summary: "The register of pilot SMEs",
  description:
    "Every business in the diagnostic workbook, with its total capital gap, export readiness score, finance readiness level and finance priority worked out from what was recorded, and totals across them. Entrust staff only.",
  responses: { 200: { description: "The register", content: json(RegisterList) }, ...listErrors, 403: forbidden },
});

const detailRoute = createRoute({
  method: "get",
  path: "/register/{id}",
  tags,
  summary: "One business in the register",
  description:
    "Everything recorded about the business, with its figures worked out, and the responses from Ethiopia to a programme's form that come from the same business, if any. Entrust staff only.",
  request: { params: RegisterParam },
  responses: { 200: { description: "The business", content: json(RegisterDetail) }, ...listErrors, 403: forbidden },
});

const importRoute = createRoute({
  method: "post",
  path: "/register/import",
  tags,
  summary: "Load the diagnostic workbook into the register",
  description:
    "Takes the .xlsx file (base64 encoded) and reads its \"Master SME Database\" sheet, and the email and notes from \"Entrust Service Pipeline\". A business is matched on its SME ID: new ones are added, changed ones updated, and one the file leaves out is kept. Totals and levels in the workbook are not read; they are worked out again, and the warnings say where the workbook disagreed with itself. Entrust admins and facilitators only.",
  request: { body: { required: true, content: json(ImportRegisterBody) } },
  responses: {
    201: { description: "What was loaded", content: json(RegisterImported) },
    ...listErrors,
    403: forbidden,
    422: problem("The file isn't the diagnostic workbook. The message says why."),
  },
});

export const tradeRegister = register
  .openapi(listRoute, async (c) => c.json(await listRegister(await contextFor(c.get("user"))), 200))
  .openapi(detailRoute, async (c) => c.json(await getRegisterRecord(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(importRoute, async (c) => c.json(await importRegister(await contextFor(c.get("user")), c.req.valid("json")), 201));
