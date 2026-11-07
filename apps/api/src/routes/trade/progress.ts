import { createRoute } from "@hono/zod-openapi";
import {
  ModuleProgressList,
  ModuleProgressQuery,
  ModuleProgressSchema,
  RecordModuleProgressBody,
} from "../../schemas/trade";
import {
  listEnrollmentProgress,
  recordModuleProgress,
} from "../../services/trade-progress";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

const tags = ["TRADE learner module progress"];
const router = clearRouter("trade");

const listProgressRoute = createRoute({
  method: "get",
  path: "/module-progress",
  tags,
  summary: "List enrollment module progress",
  description:
    "Returns module progress records for an enrollment. Staff can view any learner's view read-only; learners can only view their own.",
  request: { query: ModuleProgressQuery },
  responses: {
    200: { description: "Module progress records", content: json(ModuleProgressList) },
    ...listErrors,
    404: problem("Enrollment not found"),
  },
});

const recordProgressRoute = createRoute({
  method: "post",
  path: "/module-progress",
  tags,
  summary: "Record module progress or lesson completion",
  description:
    "Records lesson completion and status changes. Modules outside the learner's plan cannot be submitted. Staff view is read-only.",
  request: {
    body: { content: { "application/json": { schema: RecordModuleProgressBody } } },
  },
  responses: {
    200: { description: "Updated module progress", content: json(ModuleProgressSchema) },
    ...writeErrors,
    400: problem("Invalid transition or unassigned module submission"),
    404: problem("Enrollment not found"),
  },
});

export const tradeModuleProgress = router
  .openapi(listProgressRoute, async (c) => {
    const query = c.req.valid("query");
    const items = await listEnrollmentProgress(await contextFor(c.get("user")), query);
    return c.json({ items }, 200);
  })
  .openapi(recordProgressRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await recordModuleProgress(await contextFor(c.get("user")), body);
    return c.json(result, 200);
  });
