import { DOCUMENT_KINDS, CATEGORY_IDS, OPPORTUNITY_PATHWAYS, TOTAL_POINTS } from "./types";
import type { SummitRules } from "./types";
import { applicableCriteria } from "./scoring";

const duplicates = <T>(values: readonly T[]): T[] => [...new Set(values.filter((v, i) => values.indexOf(v) !== i))];

function rulesErrors(rules: SummitRules): string[] {
  const errors: string[] = [];
  if (!/^\d+\.\d+\.\d+$/.test(rules.version)) errors.push("the version is major.minor.patch");
  if (rules.status !== "draft" && rules.status !== "approved") errors.push(`unknown status ${String(rules.status)}`);

  // Eligibility.
  const { requiredDocuments } = rules.eligibility;
  for (const pathway of OPPORTUNITY_PATHWAYS) {
    const kinds = requiredDocuments[pathway];
    if (!kinds) errors.push(`eligibility: no required documents for ${pathway}`);
    else {
      for (const kind of duplicates(kinds)) errors.push(`eligibility: ${pathway} requires ${kind} twice`);
      for (const kind of kinds) if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) errors.push(`eligibility: ${pathway} requires unknown document ${kind}`);
    }
  }
  for (const key of Object.keys(requiredDocuments)) {
    if (!(OPPORTUNITY_PATHWAYS as readonly string[]).includes(key)) errors.push(`eligibility: unknown pathway ${key}`);
  }

  // The rubric.
  const { categories } = rules.rubric;
  if (categories.map((c) => c.id).join() !== CATEGORY_IDS.join()) errors.push(`the categories are ${CATEGORY_IDS.join(", ")}, in that order`);
  const total = categories.reduce((sum, c) => sum + c.maxPoints, 0);
  if (total !== TOTAL_POINTS) errors.push(`the categories add up to ${total} points, not ${TOTAL_POINTS}`);
  if (!categories.some((c) => !c.investmentOnly)) errors.push("every category is investment-only, so a trade applicant would have nothing to score");

  const criterionIds = categories.flatMap((c) => c.criteria.map((k) => k.id));
  for (const id of duplicates(criterionIds)) errors.push(`criterion ${id} is used twice`);

  for (const category of categories) {
    const label = `category ${category.id}`;
    if (!Number.isInteger(category.maxPoints) || category.maxPoints <= 0) errors.push(`${label}: max points is a whole number above 0`);
    if (!category.title.trim() || !category.assess.length) errors.push(`${label}: needs a title and what it assesses`);
    if (!category.criteria.length) errors.push(`${label}: has no criteria`);
    for (const criterion of category.criteria) {
      if (!Number.isInteger(criterion.maxPoints) || criterion.maxPoints <= 0) errors.push(`criterion ${criterion.id}: max points is a whole number above 0`);
      if (!criterion.text.trim()) errors.push(`criterion ${criterion.id}: needs its text`);
      for (const p of criterion.pathways ?? []) if (!(OPPORTUNITY_PATHWAYS as readonly string[]).includes(p)) errors.push(`criterion ${criterion.id}: unknown pathway ${p}`);
      if (criterion.pathways && !criterion.pathways.length) errors.push(`criterion ${criterion.id}: scores no pathway`);
      if (rules.status === "approved") {
        if (!criterion.evidence.length || criterion.evidence.some((e) => !e.trim())) errors.push(`criterion ${criterion.id}: an approved version needs its evidence requirements`);
      }
    }
    // Every pathway has to be able to earn the category's full points, or the pathways wouldn't be comparable.
    for (const pathway of OPPORTUNITY_PATHWAYS) {
      const points = applicableCriteria(category, pathway).reduce((sum, c) => sum + c.maxPoints, 0);
      if (points !== category.maxPoints) errors.push(`${label}: the ${pathway} criteria add up to ${points} points, not ${category.maxPoints}`);
    }
  }
  return errors;
}

/** Check published versions of the Summit's rules for internal consistency. One message per problem; empty when valid. */
export function validateSummitRules(versions: readonly SummitRules[]): string[] {
  const errors = duplicates(versions.map((r) => r.version)).map((v) => `${v}: published twice`);
  for (const rules of versions) errors.push(...rulesErrors(rules).map((message) => `${rules.version}: ${message}`));
  return errors;
}
