import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@entrust/db";
import { auth } from "@entrust/auth";
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

function requireTrustedOrigin(c: { req: { header: (name: string) => string | undefined } }) {
  const origin = c.req.header("origin");
  const trusted = (process.env.CORS_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (origin && !trusted.includes(origin)) throw new ServiceError("forbidden", "That request origin is not allowed.");
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

async function isEntrustAdmin(userId: string) {
  const entrustOrgId = process.env.ENTRUST_ORG_ID;
  if (!entrustOrgId) return false;
  const row = await membership(entrustOrgId, userId);
  return row?.role === "admin";
}

async function canManage(organizationId: string, userId: string) {
  const row = await membership(organizationId, userId);
  if (row?.role === "owner") return { ...row, isOwner: true, isEntrustAdmin: false };
  if (await isEntrustAdmin(userId)) return { role: "admin", organizationName: "", isOwner: false, isEntrustAdmin: true };
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
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens (e.g. 'my-company').")
    .max(80),
  legalName: z.string().trim().min(1).max(200),
  tin: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).default("ET"),
});
// Better Auth's configured organization roles are member/admin/owner. Staff roles
// are assigned by the platform, not through the SME invitation UI.
const invite = z.object({ email: z.email(), role: z.literal("member").default("member") });
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
  .post(
    "/organizations",
    zValidator("json", createOrganization, (result, c) => {
      if (!result.success) {
        const issue = result.error.issues[0];
        const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input.";
        return c.json({ error: message, code: "invalid" }, 400);
      }
    }),
    async (c) => {
      const user = requireUser(c);
      requireTrustedOrigin(c);
      const body = c.req.valid("json");
      const db = getDb();
      const existing = await db
        .select({ id: schema.organization.id })
        .from(schema.organization)
        .where(eq(schema.organization.slug, body.slug));
      if (existing[0]) throw new ServiceError("invalid", "An organisation with that slug already exists.");
      const id = crypto.randomUUID();
      const smeId = await allocateSmeId();
      await db.transaction(async (tx) => {
        await tx.insert(schema.organization).values({ id, name: body.name, slug: body.slug, createdAt: new Date(), metadata: JSON.stringify({ kind: "sme" }) });
        await tx.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: id, userId: user.id, role: "owner", createdAt: new Date() });
        await tx.insert(schema.smeProfile).values({ organizationId: id, smeId, legalName: body.legalName, tin: body.tin ?? null, country: body.country });
        await tx.insert(schema.platformAccess).values({ organizationId: id, platform: "clear", grantedBy: user.id });
      });
      return c.json({ id, smeId }, 201);
    },
  )
  .get("/organizations/:organizationId/members", async (c) => {
    const user = requireUser(c);
    const organizationId = c.req.param("organizationId");
    const isMember = Boolean(await membership(organizationId, user.id));
    const isAdmin = await isEntrustAdmin(user.id);
    if (!isMember && !isAdmin) throw new ServiceError("forbidden", "You are not a member of this organisation.");
    const rows = await getDb().select({ id: schema.member.id, userId: schema.member.userId, name: schema.user.name, email: schema.user.email, role: schema.member.role, createdAt: schema.member.createdAt }).from(schema.member).innerJoin(schema.user, eq(schema.user.id, schema.member.userId)).where(eq(schema.member.organizationId, organizationId)).orderBy(asc(schema.member.createdAt));
    return c.json({ members: rows });
  })
  .post("/organizations/:organizationId/invitations", zValidator("json", invite), async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    if (body.role !== "member") throw new ServiceError("invalid", "Only member invitations are supported here.");
    const email = body.email.trim().toLowerCase();
    const existing = await getDb().select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
    if (existing[0]) {
      const member = await getDb().select({ id: schema.member.id }).from(schema.member).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, existing[0].id)));
      if (member[0]) throw new ServiceError("invalid", "That user is already a member.");
    }
    const result = await auth.api.createInvitation({
      headers: c.req.raw.headers,
      body: {
        organizationId,
        email,
        role: body.role,
      },
    });
    return c.json(result, 201);
  })
  .patch("/organizations/:organizationId/members/:userId", zValidator("json", role), async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const targetUserId = c.req.param("userId");
    const [targetMember] = await getDb()
      .select({ id: schema.member.id, role: schema.member.role })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, targetUserId)));
    if (!targetMember) throw new ServiceError("not_found", "Member not found in this organisation.");

    const body = c.req.valid("json");
    const isEntrust = organizationId === process.env.ENTRUST_ORG_ID;
    if (isEntrust ? !EntrustRoles.safeParse(body.role).success : !SmeRoles.safeParse(body.role).success) throw new ServiceError("invalid", "That role is not valid for this organisation.");

    const requiredRole = isEntrust ? "admin" : "owner";
    if (targetMember.role === requiredRole && body.role !== requiredRole) {
      const [countResult] = await getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.member)
        .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.role, requiredRole)));
      if ((countResult?.count ?? 0) <= 1) {
        throw new ServiceError("invalid", `Cannot demote the last ${requiredRole} of the organisation.`);
      }
    }

    await getDb().update(schema.member).set({ role: body.role }).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, targetUserId)));
    return c.json({ ok: true });
  })
  .delete("/organizations/:organizationId/members/:userId", async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const targetUserId = c.req.param("userId");
    if (targetUserId === user.id) throw new ServiceError("invalid", "You cannot remove yourself.");

    const [targetMember] = await getDb()
      .select({ id: schema.member.id, role: schema.member.role })
      .from(schema.member)
      .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, targetUserId)));
    if (!targetMember) throw new ServiceError("not_found", "Member not found in this organisation.");

    const isEntrust = organizationId === process.env.ENTRUST_ORG_ID;
    const requiredRole = isEntrust ? "admin" : "owner";
    if (targetMember.role === requiredRole) {
      const [countResult] = await getDb()
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.member)
        .where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.role, requiredRole)));
      if ((countResult?.count ?? 0) <= 1) {
        throw new ServiceError("invalid", `Cannot remove the last ${requiredRole} of the organisation.`);
      }
    }

    await getDb().delete(schema.member).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, targetUserId)));
    return c.json({ ok: true });
  })
  .patch("/organizations/:organizationId/profile", zValidator("json", profile), async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    await getDb().update(schema.smeProfile).set({ legalName: body.legalName, tin: body.tin, ...(body.country ? { country: body.country } : {}) }).where(eq(schema.smeProfile.organizationId, organizationId));
    return c.json({ ok: true });
  })
  .post("/organizations/:organizationId/platform-access", zValidator("json", platform), async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    if (!(await isEntrustAdmin(user.id))) {
      throw new ServiceError("forbidden", "Only Entrust admins can manage platform access.");
    }
    const organizationId = c.req.param("organizationId");
    const body = c.req.valid("json");
    if (body.enabled) await getDb().insert(schema.platformAccess).values({ organizationId, platform: body.platform, grantedBy: user.id }).onConflictDoNothing();
    else await getDb().delete(schema.platformAccess).where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, body.platform)));
    return c.json({ organizationId, platform: body.platform, enabled: body.enabled });
  });
