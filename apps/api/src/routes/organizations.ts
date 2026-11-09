import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, REGISTRATION_STATUSES, BUSINESS_STATUSES } from "@entrust/db";
import { auth, trustedOrigins } from "@entrust/auth";
import { ENTRUST_ROLES, ORGANIZATION_KINDS, PLATFORMS, SME_ROLES } from "@entrust/roles";
import type { AppEnv } from "../app";
import { ServiceError } from "../services/errors";
import { getUserOrganizations } from "../services/access";
import { checkSmeDuplicates } from "../services/sme-registry";

const SmeRoles = z.enum(SME_ROLES);
// "committee" is the Summit selection committee's role (#80). It grants nothing in CLEAR or TRADE.
const EntrustRoles = z.enum([...ENTRUST_ROLES, "committee"]);
const Platform = z.enum(PLATFORMS);

function requireUser(c: { get: (key: "user") => AppEnv["Variables"]["user"] }) {
  const user = c.get("user");
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");
  return user;
}

function requireTrustedOrigin(c: { req: { header: (name: string) => string | undefined } }) {
  const origin = c.req.header("origin");
  if (origin && !trustedOrigins.includes(origin)) throw new ServiceError("forbidden", "That request origin is not allowed.");
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

async function isEntrustStaff(userId: string) {
  const entrustOrgId = process.env.ENTRUST_ORG_ID;
  if (!entrustOrgId) return false;
  const row = await membership(entrustOrgId, userId);
  return row?.role === "admin" || row?.role === "facilitator";
}

async function canManage(organizationId: string, userId: string) {
  const row = await membership(organizationId, userId);
  const isAdmin = await isEntrustAdmin(userId);
  if (row?.role === "owner") return { ...row, isOwner: true, isEntrustAdmin: isAdmin };
  if (isAdmin) return { role: "admin", organizationName: "", isOwner: false, isEntrustAdmin: true };
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
  tradingName: z.string().trim().max(200).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  registrationStatus: z.enum(REGISTRATION_STATUSES).default("registered"),
  businessStatus: z.enum(BUSINESS_STATUSES).default("active"),
  sector: z.string().trim().max(100).optional(),
  tin: z.string().trim().max(80).optional(),
  country: z.string().trim().length(2).default("ET"),
  // The platform the new organisation gets first. A Summit applicant gets `summit` alone, so TRADE's learner screens stay out of their way.
  platform: z.enum(["clear", "trade", "summit"]).optional(),
  kind: z.enum(ORGANIZATION_KINDS).default("sme"),
  confirmDuplicateName: z.boolean().default(false),
});
// Better Auth's configured organization roles are member/admin/owner. Staff roles
// are assigned by the platform, not through the SME invitation UI.
const invite = z.object({
  email: z.email(),
  role: z.enum(["member", "owner"]).default("member"),
  platform: z.enum(["clear", "trade"]).optional(),
});
const role = z.object({ role: z.union([SmeRoles, EntrustRoles]) });
const profile = z.object({
  legalName: z.string().trim().min(1).max(200).optional(),
  tradingName: z.string().trim().max(200).nullable().optional(),
  registrationNumber: z.string().trim().max(100).nullable().optional(),
  registrationStatus: z.enum(REGISTRATION_STATUSES).optional(),
  businessStatus: z.enum(BUSINESS_STATUSES).optional(),
  sector: z.string().trim().max(100).nullable().optional(),
  tin: z.string().trim().max(80).nullable().optional(),
  country: z.string().trim().length(2).optional(),
});
const platform = z.object({ enabled: z.boolean().default(true), platform: Platform.default("clear") });

export const organizations = new Hono<AppEnv>()
  .get("/organizations", async (c) => {
    const user = requireUser(c);
    const db = getDb();
    const rows = await getUserOrganizations(db, user.id);
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

      // Duplicate check in SME registry
      const duplicateResult = await checkSmeDuplicates(db, {
        legalName: body.legalName,
        registrationNumber: body.registrationNumber,
        country: body.country,
      });

      if (duplicateResult.registrationNumberConflict) {
        throw new ServiceError(
          "conflict",
          `An organisation with registration number '${duplicateResult.registrationNumberConflict.registrationNumber}' already exists in ${duplicateResult.registrationNumberConflict.country}. Please ask the existing owner for an invitation.`,
        );
      }

      if (duplicateResult.legalNameWarning && !body.confirmDuplicateName) {
        return c.json(
          {
            error: `An organisation with a similar name already exists ('${duplicateResult.legalNameWarning.legalName}'). Please confirm if this is a different organisation.`,
            code: "duplicate_legal_name_warning",
            warning: "duplicate_legal_name",
            existingSme: duplicateResult.legalNameWarning,
          },
          409,
        );
      }

      const origin = c.req.header("origin") ?? "";
      const platformToGrant = body.platform ?? (origin.includes(":3001") || origin.includes("trade.") ? "trade" : "clear");
      const id = crypto.randomUUID();
      const smeId = await allocateSmeId();
      await db.transaction(async (tx) => {
        await tx.insert(schema.organization).values({
          id,
          name: body.name,
          slug: body.slug,
          createdAt: new Date(),
          metadata: JSON.stringify({ kind: body.kind }),
        });
        await tx.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: id, userId: user.id, role: "owner", createdAt: new Date() });
        await tx.insert(schema.smeProfile).values({
          organizationId: id,
          smeId,
          legalName: body.legalName,
          tradingName: body.tradingName ?? null,
          registrationNumber: body.registrationNumber ?? null,
          registrationStatus: body.registrationStatus ?? "registered",
          businessStatus: body.businessStatus ?? "active",
          sector: body.sector ?? null,
          tin: body.tin ?? null,
          country: body.country,
        });
        await tx.insert(schema.platformAccess).values({ organizationId: id, platform: platformToGrant, grantedBy: user.id });
        await tx.insert(schema.auditLog).values({
          actorUserId: user.id,
          organizationId: id,
          action: "organization.created",
          entityType: "organization",
          entityId: id,
          after: {
            id,
            name: body.name,
            slug: body.slug,
            legalName: body.legalName,
            tradingName: body.tradingName ?? null,
            registrationNumber: body.registrationNumber ?? null,
            registrationStatus: body.registrationStatus ?? "registered",
            businessStatus: body.businessStatus ?? "active",
            sector: body.sector ?? null,
            tin: body.tin ?? null,
            country: body.country,
            smeId,
          },
        });
      });
      return c.json({ id, smeId, platform: platformToGrant }, 201);
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
    const manager = await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    if (body.role === "owner") {
      const isStaff = await isEntrustStaff(user.id);
      if (!isStaff) {
        throw new ServiceError("invalid", "Only Entrust staff can invite organisation owners.");
      }
    }
    const email = body.email.trim().toLowerCase();
    const existing = await getDb().select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
    if (existing[0]) {
      const member = await getDb().select({ id: schema.member.id }).from(schema.member).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, existing[0].id)));
      if (member[0]) throw new ServiceError("invalid", "That user is already a member.");
    }
    const origin = c.req.header("origin") ?? "";
    const platform = body.platform ?? (origin.includes(":3001") || origin.includes("trade.") ? "trade" : "clear");
    const result = await auth.api.createInvitation({
      headers: c.req.raw.headers,
      body: {
        organizationId,
        email,
        role: body.role,
        platform,
      } as any,
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

    await getDb().transaction(async (tx) => {
      await tx.update(schema.member).set({ role: body.role }).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, targetUserId)));
      await tx.insert(schema.auditLog).values({
        actorUserId: user.id,
        organizationId,
        action: "organization.member.role_changed",
        entityType: "member",
        entityId: targetMember.id,
        before: { userId: targetUserId, role: targetMember.role },
        after: { userId: targetUserId, role: body.role },
      });
    });
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

    await getDb().transaction(async (tx) => {
      await tx.delete(schema.member).where(and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, targetUserId)));
      await tx.insert(schema.auditLog).values({
        actorUserId: user.id,
        organizationId,
        action: "organization.member.removed",
        entityType: "member",
        entityId: targetMember.id,
        before: { userId: targetUserId, role: targetMember.role },
      });
    });
    return c.json({ ok: true });
  })
  .patch("/organizations/:organizationId/profile", zValidator("json", profile), async (c) => {
    const user = requireUser(c);
    requireTrustedOrigin(c);
    const organizationId = c.req.param("organizationId");
    await canManage(organizationId, user.id);
    const body = c.req.valid("json");
    const db = getDb();

    const [current] = await db
      .select()
      .from(schema.smeProfile)
      .where(eq(schema.smeProfile.organizationId, organizationId));
    if (!current) throw new ServiceError("not_found", "SME profile not found.");

    if (
      body.registrationNumber &&
      body.registrationNumber !== current.registrationNumber
    ) {
      const dup = await checkSmeDuplicates(db, {
        legalName: body.legalName ?? current.legalName,
        registrationNumber: body.registrationNumber,
        country: body.country ?? current.country,
        excludeOrganizationId: organizationId,
      });
      if (dup.registrationNumberConflict) {
        throw new ServiceError(
          "conflict",
          `An organisation with registration number '${dup.registrationNumberConflict.registrationNumber}' already exists in ${dup.registrationNumberConflict.country}. Please ask the existing owner for an invitation.`,
        );
      }
    }

    const updateData: Record<string, any> = {
      ...(body.legalName ? { legalName: body.legalName } : {}),
      ...(body.tradingName !== undefined ? { tradingName: body.tradingName } : {}),
      ...(body.registrationNumber !== undefined ? { registrationNumber: body.registrationNumber } : {}),
      ...(body.registrationStatus ? { registrationStatus: body.registrationStatus } : {}),
      ...(body.businessStatus ? { businessStatus: body.businessStatus } : {}),
      ...(body.sector !== undefined ? { sector: body.sector } : {}),
      ...(body.tin !== undefined ? { tin: body.tin } : {}),
      ...(body.country ? { country: body.country } : {}),
      updatedAt: new Date(),
    };

    await db.transaction(async (tx) => {
      await tx
        .update(schema.smeProfile)
        .set(updateData)
        .where(eq(schema.smeProfile.organizationId, organizationId));

      await tx.insert(schema.auditLog).values({
        actorUserId: user.id,
        organizationId,
        action: "sme_profile.updated",
        entityType: "sme_profile",
        entityId: current.id,
        before: {
          legalName: current.legalName,
          tradingName: current.tradingName,
          registrationNumber: current.registrationNumber,
          registrationStatus: current.registrationStatus,
          businessStatus: current.businessStatus,
          sector: current.sector,
          tin: current.tin,
          country: current.country,
        },
        after: {
          legalName: body.legalName ?? current.legalName,
          tradingName: body.tradingName !== undefined ? body.tradingName : current.tradingName,
          registrationNumber:
            body.registrationNumber !== undefined ? body.registrationNumber : current.registrationNumber,
          registrationStatus: body.registrationStatus ?? current.registrationStatus,
          businessStatus: body.businessStatus ?? current.businessStatus,
          sector: body.sector !== undefined ? body.sector : current.sector,
          tin: body.tin !== undefined ? body.tin : current.tin,
          country: body.country ?? current.country,
        },
      });
    });

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
    if (body.enabled) {
      await getDb()
        .insert(schema.platformAccess)
        .values({ organizationId, platform: body.platform, grantedBy: user.id })
        .onConflictDoNothing();
      await getDb().insert(schema.auditLog).values({
        actorUserId: user.id,
        organizationId,
        platform: body.platform,
        action: "organization.platform_access_granted",
        entityType: "organization",
        entityId: organizationId,
        after: { platform: body.platform },
      });
    } else {
      await getDb()
        .delete(schema.platformAccess)
        .where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, body.platform)));
      await getDb().insert(schema.auditLog).values({
        actorUserId: user.id,
        organizationId,
        platform: body.platform,
        action: "organization.platform_access_revoked",
        entityType: "organization",
        entityId: organizationId,
        before: { platform: body.platform },
      });
    }
    return c.json({ organizationId, platform: body.platform, enabled: body.enabled });
  });
