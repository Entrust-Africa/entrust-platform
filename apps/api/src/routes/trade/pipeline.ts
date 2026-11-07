import { createRoute } from "@hono/zod-openapi";
import {
  ActivityList,
  ActivityView,
  CreateOpportunityActivityBody,
  CreateOpportunityBody,
  ExportJourneyStageView,
  OpportunityList,
  OpportunityParam,
  OpportunityScorecardBody,
  OpportunityView,
  PipelineQuery,
  UpdateOpportunityStageBody,
} from "../../schemas/trade";
import {
  createOpportunity,
  getExportJourneyStage,
  listOpportunities,
  listOpportunityActivities,
  recordOpportunityActivity,
  scoreOpportunity,
  updateOpportunityStage,
} from "../../services/trade-pipeline";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

const tags = ["TRADE buyer pipeline"];
const router = clearRouter("trade");

const listOpportunitiesRoute = createRoute({
  method: "get",
  path: "/pipeline",
  tags,
  summary: "List buyer opportunities",
  description: "Opportunities tracked for an SME organization, with activity counts and latest activity.",
  request: { query: PipelineQuery },
  responses: {
    200: { description: "Opportunity list", content: json(OpportunityList) },
    ...listErrors,
  },
});

const createOpportunityRoute = createRoute({
  method: "post",
  path: "/pipeline",
  tags,
  summary: "Create a commercial opportunity",
  description: "Create a new buyer lead / commercial opportunity with source links and qualification metadata.",
  request: { body: { content: json(CreateOpportunityBody), required: true } },
  responses: {
    201: { description: "Created opportunity", content: json(OpportunityView) },
    ...writeErrors,
  },
});

const updateStageRoute = createRoute({
  method: "patch",
  path: "/pipeline/{id}/stage",
  tags,
  summary: "Update pipeline stage",
  description: "Advances or updates opportunity stage. Refused if no commercial activity exists for the lead.",
  request: {
    params: OpportunityParam,
    body: { content: json(UpdateOpportunityStageBody), required: true },
  },
  responses: {
    200: { description: "Updated opportunity", content: json(OpportunityView) },
    ...writeErrors,
    404: problem("Opportunity not found"),
    422: problem("Stage transition requires at least one recorded commercial activity for this lead."),
  },
});

const recordActivityRoute = createRoute({
  method: "post",
  path: "/pipeline/{id}/activities",
  tags,
  summary: "Record commercial activity",
  description: "Logs a touchpoint (call, email, meeting, RFQ) against an opportunity.",
  request: {
    params: OpportunityParam,
    body: { content: json(CreateOpportunityActivityBody), required: true },
  },
  responses: {
    201: { description: "Created activity", content: json(ActivityView) },
    ...writeErrors,
    404: problem("Opportunity not found"),
  },
});

const listActivitiesRoute = createRoute({
  method: "get",
  path: "/pipeline/{id}/activities",
  tags,
  summary: "List opportunity activities",
  description: "Lists all logged activities and follow-ups for a buyer lead.",
  request: {
    params: OpportunityParam,
  },
  responses: {
    200: { description: "Activity list", content: json(ActivityList) },
    ...listErrors,
    404: problem("Opportunity not found"),
  },
});

const scoreOpportunityRoute = createRoute({
  method: "post",
  path: "/pipeline/{id}/scorecard",
  tags,
  summary: "Evaluate qualification scorecard",
  description: "Evaluates 6 qualification criteria (0-5) and stores total score and qualification band.",
  request: {
    params: OpportunityParam,
    body: { content: json(OpportunityScorecardBody), required: true },
  },
  responses: {
    200: { description: "Updated opportunity with scorecard", content: json(OpportunityView) },
    ...writeErrors,
    404: problem("Opportunity not found"),
  },
});

const getJourneyStageRoute = createRoute({
  method: "get",
  path: "/pipeline/journey",
  tags,
  summary: "Get export journey stage",
  description: "Calculates the SME's current 10-stage export journey stage and M05 deliverable status.",
  request: { query: PipelineQuery },
  responses: {
    200: { description: "Export journey stage", content: json(ExportJourneyStageView) },
    ...listErrors,
  },
});

export const tradePipeline = router
  .openapi(listOpportunitiesRoute, async (c) => {
    const query = c.req.valid("query");
    const items = await listOpportunities(await contextFor(c.get("user")), query);
    return c.json({ items }, 200);
  })
  .openapi(createOpportunityRoute, async (c) => {
    const body = c.req.valid("json");
    const result = await createOpportunity(await contextFor(c.get("user")), body);
    return c.json(result, 201);
  })
  .openapi(getJourneyStageRoute, async (c) => {
    const query = c.req.valid("query");
    const result = await getExportJourneyStage(await contextFor(c.get("user")), query);
    return c.json(result, 200);
  })
  .openapi(updateStageRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { stage } = c.req.valid("json");
    const result = await updateOpportunityStage(await contextFor(c.get("user")), id, stage);
    return c.json(result, 200);
  })
  .openapi(recordActivityRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await recordOpportunityActivity(await contextFor(c.get("user")), id, body);
    return c.json(result, 201);
  })
  .openapi(listActivitiesRoute, async (c) => {
    const { id } = c.req.valid("param");
    const items = await listOpportunityActivities(await contextFor(c.get("user")), id);
    return c.json({ items }, 200);
  })
  .openapi(scoreOpportunityRoute, async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await scoreOpportunity(await contextFor(c.get("user")), id, body);
    return c.json(result, 200);
  });
