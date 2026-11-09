import type { KnowledgeQuestion, Worksheet, WorksheetField } from "../schema";

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

// ---- Worksheet builders ----
// Entrust's text lists each practical output as headings to fill in. These build the matching forms.


type Kind = WorksheetField["kind"];
const field = (kind: Kind) => (id: string, label: string, required = false): WorksheetField => ({ id, label, kind, ...(required ? { required } : {}) });
export const shortText = field("text");
export const longText = field("long_text");
export const dateField = field("date");
export const numberField = field("number");
export const moneyField = field("money");
export const checkbox = field("checkbox");

export const choice = (id: string, label: string, options: readonly (readonly [string, string])[], required = false): WorksheetField => ({
  id,
  label,
  kind: "choice",
  ...(required ? { required } : {}),
  options: options.map(([value, text]) => ({ value, label: text })),
});

/** A form of single fields. */
export const form = (id: string, title: string, description: string, fields: WorksheetField[]): Worksheet => ({ id, title, description, fields, tables: [], computed: [] });

/** A form that is one table of rows. */
export const register = (id: string, title: string, description: string, columns: WorksheetField[], minRows = 1, maxRows?: number): Worksheet => ({
  id,
  title,
  description,
  fields: [],
  tables: [{ id: "rows", label: title, columns, minRows, ...(maxRows ? { maxRows } : {}) }],
  computed: [],
});

/** The last output of a module on Entrust's standard: a plan built on the gaps the assessor found. `minRows` is the number of actions the module wants. */
export const learningPlan = (minRows = 1): Worksheet =>
  register(
    "individual_learning_plan",
    "Individual Learning Plan",
    "An improvement plan based on your assessment gaps.",
    [
      longText("gap", "Identified gap", true),
      longText("improvement", "Required improvement", true),
      shortText("owner", "Suggested owner"),
      dateField("target_date", "Target date"),
      shortText("evidence", "Evidence"),
    ],
    minRows,
  );
