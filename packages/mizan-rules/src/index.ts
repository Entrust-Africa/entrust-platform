import { canonicalJson, sha256Hex } from "./hash";
import type { Criterion, Dimension, MizanConfig } from "./types";
import { validateMizanConfigs } from "./validate";
import { MIZAN_CONFIG_0_2_1_INTERIM } from "./versions/v0-2-1-interim";

export * from "./types";
export { canonicalJson, sha256Hex } from "./hash";
export { validateMizanConfigs } from "./validate";

/**
 * Every published MIZAN configuration. An assessment stores the version it was scored under, so a version stays here after a
 * newer one is published, and test/mizan-rules.test.ts fails if a published one is edited. Put a change in a new version.
 */
export const MIZAN_CONFIGS: readonly MizanConfig[] = [MIZAN_CONFIG_0_2_1_INTERIM];

/** The configuration new assessments are scored under. Moving it to a new version never rescores existing assessments. */
export const CURRENT_MIZAN_CONFIG_VERSION = MIZAN_CONFIG_0_2_1_INTERIM.version;

// A configuration that doesn't validate never reaches a score: loading the package fails instead.
const errors = validateMizanConfigs(MIZAN_CONFIGS);
if (errors.length) throw new Error(`Invalid MIZAN configuration:\n${errors.join("\n")}`);
if (!MIZAN_CONFIGS.some((c) => c.version === CURRENT_MIZAN_CONFIG_VERSION)) throw new Error("The current MIZAN configuration is not published");

export function findMizanConfig(version: string): MizanConfig | undefined {
  return MIZAN_CONFIGS.find((c) => c.version === version);
}

/** The configuration a version names. Throws for an unknown version: an assessment's version always exists. */
export function getMizanConfig(version: string): MizanConfig {
  const cfg = findMizanConfig(version);
  if (!cfg) throw new Error(`Unknown MIZAN configuration version: ${version}`);
  return cfg;
}

export function currentMizanConfig(): MizanConfig {
  return getMizanConfig(CURRENT_MIZAN_CONFIG_VERSION);
}

/** SHA-256 of the configuration's canonical JSON. Stored on every assessment with the version, to show exactly what scored it. */
export function configFingerprint(cfg: MizanConfig): Promise<string> {
  return sha256Hex(canonicalJson(cfg));
}

/** Every criterion in order, with the dimension it belongs to. */
export function allCriteria(cfg: MizanConfig): { criterion: Criterion; dimension: Dimension }[] {
  return cfg.dimensions.flatMap((dimension) => dimension.criteria.map((criterion) => ({ criterion, dimension })));
}

export function findCriterion(cfg: MizanConfig, id: string): { criterion: Criterion; dimension: Dimension } | undefined {
  return allCriteria(cfg).find((c) => c.criterion.id === id);
}
