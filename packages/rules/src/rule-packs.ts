import { FACTS } from "./facts";
import { ET_US_GREEN_COFFEE } from "./packs/et-us-green-coffee";
import { STEPS } from "./steps";
import type { RulePack } from "./types";
import { compareVersions, validateRulePacks } from "./validate";

// Every published version of every rule pack. A case keeps the version it was opened with, so a
// version stays here after a newer one is published, and test/rule-packs.test.ts fails if a
// published one is edited.
export const RULE_PACKS: readonly RulePack[] = [...ET_US_GREEN_COFFEE];

// A pack that doesn't validate never reaches a case: loading the package fails instead.
const errors = validateRulePacks(RULE_PACKS, { steps: STEPS, facts: FACTS });
if (errors.length) throw new Error(`Invalid rule packs:\n${errors.join("\n")}`);

export function findRulePack(id: string, version: string): RulePack | undefined {
  return RULE_PACKS.find((p) => p.id === id && p.version === version);
}

/** The newest version of the pack covering this product and destination, if there is one. */
export function latestRulePack(product: string | undefined, destination: string | undefined): RulePack | undefined {
  if (!product || !destination) return undefined;
  const country = destination.trim().toUpperCase();
  return RULE_PACKS.filter((p) => p.corridor.products.includes(product) && p.corridor.destinations.includes(country)).reduce<
    RulePack | undefined
  >((newest, p) => (!newest || compareVersions(p.version, newest.version) > 0 ? p : newest), undefined);
}

export interface PackChanges {
  /** Requirement codes only in the newer pack. */
  added: string[];
  /** Codes only in the older one. */
  removed: string[];
  /** Codes in both whose content differs: wording, sources, basis, steps or check date. */
  changed: string[];
}

/** What moving a case from one pack version to another would change, by requirement code. */
export function packChanges(from: RulePack | undefined, to: RulePack | undefined): PackChanges {
  const before = new Map(from?.requirements.map((r) => [r.code, JSON.stringify(r)]));
  const after = new Map(to?.requirements.map((r) => [r.code, JSON.stringify(r)]));
  return {
    added: [...after.keys()].filter((code) => !before.has(code)),
    removed: [...before.keys()].filter((code) => !after.has(code)),
    changed: [...after].filter(([code, json]) => before.has(code) && before.get(code) !== json).map(([code]) => code),
  };
}
