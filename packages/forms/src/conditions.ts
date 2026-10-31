// Conditions over named facts, with three-valued logic. A form uses them to decide which questions to
// ask (the facts are earlier answers) and the CLEAR gate engine uses them for steps (the facts are case
// facts). They live here so neither platform depends on the other.

/**
 * A leaf holds when the fact's value (or, for a multi-valued fact, any of its values) is in `in`. The
 * shape is the one CLEAR's rule packs already use, so a pack's conditions evaluate here unchanged.
 */
export type Condition<Fact extends string = string> =
  | { fact: Fact; in: readonly string[] }
  | { all: readonly Condition<Fact>[] }
  | { any: readonly Condition<Fact>[] }
  | { not: Condition<Fact> };

/** What is known so far, by fact name. A missing fact, or an empty one, is not known yet. */
export type Facts<Fact extends string = string> = Partial<Record<Fact, string | readonly string[]>>;

/** Every fact name a condition mentions. */
export function conditionFacts<Fact extends string>(condition: Condition<Fact>): Fact[] {
  if ("all" in condition) return condition.all.flatMap((c) => conditionFacts(c));
  if ("any" in condition) return condition.any.flatMap((c) => conditionFacts(c));
  if ("not" in condition) return conditionFacts(condition.not);
  return [condition.fact];
}

/**
 * Evaluate a condition with three-valued logic: true, false, or undefined when a fact it needs
 * is not known yet. `all` is false as soon as one part is false, `any` true as soon as one is true.
 */
export function evaluateCondition<Fact extends string>(condition: Condition<Fact>, facts: Facts<Fact>): boolean | undefined {
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
  const value: string | readonly string[] | undefined = facts[condition.fact];
  // Compared trimmed and case-insensitively, so "us" or " US" still matches "US".
  const norm = (v: string) => v.trim().toLowerCase();
  const values = (typeof value === "string" ? [value] : (value ?? [])).map(norm).filter((v) => v !== "");
  if (values.length === 0) return undefined;
  const wanted = condition.in.map(norm);
  return values.some((v) => wanted.includes(v));
}
