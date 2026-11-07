import { createRoute } from "@hono/zod-openapi";
import { Catalogue } from "../../schemas/trade";
import { getCatalogue } from "../../services/trade-catalogue";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

// The pilot's SMEs by cohort. Staff only.

const tags = ["TRADE SME catalogue"];
const catalogue = clearRouter("trade");

const listRoute = createRoute({
  method: "get",
  path: "/catalogue",
  tags,
  summary: "The pilot SMEs, by cohort",
  description:
    "Cohort 1 is the leather businesses in the SME register; cohort 2 is the agro-processing businesses that applied to the training programme, and cohort 3 the Export Growth Companies cohort, each listed once, from Ethiopia only. A business that is in more than one cohort is marked in each. Entrust staff only.",
  responses: { 200: { description: "The catalogue", content: json(Catalogue) }, ...listErrors, 403: problem("The caller isn't Entrust staff") },
});

export const tradeCatalogue = catalogue.openapi(listRoute, async (c) => c.json(await getCatalogue(await contextFor(c.get("user"))), 200));
