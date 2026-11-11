import { isRetired } from "./retired";
import { moduleContentSchema } from "./schema";
import type { ModuleContent } from "./schema";

/**
 * Entrust's common assessment standard (Curriculum and Platform Consistency Review, section 5), which every version
 * learners are graded on has to meet: a knowledge check of ten questions with four options and one answer, passed at
 * 80%, and a rubric of six criteria scored 0 to 6, passed at 24 of 36, with no must-have criteria and at least one
 * critical failure. The schema only checks that a version is consistent with itself, so the studio could otherwise
 * approve any pass mark.
 */
export function standardProblems(content: ModuleContent): string[] {
  const problems: string[] = [];
  const name = `${content.module}@${content.version}`;
  const { knowledgeCheck: check, rubric } = content;
  if (check.passMark !== 80) problems.push(`${name}: the knowledge check passes at 80%, not ${check.passMark}%`);
  if (check.questions.length !== 10) problems.push(`${name}: the knowledge check has 10 questions, not ${check.questions.length}`);
  for (const q of check.questions) {
    if (q.options.length !== 4) problems.push(`${name}: ${q.id} has 4 options, not ${q.options.length}`);
    if (q.correct.length !== 1) problems.push(`${name}: ${q.id} has one right answer, not ${q.correct.length}`);
  }
  if (rubric.criteria.length !== 6) problems.push(`${name}: the rubric has 6 criteria, not ${rubric.criteria.length}`);
  for (const c of rubric.criteria) {
    if (c.maxPoints !== 6) problems.push(`${name}: ${c.id} is scored out of 6, not ${c.maxPoints}`);
    if (c.mustHave) problems.push(`${name}: ${c.id} can't be a must-have criterion`);
  }
  if (rubric.passMark !== 24) problems.push(`${name}: the rubric passes at 24, not ${rubric.passMark}`);
  if (!rubric.criticalFailures.length) problems.push(`${name}: the rubric lists its critical failures`);
  return problems;
}

const label = (raw: unknown): string => {
  const { module, version } = (raw ?? {}) as { module?: unknown; version?: unknown };
  return typeof module === "string" && typeof version === "string" ? `${module}@${version}` : "unnamed content";
};

/**
 * Check module versions with zod and for repeats. One message per problem; empty when valid. Takes
 * unknown values, so content loaded from files is checked the same way as content written in code.
 */
export function validateModuleContent(versions: readonly unknown[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const raw of versions) {
    const name = label(raw);
    const result = moduleContentSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        errors.push(`${name}: ${path}${issue.message}`);
      }
      continue;
    }
    const content: ModuleContent = result.data;
    // What learners are graded on meets the standard. A retired version predates it and nobody is graded on it now.
    if (content.status === "approved" && !isRetired(content)) errors.push(...standardProblems(content));
    const key = `${content.module}@${content.version}`;
    if (seen.has(key)) errors.push(`${key}: published twice`);
    seen.add(key);
  }
  return errors;
}
