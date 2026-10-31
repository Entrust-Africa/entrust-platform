import { conditionFacts } from "./conditions";
import type { Condition } from "./conditions";
import { CURRENCIES, NO, YES } from "./types";
import type { FormDefinition, FormQuestion } from "./types";

const duplicates = <T>(values: readonly T[]): T[] => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

const PLACEHOLDER = /\{(\w+)\}/g;

/** The names a text holds as {name}. */
export const placeholders = (text: string): string[] => [...text.matchAll(PLACEHOLDER)].map((m) => m[1] as string);

const CHOICE_TYPES = ["single_choice", "multiple_choice"] as const;

/** The values a question's answer can take in a condition, or none if a condition can't depend on it. */
export function conditionValues(question: FormQuestion): readonly string[] | undefined {
  if (question.type === "yes_no") return [YES, NO];
  if (question.type === "single_choice" || question.type === "multiple_choice") return (question.options ?? []).map((o) => o.value);
  return undefined;
}

function optionErrors(q: FormQuestion): string[] {
  const options = q.options ?? [];
  if (!CHOICE_TYPES.includes(q.type as (typeof CHOICE_TYPES)[number])) {
    return options.length ? [`${q.id}: a ${q.type} question has no options`] : [];
  }
  const errors: string[] = [];
  if (options.length < 2) errors.push(`${q.id}: needs at least two options`);
  // A condition compares trimmed and case-insensitively, so two values that differ only that way would clash.
  for (const v of duplicates(options.map((o) => o.value.trim().toLowerCase()))) errors.push(`${q.id}: duplicate option ${v}`);
  for (const o of options) if (!o.value.trim() || !o.label.trim()) errors.push(`${q.id}: an option needs a value and a label`);
  if (q.type === "single_choice" && options.some((o) => o.exclusive)) errors.push(`${q.id}: only a multiple-choice question has an exclusive option`);
  return errors;
}

function constraintErrors(q: FormQuestion): string[] {
  const errors: string[] = [];
  const only = (field: string, present: boolean, types: readonly string[]) => {
    if (present && !types.includes(q.type)) errors.push(`${q.id}: ${field} only applies to ${types.join(" or ")} questions`);
  };
  only("mustBe", q.mustBe !== undefined, ["yes_no"]);
  only("maxLength", q.maxLength !== undefined, ["short_text", "long_text", "list"]);
  only("integer, min and max", q.integer !== undefined || q.min !== undefined || q.max !== undefined, ["number"]);
  only("currencies", q.currencies !== undefined, ["money"]);
  only("maxItems", q.maxItems !== undefined, ["list"]);
  only("notFuture", q.notFuture !== undefined, ["date"]);

  if (q.mustBe && q.optional) errors.push(`${q.id}: a question that must be ${q.mustBe} can't also be optional`);
  if (q.maxLength !== undefined && !(Number.isInteger(q.maxLength) && q.maxLength > 0)) errors.push(`${q.id}: maxLength is a whole number above 0`);
  if (q.min !== undefined && q.max !== undefined && q.min > q.max) errors.push(`${q.id}: min is above max`);
  if (q.maxItems !== undefined && !(Number.isInteger(q.maxItems) && q.maxItems > 0)) errors.push(`${q.id}: maxItems is a whole number above 0`);
  if (q.currencies) {
    if (!q.currencies.length) errors.push(`${q.id}: offers no currency`);
    for (const c of duplicates(q.currencies)) errors.push(`${q.id}: currency ${c} listed twice`);
    for (const c of q.currencies) if (!(CURRENCIES as readonly string[]).includes(c)) errors.push(`${q.id}: unknown currency ${c}`);
  }
  return errors;
}

function conditionErrors(q: FormQuestion, condition: Condition, earlier: ReadonlyMap<string, FormQuestion>, all: ReadonlyMap<string, FormQuestion>): string[] {
  const errors: string[] = [];
  const leaves = (c: Condition): { fact: string; in: readonly string[] }[] => {
    if ("all" in c) return c.all.flatMap(leaves);
    if ("any" in c) return c.any.flatMap(leaves);
    if ("not" in c) return leaves(c.not);
    return [c];
  };
  for (const fact of new Set(conditionFacts(condition))) {
    const target = all.get(fact);
    if (!target) errors.push(`${q.id}: shown by missing question ${fact}`);
    else if (!earlier.has(fact)) errors.push(`${q.id}: shown by ${fact}, which doesn't come before it`);
    else if (!conditionValues(target)) errors.push(`${q.id}: shown by ${fact}, a ${target.type} question, which a condition can't test`);
  }
  for (const leaf of leaves(condition)) {
    const target = earlier.get(leaf.fact);
    const values = target && conditionValues(target);
    if (!leaf.in.length) errors.push(`${q.id}: shown on no answer to ${leaf.fact}`);
    if (values) for (const v of leaf.in) if (!values.includes(v)) errors.push(`${q.id}: ${leaf.fact} has no option "${v}"`);
  }
  return errors;
}

/** What is wrong with one form definition. One message per problem; empty when valid. */
export function formDefinitionErrors(form: FormDefinition): string[] {
  const errors: string[] = [];
  if (!form.id.trim()) errors.push("the form needs an ID");
  if (!/^\d+\.\d+\.\d+$/.test(form.version)) errors.push("the version is major.minor.patch");
  if (!form.title.trim()) errors.push("the form needs a title");

  const sectionIds = new Set(form.sections.map((s) => s.id));
  for (const id of duplicates(form.sections.map((s) => s.id))) errors.push(`duplicate section ${id}`);
  for (const id of duplicates(form.questions.map((q) => q.id))) errors.push(`duplicate question ${id}`);
  for (const s of form.sections) {
    if (!s.title.trim()) errors.push(`section ${s.id}: needs a title`);
    if (!form.questions.some((q) => q.section === s.id)) errors.push(`section ${s.id}: has no questions`);
  }

  for (const name of duplicates(form.variables ?? [])) errors.push(`variable ${name} listed twice`);

  const all = new Map(form.questions.map((q) => [q.id, q]));
  const earlier = new Map<string, FormQuestion>();
  for (const q of form.questions) {
    if (!q.id.trim() || !q.text.trim()) errors.push(`${q.id || "a question"}: needs an ID and its text`);
    if (!sectionIds.has(q.section)) errors.push(`${q.id}: unknown section ${q.section}`);
    errors.push(...optionErrors(q), ...constraintErrors(q));
    for (const name of new Set([...placeholders(q.text), ...placeholders(q.help ?? "")])) {
      if (!form.variables?.includes(name)) errors.push(`${q.id}: uses {${name}}, which the form doesn't declare`);
    }
    if (q.showIf) errors.push(...conditionErrors(q, q.showIf, earlier, all));
    earlier.set(q.id, q);
  }
  return errors;
}

/** Check published versions of forms for internal consistency. One message per problem, led by the form and version. */
export function validateFormDefinitions(forms: readonly FormDefinition[]): string[] {
  const errors = duplicates(forms.map((f) => `${f.id} ${f.version}`)).map((v) => `${v}: published twice`);
  for (const form of forms) errors.push(...formDefinitionErrors(form).map((message) => `${form.id} ${form.version}: ${message}`));
  return errors;
}
