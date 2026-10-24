import { createRoute } from "@hono/zod-openapi";
import { RulePackDetail, RulePackList, RulePackParam } from "../../schemas/clear";
import { getRulePack, listRulePacks } from "../../services/rule-packs";
import { clearRouter, json, listErrors, problem } from "./shared";

const tags = ["CLEAR rule packs"];

const packs = clearRouter();

const listRoute = createRoute({
  method: "get",
  path: "/rule-packs",
  tags,
  summary: "List the rule packs",
  description:
    "Every published version of every corridor's rule pack, newest first within each pack. New cases get the newest version for their product and destination; a case keeps the version it was opened with until it is re-evaluated.",
  responses: { 200: { description: "The pack versions", content: json(RulePackList) }, ...listErrors },
});

const getRoute = createRoute({
  method: "get",
  path: "/rule-packs/{id}/versions/{version}",
  tags,
  summary: "View a rule pack version",
  description:
    "The version's requirements: what each asks, who acts, its basis (confirmed, conditional, awaiting verification or a transaction term), its sources, the day they were checked, and the canonical steps it sits on.",
  request: { params: RulePackParam },
  responses: { 200: { description: "The pack version", content: json(RulePackDetail) }, ...listErrors, 404: problem("No such pack version") },
});

export const clearRulePacks = packs
  .openapi(listRoute, async (c) => c.json({ items: listRulePacks() }, 200))
  .openapi(getRoute, async (c) => {
    const { id, version } = c.req.valid("param");
    return c.json(getRulePack(id, version), 200);
  });
