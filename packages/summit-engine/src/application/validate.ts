import { formDefinitionErrors } from "@entrust/forms";
import type { FormQuestion } from "@entrust/forms";
import { OPPORTUNITY_PATHWAYS } from "../types";
import type { ApplicationTemplate, OptionRule } from "./types";

const duplicates = <T>(values: readonly T[]): T[] => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

function templateErrors(template: ApplicationTemplate): string[] {
  const errors = formDefinitionErrors(template);
  if (template.status !== "draft" && template.status !== "published") errors.push(`unknown status ${String(template.status)}`);
  const questions = new Map(template.questions.map((q) => [q.id, q]));
  const { inputs } = template;

  const find = (id: string, name: string, types: readonly FormQuestion["type"][]): FormQuestion | undefined => {
    const q = questions.get(id);
    if (!q) errors.push(`${name} names missing question ${id}`);
    else if (!types.includes(q.type)) errors.push(`${name}: ${id} is a ${q.type} question, not ${types.join(" or ")}`);
    return q;
  };
  const optionRule = (rule: OptionRule, name: string) => {
    const q = find(rule.question, name, ["single_choice"]);
    const values = new Set(q?.options?.map((o) => o.value));
    if (!rule.met.length || !rule.notMet.length) errors.push(`${name}: needs answers that meet it and answers that don't`);
    if (q) for (const v of [...rule.met, ...rule.notMet]) if (!values.has(v)) errors.push(`${name}: ${rule.question} has no option "${v}"`);
    for (const v of rule.met) if (rule.notMet.includes(v)) errors.push(`${name}: "${v}" both meets it and doesn't`);
  };

  const pathway = find(inputs.pathway, "pathway", ["single_choice"]);
  if (pathway && (pathway.options ?? []).map((o) => o.value).join() !== OPPORTUNITY_PATHWAYS.join()) {
    errors.push(`pathway: ${inputs.pathway} offers ${(pathway.options ?? []).map((o) => o.value).join(", ")}, not ${OPPORTUNITY_PATHWAYS.join(", ")}`);
  }
  const seeking = find(inputs.seekingInvestment, "seekingInvestment", ["yes_no"]);
  if (seeking?.optional) errors.push(`seekingInvestment: ${seeking.id} can't be optional`);
  optionRule(inputs.registration, "registration");
  optionRule(inputs.operating, "operating");
  find(inputs.representative, "representative", ["yes_no"]);
  if (!inputs.offering.length) errors.push("offering names no question");
  for (const id of inputs.offering) find(id, "offering", ["short_text", "long_text", "list", "single_choice", "multiple_choice"]);
  if (!inputs.declaration.length) errors.push("declaration names no question");
  for (const id of inputs.declaration) {
    const q = find(id, "declaration", ["yes_no"]);
    if (q && q.mustBe !== "yes") errors.push(`declaration: ${id} must be yes to submit`);
  }

  for (const id of duplicates(template.registry)) errors.push(`registry lists ${id} twice`);
  for (const id of template.registry) if (!questions.has(id)) errors.push(`registry names missing question ${id}`);
  return errors;
}

/** Check versions of the Summit application for internal consistency. One message per problem; empty when valid. */
export function validateApplicationTemplates(templates: readonly ApplicationTemplate[]): string[] {
  const errors = duplicates(templates.map((t) => t.version)).map((v) => `${v}: published twice`);
  for (const t of templates) errors.push(...templateErrors(t).map((message) => `${t.version}: ${message}`));
  return errors;
}
