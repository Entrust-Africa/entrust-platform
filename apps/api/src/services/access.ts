import { and, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@entrust/db";
import { ENTRUST_ROLES, SME_ROLES, ORGANIZATION_KINDS, type Actor, type EntrustRole, type SmeRole, type OrganizationKind } from "@entrust/gate-engine";
import { QUALITY_ROLE, SPONSOR_ROLES, type SponsorRole } from "@entrust/roles";
import type { Executor } from "./db";
import { ServiceError } from "./errors";

/** Who is calling, from their memberships. */
export interface Principal {
  userId: string;
  /** Set for members of the Entrust organisation, who see every case. */
  staffRole: EntrustRole | null;
  /** Roles in SME organisations, by organisation id. */
  smeRoles: ReadonlyMap<string, SmeRole>;
  /**
   * A member of the Summit's selection committee (#80): the Entrust organisation's `committee` role. It is not a staff
   * role, so it grants nothing in CLEAR or TRADE and only the Summit's committee endpoints know it.
   */
  committee: boolean;
  /** A member of the Quality role (spec section 17): reads programme reports and the audit trail across every cohort, and changes nothing. Not a staff role. */
  quality: boolean;
  /** Roles in sponsor organisations (#70), by organisation id. A sponsor sees only the cohorts it sponsors and what an SME has agreed to share. */
  sponsorRoles: ReadonlyMap<string, SponsorRole>;
}

/**
 * A request about practice cases, which TRADE's M08 runs on CLEAR's own services. Without it a request
 * sees real cases only; with it, practice cases only. Nothing crosses over in either direction.
 */
export interface PracticeScope {
  /** The role the learner practises in. A learner works every party's steps, so they pick whose turn it is. Default: their own. */
  actingAs?: Actor | undefined;
}

export interface Ctx {
  db: Database;
  principal: Principal;
  now: Date;
  practice?: PracticeScope;
}

/** The role of the Summit's selection committee in the Entrust organisation. Summit only, so it isn't in ENTRUST_ROLES. */
export const COMMITTEE_ROLE = "committee";

const isEntrustRole = (role: string): role is EntrustRole => (ENTRUST_ROLES as readonly string[]).includes(role);
const isSmeRole = (role: string): role is SmeRole => (SME_ROLES as readonly string[]).includes(role);
const isSponsorRole = (role: string): role is SponsorRole => (SPONSOR_ROLES as readonly string[]).includes(role);

/**
 * Entrust staff are the members of the organisation in ENTRUST_ORG_ID (#18) whose role is one of
 * the Entrust roles. The id, not the slug, so nobody becomes staff by registering an organisation
 * with a familiar name; unset, nobody is staff. A role the permission checks don't know gives no
 * access, so a stray "admin" in an SME organisation grants nothing.
 */
export async function loadPrincipal(db: Executor, userId: string): Promise<Principal> {
  const entrustOrganizationId = process.env.ENTRUST_ORG_ID;
  const memberships = await db
    .select({ organizationId: schema.member.organizationId, role: schema.member.role })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));

  let staffRole: EntrustRole | null = null;
  let committee = false;
  let quality = false;
  const smeRoles = new Map<string, SmeRole>();
  const sponsorRoles = new Map<string, SponsorRole>();
  const sponsorOrganizations = new Set<string>();
  const sponsorCandidates = memberships.filter((m) => isSponsorRole(m.role));
  if (sponsorCandidates.length) {
    // A sponsor role counts only in an organisation of the sponsor kind, so it can't be claimed anywhere else.
    const rows = await db
      .select({ id: schema.organization.id, metadata: schema.organization.metadata })
      .from(schema.organization)
      .where(inArray(schema.organization.id, sponsorCandidates.map((m) => m.organizationId)));
    for (const row of rows) if (organizationKind(row.metadata) === "sponsor") sponsorOrganizations.add(row.id);
  }
  for (const { organizationId, role } of memberships) {
    if (isSponsorRole(role) && sponsorOrganizations.has(organizationId)) {
      sponsorRoles.set(organizationId, role);
      continue;
    }
    if (entrustOrganizationId && organizationId === entrustOrganizationId) {
      if (isEntrustRole(role)) staffRole = role;
      else if (role === COMMITTEE_ROLE) committee = true;
      else if (role === QUALITY_ROLE) quality = true;
    } else if (isSmeRole(role)) {
      smeRoles.set(organizationId, role);
    }
  }
  return { userId, staffRole, smeRoles, committee, quality, sponsorRoles };
}

/** The kind stored in an organisation's metadata, or null. */
export function organizationKind(metadata: unknown): OrganizationKind | null {
  try {
    const parsed = typeof metadata === "string" ? JSON.parse(metadata) : metadata;
    const kind = (parsed as { kind?: unknown } | null)?.kind;
    return typeof kind === "string" && (ORGANIZATION_KINDS as readonly string[]).includes(kind) ? (kind as OrganizationKind) : null;
  } catch {
    return null;
  }
}

/** The role the caller acts in on an organisation's cases, or null if they can't see them. */
export function actorFor(principal: Principal, organizationId: string): Actor | null {
  return principal.staffRole ?? principal.smeRoles.get(organizationId) ?? null;
}

/** Whether the organisation has been given TRADE access, which practice cases need. */
export async function hasTradeAccess(db: Executor, organizationId: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.platformAccess.id })
    .from(schema.platformAccess)
    .where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, "trade")))
    .limit(1);
  return grant !== undefined;
}

/** Whether the organisation has been given CLEAR access (#50). */
export async function hasClearAccess(db: Executor, organizationId: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.platformAccess.id })
    .from(schema.platformAccess)
    .where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, "clear")))
    .limit(1);
  return grant !== undefined;
}

/** Whether the organisation has been given access to the specified platform (#50). */
export async function hasPlatformAccess(db: Executor, organizationId: string, platform: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: schema.platformAccess.id })
    .from(schema.platformAccess)
    .where(and(eq(schema.platformAccess.organizationId, organizationId), eq(schema.platformAccess.platform, platform as any)))
    .limit(1);
  return grant !== undefined;
}

/**
 * A case the caller may see, locked for update when `lock` is set. A case that doesn't exist, one in
 * another organisation, and a practice case asked for outside the practice scope (or a real case inside
 * it) look the same: not found. In the practice scope an SME member needs their organisation to have
 * TRADE access and acts in the role they chose; Entrust staff keep their own role and need no access.
 */
export async function findCase(
  db: Executor,
  principal: Principal,
  caseId: string,
  options: { lock?: boolean; practice?: PracticeScope | undefined } = {},
) {
  const query = db.select().from(schema.exportCase).where(eq(schema.exportCase.id, caseId));
  const [row] = options.lock ? await query.for("update") : await query;
  const own = row ? actorFor(principal, row.organizationId) : null;
  const inScope = row && (row.practiceScenario !== null) === (options.practice !== undefined);
  const actor = options.practice && own && !principal.staffRole ? (options.practice.actingAs ?? own) : own;
  if (!row || !inScope || !actor) throw new ServiceError("not_found", "Case not found.");
  if (!options.practice && !principal.staffRole && !(await hasClearAccess(db, row.organizationId))) {
    throw new ServiceError("not_found", "Case not found.");
  }
  if (options.practice && !principal.staffRole && !(await hasTradeAccess(db, row.organizationId))) {
    throw new ServiceError("forbidden", "Your organisation doesn't have access to TRADE.");
  }
  return { row, actor };
}

/** Throws unless the caller's role is one of `allowed`. */
export function requireRole(actor: Actor, allowed: readonly Actor[], doing: string): void {
  if (!allowed.includes(actor)) {
    throw new ServiceError("forbidden", `Your role (${actor}) can't ${doing}.`);
  }
}

/** Throws unless the caller is Entrust staff in one of the given roles. */
export function requireStaff(principal: Principal, allowed: readonly EntrustRole[], doing: string): void {
  if (!principal.staffRole || !allowed.includes(principal.staffRole)) {
    throw new ServiceError("forbidden", `Only Entrust ${allowed.join(" or ")} can ${doing}.`);
  }
}

export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  role: string;
  kind: OrganizationKind;
  smeId: string | null;
  platforms: string[];
}

/**
 * Returns, for each organisation the user belongs to, its kind, role, SME ID and platforms (#50).
 */
export async function getUserOrganizations(db: Executor, userId: string): Promise<UserOrganization[]> {
  const rows = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      slug: schema.organization.slug,
      metadata: schema.organization.metadata,
      role: schema.member.role,
      smeId: schema.smeProfile.smeId,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.member.organizationId))
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.organization.id))
    .where(eq(schema.member.userId, userId));

  const orgIds = rows.map((r) => r.id);
  const grants = orgIds.length
    ? await db
        .select({
          organizationId: schema.platformAccess.organizationId,
          platform: schema.platformAccess.platform,
        })
        .from(schema.platformAccess)
        .where(inArray(schema.platformAccess.organizationId, orgIds))
    : [];

  const platformsByOrg = new Map<string, string[]>();
  for (const g of grants) {
    const list = platformsByOrg.get(g.organizationId) ?? [];
    list.push(g.platform);
    platformsByOrg.set(g.organizationId, list);
  }

  const entrustOrgId = process.env.ENTRUST_ORG_ID;

  return rows.map((r) => {
    let kind: OrganizationKind = "sme";
    if (entrustOrgId && r.id === entrustOrgId) {
      kind = "entrust";
    } else if (r.metadata) {
      try {
        const parsed = typeof r.metadata === "string" ? JSON.parse(r.metadata) : r.metadata;
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof parsed.kind === "string" &&
          (ORGANIZATION_KINDS as readonly string[]).includes(parsed.kind)
        ) {
          kind = parsed.kind as OrganizationKind;
        }
      } catch {}
    }
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      role: r.role,
      kind,
      smeId: r.smeId ?? null,
      platforms: platformsByOrg.get(r.id) ?? [],
    };
  });
}

