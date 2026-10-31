import type { TradeRules } from "../../types";
import { MODULES } from "./modules";
import { REASON_CODE_DEFINITIONS } from "./reason-codes";
import { BANDS, DOMAINS, THRESHOLDS, TRIGGER_GROUPS } from "./scoring";
import { PLACEMENT_TEMPLATE } from "./template";

// The first version, built from the Placement Assessment Specification v1.0 and the choices in #48.
// Not 1.0.0 until Entrust signs those off and the 60-point threshold is checked against pilot data.
export const TRADE_RULES_0_1_0: TradeRules = {
  version: "0.1.0",
  template: PLACEMENT_TEMPLATE,
  domains: DOMAINS,
  triggerGroups: TRIGGER_GROUPS,
  bands: BANDS,
  thresholds: THRESHOLDS,
  modules: MODULES,
  reasonCodes: REASON_CODE_DEFINITIONS,
};
