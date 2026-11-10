import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import { PASSPORT_STATUSES, PASSPORT_TIERS } from "@entrust/trade-engine";
import type { AppEnv } from "../../app";
import { listPassports, passportForStaff, passportPrefill, publicPassport, savePassport } from "../../services/trade-passports";
import { clearRouter, contextFor, json, listErrors, problem } from "../clear/shared";

// The Entrust Africa Verified SME Passport: a public page behind the passport's QR code, and the staff screens that make it.

const tags = ["TRADE SME passport"];
const publicRouter = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
});
const router = clearRouter("trade");

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-13.");
const line = z.string().trim().max(500);
const longText = z.string().trim().max(4000);
const optional = (s: z.ZodString) => s.nullable().transform((v) => (v ? v : null));
const list = (item: z.ZodString) => z.array(item.min(1)).max(30);

const Standing = z.enum(["active", "expired", "suspended", "revoked"]);

const PassportContent = z
  .object({
    passportId: z.string(),
    tier: z.enum(PASSPORT_TIERS),
    status: z.enum(PASSPORT_STATUSES),
    statusReason: z.string().nullable(),
    verifiedOn: day,
    validUntil: day,
    displayName: line.min(1),
    tagline: optional(line),
    country: z.string().trim().length(2).toUpperCase(),
    sector: optional(line),
    established: z.number().int().min(1800).max(2100).nullable(),
    employeesRange: optional(line),
    ownership: optional(line),
    founder: optional(line),
    headline: optional(line),
    overview: optional(longText),
    products: z.array(z.object({ name: line.min(1), detail: optional(line), code: optional(z.string().trim().max(40)) })).max(20),
    womenInTrade: list(line),
    targetMarkets: z.array(z.object({ label: line.min(1), places: list(line) })).max(10),
    seeking: optional(line),
    checks: list(line),
    website: optional(line),
    email: optional(line),
    phones: list(line),
    address: optional(line),
  })
  .openapi("TradePassport");

const SaveBody = PassportContent.omit({ passportId: true })
  .extend({
    statusReason: z.string().trim().max(500).nullable().optional().transform((v) => v ?? null),
    smeId: z.string().trim().min(1).max(40).optional(),
    applicationId: z.uuid().optional(),
  })
  .openapi("TradePassportInput");

const PublicPassport = z
  .object({
    passportId: z.string(),
    standing: Standing,
    displayName: z.string(),
    tier: z.enum(PASSPORT_TIERS),
    verifiedOn: z.string(),
    validUntil: z.string(),
    details: PassportContent.omit({ passportId: true, tier: true, status: true, statusReason: true, verifiedOn: true, validUntil: true, displayName: true }).nullable(),
  })
  .openapi("TradePublicPassport");

const Source = z.object({
  kind: z.enum(["business", "application"]),
  label: z.string(),
  smeId: z.string().nullable(),
  organizationId: z.string().nullable(),
  applicationId: z.string().nullable(),
});

const Editor = z.object({ passport: PassportContent, source: Source.nullable() }).openapi("TradePassportEditor");

const Prefill = z
  .object({
    source: Source,
    existingPassportId: z.string().nullable(),
    suggestion: PassportContent.pick({ displayName: true, country: true, sector: true, established: true, employeesRange: true, ownership: true, founder: true, website: true, email: true, phones: true, address: true }),
  })
  .openapi("TradePassportPrefill");

const List = z
  .object({
    items: z.array(z.object({ passportId: z.string(), displayName: z.string(), tier: z.enum(PASSPORT_TIERS), standing: Standing, verifiedOn: z.string(), validUntil: z.string() })),
  })
  .openapi("TradePassportList");

const publicRoute = createRoute({
  method: "get",
  path: "/passports/{passportId}/public",
  tags,
  summary: "Check an Entrust Africa Verified SME Passport",
  description:
    "What the QR code on a passport opens. It needs no sign-in. It holds only the lines Entrust staff published on the passport (never a score, a finance figure or an answer from the diagnostic). A suspended or revoked passport returns its standing and no details.",
  request: { params: z.object({ passportId: z.string().min(1).max(40) }) },
  responses: { 200: { description: "The passport", content: json(PublicPassport) }, 404: problem("No such passport") },
});

const listRoute = createRoute({
  method: "get",
  path: "/passports",
  tags,
  summary: "The passports Entrust has issued",
  description: "Every passport with its tier and standing. Entrust admins and facilitators.",
  responses: { 200: { description: "The passports", content: json(List) }, ...listErrors, 403: problem("Not Entrust staff") },
});

const prefillRoute = createRoute({
  method: "get",
  path: "/passports/prefill",
  tags,
  summary: "What is held about a business, to start a passport from",
  description:
    "Give an SME ID (a business on the platform) or an application id (a business in the SME register, Ethiopia only). It returns a suggestion made from what is held (name, country, year, ownership, and the headcount range from the diagnostic or the application) and the number of the passport already made from it, if any. The suggestion is for staff only; nothing becomes public until staff save it on the passport. Entrust admins and facilitators.",
  request: { query: z.object({ smeId: z.string().min(1).max(40).optional(), applicationId: z.uuid().optional() }) },
  responses: { 200: { description: "The suggestion", content: json(Prefill) }, ...listErrors, 403: problem("Not Entrust staff") },
});

const numberParam = z.object({ passportId: z.string().min(1).max(40) });
const editorRoute = createRoute({
  method: "get",
  path: "/passports/{passportId}",
  tags,
  summary: "One passport as staff see it",
  description: "Every line of the passport, including the reason for a suspension, and what it was made from. Entrust admins and facilitators.",
  request: { params: numberParam },
  responses: { 200: { description: "The passport", content: json(Editor) }, ...listErrors, 403: problem("Not Entrust staff") },
});

const saveRoute = createRoute({
  method: "put",
  path: "/passports/{passportId}",
  tags,
  summary: "Issue or change a passport",
  description:
    "Saves every line of the passport with this number (EA-ETH-0002). A new passport can say which business (`smeId`) or register application (`applicationId`) it was made from; the link is kept. A status other than active needs a reason. Entrust admins only; every save is audited.",
  request: { params: numberParam, body: { required: true, content: json(SaveBody) } },
  responses: {
    200: { description: "The saved passport", content: json(PassportContent) },
    ...listErrors,
    403: problem("Only Entrust admins can issue or change a passport"),
    409: problem("The business or application already has a passport"),
    422: problem("The values aren't allowed"),
  },
});

publicRouter.openapi(publicRoute, async (c) => c.json(await publicPassport(getDb(), c.req.valid("param").passportId), 200));

router
  .openapi(listRoute, async (c) => c.json(await listPassports(await contextFor(c.get("user"))), 200))
  .openapi(prefillRoute, async (c) => c.json(await passportPrefill(await contextFor(c.get("user")), c.req.valid("query")), 200))
  .openapi(editorRoute, async (c) => c.json(await passportForStaff(await contextFor(c.get("user")), c.req.valid("param").passportId), 200))
  .openapi(saveRoute, async (c) => c.json(await savePassport(await contextFor(c.get("user")), c.req.valid("param").passportId, c.req.valid("json")), 200));

export const tradePublicPassports = publicRouter;
export const tradePassports = router;
