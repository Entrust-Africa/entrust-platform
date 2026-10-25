import { FAILURE_RULE_IDS } from "./types";
import type {
  Condition,
  DocumentFieldDefinition,
  EvidenceType,
  FailureRuleDefinition,
  FactKey,
  FactDefinition,
  MasterControl,
  PhaseDefinition,
  ReconciliationDocument,
  RulePack,
  StepDefinition,
} from "./types";
import { DOCUMENT_FIELD_KEYS } from "./types";

export interface Catalogue {
  phases: readonly PhaseDefinition[];
  facts: readonly FactDefinition[];
  evidenceTypes: readonly EvidenceType[];
  masterControls: readonly MasterControl[];
}

const stepNumber = (id: string) => Number(id.slice("STEP-".length));

/** What is wrong with a condition: empty groups, unknown facts, values a fact doesn't have. */
function conditionErrors(id: string, condition: Condition, facts: ReadonlyMap<FactKey, FactDefinition>): string[] {
  if ("all" in condition || "any" in condition) {
    const parts = "all" in condition ? condition.all : condition.any;
    const empty = parts.length === 0 ? [`${id}: empty ${"all" in condition ? "all" : "any"} condition`] : [];
    return [...empty, ...parts.flatMap((c) => conditionErrors(id, c, facts))];
  }
  if ("not" in condition) return conditionErrors(id, condition.not, facts);
  const fact = facts.get(condition.fact);
  if (!fact) return [`${id}: condition uses unknown fact ${condition.fact}`];
  const allowed = new Set(fact.options?.map((o) => o.value));
  return fact.options ? condition.in.filter((v) => !allowed.has(v)).map((v) => `${id}: ${condition.fact} has no value "${v}"`) : [];
}

/** A condition's value from the facts given, or undefined while a fact it needs isn't given. */
function holds(condition: Condition, facts: Partial<Record<FactKey, string>>): boolean | undefined {
  if ("not" in condition) {
    const value = holds(condition.not, facts);
    return value === undefined ? undefined : !value;
  }
  if ("all" in condition || "any" in condition) {
    const values = ("all" in condition ? condition.all : condition.any).map((c) => holds(c, facts));
    const decisive = "all" in condition ? false : true;
    if (values.includes(decisive)) return decisive;
    return values.includes(undefined) ? undefined : !decisive;
  }
  const value = facts[condition.fact];
  return value === undefined ? undefined : condition.in.includes(value);
}

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
  const checkCondition = (id: string, condition: Condition) => errors.push(...conditionErrors(id, condition, facts));

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

/**
 * Check the document comparison data: every field is defined once, numbered 1 to 24 without gaps
 * (ours have no number), and carried by a document; every document is a known evidence type and
 * lists each field once; what a document requires is something it may carry.
 */
export function validateDocuments(
  fields: readonly DocumentFieldDefinition[],
  documents: readonly ReconciliationDocument[],
  evidenceTypes: readonly EvidenceType[],
  facts: readonly FactDefinition[],
): string[] {
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) errors.push(`${field.key}: duplicate field`);
    keys.add(field.key);
  }
  for (const key of DOCUMENT_FIELD_KEYS) {
    if (!keys.has(key)) errors.push(`${key}: not defined`);
  }
  const numbers = fields.flatMap((f) => (f.number === null ? [] : [f.number])).sort((a, b) => a - b);
  if (numbers.join() !== Array.from({ length: numbers.length }, (_, i) => i + 1).join()) {
    errors.push(`The field numbers are ${numbers.join(", ")}, expected 1 to ${numbers.length} once each`);
  }

  const evidence = new Set(evidenceTypes.map((e) => e.id));
  const factKeys = new Map(facts.map((f) => [f.key, f]));
  const seen = new Set<string>();
  const carried = new Set<string>();
  for (const document of documents) {
    if (seen.has(document.id)) errors.push(`${document.id}: duplicate document`);
    seen.add(document.id);
    if (!evidence.has(document.id)) errors.push(`${document.id}: not an evidence type`);
    const own = new Set<string>();
    for (const key of document.fields) {
      if (!keys.has(key)) errors.push(`${document.id}: carries unknown field ${key}`);
      if (own.has(key)) errors.push(`${document.id}: lists ${key} twice`);
      own.add(key);
      carried.add(key);
    }
    for (const requirement of document.requires ?? []) {
      for (const key of requirement.fields) {
        if (!own.has(key)) errors.push(`${document.id}: requires ${key}, which it doesn't carry`);
      }
      const condition = requirement.when?.condition;
      if (condition && "fact" in condition && !factKeys.has(condition.fact)) {
        errors.push(`${document.id}: requirement uses unknown fact ${condition.fact}`);
      }
    }
  }
  for (const key of keys) {
    if (!carried.has(key)) errors.push(`${key}: no document carries it`);
  }
  return errors;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isIsoDate = (value: string) => ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const TEXT_FIELDS = ["name", "description", "action", "whyItMatters", "responsible", "trigger", "evidence", "authority"] as const;

/**
 * Check rule packs against the canonical steps and facts. Besides the shape (a version number,
 * dates, known steps and facts), it holds the line the packs promise: a requirement presented as
 * law cites an official source with a link, and one that isn't established says so.
 */
export function validateRulePacks(
  packs: readonly RulePack[],
  catalogue: { steps: readonly StepDefinition[]; facts: readonly FactDefinition[] },
): string[] {
  const errors: string[] = [];
  const steps = new Map(catalogue.steps.map((s) => [s.id, s]));
  const position = new Map(catalogue.steps.map((s, i) => [s.id, i]));
  const facts = new Map(catalogue.facts.map((f) => [f.key, f]));
  const products = new Set(facts.get("product")?.options?.map((o) => o.value));
  const seen = new Set<string>();

  for (const pack of packs) {
    const at = `${pack.id}@${pack.version}`;
    const fail = (message: string) => errors.push(`${at}: ${message}`);
    if (seen.has(at)) fail("published twice");
    seen.add(at);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pack.id)) fail("the id is lower-case words joined by hyphens");
    if (!/^\d+\.\d+\.\d+$/.test(pack.version)) fail("the version is major.minor.patch");
    if (!isIsoDate(pack.checkedOn)) fail(`checkedOn "${pack.checkedOn}" is not a date`);
    if (!pack.name.trim() || !pack.route.trim() || !pack.changes.trim()) fail("needs a name, a route and what changed");
    if (pack.corridor.products.length === 0 || pack.corridor.destinations.length === 0) fail("covers no corridor");
    for (const product of pack.corridor.products) if (!products.has(product)) fail(`unknown product ${product}`);
    for (const country of pack.corridor.destinations) if (!/^[A-Z]{2}$/.test(country)) fail(`destination ${country} is not an ISO country code`);
    if (pack.requirements.length === 0) fail("has no requirements");
    const corridors = pack.corridor.products.flatMap((product) =>
      pack.corridor.destinations.map((destinationCountry) => ({ product, destinationCountry })),
    );

    // Listed in the order their work starts, so a pack reads like the workflow.
    const firstAt = (r: RulePack["requirements"][number]) => Math.min(...r.steps.map((s) => position.get(s) ?? Infinity));
    pack.requirements.forEach((r, i) => {
      const previous = pack.requirements[i - 1];
      if (previous && firstAt(previous) > firstAt(r)) fail(`${r.code} starts before ${previous.code}, so it goes first`);
    });

    const codes = new Set<string>();
    for (const r of pack.requirements) {
      const id = `${at} ${r.code}`;
      const wrong = (message: string) => errors.push(`${id}: ${message}`);
      if (codes.has(r.code)) wrong("duplicate code");
      codes.add(r.code);
      if (!/^[A-Z]{2,4}-\d{2}$/.test(r.code)) wrong("the code looks like ELG-01");
      for (const field of TEXT_FIELDS) if (!r[field].trim()) wrong(`${field} is empty`);
      if (r.jurisdiction !== null && !/^([A-Z]{2}|GCC)$/.test(r.jurisdiction)) wrong(`jurisdiction ${r.jurisdiction} is not an ISO country code`);

      if (r.steps.length === 0) wrong("is on no step");
      if (new Set(r.steps).size !== r.steps.length) wrong("lists a step twice");
      for (const stepId of r.steps) if (!steps.has(stepId)) wrong(`unknown step ${stepId}`);
      if (r.steps.length && r.steps.every((s) => steps.get(s)?.class === "exception")) {
        wrong("is only on exception steps, so it would apply only once one is raised");
      }
      if (r.appliesWhen?.condition) errors.push(...conditionErrors(id, r.appliesWhen.condition, facts));
      // It has to be able to apply to some case the pack covers: not only on steps for another
      // destination, say, or under a condition the corridor rules out.
      const possible = (c: Condition | undefined, corridor: Partial<Record<FactKey, string>>) => !c || holds(c, corridor) !== false;
      const applies = corridors.some(
        (c) => possible(r.appliesWhen?.condition, c) && r.steps.some((s) => steps.has(s) && possible(steps.get(s)?.appliesWhen?.condition, c)),
      );
      if (r.steps.length && r.steps.every((s) => steps.has(s)) && !applies) wrong("never applies to a case this pack covers");
      if (r.appliesWhen && !r.appliesWhen.description.trim()) wrong("appliesWhen needs a description");

      // Nothing unsourced is presented as a requirement of law.
      const linked = r.sources.filter((s) => s.url);
      if ((r.basis === "confirmed" || r.basis === "conditional") && linked.length === 0) {
        wrong(`a ${r.basis} requirement cites an official source with a link`);
      }
      if (r.basis === "conditional" && !r.appliesWhen) wrong("a conditional requirement says when it applies");
      if (r.basis === "awaiting_verification" && r.verification.status !== "awaiting_verification") {
        wrong("a requirement awaiting verification can't be shown as checked or verified");
      }
      for (const source of r.sources) {
        if (!source.title.trim()) wrong("a source has no title");
        if (source.url !== undefined && !source.url.startsWith("https://")) wrong(`source ${source.url} is not an https link`);
      }
      if (!isIsoDate(r.verification.checkedOn)) wrong(`checkedOn "${r.verification.checkedOn}" is not a date`);
      else if (r.verification.checkedOn > pack.checkedOn) wrong("checked after the pack's own check date");
      if (!r.verification.note.trim()) wrong("the verification note is empty");
    }
  }

  // Each corridor has one pack, so a new case can't match two.
  const latest = new Map<string, RulePack>();
  for (const pack of packs) {
    const current = latest.get(pack.id);
    if (!current || compareVersions(pack.version, current.version) > 0) latest.set(pack.id, pack);
  }
  const covering = new Map<string, string>();
  for (const pack of latest.values()) {
    for (const product of pack.corridor.products) {
      for (const country of pack.corridor.destinations) {
        const key = `${product} to ${country}`;
        const other = covering.get(key);
        if (other) errors.push(`${pack.id} and ${other} both cover ${key}`);
        covering.set(key, pack.id);
      }
    }
  }
  return errors;
}

/** Orders major.minor.patch versions: negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(".").map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
