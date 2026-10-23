import { FAILURE_RULE_IDS } from "./types";
import type {
  Condition,
  EvidenceType,
  FailureRuleDefinition,
  FactKey,
  FactDefinition,
  MasterControl,
  PhaseDefinition,
  StepDefinition,
} from "./types";

export interface Catalogue {
  phases: readonly PhaseDefinition[];
  facts: readonly FactDefinition[];
  evidenceTypes: readonly EvidenceType[];
  masterControls: readonly MasterControl[];
}

const stepNumber = (id: string) => Number(id.slice("STEP-".length));

/** Check a step list for internal consistency. Returns one message per problem; empty when valid. */
export function validateSteps(steps: readonly StepDefinition[], catalogue: Catalogue): string[] {
  const errors: string[] = [];
  const position = new Map<string, number>();
  steps.forEach((step, i) => {
    if (position.has(step.id)) errors.push(`${step.id}: duplicate id`);
    position.set(step.id, i);
  });

  const facts = new Map(catalogue.facts.map((f) => [f.key, f]));
  const evidenceTypes = new Set(catalogue.evidenceTypes.map((e) => e.id));
  const masterControls = new Set(catalogue.masterControls.map((m) => m.id));

  const checkCondition = (id: string, condition: Condition): void => {
    if ("all" in condition || "any" in condition) {
      const parts = "all" in condition ? condition.all : condition.any;
      if (parts.length === 0) errors.push(`${id}: empty ${"all" in condition ? "all" : "any"} condition`);
      return parts.forEach((c) => checkCondition(id, c));
    }
    if ("not" in condition) return checkCondition(id, condition.not);
    const fact = facts.get(condition.fact);
    if (!fact) return void errors.push(`${id}: condition uses unknown fact ${condition.fact}`);
    if (fact.options) {
      const allowed = new Set(fact.options.map((o) => o.value));
      for (const value of condition.in) {
        if (!allowed.has(value)) errors.push(`${id}: ${condition.fact} has no value "${value}"`);
      }
    }
  };

  for (const [i, step] of steps.entries()) {
    const phase = catalogue.phases.find((p) => p.id === step.phase);
    if (!phase) {
      errors.push(`${step.id}: unknown phase ${step.phase}`);
    } else {
      const n = stepNumber(step.id);
      if (n < stepNumber(phase.firstStep) || n > stepNumber(phase.lastStep)) {
        errors.push(`${step.id}: outside phase ${phase.id} (${phase.firstStep} to ${phase.lastStep})`);
      }
    }
    const previous = steps[i - 1];
    if (previous && previous.phase > step.phase) errors.push(`${step.id}: listed after a step of a later phase`);

    if (!masterControls.has(step.masterControl)) errors.push(`${step.id}: unknown master control ${step.masterControl}`);

    for (const prerequisite of step.prerequisites) {
      const at = position.get(prerequisite);
      if (at === undefined) errors.push(`${step.id}: prerequisite ${prerequisite} does not exist`);
      else if (at >= i) errors.push(`${step.id}: prerequisite ${prerequisite} comes later in the sequence`);
    }

    if (step.class === "conditional" && !step.appliesWhen) errors.push(`${step.id}: conditional step without appliesWhen`);
    if (step.class !== "conditional" && step.appliesWhen) errors.push(`${step.id}: appliesWhen on a ${step.class} step`);
    if (step.class === "exception" && !step.raisedWhen) errors.push(`${step.id}: exception step without raisedWhen`);
    if (step.class !== "exception" && step.raisedWhen) errors.push(`${step.id}: raisedWhen on a ${step.class} step`);
    if (step.appliesWhen) checkCondition(step.id, step.appliesWhen.condition);

    for (const requirement of step.evidence) {
      if (!evidenceTypes.has(requirement.type)) errors.push(`${step.id}: unknown evidence type ${requirement.type}`);
      if (requirement.when) checkCondition(step.id, requirement.when.condition);
    }

    if (step.deadline && "afterStep" in step.deadline.starts && !position.has(step.deadline.starts.afterStep)) {
      errors.push(`${step.id}: deadline starts after unknown step ${step.deadline.starts.afterStep}`);
    }

    if (step.milestone) {
      if (step.class !== "mandatory") errors.push(`${step.id}: milestone must be mandatory`);
      const next = steps[i + 1];
      if (next && next.phase === step.phase) errors.push(`${step.id}: milestone is not the last step of its phase`);
    }
  }

  // A step that depends on a fact must come after the step that establishes it.
  const ancestors = new Map<string, Set<string>>();
  const ancestorsOf = (id: string): Set<string> => {
    const known = ancestors.get(id);
    if (known) return known;
    const result = new Set<string>();
    ancestors.set(id, result);
    for (const p of steps[position.get(id) ?? -1]?.prerequisites ?? []) {
      result.add(p);
      for (const a of ancestorsOf(p)) result.add(a);
    }
    return result;
  };
  const factsIn = (condition: Condition): FactKey[] =>
    "all" in condition
      ? condition.all.flatMap(factsIn)
      : "any" in condition
        ? condition.any.flatMap(factsIn)
        : "not" in condition
          ? factsIn(condition.not)
          : [condition.fact];
  for (const step of steps) {
    const conditions = [step.appliesWhen?.condition, ...step.evidence.map((e) => e.when?.condition)].filter(
      (c): c is Condition => c !== undefined,
    );
    for (const key of new Set(conditions.flatMap(factsIn))) {
      const determinedAt = facts.get(key)?.determinedAt;
      if (determinedAt && determinedAt !== step.id && !ancestorsOf(step.id).has(determinedAt)) {
        errors.push(`${step.id}: uses ${key}, which is only known after ${determinedAt}, but does not wait on it`);
      }
    }
  }

  for (const phase of catalogue.phases) {
    const milestones = steps.filter((s) => s.phase === phase.id && s.milestone);
    if (milestones.length !== 1) errors.push(`Phase ${phase.id}: has ${milestones.length} milestone steps, expected 1`);
  }

  return errors;
}

/**
 * Check the failure rules against the steps. Every rule must be defined once, and what it raises
 * must be an exception step and what it holds an existing step.
 */
export function validateFailureRules(rules: readonly FailureRuleDefinition[], steps: readonly StepDefinition[]): string[] {
  const errors: string[] = [];
  const byId = new Map(steps.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) errors.push(`${rule.id}: duplicate rule`);
    seen.add(rule.id);
    if (rule.origin === "proposed" && !rule.basis) errors.push(`${rule.id}: a proposed rule names the failure point it comes from`);
    if (rule.origin === "matrix" && rule.basis) errors.push(`${rule.id}: a rule from the matrix has no Register basis`);
    for (const id of rule.raises) {
      const step = byId.get(id);
      if (!step) errors.push(`${rule.id}: raises unknown step ${id}`);
      else if (step.class !== "exception") errors.push(`${rule.id}: raises ${id}, which is a ${step.class} step, not an exception step`);
    }
    for (const id of rule.blocks) {
      if (!byId.has(id)) errors.push(`${rule.id}: blocks unknown step ${id}`);
    }
  }
  for (const id of FAILURE_RULE_IDS) {
    if (!seen.has(id)) errors.push(`${id}: not defined`);
  }
  return errors;
}
