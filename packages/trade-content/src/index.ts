import { compareVersions, latestTradeRules } from "@entrust/trade-rules";
import type { ContentStatus, ModuleId } from "@entrust/trade-rules";
import type { ModuleContent } from "./schema";
import { validateModuleContent } from "./validate";

import { M01_V0_1_0 } from "./versions/m01";
import { M02_V1_0_0 } from "./versions/m02-v1-0-0";
import { M03_V0_1_0 } from "./versions/m03";
import { M04_V0_1_0 } from "./versions/m04";
import { M05_V1_0_0 } from "./versions/m05-v1-0-0";
import { M06_V1_0_0 } from "./versions/m06-v1-0-0";
import { M07_V0_1_0 } from "./versions/m07";
import { M08_V1_0_0 } from "./versions/m08-v1-0-0";
import { M09_V1_0_0 } from "./versions/m09-v1-0-0";
import { M10_V1_0_0 } from "./versions/m10-v1-0-0";
import { M11_V1_0_0 } from "./versions/m11-v1-0-0";
import { M12_V1_0_0 } from "./versions/m12-v1-0-0";

export * from "./schema";
export { learnerModuleSchema, toLearnerView } from "./learner";
export type { LearnerModuleContent } from "./learner";
export { validateModuleContent } from "./validate";

// Every version of every module's learning package. Put a module version here as one file in
// ./versions, named for the module and version, exporting a ModuleContent. A draft can still change.
// An approved version is never edited: test/trade-content.test.ts keeps a hash of each one and
// fails if it changes, so a correction goes in a new version. A learner keeps the version they started.
export const MODULE_CONTENT: readonly ModuleContent[] = [
  M01_V0_1_0,
  M02_V1_0_0,
  M03_V0_1_0,
  M04_V0_1_0,
  M05_V1_0_0,
  M06_V1_0_0,
  M07_V0_1_0,
  M08_V1_0_0,
  M09_V1_0_0,
  M10_V1_0_0,
  M11_V1_0_0,
  M12_V1_0_0,
];

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
