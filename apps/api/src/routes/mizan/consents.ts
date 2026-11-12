import { createRoute, z } from "@hono/zod-openapi";
import { CONSENT_KINDS, CONSENT_METHODS, CONSENT_SOURCES } from "@entrust/mizan-engine";
import { acceptConsent, getConsents, listNotices, publishNotice, withdrawConsent } from "../../services/mizan-consents";
import { clearRouter, contextFor, json, problem } from "../clear/shared";

// The data collection notice and the permission to use TRADE and CLEAR data (#227): their wording, and each SME's record of
// accepting and withdrawing them.

const tags = ["MIZAN consent"];
const router = clearRouter("mizan");

const Kind = z.enum(CONSENT_KINDS);
const day = z.iso.date();
/** A day as a moment: today is now, so it sorts after anything recorded earlier today; any other day is its start. */
const onDay = (d: string | undefined, now: Date) => (d === undefined ? undefined : d === now.toISOString().slice(0, 10) ? now : new Date(`${d}T00:00:00Z`));
const name = z.string().trim().min(1).max(200);
const optionalLine = z.string().trim().max(200).optional();

const Notice = z
  .object({ kind: Kind, version: z.string(), title: z.string(), body: z.string(), publishedAt: z.string() })
  .openapi("MizanNotice");

const Consent = z
  .object({
    id: z.string(),
    kind: Kind,
    accepted: z.boolean().openapi({ description: "False for a withdrawal" }),
    signatoryName: z.string(),
    signatoryRole: z.string().nullable(),
    method: z.enum(CONSENT_METHODS),
    noticeVersion: z.string(),
    source: z.enum(CONSENT_SOURCES),
    sourceRef: z.string().nullable(),
    givenAt: z.string(),
    fileId: z.string().nullable(),
    capturedBy: z.string().nullable(),
    capturedAt: z.string(),
    withdrawnAt: z.string().nullable(),
    withdrawnBy: z.string().nullable(),
  })
  .openapi("MizanConsent");

const Consents = z
  .object({
    organizationId: z.string(),
    smeId: z.string(),
    legalName: z.string(),
    canRecord: z.boolean().openapi({ description: "Staff who may record and withdraw on the SME's behalf" }),
    canAccept: z.boolean().openapi({ description: "Someone from the SME, who may accept or withdraw in MIZAN" }),
    kinds: z.array(z.object({ kind: Kind, inForce: z.boolean(), latest: Consent.nullable(), notice: Notice })),
    history: z.array(Consent).openapi({ description: "Every acceptance and withdrawal, newest first" }),
  })
  .openapi("MizanConsents");

const AcceptBody = z
  .object({
    kind: Kind,
    method: z.enum(CONSENT_METHODS),
    signatoryName: name.optional(),
    signatoryRole: optionalLine,
    noticeVersion: z.string().trim().min(1).max(80).optional(),
    givenOn: day.optional(),
    fileId: z.uuid().optional(),
    sourceRef: z.string().trim().min(1).max(200).optional(),
  })
  .openapi("MizanConsentAccept");

const WithdrawBody = z
  .object({ signatoryName: name.optional(), signatoryRole: optionalLine, givenOn: day.optional(), fileId: z.uuid().optional(), reason: z.string().trim().max(2000).optional() })
  .openapi("MizanConsentWithdraw");

const errors = {
  400: problem("The request is malformed"),
  401: problem("Not signed in"),
  404: problem("No such SME, or the caller can't see it"),
};
const writeErrors = {
  ...errors,
  403: problem("The caller's role can't make this change"),
  409: problem("It is already accepted, or there is nothing in force to withdraw"),
  422: problem("The values aren't allowed"),
};

const params = z.object({ organizationId: z.string().min(1) });

const noticesRoute = createRoute({
  method: "get",
  path: "/notices",
  tags,
  summary: "The wording in use",
  description: "The latest published version of the assessment notice and of the permission to use TRADE and CLEAR data.",
  responses: { 200: { description: "The notices", content: json(z.object({ items: z.array(Notice) })) }, 401: problem("Not signed in") },
});

const publishRoute = createRoute({
  method: "post",
  path: "/notices",
  tags,
  summary: "Reword a notice",
  description:
    "Publishes a new version of a notice's wording, shown and accepted from now on. Earlier versions are kept, and acceptances of them stay in force. Super Admin only.",
  request: {
    body: {
      content: json(z.object({ kind: Kind, version: z.string().trim().min(1).max(40), title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(20000) })),
    },
  },
  responses: {
    201: { description: "The new version", content: json(Notice) },
    400: problem("The request is malformed"),
    401: problem("Not signed in"),
    403: problem("Not a Super Admin"),
    409: problem("That version exists"),
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/smes/{organizationId}/consents",
  tags,
  summary: "An SME's notice and data permission",
  description: "Whether each is in force, the wording, and every acceptance and withdrawal. MIZAN staff, and the SME's own members.",
  request: { params },
  responses: { 200: { description: "The SME's consents", content: json(Consents) }, ...errors },
});

const acceptRoute = createRoute({
  method: "post",
  path: "/smes/{organizationId}/consents",
  tags,
  summary: "Record an acceptance",
  description:
    "Someone from the SME accepts in MIZAN (`in_platform`, the current wording). An Assessor or Super Admin records one signed on paper (`paper`, with the scan's file id and the date) or given in TRADE (`trade`, with TRADE's reference and the date). The latest record wins.",
  request: { params, body: { content: json(AcceptBody) } },
  responses: { 200: { description: "The SME's consents", content: json(Consents) }, ...writeErrors },
});

const withdrawRoute = createRoute({
  method: "post",
  path: "/smes/{organizationId}/consents/{kind}/withdraw",
  tags,
  summary: "Withdraw",
  description:
    "Stops future use. An open assessment can't be submitted or approved while the notice is withdrawn; its work is kept. Reports already issued are untouched. Staff record who asked and when; someone from the SME withdraws for themselves.",
  request: { params: params.extend({ kind: Kind }), body: { content: json(WithdrawBody) } },
  responses: { 200: { description: "The SME's consents", content: json(Consents) }, ...writeErrors },
});

export const mizanConsentRoutes = router
  .openapi(noticesRoute, async (c) => c.json(await listNotices(await contextFor(c.get("user"))), 200))
  .openapi(publishRoute, async (c) => c.json(await publishNotice(await contextFor(c.get("user")), c.req.valid("json")), 201))
  .openapi(getRoute, async (c) => c.json(await getConsents(await contextFor(c.get("user")), c.req.valid("param").organizationId), 200))
  .openapi(acceptRoute, async (c) => {
    const { givenOn, ...body } = c.req.valid("json");
    const ctx = await contextFor(c.get("user"));
    return c.json(await acceptConsent(ctx, c.req.valid("param").organizationId, { ...body, givenAt: onDay(givenOn, ctx.now) }), 200);
  })
  .openapi(withdrawRoute, async (c) => {
    const { organizationId, kind } = c.req.valid("param");
    const { givenOn, ...body } = c.req.valid("json");
    const ctx = await contextFor(c.get("user"));
    return c.json(await withdrawConsent(ctx, organizationId, { kind, ...body, givenAt: onDay(givenOn, ctx.now) }), 200);
  });
