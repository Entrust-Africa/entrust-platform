import { createRoute, z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";
import { listIntegrations, recordIntegration } from "../../services/trade-integrations";
import { createReferral, decideConsent, listReferrals, referralEvents, referralPackage, requestConsent, setReferralStatus } from "../../services/trade-referrals";
import { clearRouter, contextFor, json, listErrors, writeErrors } from "../clear/shared";

const tags = ["TRADE referrals and integrations"];
const router = clearRouter("trade");
const ok = (description: string, schema: z.ZodType) => ({ description, content: json(schema) });
const id = z.object({ id: z.uuid() });
const text = z.string().trim().max(2000);

const Referral = z
  .object({
    id: z.string(),
    organizationId: z.string(),
    organizationName: z.string(),
    destinationName: z.string(),
    destinationType: z.enum(schema.REFERRAL_DESTINATION_TYPES),
    reason: z.string(),
    sharedDataKinds: z.array(z.enum(schema.REFERRAL_DATA_KINDS)),
    consentStatus: z.enum(schema.REFERRAL_CONSENT_STATUSES),
    consentAt: z.string().nullable(),
    status: z.enum(schema.REFERRAL_STATUSES),
    referralDate: z.string().nullable(),
    responsible: z.string().nullable(),
    outcome: z.string().nullable(),
    createdAt: z.string(),
  })
  .openapi("TradeReferral");

const list = createRoute({ method: "get", path: "/referrals", tags, summary: "Partner referrals", description: "A business sees its own, once staff have asked for its consent. Staff see those of the businesses they work with.", request: { query: z.object({ organizationId: z.string().optional(), status: z.enum(schema.REFERRAL_STATUSES).optional() }) }, responses: { 200: ok("Referrals", z.object({ items: z.array(Referral) })), ...listErrors } });
const create = createRoute({
  method: "post",
  path: "/referrals",
  tags,
  summary: "Refer a business to a bank, insurer or service provider",
  description: "Staff only. Nothing is shared: the referral lists what the business would be asked to release, and waits for its consent.",
  request: { body: { content: json(z.object({ organizationId: z.string(), destinationName: text.min(1, "Name the partner"), destinationType: z.enum(schema.REFERRAL_DESTINATION_TYPES), reason: text.min(1, "Say why"), sharedDataKinds: z.array(z.enum(schema.REFERRAL_DATA_KINDS)).max(4), responsibleUserId: z.string().nullable().optional() })), required: true } },
  responses: { 201: ok("The referral", Referral), ...writeErrors },
});
const ask = createRoute({ method: "post", path: "/referrals/{id}/request-consent", tags, summary: "Ask the business to agree", request: { params: id }, responses: { 200: ok("The referral", Referral), ...writeErrors } });
const consent = createRoute({ method: "post", path: "/referrals/{id}/consent", tags, summary: "The business grants, declines or withdraws its consent", description: "Owners only. Consent is for this partner, this purpose and these kinds of information.", request: { params: id, body: { content: json(z.object({ decision: z.enum(["grant", "decline", "withdraw"]) })), required: true } }, responses: { 200: ok("The referral", Referral), ...writeErrors } });
const release = createRoute({ method: "post", path: "/referrals/{id}/release", tags, summary: "Release the information the business agreed to share", description: "Staff only. Refused unless consent is granted now. Returns only the agreed kinds, and records the release.", request: { params: id }, responses: { 200: ok("The package", z.object({ referralId: z.string(), destinationName: z.string(), purpose: z.string(), consentAt: z.string().nullable(), kinds: z.array(z.string()) }).catchall(z.unknown())), ...writeErrors } });
const status = createRoute({ method: "post", path: "/referrals/{id}/status", tags, summary: "Record where a referral got to", request: { params: id, body: { content: json(z.object({ status: z.enum(["accepted", "declined", "completed", "closed"]), outcome: text.nullable().optional() })), required: true } }, responses: { 200: ok("The referral", Referral), ...writeErrors } });
const events = createRoute({ method: "get", path: "/referrals/{id}/events", tags, summary: "A referral's history: consent, releases and status changes", request: { params: id }, responses: { 200: ok("Events", z.object({ items: z.array(z.object({ id: z.string(), type: z.string(), note: z.string().nullable(), detail: z.record(z.string(), z.unknown()).nullable(), createdAt: z.string() })) })), ...listErrors } });

const Integrations = z
  .object({
    organizationId: z.string(),
    providers: z.array(z.object({ provider: z.enum(schema.INTEGRATION_PROVIDERS), available: z.boolean(), status: z.enum(["pending", "synced", "failed"]) })),
    items: z.array(z.object({ id: z.string(), provider: z.enum(schema.INTEGRATION_PROVIDERS), recordType: z.string(), externalReference: z.string().nullable(), syncStatus: z.enum(schema.INTEGRATION_SYNC_STATUSES), lastSyncAt: z.string().nullable(), errorCode: z.string().nullable(), errorDescription: z.string().nullable() })),
  })
  .openapi("TradeIntegrations");
const integrations = createRoute({ method: "get", path: "/integrations", tags, summary: "How each outside system stands for a business", description: "MIZAN isn't built, so it shows as pending. A failed sync is shown here and never stops learning.", request: { query: z.object({ organizationId: z.string().optional() }) }, responses: { 200: ok("Integrations", Integrations), ...listErrors } });
const recordIt = createRoute({
  method: "post",
  path: "/integrations",
  tags,
  summary: "Record a sync",
  description: "Super Admin only. The same business, provider and record type is updated rather than repeated.",
  request: { body: { content: json(z.object({ organizationId: z.string(), provider: z.enum(schema.INTEGRATION_PROVIDERS), recordType: text.min(1), externalReference: text.nullable().optional(), syncStatus: z.enum(schema.INTEGRATION_SYNC_STATUSES), errorCode: text.nullable().optional(), errorDescription: text.nullable().optional() })), required: true } },
  responses: { 200: ok("The record", Integrations.shape.items.element), ...writeErrors },
});

export const tradeReferrals = router
  .openapi(list, async (c) => c.json(await listReferrals(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(create, async (c) => c.json(await createReferral(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(ask, async (c) => c.json(await requestConsent(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(consent, async (c) => c.json(await decideConsent(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(release, async (c) => c.json((await referralPackage(await contextFor(c.get("user")), c.req.valid("param").id)) as never, 200))
  .openapi(status, async (c) => c.json(await setReferralStatus(await contextFor(c.get("user")), c.req.valid("param").id, c.req.valid("json")), 200))
  .openapi(events, async (c) => c.json(await referralEvents(await contextFor(c.get("user")), c.req.valid("param").id), 200))
  .openapi(integrations, async (c) => c.json(await listIntegrations(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(recordIt, async (c) => c.json(await recordIntegration(await contextFor(c.get("user")), c.req.valid("json")), 200));
