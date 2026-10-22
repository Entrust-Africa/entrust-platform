import type { Condition } from "@entrust/rules";
import type { CaseFacts } from "./types";

/**
 * Evaluate a condition with three-valued logic: true, false, or undefined when a fact it needs
 * is not known yet. `all` is false as soon as one part is false, `any` true as soon as one is true.
 */
export function evaluateCondition(condition: Condition, facts: CaseFacts): boolean | undefined {
  if ("all" in condition) {
    const results = condition.all.map((c) => evaluateCondition(c, facts));
    if (results.includes(false)) return false;
    return results.includes(undefined) ? undefined : true;
  }
  if ("any" in condition) {
    const results = condition.any.map((c) => evaluateCondition(c, facts));
    if (results.includes(true)) return true;
    return results.includes(undefined) ? undefined : false;
  }
  if ("not" in condition) {
    const result = evaluateCondition(condition.not, facts);
    return result === undefined ? undefined : !result;
  }
  const value = facts[condition.fact];
  // Compared trimmed and case-insensitively, so "us" or " US" still matches "US".
  const norm = (v: string) => v.trim().toLowerCase();
  const values = (typeof value === "string" ? [value] : (value ?? [])).map(norm).filter((v) => v !== "");
  if (values.length === 0) return undefined;
  const wanted = condition.in.map(norm);
  return values.some((v) => wanted.includes(v));
}
