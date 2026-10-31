import { compareVersions, latestTradeRules } from "@entrust/trade-rules";
import type { ContentStatus, ModuleId } from "@entrust/trade-rules";
import type { ModuleContent } from "./schema";
import { validateModuleContent } from "./validate";

export * from "./schema";
export { learnerModuleSchema, toLearnerView } from "./learner";
export type { LearnerModuleContent } from "./learner";
export { validateModuleContent } from "./validate";

// Every version of every module's learning package. Put a module version here as one file in
// ./versions, named for the module and version, exporting a ModuleContent. A draft can still change.
// An approved version is never edited: test/trade-content.test.ts keeps a hash of each one and
// fails if it changes, so a correction goes in a new version. A learner keeps the version they started.
//
// Nothing is registered yet: Entrust's packages for M01, M03, M04, M05, M07 and M08 haven't been
// loaded (#61), so all twelve modules show as "content in production".
export const MODULE_CONTENT: readonly ModuleContent[] = [];

// Content that doesn't validate never reaches a learner: loading the package fails instead.
const errors = validateModuleContent(MODULE_CONTENT);
if (errors.length) throw new Error(`Invalid TRADE content:\n${errors.join("\n")}`);

/** Staff see drafts to review them. An SME only gets what Entrust has approved. */
export type Audience = "staff" | "learner";

export interface ModuleSummary {
  id: ModuleId;
  title: string;
  deliverable: string;
  objectives: string[];
  /** ready: an approved version. draft: only drafts, which only staff see. in_production: no content yet. */
  contentStatus: ContentStatus;
  /** The newest version the audience can open, or null while the module is in production. */
  latestVersion: string | null;
  /** Versions the audience can open, newest first. */
  versions: string[];
}

/** The versions of a module the audience can open, newest first. */
export function visibleVersions(module: ModuleId, audience: Audience, content: readonly ModuleContent[] = MODULE_CONTENT): ModuleContent[] {
  return content
    .filter((c) => c.module === module && (audience === "staff" || c.status === "approved"))
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** One version, or the newest the audience can open when no version is named. */
export function findVersion(
  module: ModuleId,
  audience: Audience,
  version?: string,
  content: readonly ModuleContent[] = MODULE_CONTENT,
): ModuleContent | undefined {
  const versions = visibleVersions(module, audience, content);
  return version === undefined ? versions[0] : versions.find((c) => c.version === version);
}

/**
 * Whether a newer version than `version` is open to the audience, for the module page to say so. A
 * learner stays on the version they started.
 */
export function newerVersion(module: ModuleId, audience: Audience, version: string, content: readonly ModuleContent[] = MODULE_CONTENT): string | null {
  const latest = visibleVersions(module, audience, content)[0];
  return latest && compareVersions(latest.version, version) > 0 ? latest.version : null;
}

/**
 * All twelve modules. A module with content shows its newest visible version's title and objectives;
 * one without shows the title and deliverable from the rules' module catalogue.
 */
export function listModules(audience: Audience, content: readonly ModuleContent[] = MODULE_CONTENT): ModuleSummary[] {
  return latestTradeRules().modules.map((module) => {
    const versions = visibleVersions(module.id, audience, content);
    const latest = versions[0];
    return {
      id: module.id,
      title: latest?.title ?? module.title,
      deliverable: latest?.deliverable ?? module.deliverable,
      objectives: latest?.objectives ?? [],
      contentStatus: versions.some((v) => v.status === "approved") ? "ready" : latest ? "draft" : "in_production",
      latestVersion: latest?.version ?? null,
      versions: versions.map((v) => v.version),
    };
  });
}
