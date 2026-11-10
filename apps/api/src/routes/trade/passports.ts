import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { getDb } from "@entrust/db";
import { PASSPORT_STATUSES, PASSPORT_TIERS } from "@entrust/trade-engine";
import type { AppEnv } from "../../app";
import { listPassports, passportForBusiness, publicPassport, savePassport } from "../../services/trade-passports";
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

const SaveBody = PassportContent.extend({ passportId: z.string().trim().optional(), statusReason: z.string().trim().max(500).nullable().optional().transform((v) => v ?? null) }).openapi("TradePassportInput");

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

const Editor = z
  .object({
    business: z.object({ organizationId: z.string(), smeId: z.string(), legalName: z.string() }),
    passport: PassportContent.nullable(),
    suggestion: PassportContent.pick({ displayName: true, country: true, sector: true, established: true, employeesRange: true, ownership: true, website: true, email: true, phones: true, address: true }),
  })
  .openapi("TradePassportEditor");

const List = z
  .object({
    items: z.array(z.object({ passportId: z.string(), smeId: z.string(), displayName: z.string(), tier: z.enum(PASSPORT_TIERS), standing: Standing, verifiedOn: z.string(), validUntil: z.string() })),
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

const businessParam = z.object({ smeId: z.string().min(1).max(40) });
const editorRoute = createRoute({
  method: "get",
  path: "/passports/by-sme/{smeId}",
  tags,
  summary: "A business's passport and what could fill one in",
  description:
    "The business's passport, or null, with a suggestion made from what the platform holds (name, country, year, address and a headcount range taken from the diagnostic). The suggestion is for staff only; nothing becomes public until staff save it on the passport. Entrust admins and facilitators.",
  request: { params: businessParam },
  responses: { 200: { description: "The passport and the suggestion", content: json(Editor) }, ...listErrors, 403: problem("Not Entrust staff") },
});

const saveRoute = createRoute({
  method: "put",
  path: "/passports/by-sme/{smeId}",
  tags,
  summary: "Issue or change a business's passport",
  description:
    "Saves every line of the passport. The number (EA-ETH-0002) is given on the first save and can't change. A status other than active needs a reason. Entrust admins only; every save is audited.",
  request: { params: businessParam, body: { required: true, content: json(SaveBody) } },
  responses: {
    200: { description: "The saved passport", content: json(PassportContent) },
    ...listErrors,
    403: problem("Only Entrust admins can issue or change a passport"),
    409: problem("The number is already issued to another business"),
    422: problem("The values aren't allowed"),
  },
});

publicRouter.openapi(publicRoute, async (c) => c.json(await publicPassport(getDb(), c.req.valid("param").passportId), 200));

router
  .openapi(listRoute, async (c) => c.json(await listPassports(await contextFor(c.get("user"))), 200))
  .openapi(editorRoute, async (c) => c.json(await passportForBusiness(await contextFor(c.get("user")), c.req.valid("param").smeId), 200))
  .openapi(saveRoute, async (c) => c.json(await savePassport(await contextFor(c.get("user")), c.req.valid("param").smeId, c.req.valid("json")), 200));

export const tradePublicPassports = publicRouter;
export const tradePassports = router;
