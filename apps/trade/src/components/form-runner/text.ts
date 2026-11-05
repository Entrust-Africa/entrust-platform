import { isNotApplicable, isNotKnown, renderText } from "@entrust/forms";
import type { Answer, AnswerProblem, FormQuestion } from "@entrust/forms";

/** A question's text with its {names} filled in. A name with no value stays as written rather than breaking the page. */
export function questionText(text: string, variables?: Readonly<Record<string, string>>): string {
  if (!variables) return text;
  try {
    return renderText(text, variables);
  } catch {
    return text;
  }
}

/** A problem from the form package as a sentence for the person filling the form in ("S1.4: choose one of the options"). */
export function problemText(problem: AnswerProblem): string {
  if (problem.code === "missing") return "Please answer this question.";
  if (problem.code === "not_accepted") return "You need to say yes to send the form.";
  const sentence = problem.message.includes(": ") ? problem.message.slice(problem.message.indexOf(": ") + 2) : problem.message;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + (sentence.endsWith(".") ? "" : ".");
}

const number = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** An answer as the review page shows it. Returns a list when the answer has several parts. */
export function answerLines(question: FormQuestion, answer: Answer | undefined): string[] | null {
  if (answer === undefined) return null;
  if (isNotKnown(answer)) return ["I don't know"];
  if (isNotApplicable(answer)) return [`Doesn't apply to us: ${answer.reason}`];
  if (typeof answer === "number") return [number.format(answer)];
  if (typeof answer === "string") {
    if (answer.trim() === "") return null;
    if (question.type === "yes_no") return [answer === "yes" ? "Yes" : answer === "no" ? "No" : answer];
    if (question.type === "single_choice") return [question.options?.find((o) => o.value === answer)?.label ?? answer];
    if (question.type === "date") {
      const parsed = new Date(`${answer}T00:00:00Z`);
      return [Number.isNaN(parsed.getTime()) ? answer : date.format(parsed)];
    }
    return [answer];
  }
  if (Array.isArray(answer)) {
    if (answer.length === 0) return null;
    return question.type === "multiple_choice" ? answer.map((v) => question.options?.find((o) => o.value === v)?.label ?? v) : [...answer];
  }
  if (typeof answer === "object" && "amount" in answer) return [`${number.format(answer.amount)} ${answer.currency}`];
  return null;
}
