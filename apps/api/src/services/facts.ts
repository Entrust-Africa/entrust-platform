import { FACTS, type FactKey } from "@entrust/rules";
import type { CaseFacts } from "@entrust/gate-engine";
import { ServiceError } from "./errors";

const DEFINITIONS = new Map<string, (typeof FACTS)[number]>(FACTS.map((f) => [f.key, f]));
/** Known when a case opens, and what the case list filters on, so they are never cleared. */
const REQUIRED: readonly FactKey[] = ["product", "destinationCountry"];

export type FactInput = string | string[] | null;
export interface FactChange {
  set: CaseFacts;
  clear: FactKey[];
}

const invalid = (message: string) => new ServiceError("invalid", message);

/**
 * Checks facts from a request against the fact definitions and returns them as they are stored:
 * options in their canonical spelling, country codes in capitals, multi-valued facts as lists.
 * A null value clears the fact.
 */
export function checkFacts(input: Record<string, FactInput>): FactChange {
  const change: FactChange = { set: {}, clear: [] };
  for (const [key, raw] of Object.entries(input)) {
    const definition = DEFINITIONS.get(key);
    if (!definition) throw invalid(`"${key}" is not a case fact. Known facts: ${FACTS.map((f) => f.key).join(", ")}.`);
    const factKey = definition.key;

    if (raw === null) {
      if (REQUIRED.includes(factKey)) throw invalid(`${definition.label} can't be cleared.`);
      change.clear.push(factKey);
      continue;
    }
    let values = (Array.isArray(raw) ? raw : [raw]).map((v) => v.trim());
    if (values.length === 0 || values.some((v) => v === "")) throw invalid(`${definition.label} needs a value.`);
    if (!definition.multiple && values.length !== 1) throw invalid(`${definition.label} takes a single value.`);

    if (factKey === "destinationCountry") {
      values = values.map((v) => v.toUpperCase());
      if (!/^[A-Z]{2}$/.test(values[0] ?? "")) throw invalid("Destination country is a two-letter ISO 3166-1 code, such as US.");
    }
    if (definition.options) {
      const options = definition.options;
      values = values.map((v) => {
        const match = options.find((o) => o.value.toLowerCase() === v.toLowerCase());
        if (!match) throw invalid(`"${v}" is not a ${definition.label.toLowerCase()}. Allowed: ${options.map((o) => o.value).join(", ")}.`);
        return match.value;
      });
    }
    values = [...new Set(values)];
    change.set[factKey] = definition.multiple ? values : values[0];
  }
  return change;
}

export function applyFacts(current: CaseFacts, { set, clear }: FactChange): CaseFacts {
  const next = { ...current, ...set };
  for (const key of clear) delete next[key];
  return next;
}

const listOf = (value: CaseFacts[FactKey]) =>
  (value === undefined ? [] : typeof value === "string" ? [value] : [...value]).sort();

export function sameFacts(a: CaseFacts, b: CaseFacts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<FactKey>;
  return [...keys].every((key) => listOf(a[key]).join("\n") === listOf(b[key]).join("\n"));
}

/** True when the change overwrites or clears a fact that is already recorded. */
export function changesRecordedFact(current: CaseFacts, { set, clear }: FactChange): boolean {
  const recorded = (key: FactKey) => listOf(current[key]).length > 0;
  const overwritten = (Object.keys(set) as FactKey[]).some(
    (key) => recorded(key) && listOf(current[key]).join("\n") !== listOf(set[key]).join("\n"),
  );
  return overwritten || clear.some(recorded);
}
