import { createRoute } from "@hono/zod-openapi";
import {
  CreateModuleSubmissionBody,
  ModuleSubmissionList,
  ModuleSubmissionListQuery,
  ModuleSubmissionView,
  OverrideScoreBody,
  RubricAssessmentView,
  ScoreSubmissionBody,
  SubmissionParam,
  SubmissionScoresList,
} from "../../schemas/trade";
import {
  createModuleSubmission,
  getModuleSubmission,
  listModuleSubmissions,
  listSubmissionScores,
  overrideRubricScore,
  scoreModuleSubmission,
} from "../../services/trade-assessor-scoring";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

const tags = ["TRADE module submissions & assessor scoring"];
const router = clearRouter("trade");

const createSubmissionRoute = createRoute({
  method: "post",
  path: "/module-submissions",
  tags,
  summary: "Submit module practical deliverable",
  description:
    "Takes a snapshot of the worksheet version and linked evidence. Moves module progress to submitted.",
  request: {
    body: { content: { "application/json": { schema: CreateModuleSubmissionBody } } },
  },
  responses: {
    200: { description: "Created submission", content: json(ModuleSubmissionView) },
    ...writeErrors,
    400: problem("Prerequisite theory incomplete or module outside plan"),
    403: problem("Caller lacks permission or is read-only staff"),
    404: problem("Enrollment or worksheet version not found"),
  },
});

const listSubmissionsRoute = createRoute({
  method: "get",
  path: "/module-submissions",
  tags,
  summary: "List module submissions (Assessor queue)",
  description:
    "Assessor queue sorted by waiting time for pending submissions. Filterable by cohort, module, and status.",
  request: {
    query: ModuleSubmissionListQuery,
  },
  responses: {
    200: { description: "Submissions queue list", content: json(ModuleSubmissionList) },
    ...listErrors,
    403: problem("Caller lacks permission"),
  },
});

const getSubmissionRoute = createRoute({
  method: "get",
  path: "/module-submissions/{id}",
  tags,
  summary: "View a module submission",
  description: "View submission details, worksheet snapshot, and official score.",
  request: {
    params: SubmissionParam,
  },
  responses: {
    200: { description: "Submission details", content: json(ModuleSubmissionView) },
    ...listErrors,
    403: problem("Caller lacks permission"),
    404: problem("Submission not found"),
  },
});

const scoreSubmissionRoute = createRoute({
  method: "post",
  path: "/module-submissions/{id}/score",
  tags,
  summary: "Score a submission against its rubric",
  description:
    "Staff assessor scores rubric criteria. A second assessor can score independently for blind pilot audit.",
  request: {
    params: SubmissionParam,
    body: { content: { "application/json": { schema: ScoreSubmissionBody } } },
  },
  responses: {
    200: { description: "Rubric assessment evaluation", content: json(RubricAssessmentView) },
    ...writeErrors,
    400: problem("Invalid scores or already scored by assessor"),
    403: problem("Only staff assessors can score submissions"),
    404: problem("Submission not found"),
  },
});

const overrideScoreRoute = createRoute({
  method: "patch",
  path: "/module-submissions/{id}/score",
  tags,
  summary: "Override a submission score (Admin only)",
  description:
    "Allows Entrust administrators to change a score with a required justification reason, recorded in audit log.",
  request: {
    params: SubmissionParam,
    body: { content: { "application/json": { schema: OverrideScoreBody } } },
  },
  responses: {
    200: { description: "Overridden rubric assessment", content: json(RubricAssessmentView) },
    ...writeErrors,
    400: problem("Invalid override values"),
    403: problem("Only Entrust administrators can override scores"),
    404: problem("Submission or score not found"),
  },
});

const listScoresRoute = createRoute({
  method: "get",
  path: "/module-submissions/{id}/scores",
  tags,
  summary: "List scores on a submission",
  description:
    "Lists evaluation scores. SME users only see the official first score; staff assessors see all blind scores.",
  request: {
    params: SubmissionParam,
  },
  responses: {
    200: { description: "Scores list", content: json(SubmissionScoresList) },
    ...listErrors,
    403: problem("Caller lacks permission"),
    404: problem("Submission not found"),
  },
});

export const tradeSubmissions = router
  .openapi(createSubmissionRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createModuleSubmission(await contextFor(c.get("user")), body);
    return c.json(result, 200);
  })
  .openapi(listSubmissionsRoute, async (c) => {
    const query = c.req.valid("query");
    const items = await listModuleSubmissions(await contextFor(c.get("user")), query);
    return c.json({ items }, 200);
  })
  .openapi(getSubmissionRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await getModuleSubmission(await contextFor(c.get("user")), id);
    return c.json(result, 200);
  })
  .openapi(scoreSubmissionRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await scoreModuleSubmission(await contextFor(c.get("user")), id, body);
    return c.json(result, 200);
  })
  .openapi(overrideScoreRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await overrideRubricScore(await contextFor(c.get("user")), id, body);
    return c.json(result, 200);
  })
  .openapi(listScoresRoute, async (c) => {
    const { id } = c.req.valid("param");
    const result = await listSubmissionScores(await contextFor(c.get("user")), id);
    return c.json(result, 200);
  });
