import { and, desc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  findVersion,
  listModules,
  toLearnerView,
  type Audience,
  type ModuleContent,
  type ModuleSummary,
} from "@entrust/trade-content";
import { MODULE_IDS, compareVersions, latestTradeRules, type ModuleId } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { aiAssistantEnabled } from "./ai-provider";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { seedModuleVersionsIfEmpty } from "./trade-content-editor";

// TRADE's module content (#61, #212). The content is initially based on @entrust/trade-content files,
// and editable versions are persisted in postgres (trade.module_content_version). The API decides what
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

/** Resolves module content dynamically from the database, falling back to static bundles. */
export async function resolveTradeModuleContent(
  db: Executor,
  moduleId: ModuleId,
  audience: Audience,
  version?: string,
): Promise<ModuleContent | undefined> {
  await seedModuleVersionsIfEmpty(db);
  if (version !== undefined) {
    const [row] = await db
      .select()
      .from(schema.moduleContentVersion)
      .where(and(eq(schema.moduleContentVersion.moduleId, moduleId), eq(schema.moduleContentVersion.version, version)))
      .limit(1);

    if (row) {
      if (audience === "learner" && row.status !== "approved") return undefined;
      return {
        ...(row.content as unknown as ModuleContent),
        module: moduleId,
        version: row.version,
        status: row.status === "approved" ? "approved" : "draft",
        title: row.title,
        deliverable: row.deliverable,
        objectives: row.objectives as string[],
      };
    }
    return findVersion(moduleId, audience, version);
  }

  // Find newest visible version
  const rows = await db
    .select()
    .from(schema.moduleContentVersion)
    .where(
      audience === "learner"
        ? and(eq(schema.moduleContentVersion.moduleId, moduleId), eq(schema.moduleContentVersion.status, "approved"))
        : eq(schema.moduleContentVersion.moduleId, moduleId),
    );

  const staticVers = findVersion(moduleId, audience);
  if (rows.length === 0) {
    return staticVers;
  }

  const sortedRows = rows.sort((a, b) => compareVersions(b.version, a.version));
  const latestDb = sortedRows[0];
  if (!latestDb) {
    return staticVers;
  }
  if (!staticVers || compareVersions(latestDb.version, staticVers.version) >= 0) {
    return {
      ...(latestDb.content as unknown as ModuleContent),
      module: moduleId,
      version: latestDb.version,
      status: latestDb.status === "approved" ? "approved" : "draft",
      title: latestDb.title,
      deliverable: latestDb.deliverable,
      objectives: latestDb.objectives as string[],
    };
  }
  return staticVers;
}

export async function listTradeModules(ctx: Ctx): Promise<ModuleSummary[]> {
  const audience = await audienceFor(ctx);
  await seedModuleVersionsIfEmpty(ctx.db);

  const dbRows = await ctx.db
    .select()
    .from(schema.moduleContentVersion)
    .where(audience === "learner" ? eq(schema.moduleContentVersion.status, "approved") : undefined);

  return latestTradeRules().modules.map((module) => {
    const modId = module.id as ModuleId;
    const staticVers = listModules(audience).find((m) => m.id === modId);
    const modDbRows = dbRows.filter((r) => r.moduleId === modId);

    const versionMap = new Map<string, { status: string; title: string; deliverable: string; objectives: string[] }>();
    if (staticVers) {
      for (const v of staticVers.versions) {
        const found = findVersion(modId, audience, v);
        if (found) {
          versionMap.set(v, {
            status: found.status,
            title: found.title,
            deliverable: found.deliverable,
            objectives: found.objectives,
          });
        }
      }
    }

    for (const r of modDbRows) {
      versionMap.set(r.version, {
        status: r.status,
        title: r.title,
        deliverable: r.deliverable,
        objectives: r.objectives as string[],
      });
    }

    const allVersions = [...versionMap.keys()].sort((a, b) => compareVersions(b, a));
    const latestVersion = allVersions[0] ?? null;
    const latestInfo = latestVersion ? versionMap.get(latestVersion) : null;
    const hasApproved = [...versionMap.values()].some((v) => v.status === "approved");

    return {
      id: modId,
      title: latestInfo?.title ?? module.title,
      deliverable: latestInfo?.deliverable ?? module.deliverable,
      objectives: latestInfo?.objectives ?? [],
      contentStatus: hasApproved ? "ready" : latestVersion ? "draft" : "in_production",
      latestVersion,
      versions: allVersions,
    };
  });
}

/** A module with the content of one version: the one asked for, or the newest the caller can open. */
export async function getTradeModule(ctx: Ctx, id: string, version?: string) {
  const audience = await audienceFor(ctx);
  const module = MODULE_IDS.find((m) => m === id);
  if (!module) throw new ServiceError("not_found", "Module not found.");

  const summaries = await listTradeModules(ctx);
  const summary = summaries.find((m) => m.id === module);
  if (!summary) throw new ServiceError("not_found", "Module not found.");

  const found = await resolveTradeModuleContent(ctx.db, module as ModuleId, audience, version);
  // A version the caller can't open, such as a draft to an SME, looks the same as one that doesn't exist.
  if (version !== undefined && !found) throw new ServiceError("not_found", "That version of the module doesn't exist.");
  return {
    ...summary,
    content: found ? (audience === "staff" ? found : toLearnerView(found)) : null,
    aiAssistantEnabled: aiAssistantEnabled(),
  };
}

/** Every AI prompt in the modules the caller can open, for the AI Practice Lab. They copy them into a tool of their choice. */
export async function listAiPrompts(ctx: Ctx) {
  const audience = await audienceFor(ctx);
  const items = [];
  for (const id of MODULE_IDS) {
    const content = await resolveTradeModuleContent(ctx.db, id as ModuleId, audience);
    if (!content) continue;
    for (const p of content.aiPrompts) {
      items.push({
        module: id,
        moduleTitle: content.title,
        id: p.id,
        title: p.title,
        prompt: p.prompt,
        verification: p.verification,
      });
    }
  }
  return { items };
}
