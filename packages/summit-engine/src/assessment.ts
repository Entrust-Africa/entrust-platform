import type { ScoreResult } from "./scoring";
import type { CategoryId } from "./types";

/** An officer's note on one category: the scorecard asks for both for every category. */
export interface CategoryNote {
  /** A short justification of the points. */
  justification?: string | undefined;
  /** What the officer relied on: the documents or answers, by name. */
  evidence?: readonly string[] | undefined;
}

export interface NoteProblem {
  category: CategoryId;
  message: string;
}

/**
 * What an officer still has to write before an assessment can be completed. Every category that was scored
 * needs a short justification, and one that earned points needs the evidence it rests on. A category
 * scored 0 needs no evidence, since the points say there was none. A category left out as not applicable
 * needs nothing.
 */
export function categoryNoteProblems(result: ScoreResult, notes: Readonly<Partial<Record<CategoryId, CategoryNote>>>): NoteProblem[] {
  const problems: NoteProblem[] = [];
  for (const category of result.categories) {
    if (!category.applicable) continue;
    const note = notes[category.id];
    if (!note?.justification?.trim()) problems.push({ category: category.id, message: `Category ${category.id}: record a short justification.` });
    if ((category.points ?? 0) > 0 && !note?.evidence?.some((e) => e.trim())) {
      problems.push({ category: category.id, message: `Category ${category.id}: reference the evidence the points rest on.` });
    }
  }
  return problems;
}
