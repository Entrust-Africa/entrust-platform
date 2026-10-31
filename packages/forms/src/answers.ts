import { evaluateCondition } from "./conditions";
import type { Facts } from "./conditions";
import { CURRENCIES, NO, YES, isNotKnown } from "./types";
import type { Answer, AnswerProblem, Answers, FormCheck, FormDefinition, FormQuestion, Money } from "./types";

const SHORT_TEXT_MAX = 300;
const LONG_TEXT_MAX = 5000;
const LIST_MAX_ITEMS = 10;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when `value` is a real calendar date written YYYY-MM-DD. */
export function isDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const real = new Date(Date.UTC(year, month - 1, day));
  return real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day;
}

const isMoney = (answer: Answer): answer is Money =>
  typeof answer === "object" && !Array.isArray(answer) && "amount" in answer && "currency" in answer;

/** An answer that was given. A blank text or an empty list is a field left empty, not an answer. */
function isAnswered(answer: Answer | undefined): answer is Answer {
  if (answer === undefined) return false;
  if (typeof answer === "string") return answer.trim() !== "";
  if (Array.isArray(answer)) return answer.length > 0;
  return true;
}

/** The value a condition sees for a question: only choices can be tested, and "not known" tests as unknown. */
function factValue(question: FormQuestion, answer: Answer | undefined): string | readonly string[] | undefined {
  if (!isAnswered(answer) || isNotKnown(answer)) return undefined;
  if (question.type === "multiple_choice") return Array.isArray(answer) ? answer : undefined;
  if (question.type === "single_choice" || question.type === "yes_no") return typeof answer === "string" ? answer : undefined;
  return undefined;
}

/**
 * The questions to ask given the answers so far. A question with `showIf` shows when its condition holds,
 * judged on the answers to questions that are themselves shown, so a hidden question's old answer
 * hides nothing and shows nothing.
 */
export function visibleQuestions(form: FormDefinition, answers: Answers): FormQuestion[] {
  const facts: Facts = {};
  const visible: FormQuestion[] = [];
  for (const q of form.questions) {
    if (q.showIf && evaluateCondition(q.showIf, facts) !== true) continue;
    visible.push(q);
    const value = factValue(q, answers[q.id]);
    if (value !== undefined) facts[q.id] = value;
  }
  return visible;
}

/** The answers that count: those to shown questions. Use these, not the stored answers, for anything built from the form. */
export function effectiveAnswers(form: FormDefinition, answers: Answers): Answers {
  const effective: Record<string, Answer> = {};
  for (const q of visibleQuestions(form, answers)) {
    const answer = answers[q.id];
    if (isAnswered(answer)) effective[q.id] = answer;
  }
  return effective;
}

/** A text with its {name} placeholders filled in. A name with no value is a mistake in the caller, so it throws. */
export function renderText(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new RangeError(`no value for {${name}}`);
    return value;
  });
}

/** What is wrong with an answer to a question, as a sentence, or undefined if it is fine. */
function answerProblem(q: FormQuestion, answer: Answer, today: string | undefined): string | undefined {
  if (isNotKnown(answer)) return q.mustBe ? `answer ${q.mustBe}` : undefined;
  switch (q.type) {
    case "single_choice":
      return typeof answer === "string" && q.options?.some((o) => o.value === answer) ? undefined : "choose one of the options";
    case "multiple_choice": {
      const offered = new Set(q.options?.map((o) => o.value));
      if (!Array.isArray(answer) || answer.some((v) => !offered.has(v)) || new Set(answer).size !== answer.length) {
        return "choose some of the options, each once";
      }
      const exclusive = q.options?.find((o) => o.exclusive);
      return exclusive && answer.includes(exclusive.value) && answer.length > 1 ? `"${exclusive.label}" can't be combined with another option` : undefined;
    }
    case "yes_no":
      return answer === YES || answer === NO ? undefined : "answer yes or no";
    case "short_text":
    case "long_text": {
      const max = q.maxLength ?? (q.type === "short_text" ? SHORT_TEXT_MAX : LONG_TEXT_MAX);
      if (typeof answer !== "string") return "enter text";
      return answer.length > max ? `keep it to ${max} characters` : undefined;
    }
    case "number": {
      if (typeof answer !== "number" || !Number.isFinite(answer)) return "enter a number";
      if (q.integer && !Number.isInteger(answer)) return "enter a whole number";
      if (q.min !== undefined && answer < q.min) return `enter a number of at least ${q.min}`;
      if (q.max !== undefined && answer > q.max) return `enter a number of at most ${q.max}`;
      return undefined;
    }
    case "money": {
      if (!isMoney(answer) || typeof answer.amount !== "number" || !Number.isFinite(answer.amount)) return "enter an amount and a currency";
      if (answer.amount < 0) return "the amount can't be negative";
      const allowed: readonly string[] = q.currencies ?? CURRENCIES;
      return allowed.includes(answer.currency) ? undefined : `the currency is ${allowed.join(", ")}`;
    }
    case "date": {
      if (typeof answer !== "string" || !isDate(answer)) return "enter a date as YYYY-MM-DD";
      return q.notFuture && today !== undefined && answer > today ? "the date can't be in the future" : undefined;
    }
    case "list": {
      const max = q.maxItems ?? LIST_MAX_ITEMS;
      const itemMax = q.maxLength ?? SHORT_TEXT_MAX;
      if (!Array.isArray(answer) || answer.some((v) => typeof v !== "string" || !v.trim())) return "list at least one item, each with some text";
      if (answer.length > max) return `list at most ${max} items`;
      return answer.some((v) => v.length > itemMax) ? `keep each item to ${itemMax} characters` : undefined;
    }
  }
}

export interface CheckOptions {
  /** The day the form is checked on, as YYYY-MM-DD. Without it a date that can't be in the future isn't checked. */
  today?: string;
}

/**
 * Check answers against a form. `errors` are answers that aren't valid, and stop a draft from saving.
 * `incomplete` are shown questions still to answer, or an "I confirm" that isn't confirmed, and stop
 * a submit. A question that isn't shown never blocks anything, and its answer is only listed as ignored.
 */
export function checkAnswers(form: FormDefinition, answers: Answers, options: CheckOptions = {}): FormCheck {
  if (options.today !== undefined && !isDate(options.today)) throw new RangeError(`today must be a real date as YYYY-MM-DD, not "${options.today}"`);
  const known = new Map(form.questions.map((q) => [q.id, q]));
  const visible = visibleQuestions(form, answers);
  const shown = new Set(visible.map((q) => q.id));

  const errors: AnswerProblem[] = [];
  const incomplete: AnswerProblem[] = [];
  const ignored: string[] = [];

  for (const id of Object.keys(answers)) {
    if (!known.has(id)) errors.push({ question: id, code: "unknown_question", message: `${id}: this form has no such question` });
    else if (!shown.has(id) && isAnswered(answers[id])) ignored.push(id);
  }

  const progress = { answered: 0, total: 0, bySection: {} as Record<string, { answered: number; total: number }> };
  for (const q of visible) {
    const answer = answers[q.id];
    let done = true;
    if (!isAnswered(answer)) {
      if (!q.optional) incomplete.push({ question: q.id, code: "missing", message: `${q.id}: answer this question` });
      done = !!q.optional;
    } else {
      const problem = answerProblem(q, answer, options.today);
      if (problem) {
        errors.push({ question: q.id, code: "invalid_answer", message: `${q.id}: ${problem}` });
        done = false;
      } else if (q.mustBe && answer !== q.mustBe) {
        incomplete.push({ question: q.id, code: "not_accepted", message: `${q.id}: answer ${q.mustBe} to submit` });
        done = false;
      }
    }
    // Progress counts the questions that have to be answered, so 100% means the form can be submitted.
    if (q.optional) continue;
    progress.total += 1;
    progress.bySection[q.section] ??= { answered: 0, total: 0 };
    progress.bySection[q.section]!.total += 1;
    if (done) {
      progress.answered += 1;
      progress.bySection[q.section]!.answered += 1;
    }
  }
  const percent = progress.total === 0 ? 100 : Math.floor((progress.answered / progress.total) * 100);
  return { errors, incomplete, ignored, progress: { ...progress, percent } };
}

/** A form can be submitted when every answer is valid and nothing shown is left to answer. */
export const canSubmit = (check: FormCheck): boolean => check.errors.length === 0 && check.incomplete.length === 0;
