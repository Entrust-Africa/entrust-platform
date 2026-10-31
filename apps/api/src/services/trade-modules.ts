import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findVersion, listModules, toLearnerView, type Audience } from "@entrust/trade-content";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";

// TRADE's module content (#61). The content is files in @entrust/trade-content; the API decides what
// each caller may see of it. An SME never gets answer keys or staff-only material.

/**
 * Entrust staff see every version, drafts included, with the answer keys. An SME sees approved versions
 * only, and only when one of their organisations has been given TRADE access.
 */
export async function audienceFor({ db, principal }: Ctx): Promise<Audience> {
  if (principal.staffRole) return "staff";
  const organizations = [...principal.smeRoles.keys()];
  if (organizations.length) {
    const [grant] = await db
      .select({ organizationId: schema.platformAccess.organizationId })
      .from(schema.platformAccess)
      .where(and(eq(schema.platformAccess.platform, "trade"), inArray(schema.platformAccess.organizationId, organizations)))
      .limit(1);
    if (grant) return "learner";
  }
  throw new ServiceError("forbidden", "Your organisation doesn't have access to TRADE.");
}

export async function listTradeModules(ctx: Ctx) {
  return listModules(await audienceFor(ctx));
}

/** A module with the content of one version: the one asked for, or the newest the caller can open. */
export async function getTradeModule(ctx: Ctx, id: string, version?: string) {
  const audience = await audienceFor(ctx);
  const module = MODULE_IDS.find((m) => m === id);
  const summary = module && listModules(audience).find((m) => m.id === module);
  if (!module || !summary) throw new ServiceError("not_found", "Module not found.");

  const found = findVersion(module as ModuleId, audience, version);
  // A version the caller can't open, such as a draft to an SME, looks the same as one that doesn't exist.
  if (version !== undefined && !found) throw new ServiceError("not_found", "That version of the module doesn't exist.");
  return { ...summary, content: found ? (audience === "staff" ? found : toLearnerView(found)) : null };
}
