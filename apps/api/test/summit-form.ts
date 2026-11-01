import { visibleQuestions, type Answers, type FormDefinition, type FormQuestion } from "@entrust/forms";

// Shared by the Summit tests. This file imports nothing from the app, because the mock of the application form
// loads it while the app itself is still being imported.

/**
 * The real application form is still a draft until Entrust confirms the questions, and a period needs a published
 * one. The tests stand a published copy of version 0.1.0 in for it.
 */
export function withPublishedForm<T extends { findApplicationTemplate: (version: string) => any }>(original: T) {
  const published = { ...original.findApplicationTemplate("0.1.0"), status: "published" as const };
  return {
    ...original,
    findApplicationTemplate: (version: string) => (version === published.version ? published : original.findApplicationTemplate(version)),
    latestPublishedTemplate: () => published,
  };
}

/** A valid answer to a question: the first option, yes, some text, or the least number. */
export function answerFor(q: FormQuestion) {
  switch (q.type) {
    case "single_choice":
      return q.options?.[0]?.value as string;
    case "multiple_choice":
      return [q.options?.[0]?.value as string];
    case "yes_no":
      return "yes";
    case "short_text":
    case "long_text":
      return "An answer";
    case "number":
      return q.min ?? 1;
    case "money":
      return { amount: 1000, currency: "USD" };
    case "date":
      return "2026-10-01";
    case "list":
      return ["one", "two"];
  }
}

/** Answers to every question the form shows, with the given ones kept. */
export function completeAnswers(form: Pick<FormDefinition, "questions"> & Partial<FormDefinition>, overrides: Answers = {}): Answers {
  let answers: Answers = { ...overrides };
  for (let pass = 0; pass < 6; pass++) {
    for (const q of visibleQuestions(form as FormDefinition, answers)) {
      if (answers[q.id] === undefined) answers = { ...answers, [q.id]: answerFor(q) as never };
    }
  }
  return answers;
}
