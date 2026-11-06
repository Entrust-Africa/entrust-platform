import { createRoute } from "@hono/zod-openapi";
import {
  ApprovePlanBody,
  CreateExemptionBody,
  ExemptionListQuery,
  ExemptionParam,
  LearningPlanList,
  LearningPlanListQuery,
  LearningPlanSchema,
  ModuleExemptionList,
  ModuleExemptionSchema,
  OverridePlanBody,
  PlanParam,
  ReviewExemptionBody,
} from "../../schemas/trade";
import {
  approvePlan,
  createExemption,
  getPlan,
  listExemptions,
  listPlans,
  overridePlan,
  reviewExemption,
} from "../../services/trade-plans";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE plans & exemptions"];
const router = clearRouter("trade");

const listPlansRoute = createRoute({
  method: "get",
  path: "/plans",
  tags,
  summary: "List learning plans",
  description:
    "Queries learning plans across enrollments. Entrust staff can filter review queue (e.g. requiresHumanReview=true or status=review_required).",
  request: { query: LearningPlanListQuery },
  responses: {
    200: { description: "List of learning plans", content: json(LearningPlanList) },
    ...listErrors,
  },
});

const getPlanRoute = createRoute({
  method: "get",
  path: "/plans/{id}",
  tags,
  summary: "Get a learning plan",
  description: "Fetches details of a learning plan including assigned modules and sequence.",
  request: { params: PlanParam },
  responses: {
    200: { description: "The learning plan", content: json(LearningPlanSchema) },
    ...listErrors,
  },
});

const approvePlanRoute = createRoute({
  method: "post",
  path: "/plans/{id}/approve",
  tags,
  summary: "Approve a learning plan",
  description: "Entrust staff approves a generated or review-required learning plan.",
  request: {
    params: PlanParam,
    body: { content: json(ApprovePlanBody), required: false },
  },
  responses: {
    200: { description: "The approved learning plan", content: json(LearningPlanSchema) },
    ...writeErrors,
  },
});

const overridePlanRoute = createRoute({
  method: "post",
  path: "/plans/{id}/override",
  tags,
  summary: "Override a learning plan",
  description:
    "Entrust staff modifies assigned modules (additions, removals, sequence changes). A reason is mandatory.",
  request: {
    params: PlanParam,
    body: { content: json(OverridePlanBody), required: true },
  },
  responses: {
    200: { description: "The overridden learning plan", content: json(LearningPlanSchema) },
    ...writeErrors,
  },
});

const listExemptionsRoute = createRoute({
  method: "get",
  path: "/exemptions",
  tags,
  summary: "List module exemptions",
  description: "Queries module exemptions for an enrollment or organization.",
  request: { query: ExemptionListQuery },
  responses: {
    200: { description: "List of module exemptions", content: json(ModuleExemptionList) },
    ...listErrors,
  },
});

const createExemptionRoute = createRoute({
  method: "post",
  path: "/exemptions",
  tags,
  summary: "Request a module exemption",
  description:
    "SME learner or staff requests an exemption from a module backed by an evidence record.",
  request: {
    body: { content: json(CreateExemptionBody), required: true },
  },
  responses: {
    201: { description: "The requested module exemption", content: json(ModuleExemptionSchema) },
    ...writeErrors,
  },
});

const reviewExemptionRoute = createRoute({
  method: "post",
  path: "/exemptions/{id}/review",
  tags,
  summary: "Review a module exemption",
  description:
    "Entrust staff reviews an exemption request (approve/reject). Approval marks module progress as exempted.",
  request: {
    params: ExemptionParam,
    body: { content: json(ReviewExemptionBody), required: true },
  },
  responses: {
    200: { description: "The reviewed module exemption", content: json(ModuleExemptionSchema) },
    ...writeErrors,
  },
});

export const tradePlans = router
  .openapi(listPlansRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const items = await listPlans(ctx, c.req.valid("query"));
    return c.json({ items }, 200);
  })
  .openapi(getPlanRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const plan = await getPlan(ctx, id);
    return c.json(plan, 200);
  })
  .openapi(approvePlanRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const plan = await approvePlan(ctx, id, c.req.valid("json") ?? {});
    return c.json(plan, 200);
  })
  .openapi(overridePlanRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const plan = await overridePlan(ctx, id, c.req.valid("json"));
    return c.json(plan, 200);
  })
  .openapi(listExemptionsRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const items = await listExemptions(ctx, c.req.valid("query"));
    return c.json({ items }, 200);
  })
  .openapi(createExemptionRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const exemption = await createExemption(ctx, c.req.valid("json"));
    return c.json(exemption, 201);
  })
  .openapi(reviewExemptionRoute, async (c) => {
    const ctx = await contextFor(c.get("user"));
    const { id } = c.req.valid("param");
    const exemption = await reviewExemption(ctx, id, c.req.valid("json"));
    return c.json(exemption, 200);
  });
