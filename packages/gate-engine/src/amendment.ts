import {
  CONTRACT_FIELDS,
  FACTS,
  LC_FIELDS,
  type AmendableField,
  type Condition,
  type FactKey,
  type StepDefinition,
  type StepId,
} from "@entrust/rules";
import { evaluateCase } from "./evaluate";
import type { CaseState } from "./types";

// Amendments after a phase gate is signed (#13). A contract, a letter of credit or a case fact
// changes; the steps that depend on what changed are verified again, the evidence they rely on goes
// back for review, and the gates of the phases they sit in reopen. The rest of the case, and the
// evidence it rests on, is left alone. Which steps depend on which field is read from the step data:
// their conditions, the step that establishes a fact (`determinedAt`), and `relies` for contract and
// letter of credit terms. Pure, like the rest of the engine.

const FACT_KEYS = new Set<string>(FACTS.map((f) => f.key));
export const isFactField = (field: AmendableField): field is FactKey => FACT_KEYS.has(field);

/** Every field an amendment can change. */
export const AMENDABLE_FIELDS: readonly AmendableField[] = [...FACTS.map((f) => f.key), ...CONTRACT_FIELDS, ...LC_FIELDS];

const CONTRACT_LABELS: Record<(typeof CONTRACT_FIELDS)[number], string> = {
  "contract.number": "Contract number",
  "contract.buyerName": "Buyer",
  "contract.contractDate": "Contract date",
  "contract.unitPrice": "Unit price",
  "contract.coffeeType": "Coffee type",
  "contract.grade": "Grade",
  "contract.origin": "Origin",
};
const LC_LABELS: Record<(typeof LC_FIELDS)[number], string> = {
  "lc.expiry": "Letter of credit expiry",
  "lc.quantityTolerance": "Letter of credit quantity tolerance",
  "lc.reference": "Letter of credit reference",
};

export function fieldLabel(field: AmendableField): string {
  if (isFactField(field)) return FACTS.find((f) => f.key === field)?.label ?? field;
  return field in CONTRACT_LABELS ? CONTRACT_LABELS[field as keyof typeof CONTRACT_LABELS] : LC_LABELS[field as keyof typeof LC_LABELS];
}

/** One field that an amendment changed. A null side means the field had no value. */
export interface FieldChange {
  field: AmendableField;
  label: string;
  before: unknown;
  after: unknown;
}

const usesFact = (condition: Condition, fact: FactKey): boolean =>
  "all" in condition
    ? condition.all.some((c) => usesFact(c, fact))
    : "any" in condition
      ? condition.any.some((c) => usesFact(c, fact))
      : "not" in condition
        ? usesFact(condition.not, fact)
        : condition.fact === fact;

/**
 * The steps that depend on a field: for a case fact, the steps whose applicability or required
 * evidence is conditional on it and the step that establishes it; for contract and letter of credit
 * terms, the steps that list it in `relies`. In step order.
 */
export function dependentsOf(definitions: readonly StepDefinition[], field: AmendableField): StepId[] {
  if (!isFactField(field)) return definitions.filter((d) => d.relies?.includes(field as never)).map((d) => d.id);
  const establishedAt = FACTS.find((f) => f.key === field)?.determinedAt;
  return definitions
    .filter(
      (d) =>
        d.id === establishedAt ||
        (d.appliesWhen !== undefined && usesFact(d.appliesWhen.condition, field)) ||
        d.evidence.some((e) => e.when !== undefined && usesFact(e.when.condition, field)),
    )
    .map((d) => d.id);
}

export interface AmendmentImpact {
  /** Every dependent step that applies to the case once amended, in step order. */
  affected: StepId[];
  /** Completed steps among them: they are reopened. */
  reopen: StepId[];
  /**
   * What has to be done again for the amendment to be complete: the reopened steps, the dependents
   * the amendment makes applicable, and the gates it reopens.
   */
  reverify: StepId[];
  /** Evidence types the affected steps ask for. Approved evidence of these goes back for review. */
  evidence: string[];
  /** Milestone sign-offs of the phases that have a step to verify again, if they were signed. */
  unlock: StepId[];
  /** The changed fields each affected step depends on. */
  because: Partial<Record<StepId, AmendableField[]>>;
}

/**
 * Work out what an amendment sets back. `before` and `after` are the case's state either side of the
 * change. A dependent that doesn't apply to the amended case isn't touched, and one the amendment
 * makes applicable is added to what is to be done. Evidence that no affected step asks for stays
 * approved.
 */
export function amendmentImpact(
  definitions: readonly StepDefinition[],
  before: CaseState,
  after: CaseState,
  fields: readonly AmendableField[],
  options: { asOf: string },
): AmendmentImpact {
  const stateOf = (state: CaseState): CaseState => ({ ...state, flags: [] });
  const evaluatedBefore = new Map(evaluateCase(definitions, stateOf(before), options).steps.map((s) => [s.id, s]));
  const evaluatedAfter = new Map(evaluateCase(definitions, stateOf(after), options).steps.map((s) => [s.id, s]));

  const because: Partial<Record<StepId, AmendableField[]>> = {};
  for (const field of fields) {
    for (const id of dependentsOf(definitions, field)) (because[id] ??= []).push(field);
  }

  const affected = definitions
    .filter((d) => because[d.id] !== undefined)
    .filter((d) => {
      const step = evaluatedAfter.get(d.id);
      return step?.applicability === "applicable" && step.status !== "not_applicable";
    })
    .map((d) => d.id);

  const reopen = affected.filter((id) => after.steps[id]?.status === "completed");
  const newlyApplicable = affected.filter((id) => evaluatedBefore.get(id)?.applicability !== "applicable");
  const verifyAgain = new Set<StepId>([...reopen, ...newlyApplicable]);

  const phases = new Set(definitions.filter((d) => verifyAgain.has(d.id)).map((d) => d.phase));
  const unlock = definitions.filter((d) => d.milestone && phases.has(d.phase) && after.steps[d.id]?.status === "completed").map((d) => d.id);

  const evidence = [...new Set(affected.flatMap((id) => (evaluatedAfter.get(id)?.evidence ?? []).map((e) => e.type)))];
  return {
    affected,
    reopen,
    reverify: definitions.filter((d) => verifyAgain.has(d.id) || unlock.includes(d.id)).map((d) => d.id),
    evidence,
    unlock,
    because,
  };
}
