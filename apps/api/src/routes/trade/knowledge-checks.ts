import { createRoute, z } from "@hono/zod-openapi";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";
import {
  CohortKnowledgeCheckStats,
  KnowledgeCheckAttemptInput,
  KnowledgeCheckAttemptResult,
  KnowledgeCheckHistoryList,
  KnowledgeCheckHistoryQuery,
  ModuleParam,
} from "../../schemas/trade";
import {
  getCohortKnowledgeCheckStats,
  listKnowledgeCheckAttempts,
  submitKnowledgeCheckAttempt,
} from "../../services/trade-knowledge-checks";
import { ServiceError } from "../../services/errors";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

const tags = ["TRADE knowledge checks"];
const router = clearRouter("trade");

const CohortParam = z.object({ id: z.string().uuid().openapi({ example: "11111111-1111-4111-8111-111111111111" }) });

const submitAttemptRoute = createRoute({
  method: "post",
  path: "/modules/{id}/knowledge-check/attempts",
  tags,
  summary: "Submit a knowledge check attempt",
  description:
    "Grades learner answers server-side against the answer key. Requires 80% to pass. Persists the attempt, records theory completion when passed, and returns question feedback.",
  request: {
    params: ModuleParam,
    body: { content: { "application/json": { schema: KnowledgeCheckAttemptInput } } },
  },
  responses: {
    200: { description: "Attempt graded result", content: json(KnowledgeCheckAttemptResult) },
    ...writeErrors,
    400: problem("Invalid attempt answers or unconfigured module"),
    403: problem("Caller lacks permission or is read-only staff"),
    404: problem("Module or enrollment not found"),
  },
});

const listAttemptsRoute = createRoute({
  method: "get",
  path: "/modules/{id}/knowledge-check/attempts",
  tags,
  summary: "List past knowledge check attempts for a module",
  description:
    "Returns past attempts, newest first, including scores, pass status, and overall module pass state.",
  request: {
    params: ModuleParam,
    query: KnowledgeCheckHistoryQuery,
  },
  responses: {
    200: { description: "Past attempts list", content: json(KnowledgeCheckHistoryList) },
    ...listErrors,
    403: problem("Caller lacks permission"),
    404: problem("Module or enrollment not found"),
  },
});

const cohortStatsRoute = createRoute({
  method: "get",
  path: "/cohorts/{id}/knowledge-check-stats",
  tags,
  summary: "Cohort knowledge check statistics",
  description:
    "Staff-only route returning module-by-module pass rates and attempt counts across the cohort.",
  request: {
    params: CohortParam,
  },
  responses: {
    200: { description: "Cohort knowledge check statistics", content: json(CohortKnowledgeCheckStats) },
    ...listErrors,
    403: problem("Staff access required"),
    404: problem("Cohort not found"),
  },
});

function resolveModuleId(id: string): ModuleId {
  const mod = MODULE_IDS.find((m) => m === id);
  if (!mod) throw new ServiceError("not_found", `Module ${id} not found.`);
  return mod;
}

export const tradeKnowledgeChecks = router
  .openapi(submitAttemptRoute, async (c) => {
    const { id } = c.req.valid("param");
    const moduleId = resolveModuleId(id);
    const body = c.req.valid("json");
    const result = await submitKnowledgeCheckAttempt(await contextFor(c.get("user")), moduleId, body);
    return c.json(result, 200);
  })
  .openapi(listAttemptsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const moduleId = resolveModuleId(id);
    const { enrollmentId } = c.req.valid("query");
    const result = await listKnowledgeCheckAttempts(await contextFor(c.get("user")), moduleId, enrollmentId);
    return c.json(result, 200);
  })
  .openapi(cohortStatsRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await getCohortKnowledgeCheckStats(await contextFor(c.get("user")), id);
    return c.json(result, 200);
  });
