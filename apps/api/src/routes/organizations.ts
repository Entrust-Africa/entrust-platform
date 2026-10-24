import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@entrust/db";
import { sendEmail } from "@entrust/notify";
import { InvitationEmail } from "@entrust/notify/templates";
import type { AppEnv } from "../app";
import { ServiceError } from "../services/errors";

const SmeRoles = z.enum(["owner", "member"]);
const EntrustRoles = z.enum(["admin", "facilitator", "reviewer"]);
const Platform = z.literal("clear");

function requireUser(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  return user;
}

async function membership(organizationId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select({ role: schema.member.role, organizationName: schema.organization.name })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, userId)));
  return row ?? null;
}

async function canManage(organizationId: string, userId: string) {
  const row = await membership(organizationId, userId);
  if (row?.role === "owner") return row;
  if (organizationId === process.env.ENTRUST_ORG_ID && row?.role === "admin") return row;
  throw new ServiceError("forbidden", "Only organisation owners and Entrust admins can manage members.");
}

async function allocateSmeId() {
  const result = await getDb().execute<{ value: string }>(sql`select nextval('core.sme_id_seq') as value`);
  const [row] = result.rows;
  if (!row?.value) throw new ServiceError("invalid", "Could not allocate an SME ID.");
  return `ET-SME-${row.value.padStart(6, "0")}`;
}

const createOrganization = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  legalName: z.string().trim().min(1).max(200),
  tin: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).default("ET"),
});
const invite = z.object({ email: z.email(), role: z.enum(["member", "facilitator", "reviewer"]).default("member") });
const role = z.object({ role: z.union([SmeRoles, EntrustRoles]) });
const profile = z.object({ legalName: z.string().trim().min(1).max(200), tin: z.string().trim().max(80).nullable().optional(), country: z.string().trim().length(2).optional() });
const platform = z.object({ enabled: z.boolean().default(true), platform: Platform.default("clear") });

export const organizations = new Hono<AppEnv>()
  .get("/organizations", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const rows = await db
      .select({ id: schema.organization.id, name: schema.organization.name, slug: schema.organization.slug, role: schema.member.role })
      .from(schema.member)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
      .where(eq(schema.member.userId, user.id));
    return c.json({ organizations: rows });
  })
  .post("/organizations", zValidator("json", createOrganization), async (c) => {
    const user = requireUser(c);
    const body = c.req.valid("json");
    const db = getDb();
    const id = crypto.randomUUID();
    const smeId = await allocateSmeId();
    await db.insert(schema.organization).values({ id, name: body.name, slug: body.slug, createdAt: new Date(), metadata: JSON.stringify({ kind: "sme" }) });
    await db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: id, userId: user.id, role: "owner", createdAt: new Date() });
    await db.insert(schema.smeProfile).values({ organizationId: id, smeId, legalName: body.legalName, tin: body.tin ?? null, country: body.country });
    await db.insert(schema.platformAccess).values({ organizationId: id, platform: "clear", grantedBy: user.id });
    return c.json({ id, smeId }, 201);
  })
  .get("/organizations/:organizationId/members", async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    if (!(await membership(organizationId, user.id))) throw new ServiceError("forbidden", "You are not a member of this organisation.");
    const rows = await getDb().select({ id: schema.member.id, userId: schema.member.userId, name: schema.user.name, email: schema.user.email, role: schema.member.role, createdAt: schema.member.createdAt }).from(schema.member).innerJoin(schema.user, eq(schema.user.id, schema.member.userId)).where(eq(schema.member.organizationId, organizationId)).orderBy(asc(schema.member.createdAt));
    return c.json({ members: rows });
  })
  .post("/organizations/:organizationId/invitations", zValidator("json", invite), async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    const org = await membership(organizationId, user.id);
    if (!org) throw new ServiceError("not_found", "Organisation not found.");
    const isEntrust = organizationId === process.env.ENTRUST_ORG_ID;
    if (isEntrust ? !EntrustRoles.safeParse(body.role).success : body.role !== "member") throw new ServiceError("invalid", "That role is not valid for this organisation.");
    const existing = await getDb().select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, body.email));
    if (existing[0]) {
      const member = await getDb().select({ id: schema.member.id }).from(schema.member).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, existing[0].id)));
      if (member[0]) throw new ServiceError("invalid", "That user is already a member.");
    }
    const id = crypto.randomUUID();
    await getDb().insert(schema.invitation).values({ id, organizationId, email: body.email, role: body.role, status: "pending", expiresAt: new Date(Date.now() + 7 * 86400000), createdAt: new Date(), inviterId: user.id });
    await sendEmail({
      to: body.email,
      subject: `Invitation to join ${org.organizationName} on Entrust`,
      react: InvitationEmail({
        organizationName: org.organizationName,
        inviterName: user.name,
        role: body.role,
        url: `${process.env.CLEAR_APP_URL ?? "http://localhost:3000"}/accept-invitation?id=${encodeURIComponent(id)}`,
      }),
    });
    return c.json({ id, email: body.email, role: body.role, status: "pending" }, 201);
  })
  .patch("/organizations/:organizationId/members/:userId", zValidator("json", role), async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    const isEntrust = organizationId === process.env.ENTRUST_ORG_ID;
    if (isEntrust ? !EntrustRoles.safeParse(body.role).success : !SmeRoles.safeParse(body.role).success) throw new ServiceError("invalid", "That role is not valid for this organisation.");
    await getDb().update(schema.member).set({ role: body.role }).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, c.req.param("userId"))));
    return c.json({ ok: true });
  })
  .delete("/organizations/:organizationId/members/:userId", async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    if (c.req.param("userId") === user.id) throw new ServiceError("invalid", "You cannot remove yourself.");
    await getDb().delete(schema.member).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, c.req.param("userId"))));
    return c.json({ ok: true });
  })
  .patch("/organizations/:organizationId/profile", zValidator("json", profile), async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    await getDb().update(schema.smeProfile).set({ legalName: body.legalName, tin: body.tin, ...(body.country ? { country: body.country } : {}) }).where(eq(schema.smeProfile.organizationId, organizationId));
    return c.json({ ok: true });
  })
  .post("/organizations/:organizationId/platform-access", zValidator("json", platform), async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    if (body.enabled) await getDb().insert(schema.platformAccess).values({ organizationId, platform: body.platform, grantedBy: user.id }).onConflictDoNothing();
    else await getDb().delete(schema.platformAccess).where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, body.platform)));
    return c.json({ organizationId, platform: body.platform, enabled: body.enabled });
  });
