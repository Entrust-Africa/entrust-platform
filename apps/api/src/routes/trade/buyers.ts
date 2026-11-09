import { createRoute, z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import { VERIFICATION_LADDER_STATUSES } from "@entrust/trade-engine";
import { addBuyer, listBuyers, updateBuyer } from "../../services/trade-buyers";
import { addCost, addDocument, addEvent, listCosts, listDocuments, listEvents, removeDocument } from "../../services/trade-transaction-records";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE buyers and transaction records"];
const router = clearRouter("trade");

const text = z.string().trim().max(2000);
const optionalText = text.nullable().optional();
const id = z.object({ id: z.uuid() });
const txId = z.object({ id: z.uuid() });
const ok = (description: string, schema: z.ZodType) => ({ description, content: json(schema) });

const Buyer = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    name: z.string(),
    country: z.string(),
    website: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.string().nullable(),
    verificationStatus: z.enum(VERIFICATION_LADDER_STATUSES),
    evidenceNote: z.string().nullable(),
    opportunities: z.number(),
    transactions: z.number(),
    createdAt: z.string(),
  })
  .openapi("TradeBuyer");
const BuyerBody = z
  .object({ organizationId: z.string().optional(), name: text.min(1, "Name the buyer"), country: optionalText, website: optionalText, contactName: optionalText, contactEmail: z.email().nullable().optional() })
  .openapi("TradeBuyerBody");
const BuyerPatch = z
  .object({ website: optionalText, contactName: optionalText, contactEmail: z.email().nullable().optional(), evidenceNote: optionalText, verificationStatus: z.enum(VERIFICATION_LADDER_STATUSES).optional() })
  .openapi("TradeBuyerPatch");

const Event = z.object({ id: z.string(), type: z.enum(schema.TRANSACTION_EVENT_TYPES), summary: z.string(), occurredAt: z.string() }).openapi("TradeTransactionEvent");
const Document = z.object({ id: z.string(), kind: z.enum(schema.TRANSACTION_DOCUMENT_KINDS), name: z.string(), fileId: z.string().nullable(), notes: z.string().nullable(), createdAt: z.string() }).openapi("TradeTransactionDocument");
const Cost = z.object({ id: z.string(), category: z.enum(schema.TRANSACTION_COST_CATEGORIES), basis: z.enum(schema.TRANSACTION_COST_BASES), amount: z.string(), currency: z.string(), note: z.string().nullable(), createdAt: z.string() }).openapi("TradeTransactionCost");
const Costs = z
  .object({ revisions: z.array(Cost), current: z.array(Cost), totals: z.array(z.object({ basis: z.string(), currency: z.string(), total: z.string() })) })
  .openapi("TradeTransactionCosts");

const buyerList = createRoute({ method: "get", path: "/buyers", tags, summary: "A business's buyers", description: "The one record each buyer has, shared by the pipeline, the relationship register and the export transactions.", request: { query: z.object({ organizationId: z.string().optional() }) }, responses: { 200: ok("Buyers", z.object({ organizationId: z.string(), items: z.array(Buyer) })), ...listErrors } });
const buyerAdd = createRoute({ method: "post", path: "/buyers", tags, summary: "Add a buyer", request: { body: { content: json(BuyerBody), required: true } }, responses: { 201: ok("The buyer", Buyer), ...writeErrors } });
const buyerPatch = createRoute({ method: "patch", path: "/buyers/{id}", tags, summary: "Update a buyer, or set how far it has been verified", description: "Only staff set the evidence status by hand; it carries to the buyer's opportunities.", request: { params: id, body: { content: json(BuyerPatch), required: true } }, responses: { 200: ok("The buyer", Buyer), ...writeErrors } });

const eventList = createRoute({ method: "get", path: "/transactions/{id}/events", tags, summary: "What happened on a transaction, newest first", request: { params: txId }, responses: { 200: ok("Events", z.object({ items: z.array(Event) })), ...listErrors } });
const eventAdd = createRoute({ method: "post", path: "/transactions/{id}/events", tags, summary: "Add a note, exception or payment to a transaction", request: { params: txId, body: { content: json(z.object({ type: z.enum(["note", "exception", "payment"]), summary: text.min(1, "Say what happened"), occurredAt: z.iso.datetime().optional() })), required: true } }, responses: { 201: ok("The event", Event), ...writeErrors } });
const docList = createRoute({ method: "get", path: "/transactions/{id}/documents", tags, summary: "A transaction's documents", request: { params: txId }, responses: { 200: ok("Documents", z.object({ items: z.array(Document) })), ...listErrors } });
const docAdd = createRoute({ method: "post", path: "/transactions/{id}/documents", tags, summary: "Add a document to a transaction", request: { params: txId, body: { content: json(z.object({ kind: z.enum(schema.TRANSACTION_DOCUMENT_KINDS), name: text.min(1, "Name the document"), fileId: z.uuid().nullable().optional(), notes: optionalText })), required: true } }, responses: { 201: ok("The document", Document), ...writeErrors } });
const docRemove = createRoute({ method: "delete", path: "/transactions/{id}/documents/{documentId}", tags, summary: "Remove a document from a transaction", request: { params: z.object({ id: z.uuid(), documentId: z.uuid() }) }, responses: { 200: ok("Removed", z.object({ ok: z.literal(true) })), ...writeErrors } });
const costList = createRoute({ method: "get", path: "/transactions/{id}/costs", tags, summary: "A transaction's costs, with every revision", description: "Quoted, expected and actual figures by category. A new figure is a revision; the newest counts. Currencies are never added together.", request: { params: txId }, responses: { 200: ok("Costs", Costs), ...listErrors } });
const costAdd = createRoute({ method: "post", path: "/transactions/{id}/costs", tags, summary: "Record a cost figure", request: { params: txId, body: { content: json(z.object({ category: z.enum(schema.TRANSACTION_COST_CATEGORIES), basis: z.enum(schema.TRANSACTION_COST_BASES), amount: z.number().min(0).max(1e12), currency: z.string().trim().length(3), note: optionalText })), required: true } }, responses: { 201: ok("The figure", Cost), ...writeErrors } });

export const tradeBuyers = router
  .openapi(buyerList, async (c) => c.json(await listBuyers(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(buyerAdd, async (c) => c.json(await addBuyer(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(buyerPatch, async (c) => c.json(await updateBuyer(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(eventList, async (c) => c.json(await listEvents(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(eventAdd, async (c) => c.json(await addEvent(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201))
  .openapi(docList, async (c) => c.json(await listDocuments(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(docAdd, async (c) => c.json(await addDocument(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201))
  .openapi(docRemove, async (c) => c.json(await removeDocument(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("param").documentId), 200))
  .openapi(costList, async (c) => c.json(await listCosts(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(costAdd, async (c) => c.json(await addCost(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 201));
