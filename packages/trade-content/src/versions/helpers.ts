import type { KnowledgeQuestion } from "../schema";

// Shared by the four modules whose questions Entrust wrote without wrong answers (M01, M03, M04, M07).

/**
 * One multiple-choice question. Entrust's package gives the question and the right answer only, so the
 * three wrong options come from the platform team and need Entrust's review. `at` is where the right
 * answer sits among a, b, c and d, so it isn't always the same letter.
 */
export function question(
  id: string,
  lessonId: string,
  text: string,
  right: string,
  wrong: readonly [string, string, string],
  at: "a" | "b" | "c" | "d",
): KnowledgeQuestion {
  const letters = ["a", "b", "c", "d"] as const;
  const texts = [...wrong];
  texts.splice(letters.indexOf(at), 0, right);
  return { id, text, options: letters.map((letter, i) => ({ id: letter, text: texts[i]! })), correct: [at], lessonId };
}

/** The bands of Entrust's common assessment standard, as a share of the 36 points. */
export const STANDARD_BANDS = [
  { label: "No demonstrated capability", from: 0 },
  { label: "Very limited", from: 1 },
  { label: "Partial", from: 33 },
  { label: "Functional", from: 50 },
  { label: "Good", from: 67 },
  { label: "Strong", from: 83 },
  { label: "Excellent", from: 100 },
];

/** Entrust's scoring scale for a criterion, as an assessor reads it. */
export const SCORING_GUIDE = `## Assessor scoring guide

Each criterion is scored from 0 to 6.

| Score | Performance description |
| --- | --- |
| 0 | Not completed or materially incorrect |
| 1–2 | Significant gaps |
| 3–4 | Adequate with some gaps |
| 5 | Strong and well-supported |
| 6 | Complete, clear and supported by appropriate evidence |

The pass mark is 24 of 36, and no critical failure is permitted. The assessor records the reason for any failure and gives corrective feedback.`;
