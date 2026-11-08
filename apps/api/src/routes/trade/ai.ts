import { createRoute } from "@hono/zod-openapi";
import { AiExchangeList, AiPromptParam, AiSuggestion, RunAiPromptBody } from "../../schemas/trade";
import { listAiExchanges, runAiPrompt } from "../../services/trade-ai";
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

export const tradeAi = ai
  .openapi(runRoute, async (c) => {
    const { id, promptId } = c.req.valid("param");
    return c.json(await runAiPrompt(await contextFor(c.get("user")), id, promptId, c.req.valid("json")), 200);
  })
  .openapi(logRoute, async (c) => c.json(await listAiExchanges(await contextFor(c.get("user"))), 200));
