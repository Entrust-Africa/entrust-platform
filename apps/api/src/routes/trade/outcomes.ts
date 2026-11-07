import { createRoute, z } from "@hono/zod-openapi";
import {
  CreateExportOutcomeBody,
  CreateFinancingOutcomeBody,
  OutcomeEventView,
  OutcomeList,
  OutcomeParam,
  OutcomeQuery,
  OutcomeView,
  UpdateExportStatusBody,
  UpdateFinancingStatusBody,
} from "../../schemas/trade";
import {
  createExportOutcome,
  createFinancingOutcome,
  listOutcomeEvents,
  listOutcomes,
  updateExportStatus,
  updateFinancingStatus,
} from "../../services/trade-outcomes";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

const tags = ["TRADE financing & export outcomes"];
const router = clearRouter("trade");

const listOutcomesRoute = createRoute({
  method: "get",
  path: "/outcomes",
  tags,
  summary: "List financing and export outcomes",
  description: "Tracks financing applications and export fulfillment outcomes with audit history.",
  request: { query: OutcomeQuery },
  responses: {
    200: { description: "Outcomes list", content: json(OutcomeList) },
    ...listErrors,
  },
});

const createFinancingOutcomeRoute = createRoute({
  method: "post",
  path: "/outcomes/financing",
  tags,
  summary: "Create a financing application outcome",
  description: "Records a trade financing application (amount requested, lender, type).",
  request: { body: { content: json(CreateFinancingOutcomeBody), required: true } },
  responses: {
    201: { description: "Created financing outcome", content: json(OutcomeView) },
    ...writeErrors,
  },
});

const updateFinancingStatusRoute = createRoute({
  method: "patch",
  path: "/outcomes/financing/{id}/status",
  tags,
  summary: "Update financing application status",
  description: "Transitions financing status. Keeps approval without disbursement separate.",
  request: {
    params: OutcomeParam,
    body: { content: json(UpdateFinancingStatusBody), required: true },
  },
  responses: {
    200: { description: "Updated financing outcome", content: json(OutcomeView) },
    ...writeErrors,
    404: problem("Financing outcome not found"),
  },
});

const createExportOutcomeRoute = createRoute({
  method: "post",
  path: "/outcomes/export",
  tags,
  summary: "Create an export outcome",
  description: "Records an export order outcome linked to a buyer lead with planned volume.",
  request: { body: { content: json(CreateExportOutcomeBody), required: true } },
  responses: {
    201: { description: "Created export outcome", content: json(OutcomeView) },
    ...writeErrors,
  },
});

const updateExportStatusRoute = createRoute({
  method: "patch",
  path: "/outcomes/export/{id}/status",
  tags,
  summary: "Update export outcome status",
  description: "Transitions export status. Keeps shipment without payment separate.",
  request: {
    params: OutcomeParam,
    body: { content: json(UpdateExportStatusBody), required: true },
  },
  responses: {
    200: { description: "Updated export outcome", content: json(OutcomeView) },
    ...writeErrors,
    404: problem("Export outcome not found"),
  },
});

const listEventsRoute = createRoute({
  method: "get",
  path: "/outcomes/{id}/events",
  tags,
  summary: "List outcome status audit events",
  description: "Audit trail of all status transitions, actor, evidence tier, and notes for an outcome.",
  request: { params: OutcomeParam },
  responses: {
    200: {
      description: "Outcome event history",
      content: json(z.object({ items: z.array(OutcomeEventView) }).openapi("TradeOutcomeEventList")),
    },
    ...listErrors,
    404: problem("Outcome not found"),
  },
});

export const tradeOutcomes = router
  .openapi(listOutcomesRoute, async (c) => {
    const query = c.req.valid("query");
    const items = await listOutcomes(await contextFor(c.get("user")), query);
    return c.json({ items }, 200);
  })
  .openapi(createFinancingOutcomeRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createFinancingOutcome(await contextFor(c.get("user")), body);
    return c.json(result, 201);
  })
  .openapi(updateFinancingStatusRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateFinancingStatus(await contextFor(c.get("user")), id, body);
    return c.json(result, 200);
  })
  .openapi(createExportOutcomeRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createExportOutcome(await contextFor(c.get("user")), body);
    return c.json(result, 201);
  })
  .openapi(updateExportStatusRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await updateExportStatus(await contextFor(c.get("user")), id, body);
    return c.json(result, 200);
  })
  .openapi(listEventsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const items = await listOutcomeEvents(await contextFor(c.get("user")), id);
    return c.json({ items }, 200);
  });
