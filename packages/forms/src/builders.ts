import type { Condition } from "./conditions";
import type { FormOption, FormQuestion, QuestionType } from "./types";

// Shorthand for writing a form template as data. It builds the same plain objects you could write
// by hand, so a template reads as a list of questions.

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Options whose values are their labels in snake_case: "Partially approved" is `partially_approved`. */
export const options = (...labels: string[]): FormOption[] => labels.map((label) => ({ value: slug(label), label }));

/** A condition that holds after this question is answered yes (or no). */
export const whenAnswered = (question: string, answer: "yes" | "no" = "yes"): Condition => ({ fact: question, in: [answer] });

/**
 * Builders for the questions of one section. A numeric ID gets `idPrefix` in front ("Q" makes 135
 * into Q135), and a string ID is used as written.
 */
export function sectionBuilder(section: string, idPrefix = "") {
  const ask = (n: number | string, type: QuestionType, text: string, extra: Partial<FormQuestion> = {}): FormQuestion => ({
    id: typeof n === "number" ? `${idPrefix}${n}` : n,
    section,
    type,
    text,
    ...extra,
  });
  type Extra = Partial<FormQuestion>;
  return {
    yesNo: (n: number | string, text: string, extra?: Extra) => ask(n, "yes_no", text, extra),
    short: (n: number | string, text: string, extra?: Extra) => ask(n, "short_text", text, extra),
    long: (n: number | string, text: string, extra?: Extra) => ask(n, "long_text", text, extra),
    number: (n: number | string, text: string, extra?: Extra) => ask(n, "number", text, extra),
    money: (n: number | string, text: string, extra?: Extra) => ask(n, "money", text, extra),
    date: (n: number | string, text: string, extra?: Extra) => ask(n, "date", text, extra),
    list: (n: number | string, text: string, extra?: Extra) => ask(n, "list", text, extra),
    one: (n: number | string, text: string, choices: FormOption[], extra?: Extra) => ask(n, "single_choice", text, { options: choices, ...extra }),
    many: (n: number | string, text: string, choices: FormOption[], extra?: Extra) => ask(n, "multiple_choice", text, { options: choices, ...extra }),
  };
}
