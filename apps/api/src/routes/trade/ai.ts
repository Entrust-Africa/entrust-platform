import { createRoute } from "@hono/zod-openapi";
import { AiExchangeList, AiPromptList, AiPromptParam, AiSuggestion, RunAiPromptBody } from "../../schemas/trade";
import { listAiExchanges, runAiPrompt } from "../../services/trade-ai";
import { listAiPrompts } from "../../services/trade-modules";
import { clearRouter, contextFor, json, listErrors, problem, writeErrors } from "../clear/shared";

// The AI assistant for module exercises (#76).

const tags = ["TRADE AI assistant"];
const ai = clearRouter("trade");

const runRoute = createRoute({
  method: "post",
  path: "/modules/{id}/ai-prompts/{promptId}/run",
  tags,
  summary: "Run a module's AI prompt",
  description:
    "Fills the prompt in with the product, market and buyer given here and returns the answer, labelled as an AI suggestion, with the checks to make. It changes nothing but the assistant's own log: no score, plan, evidence status or worksheet. Only these three fields go to the provider. Limited per user per hour and by a monthly cost cap.",
  request: { params: AiPromptParam, body: { content: json(RunAiPromptBody), required: true } },
  responses: { 200: { description: "The suggestion", content: json(AiSuggestion) }, ...writeErrors, 403: problem("The organisation doesn't have TRADE access"), 429: problem("Too many requests in the last hour") },
});

const logRoute = createRoute({
  method: "get",
  path: "/ai-exchanges",
  tags,
  summary: "Review the AI assistant's log",
  description: "The newest 200 requests with what was sent and what came back, and this month's cost against the cap. For Entrust administrators.",
  responses: { 200: { description: "The log", content: json(AiExchangeList) }, ...listErrors, 403: problem("Not an Entrust administrator") },
});

const promptsRoute = createRoute({
  method: "get",
  path: "/ai-prompts",
  tags,
  summary: "List the AI prompts for the practice lab",
  description: "Every AI prompt in the modules the caller can open, with its verification checklist, to copy into a tool of their choice.",
  responses: { 200: { description: "The prompts", content: json(AiPromptList) }, ...listErrors },
});

export const tradeAi = ai
  .openapi(promptsRoute, async (c) => c.json(await listAiPrompts(await contextFor(c.get("user"))), 200))
  .openapi(runRoute, async (c) => {
    const { id, promptId } = c.req.valid("param");
    return c.json(await runAiPrompt(await contextFor(c.get("user")), id, promptId, c.req.valid("json")), 200);
  })
  .openapi(logRoute, async (c) => c.json(await listAiExchanges(await contextFor(c.get("user"))), 200));
