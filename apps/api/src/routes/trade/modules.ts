import { createRoute } from "@hono/zod-openapi";
import { ModuleDetail, ModuleList, ModuleParam, ModuleQuery } from "../../schemas/trade";
import { getTradeModule, listTradeModules } from "../../services/trade-modules";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

const tags = ["TRADE modules"];

const modules = clearRouter();

const forbidden = problem("The caller's organisation doesn't have TRADE access");

const listRoute = createRoute({
  method: "get",
  path: "/modules",
  tags,
  summary: "List the twelve modules",
  description:
    "Every module with its content status. Modules whose content isn't approved yet are \"in production\" for an SME and show only the title and deliverable. Entrust staff also see drafts.",
  responses: { 200: { description: "The modules", content: json(ModuleList) }, ...listErrors, 403: forbidden },
});

const getRoute = createRoute({
  method: "get",
  path: "/modules/{id}",
  tags,
  summary: "View a module",
  description:
    "The newest version the caller can open, or the one named in `version`. A learner keeps the version they started, so callers pass it to stay on it. An SME never receives answer keys or staff-only material.",
  request: { params: ModuleParam, query: ModuleQuery },
  responses: {
    200: { description: "The module and its content", content: json(ModuleDetail) },
    ...listErrors,
    403: forbidden,
    404: problem("No such module or version"),
  },
});

export const tradeModules = modules
  .openapi(listRoute, async (c) => c.json({ items: await listTradeModules(await contextFor(c.get("user"))) }, 200))
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    const { version } = c.req.valid("query");
    return c.json(await getTradeModule(await contextFor(c.get("user")), id, version), 200);
  });
