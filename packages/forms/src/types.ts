// The mechanics every TRADE and Summit form shares: a form definition as data, and the answers to it.
// Nothing here reads a database or does I/O. A published definition never changes; a correction is a
// new version.

import type { Condition } from "./conditions";

export const QUESTION_TYPES = ["single_choice", "multiple_choice", "yes_no", "short_text", "long_text", "number", "money", "date", "list"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** The currencies a money answer can carry, unless a question narrows them (#48). */
export const CURRENCIES = ["ETB", "USD", "EUR"] as const;

/** What a yes/no question offers. A condition on one writes `{ fact: "Q43", in: ["yes"] }`. */
export const YES = "yes";
export const NO = "no";

export interface FormOption {
  value: string;
  label: string;
  /** In a multiple-choice question: if chosen, no other option can be ("none of these"). */
  exclusive?: boolean;
}

export interface FormQuestion {
  /** Stable ID shown to staff and stored with the answer: Q135. */
  id: string;
  section: string;
  type: QuestionType;
  text: string;
  help?: string;
  /** A heading inside the section that this question sits under. */
  group?: string;
  /** Single and multiple choice only. A yes/no question has its two answers built in. */
  options?: readonly FormOption[];
  /** Asked only when this holds. The facts are earlier questions' IDs, and the values are their option values. */
  showIf?: Condition;
  /** A visible question has to be answered to submit, unless this is set. "Not known" counts as an answer. */
  optional?: boolean;
  /** Yes/no only. The only answer that lets the form submit ("I confirm"), so "not known" isn't offered. */
  mustBe?: typeof YES | typeof NO;
  /** Text: the longest answer. The default is 300 characters for short text and 5000 for long text. */
  maxLength?: number;
  /** Number: the answer is a whole number. */
  integer?: boolean;
  /** Number: the lowest and highest allowed. */
  min?: number;
  max?: number;
  /** Money: the currencies offered. The default is ETB, USD and EUR. */
  currencies?: readonly string[];
  /** List: the most items, 10 unless set. */
  maxItems?: number;
  /** Date: can't be after the day the form is checked on. Only enforced when that day is passed in. */
  notFuture?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  /** What the section is for, as the document states it. */
  purpose?: string;
  notes?: readonly string[];
}

/** One published version of a form. */
export interface FormDefinition {
  /** Which form this is: "trade.diagnostic". */
  id: string;
  /** major.minor.patch. Every answer set stores the one it was given against. */
  version: string;
  title: string;
  /** Names a question's text or help can hold as {name}, filled in when the form is shown ({country} from the cohort). */
  variables?: readonly string[];
  sections: readonly FormSection[];
  questions: readonly FormQuestion[];
}

// Answers.

export interface Money {
  amount: number;
  currency: string;
}

/** "I don't know". Allowed for any question, and a condition treats it like an unanswered question. */
export interface NotKnown {
  notKnown: true;
}
export const NOT_KNOWN: NotKnown = { notKnown: true };

/**
 * One answer. A single choice, a yes/no ("yes" or "no"), text and a date (YYYY-MM-DD) are strings; a
 * number is a number; a multiple choice and a list are arrays of strings.
 */
export type Answer = string | number | readonly string[] | Money | NotKnown;
/** Answers by question ID. */
export type Answers = Readonly<Record<string, Answer>>;

export const isNotKnown = (answer: Answer | undefined): answer is NotKnown =>
  typeof answer === "object" && answer !== null && !Array.isArray(answer) && "notKnown" in answer && answer.notKnown === true;

export type ProblemCode = "unknown_question" | "invalid_answer" | "missing" | "not_accepted";

export interface AnswerProblem {
  question: string;
  code: ProblemCode;
  message: string;
}

export interface Progress {
  /** Visible questions that have to be answered to submit, and how many of them are. */
  total: number;
  answered: number;
  /** Whole percent. A form with nothing to answer is 100. */
  percent: number;
  bySection: Readonly<Record<string, { answered: number; total: number }>>;
}

export interface FormCheck {
  /** Answers that aren't valid. These stop a draft from saving and a submit from going through. */
  errors: readonly AnswerProblem[];
  /** Visible questions that still need an answer, or an "I confirm" that isn't confirmed. These stop a submit only. */
  incomplete: readonly AnswerProblem[];
  /** Questions answered but not asked, because an answer they depend on changed. Their answers are ignored. */
  ignored: readonly string[];
  progress: Progress;
}
