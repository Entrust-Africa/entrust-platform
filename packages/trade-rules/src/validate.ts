import { MODULE_IDS, PATHWAYS, PATHWAY_REASON_CODES, REASON_CODES } from "./types";
import type { ModuleDefinition, Question, TradeRules } from "./types";

const POINTS_PER_QUESTION = 3;

/** Compares major.minor.patch versions: negative when a is older, positive when newer. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(".").map(Number);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const duplicates = <T>(values: readonly T[]): T[] => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

function templateErrors(rules: TradeRules): string[] {
  const { sections, questions, scale } = rules.template;
  const errors: string[] = [];
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const questionById = new Map(questions.map((q) => [q.id, q]));

  for (const id of duplicates(sections.map((s) => s.id))) errors.push(`duplicate section ${id}`);
  for (const id of duplicates(questions.map((q) => q.id))) errors.push(`duplicate question ${id}`);
  for (const key of duplicates(questions.map((q) => q.key))) errors.push(`two questions share the key ${key}`);
  if (scale.map((s) => s.score).join() !== "0,1,2,3") errors.push("the capability scale runs 0, 1, 2, 3");

  const optionErrors = (q: Question): string[] => {
    const options = q.options ?? [];
    if (q.kind === "choice" || q.kind === "multi_choice") {
      const found = options.length < 2 ? [`${q.id}: needs at least two options`] : [];
      const repeated = duplicates(options.map((o) => o.value)).map((v) => `${q.id}: duplicate option ${v}`);
      const exclusive = q.kind === "choice" && options.some((o) => o.exclusive) ? [`${q.id}: only a multiple-choice question has an exclusive option`] : [];
      return [...found, ...repeated, ...exclusive];
    }
    return options.length ? [`${q.id}: a ${q.kind} question has no options`] : [];
  };

  questions.forEach((q, i) => {
    const section = sectionById.get(q.section);
    if (!section) errors.push(`${q.id}: unknown section ${q.section}`);
    else if (q.kind === "capability" && !section.scored) errors.push(`${q.id}: a capability question is in section ${q.section}, which isn't scored`);
    errors.push(...optionErrors(q));

    if (q.askWhen) {
      const earlier = questions.findIndex((other) => other.id === q.askWhen?.question);
      const target = questionById.get(q.askWhen.question);
      if (!target) errors.push(`${q.id}: asked after unknown question ${q.askWhen.question}`);
      else if (earlier >= i) errors.push(`${q.id}: asked after ${target.id}, which comes later`);
      else {
        const values = new Set(target.options?.map((o) => o.value));
        for (const v of q.askWhen.in) if (!values.has(v)) errors.push(`${q.id}: ${target.id} has no option "${v}"`);
      }
      if (!q.askWhen.in.length) errors.push(`${q.id}: asked after ${q.askWhen.question} on no answer`);
    }
  });
  return errors;
}

/** What is wrong with a list of question IDs: unknown, or not a capability question. */
function questionListErrors(label: string, ids: readonly string[], questions: ReadonlyMap<string, Question>): string[] {
  const errors: string[] = [];
  if (!ids.length) errors.push(`${label}: has no questions`);
  for (const id of duplicates(ids)) errors.push(`${label}: lists ${id} twice`);
  for (const id of new Set(ids)) {
    const q = questions.get(id);
    if (!q) errors.push(`${label}: names missing question ${id}`);
    else if (q.kind !== "capability") errors.push(`${label}: ${id} isn't a capability question, so it has no score`);
  }
  return errors;
}

function scoringErrors(rules: TradeRules): string[] {
  const errors: string[] = [];
  const questions = new Map(rules.template.questions.map((q) => [q.id, q]));
  const capability = rules.template.questions.filter((q) => q.kind === "capability").map((q) => q.id);
  const moduleIds = new Set<string>(rules.modules.map((m) => m.id));

  for (const id of duplicates(rules.domains.map((d) => d.id))) errors.push(`duplicate domain ${id}`);
  const inDomains = new Map<string, string>();
  for (const domain of rules.domains) {
    errors.push(...questionListErrors(`domain ${domain.id}`, domain.questions, questions));
    for (const id of new Set(domain.questions)) {
      const other = inDomains.get(id);
      if (other) errors.push(`${id} is in two domains: ${other} and ${domain.id}`);
      else inDomains.set(id, domain.id);
    }
    const max = domain.questions.length * POINTS_PER_QUESTION;
    if (domain.maxPoints !== max) errors.push(`domain ${domain.id}: max points is ${domain.maxPoints}, but ${domain.questions.length} questions come to ${max}`);
  }
  for (const id of capability) if (!inDomains.has(id)) errors.push(`${id} is in no domain, so it would never be scored`);

  for (const id of duplicates(rules.triggerGroups.map((g) => g.id))) errors.push(`duplicate trigger group ${id}`);
  const inGroups = new Set<string>();
  for (const group of rules.triggerGroups) {
    errors.push(...questionListErrors(`trigger group ${group.id}`, group.questions, questions));
    if (!moduleIds.has(group.module)) errors.push(`trigger group ${group.id}: unknown module ${group.module}`);
    group.questions.forEach((id) => inGroups.add(id));
  }
  for (const id of capability) if (!inGroups.has(id)) errors.push(`${id} is in no trigger group, so it could never assign a module`);

  const { bands, thresholds } = rules;
  for (const id of duplicates(bands.map((b) => b.id))) errors.push(`duplicate band ${id}`);
  if (bands[0]?.from !== 0) errors.push("the first band starts at 0");
  bands.forEach((band, i) => {
    const previous = bands[i - 1];
    if (previous && band.from <= previous.from) errors.push(`band ${band.id} doesn't start above ${previous.id}`);
    if (band.from < 0 || band.from > 100) errors.push(`band ${band.id}: starts outside 0 to 100`);
  });

  const boundaries = new Set(bands.map((b) => b.from));
  for (const name of ["assignBelow", "testOutFrom", "retentionBelow"] as const) {
    if (!boundaries.has(thresholds[name])) errors.push(`threshold ${name} (${thresholds[name]}) is not where a band starts`);
  }
  if (thresholds.assignBelow >= thresholds.testOutFrom) errors.push("a test-out is offered above the score that assigns a module");
  if (!(thresholds.minCoverage > 0 && thresholds.minCoverage <= 1)) errors.push("minimum coverage is a share above 0 and up to 1");
  return errors;
}

/** The module IDs a chain of prerequisites leads back to, if a module needs itself. */
function prerequisiteCycle(modules: readonly ModuleDefinition[]): string | undefined {
  const needs = new Map(modules.map((m) => [m.id, m.prerequisites.map((p) => p.module)]));
  const visit = (id: string, path: readonly string[]): string[] | undefined => {
    if (path.includes(id)) return [...path, id];
    for (const next of needs.get(id as ModuleDefinition["id"]) ?? []) {
      const cycle = visit(next, [...path, id]);
      if (cycle) return cycle;
    }
    return undefined;
  };
  for (const m of modules) {
    const cycle = visit(m.id, []);
    if (cycle) return cycle.join(" -> ");
  }
  return undefined;
}

function moduleErrors(rules: TradeRules): string[] {
  const errors: string[] = [];
  const { modules } = rules;
  const reasonCodes = new Set<string>(rules.reasonCodes.map((r) => r.code));
  const ids = modules.map((m) => m.id);
  const known = new Set<string>(MODULE_IDS);

  for (const id of duplicates(ids)) errors.push(`duplicate module ${id}`);
  for (const id of MODULE_IDS) if (!ids.includes(id)) errors.push(`module ${id} is missing from the catalogue`);
  for (const id of ids) if (!known.has(id)) errors.push(`unknown module ${id}`);

  const ruleIds: string[] = [];
  for (const m of modules) {
    if (!m.title || !m.deliverable) errors.push(`${m.id}: needs a title and a deliverable`);
    if (!m.pathways.length || m.pathways.some((p) => !PATHWAYS.includes(p))) errors.push(`${m.id}: needs pathways from A and B`);
    ruleIds.push(m.trigger.ruleId, ...m.prerequisites.map((p) => p.ruleId));
    for (const code of m.trigger.reasonCodes) if (!reasonCodes.has(code)) errors.push(`${m.id}: trigger uses unknown reason code ${code}`);
    if (!m.trigger.reasonCodes.length) errors.push(`${m.id}: trigger gives no reason code`);
    for (const p of m.prerequisites) {
      if (p.module === m.id) errors.push(`${m.id}: is its own prerequisite`);
      else if (!known.has(p.module) || !ids.includes(p.module)) errors.push(`${m.id}: prerequisite ${p.module} is not in the catalogue`);
      if (!reasonCodes.has(p.reasonCode)) errors.push(`${m.id}: prerequisite ${p.module} uses unknown reason code ${p.reasonCode}`);
    }
    if (!m.completion.length) errors.push(`${m.id}: has no completion criteria`);
    for (const id of duplicates(m.completion.map((c) => c.id))) errors.push(`${m.id}: completion criterion ${id} listed twice`);
  }
  for (const id of duplicates(ruleIds)) errors.push(`rule ID ${id} is used twice`);
  const cycle = prerequisiteCycle(modules);
  if (cycle) errors.push(`prerequisites go in a circle: ${cycle}`);
  return errors;
}

function reasonCodeErrors(rules: TradeRules): string[] {
  const codes = rules.reasonCodes.map((r) => r.code);
  const known = new Set<string>(REASON_CODES);
  // A version only defines the codes it uses, so a later version can add codes without changing an earlier one.
  const missingPathwayCodes = rules.pathway ? PATHWAY_REASON_CODES.filter((c) => !codes.includes(c)) : [];
  return [
    ...duplicates(codes).map((c) => `duplicate reason code ${c}`),
    ...codes.filter((c) => !known.has(c)).map((c) => `unknown reason code ${c}`),
    ...rules.reasonCodes.filter((r) => !r.text.trim()).map((r) => `reason code ${r.code} has an empty sentence`),
    ...missingPathwayCodes.map((c) => `pathway rules use reason code ${c}, which has no sentence`),
  ];
}

/** The values a question offers, or none if the question doesn't exist. */
const optionValues = (rules: TradeRules, id: string): Set<string> =>
  new Set(rules.template.questions.find((q) => q.id === id)?.options?.map((o) => o.value));

function planErrors(rules: TradeRules): string[] {
  const { pathway, plan } = rules;
  const errors: string[] = [];
  if (!pathway && !plan) return errors;
  if (!pathway || !plan) return ["pathway rules and plan rules come together"];

  if (!Number.isInteger(pathway.shipmentWindowMonths) || pathway.shipmentWindowMonths < 1) {
    errors.push("the shipment window is a whole number of months, at least 1");
  }

  const stages = optionValues(rules, "A2");
  const history = optionValues(rules, "A1");
  const answers: [string, readonly string[], Set<string>, string][] = [
    ["live order stages", plan.liveOrderStages, stages, "A2"],
    ["quotation stages", plan.quotationStages, stages, "A2"],
    ["no-buyer stages", plan.noBuyerStages, stages, "A2"],
    ["exported history", plan.exportedHistory, history, "A1"],
  ];
  for (const [name, values, allowed, question] of answers) {
    if (!values.length) errors.push(`plan: ${name} are empty`);
    for (const v of values) if (!allowed.has(v)) errors.push(`plan: ${name} name "${v}", which ${question} doesn't offer`);
  }
  for (const v of plan.liveOrderStages) {
    if (plan.quotationStages.includes(v)) errors.push(`plan: "${v}" is both a live order and a quotation stage`);
    if (plan.noBuyerStages.includes(v)) errors.push(`plan: "${v}" is both a live order and a no-buyer stage`);
  }

  const known = new Set<string>(MODULE_IDS);
  for (const id of plan.urgentModules) if (!known.has(id)) errors.push(`plan: urgent module ${id} is unknown`);
  for (const id of duplicates(plan.urgentModules)) errors.push(`plan: urgent module ${id} listed twice`);

  const placed = Object.values(plan.sequence).flat();
  for (const id of placed) if (!known.has(id)) errors.push(`plan: sequence has unknown module ${id}`);
  for (const id of duplicates(placed)) errors.push(`plan: ${id} is in the sequence twice`);
  for (const id of MODULE_IDS) if (!placed.includes(id)) errors.push(`plan: ${id} has no place in the sequence`);
  return errors;
}

/** Check published versions of TRADE's rules for internal consistency. One message per problem; empty when valid. */
export function validateTradeRules(versions: readonly TradeRules[]): string[] {
  const errors = duplicates(versions.map((r) => r.version)).map((v) => `${v}: published twice`);
  for (const rules of versions) {
    const found = /^\d+\.\d+\.\d+$/.test(rules.version) ? [] : ["the version is major.minor.patch"];
    const all = [...found, ...templateErrors(rules), ...scoringErrors(rules), ...moduleErrors(rules), ...reasonCodeErrors(rules), ...planErrors(rules)];
    errors.push(...all.map((message) => `${rules.version}: ${message}`));
  }
  return errors;
}
