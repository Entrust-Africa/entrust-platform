import { createRoute } from "@hono/zod-openapi";
import {
  PriceTableCreated,
  PriceTableDetail,
  PriceTableList,
  PriceTableParam,
  RecordPriceTableBody,
  UploadPriceCsvBody,
} from "../../schemas/clear";
import { getPriceTable, listPriceTables, recordPriceCsv, recordPriceTable } from "../../services/minimum-prices";
import { clearRouter, contextFor, json, listErrors, problem } from "./shared";

const tags = ["CLEAR minimum export prices"];

const staffErrors = {
  ...listErrors,
  403: problem("The caller isn't Entrust staff, or their role can't make this change"),
};
const writeErrors = { ...staffErrors, 422: problem("The prices aren't allowed. The message lists every problem, with its row or line.") };

const prices = clearRouter();

const listRoute = createRoute({
  method: "get",
  path: "/minimum-prices",
  tags,
  summary: "List the minimum export price tables",
  description:
    "Every table that has been loaded, newest first, without its prices. Tables are kept: a corrected table is a new one, and the latest table that covers a day decides its price. Entrust staff only.",
  responses: { 200: { description: "The tables", content: json(PriceTableList) }, ...staffErrors },
});

const getRoute = createRoute({
  method: "get",
  path: "/minimum-prices/{id}",
  tags,
  summary: "View a minimum export price table",
  request: { params: PriceTableParam },
  responses: { 200: { description: "The table with its prices", content: json(PriceTableDetail) }, ...staffErrors, 404: problem("No such table") },
});

const recordRoute = createRoute({
  method: "post",
  path: "/minimum-prices",
  tags,
  summary: "Type in a minimum export price table",
  description:
    "ECTA sets a minimum export price for coffee every week and doesn't publish it online, so an Entrust admin enters the figures. One entry per price: the days it applies to (both ends included), washed or unwashed, grade, an optional origin, the unit (USD/kg or USD/lb) and the price. Open cases whose contract the prices cover are checked again. Entrust admins only.",
  request: { body: { required: true, content: json(RecordPriceTableBody) } },
  responses: { 201: { description: "The new table", content: json(PriceTableCreated) }, ...writeErrors },
});

const uploadRoute = createRoute({
  method: "post",
  path: "/minimum-prices/csv",
  tags,
  summary: "Upload a minimum export price table as CSV",
  description:
    "The same as typing a table in, from the text of a CSV file. The header names the columns: effective_from, effective_to, coffee_type, grade, unit, min_price and optionally origin, in any order. The whole file is refused if any row is wrong. Entrust admins only.",
  request: { body: { required: true, content: json(UploadPriceCsvBody) } },
  responses: { 201: { description: "The new table", content: json(PriceTableCreated) }, ...writeErrors },
});

export const clearMinimumPrices = prices
  .openapi(listRoute, async (c) => c.json({ items: await listPriceTables(await contextFor(c.get("user"))) }, 200))
  .openapi(getRoute, async (c) => {
    const { id } = c.req.valid("param");
    return c.json(await getPriceTable(await contextFor(c.get("user")), id), 200);
  })
  .openapi(recordRoute, async (c) => c.json(await recordPriceTable(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(uploadRoute, async (c) => c.json(await recordPriceCsv(await contextFor(c.get("user")), c.req.valid("json")), 201));
