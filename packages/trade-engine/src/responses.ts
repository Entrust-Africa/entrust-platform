import type { Question, TradeRules } from "@entrust/trade-rules";
import { planningRules } from "./rules";

/** One answer: a choice or free text, a capability score, or the chosen options of a multiple-choice question. */
export type Answer = string | number | readonly string[];
/** Answers by question ID. */
export type Answers = Readonly<Record<string, Answer>>;

export type ProblemCode = "unknown_question" | "invalid_answer" | "exclusive_option" | "missing";

export interface ResponseProblem {
  question: string;
  code: ProblemCode;
  message: string;
}

export const CONFLICT_CODES = ["shipment_evidence_contradicts_history", "order_without_evidence"] as const;
export type ConflictCode = (typeof CONFLICT_CODES)[number];

/** Answers that are valid alone but disagree. They don't block submit; they send the assessment to staff review. */
export interface ResponseConflict {
  code: ConflictCode;
  questions: readonly string[];
  message: string;
}

export interface ResponseCheck {
  /** Stop a draft from saving, or a submit from going through. */
  errors: readonly ResponseProblem[];
  conflicts: readonly ResponseConflict[];
  /** Questions answered but not asked, because the answer they depend on changed. Their answers are ignored. */
  ignored: readonly string[];
}

const isCapabilityAnswer = (rules: TradeRules, value: unknown): boolean =>
  rules.template.unscoredAnswers.some((a) => a.value === value) ||
  (typeof value === "number" && rules.template.scale.some((s) => s.score === value));

/** The questions to ask given the answers so far: a question with `askWhen` shows only on the answer it depends on. */
export function visibleQuestions(rules: TradeRules, answers: Answers): Question[] {
  const visible = new Set<string>();
  for (const q of rules.template.questions) {
    const dependsOn = q.askWhen;
    const given = dependsOn ? answers[dependsOn.question] : undefined;
    const shown = !dependsOn || (visible.has(dependsOn.question) && typeof given === "string" && dependsOn.in.includes(given));
    if (shown) visible.add(q.id);
  }
  return rules.template.questions.filter((q) => visible.has(q.id));
}

function answerProblem(rules: TradeRules, q: Question, value: Answer): ResponseProblem | undefined {
  const bad = (message: string, code: ProblemCode = "invalid_answer"): ResponseProblem => ({ question: q.id, code, message: `${q.id}: ${message}` });
  const offered = new Set(q.options?.map((o) => o.value));
  switch (q.kind) {
    case "choice":
      return typeof value === "string" && offered.has(value) ? undefined : bad("choose one of the options");
    case "multi_choice": {
      if (!Array.isArray(value) || !value.length || value.some((v) => !offered.has(v)) || new Set(value).size !== value.length) {
        return bad("choose at least one of the options, each once");
      }
      const exclusive = q.options?.find((o) => o.exclusive);
      return exclusive && value.includes(exclusive.value) && value.length > 1
        ? bad(`"${exclusive.label}" can't be combined with another option`, "exclusive_option")
        : undefined;
    }
    case "capability":
      return isCapabilityAnswer(rules, value) ? undefined : bad("score 0 to 3, or answer not applicable or not known");
    case "text":
      return typeof value === "string" && value.trim() ? undefined : bad("enter an answer");
  }
}

function conflictsIn(rules: TradeRules, answers: Answers): ResponseConflict[] {
  const { plan } = planningRules(rules);
  const history = answers.A1;
  const stage = answers.A2;
  const evidence = answers.A5;
  const conflicts: ResponseConflict[] = [];
  if (
    typeof history === "string" &&
    !plan.exportedHistory.includes(history) &&
    Array.isArray(evidence) &&
    evidence.includes("shipment_record")
  ) {
    conflicts.push({
      code: "shipment_evidence_contradicts_history",
      questions: ["A1", "A5"],
      message: "A1 says no export has been completed, but A5 offers a shipment record.",
    });
  }
  if (typeof stage === "string" && plan.liveOrderStages.includes(stage) && Array.isArray(evidence) && evidence.length === 1 && evidence[0] === "not_available") {
    conflicts.push({
      code: "order_without_evidence",
      questions: ["A2", "A5"],
      message: "A2 reports a confirmed order or shipment, but A5 says no evidence is available.",
    });
  }
  return conflicts;
}

/**
 * Check answers against the template. A draft only needs the answers it has to be valid; a submit also
 * needs every visible question answered. "Not known" counts as an answer.
 */
export function validateResponses(rules: TradeRules, answers: Answers, options: { submit: boolean }): ResponseCheck {
  const questions = new Map(rules.template.questions.map((q) => [q.id, q]));
  const visible = new Set(visibleQuestions(rules, answers).map((q) => q.id));
  const errors: ResponseProblem[] = [];
  const ignored: string[] = [];

  for (const [id, value] of Object.entries(answers)) {
    const q = questions.get(id);
    if (!q) errors.push({ question: id, code: "unknown_question", message: `${id}: there is no such question` });
    else if (!visible.has(id)) ignored.push(id);
    else {
      const problem = answerProblem(rules, q, value);
      if (problem) errors.push(problem);
    }
  }
  if (options.submit) {
    for (const id of visible) {
      if (!(id in answers)) errors.push({ question: id, code: "missing", message: `${id}: answer this question before you submit` });
    }
  }

  const alone = new Set(errors.map((e) => e.question));
  const usable: Record<string, Answer> = Object.fromEntries(Object.entries(answers).filter(([id]) => visible.has(id) && !alone.has(id)));
  return { errors, conflicts: conflictsIn(rules, usable), ignored };
}
