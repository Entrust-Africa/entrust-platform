import { createRoute } from "@hono/zod-openapi";
import { CreateTransactionBody, TransactionList, TransactionParam, TransactionQuery, TransactionView, UpdateTransactionBody } from "../../schemas/trade";
import { createTransaction, listTransactions, updateTransaction } from "../../services/trade-transactions";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE export transactions"];
const router = clearRouter("trade");

const listRoute = createRoute({
  method: "get",
  path: "/transactions",
  tags,
  summary: "List an SME's export transactions",
  description: "Active or planned exports, with the business's real CLEAR cases it can link them to.",
  request: { query: TransactionQuery },
  responses: { 200: { description: "The transactions", content: json(TransactionList) }, ...listErrors },
});

const createTransactionRoute = createRoute({
  method: "post",
  path: "/transactions",
  tags,
  summary: "Start an export transaction",
  description: "Creates the record and its unique reference. A practice transaction is labelled as one.",
  request: { body: { content: json(CreateTransactionBody), required: true } },
  responses: { 201: { description: "The transaction", content: json(TransactionView) }, ...writeErrors },
});

const updateRoute = createRoute({
  method: "patch",
  path: "/transactions/{id}",
  tags,
  summary: "Update an export transaction",
  description: "Updates what the business records about it, including its linked CLEAR case. This doesn't certify compliance or approve a shipment.",
  request: { params: TransactionParam, body: { content: json(UpdateTransactionBody), required: true } },
  responses: { 200: { description: "The transaction", content: json(TransactionView) }, ...writeErrors },
});

export const tradeTransactions = router
  .openapi(listRoute, async (c) => c.json(await listTransactions(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(createTransactionRoute, async (c) => c.json(await createTransaction(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(updateRoute, async (c) => c.json(await updateTransaction(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200));
