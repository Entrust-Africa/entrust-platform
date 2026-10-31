import { evaluateCondition as evaluate } from "@entrust/forms";
import type { Condition } from "@entrust/rules";
import type { CaseFacts } from "./types";

/**
 * Evaluate a condition with three-valued logic: true, false, or undefined when a fact it needs
 * is not known yet. The evaluation is shared with TRADE's forms, so it lives in @entrust/forms.
 */
export function evaluateCondition(condition: Condition, facts: CaseFacts): boolean | undefined {
  return evaluate(condition, facts);
}
