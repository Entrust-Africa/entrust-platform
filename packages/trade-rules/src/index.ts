import { TRADE_RULES_0_1_0 } from "./versions/v0-1-0";
import type { TradeRules } from "./types";
import { compareVersions, validateTradeRules } from "./validate";

export * from "./types";
export { compareVersions, validateTradeRules } from "./validate";

// Every published version of TRADE's rules. Every score and plan stores the version it used, so a
// version stays here after a newer one is published, and test/trade-rules.test.ts fails if a published
// one is edited. Put a correction in a new version.
export const TRADE_RULES: readonly TradeRules[] = [TRADE_RULES_0_1_0];

// Rules that don't validate never reach a score: loading the package fails instead.
const errors = validateTradeRules(TRADE_RULES);
if (errors.length) throw new Error(`Invalid TRADE rules:\n${errors.join("\n")}`);

export function findTradeRules(version: string): TradeRules | undefined {
  return TRADE_RULES.find((r) => r.version === version);
}

/** The newest published version, for assessments started now. */
export function latestTradeRules(): TradeRules {
  return TRADE_RULES.reduce((newest, r) => (compareVersions(r.version, newest.version) > 0 ? r : newest));
}
