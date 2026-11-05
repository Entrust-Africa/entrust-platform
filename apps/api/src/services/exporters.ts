import { asc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { ExporterListView } from "../schemas/clear";
import { organizationKind, requireRole, type Ctx } from "./access";
import { ServiceError } from "./errors";

/**
 * The SME organisations a member of Entrust staff can open a case for: those with access to CLEAR.
 *
 * Staff belong to the Entrust organisation alone, so the organisations listed for their own sign-in are no
 * use for picking an exporter. Only admins and facilitators open cases (a reviewer reviews them), so only they get the list.
 * An organisation without CLEAR access is left out on purpose: its own people couldn't see a case opened for it.
 */
export async function listExporters(ctx: Ctx): Promise<ExporterListView> {
  const { staffRole } = ctx.principal;
  if (!staffRole) throw new ServiceError("forbidden", "Only Entrust staff can list the exporters.");
  requireRole(staffRole, ["admin", "facilitator"], "list the exporters");

  const grants = await ctx.db
    .select({ organizationId: schema.platformAccess.organizationId })
    .from(schema.platformAccess)
    .where(eq(schema.platformAccess.platform, "clear"));
  const organizationIds = grants.map((g) => g.organizationId);
  if (organizationIds.length === 0) return { items: [] };

  const rows = await ctx.db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      metadata: schema.organization.metadata,
      smeId: schema.smeProfile.smeId,
    })
    .from(schema.organization)
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.organization.id))
    .where(inArray(schema.organization.id, organizationIds))
    .orderBy(asc(schema.organization.name), asc(schema.organization.id));

  // An organisation with no kind recorded is an SME, as everywhere else; the Entrust team and sponsors are not exporters.
  const entrustOrganizationId = process.env.ENTRUST_ORG_ID;
  return {
    items: rows
      .filter((r) => r.id !== entrustOrganizationId && (organizationKind(r.metadata) ?? "sme") === "sme")
      .map((r) => ({ id: r.id, name: r.name, smeId: r.smeId })),
  };
}
