import type { Condition, FormDefinition, FormQuestion, FormSection } from "@entrust/forms";
import type { Question, TradeRules } from "@entrust/trade-rules";
import type { Answer as EngineAnswer } from "./responses";

// The placement assessment as a form definition, so the screens that fill in the diagnostic and the
// Summit application fill in the placement assessment too. The template stays the source of truth: this
// only changes its shape. A capability question becomes a single choice whose values are the scale
// scores as text ("0" to "3"); "not known" and "not applicable" are answers of their own (see below).

export const PLACEMENT_FORM_ID = "trade.placement";

const HELP_FOR_CAPABILITY = "Choose the step that describes your business today. Be honest: this is to plan your learning, not to judge you.";

function showIf(question: Question): Condition | undefined {
  return question.askWhen ? { fact: question.askWhen.question, in: question.askWhen.in } : undefined;
}

function formQuestion(rules: TradeRules, q: Question): FormQuestion {
  const base = { id: q.id, section: q.section, text: q.text, ...(showIf(q) ? { showIf: showIf(q) } : {}), ...(q.evidenceBased ? { evidenceBased: true } : {}) };
  switch (q.kind) {
    case "choice":
      return { ...base, type: "single_choice", options: q.options ?? [] };
    case "multi_choice":
      return { ...base, type: "multiple_choice", options: q.options ?? [] };
    case "capability":
      return {
        ...base,
        type: "single_choice",
        help: HELP_FOR_CAPABILITY,
        allowNotApplicable: rules.template.unscoredAnswers.some((a) => a.value === "not_applicable"),
        options: rules.template.scale.map((s) => ({ value: String(s.score), label: s.label, description: s.definition })),
      };
    case "text":
      return { ...base, type: "long_text" };
  }
}

/** The form definition of a version of the placement assessment. */
export function placementAsForm(rules: TradeRules): FormDefinition {
  const sections: FormSection[] = rules.template.sections.map((s) => ({
    id: s.id,
    title: s.title,
    ...(s.notes?.length ? { notes: s.notes } : {}),
  }));
  return {
    id: PLACEMENT_FORM_ID,
    version: rules.version,
    title: "TRADE placement assessment",
    sections,
    questions: rules.template.questions.map((q) => formQuestion(rules, q)),
  };
}

/** What a screen sends or receives for a capability question marked "does not apply to us". */
export interface NotApplicable {
  notApplicable: true;
  /** A short reason. Staff approve it later. */
  reason: string;
}

export const isNotApplicable = (answer: unknown): answer is NotApplicable =>
  typeof answer === "object" && answer !== null && !Array.isArray(answer) && (answer as { notApplicable?: unknown }).notApplicable === true;

/**
 * The engine's own form of an answer from the shape a form screen sends. A capability score arrives as
 * text ("2") and the engine wants the number; "not known" and "not applicable" are the engine's two
 * unscored answers. Anything that isn't a valid answer comes back unchanged, so the engine's check reports it.
 */
export function placementAnswerFromForm(rules: TradeRules, question: Question, answer: unknown): EngineAnswer {
  if (answer && typeof answer === "object" && !Array.isArray(answer)) {
    if ((answer as { notKnown?: unknown }).notKnown === true) return "not_known";
    if (isNotApplicable(answer)) return "not_applicable";
  }
  if (question.kind === "capability" && typeof answer === "string") {
    const score = rules.template.scale.find((s) => String(s.score) === answer);
    if (score) return score.score;
  }
  return answer as EngineAnswer;
}

/** The shape a form screen wants an engine answer in. The reverse of `placementAnswerFromForm`. */
export function placementAnswerToForm(question: Question, answer: EngineAnswer, reason?: string | null): unknown {
  if (answer === "not_known") return { notKnown: true };
  if (answer === "not_applicable") return { notApplicable: true, reason: reason ?? "" };
  if (question.kind === "capability" && typeof answer === "number") return String(answer);
  return answer;
}
