import { createRoute } from "@hono/zod-openapi";
import { ActionItemParam, ActionItemView, ActionPlanQuery, ActionPlanView, ActionReviewView, CreateActionItemBody, ImportActionRegisterBody, ImportActionRegisterView, RecordActionReviewBody, UpdateActionItemBody } from "../../schemas/trade";
import { createActionItem, getActionPlan, importActionRegister, recordActionReview, updateActionItem } from "../../services/trade-action-plan";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE action plan"];
const router = clearRouter("trade");

const getRoute = createRoute({
  method: "get",
  path: "/action-plan",
  tags,
  summary: "The 90-day action plan",
  description: "An SME's actions, progress by 30, 60 and 90-day milestone, and its follow-up reviews. Stays available after the certificate.",
  request: { query: ActionPlanQuery },
  responses: { 200: { description: "The plan", content: json(ActionPlanView) }, ...listErrors },
});

const createItemRoute = createRoute({
  method: "post",
  path: "/action-plan/items",
  tags,
  summary: "Add an action",
  description: "Adds an action with its owner and deadline.",
  request: { body: { content: json(CreateActionItemBody), required: true } },
  responses: { 201: { description: "The action", content: json(ActionItemView) }, ...writeErrors },
});

const updateItemRoute = createRoute({
  method: "patch",
  path: "/action-plan/items/{id}",
  tags,
  summary: "Update an action",
  description: "Updates an action's status, dates, evidence or comments.",
  request: { params: ActionItemParam, body: { content: json(UpdateActionItemBody), required: true } },
  responses: { 200: { description: "The action", content: json(ActionItemView) }, ...writeErrors },
});

const importRoute = createRoute({
  method: "post",
  path: "/action-plan/import",
  tags,
  summary: "Bring in the M12 action register",
  description: "Adds the actions from the newest submitted M12 register, once per version.",
  request: { body: { content: json(ImportActionRegisterBody), required: true } },
  responses: { 200: { description: "How many were brought in", content: json(ImportActionRegisterView) }, ...writeErrors },
});

const reviewRoute = createRoute({
  method: "post",
  path: "/action-plan/reviews",
  tags,
  summary: "Record a 30, 60 or 90-day review",
  description: "Answers to M12's follow-up questions, linked to the business's plan so progress can be compared over time.",
  request: { body: { content: json(RecordActionReviewBody), required: true } },
  responses: { 201: { description: "The review", content: json(ActionReviewView) }, ...writeErrors },
});

export const tradeActionPlan = router
  .openapi(getRoute, async (c) => c.json(await getActionPlan(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(createItemRoute, async (c) => c.json(await createActionItem(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(updateItemRoute, async (c) => c.json(await updateActionItem(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(importRoute, async (c) => c.json(await importActionRegister(await contextFor(c.get("user")), c.req.valid("json")), 200))
  .openapi(reviewRoute, async (c) => c.json(await recordActionReview(await contextFor(c.get("user")), c.req.valid("json")), 201));
