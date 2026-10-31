import { describe, expect, it } from "vitest";
import { NOT_KNOWN, canSubmit, checkAnswers, conditionFacts, effectiveAnswers, evaluateCondition, formDefinitionErrors, isDate, renderText, validateFormDefinitions, visibleQuestions } from "../src";
import type { Answers, FormDefinition, FormQuestion, FormSection } from "../src";

const FORM: FormDefinition = {
  id: "test.form",
  version: "1.0.0",
  title: "A test form",
  sections: [
    { id: "S1", title: "About the business" },
    { id: "S2", title: "Consent" },
  ],
  questions: [
    { id: "Q1", section: "S1", type: "short_text", text: "Business name" },
    { id: "Q2", section: "S1", type: "yes_no", text: "Have you exported?" },
    { id: "Q3", section: "S1", type: "date", text: "Last shipment", showIf: { fact: "Q2", in: ["yes"] }, notFuture: true },
    { id: "Q4", section: "S1", type: "long_text", text: "Why not?", showIf: { fact: "Q2", in: ["no"] } },
    {
      id: "Q5",
      section: "S1",
      type: "multiple_choice",
      text: "Transport",
      options: [
        { value: "road", label: "Road" },
        { value: "sea", label: "Sea" },
        { value: "none", label: "None of these", exclusive: true },
      ],
    },
    { id: "Q6", section: "S1", type: "short_text", text: "Which port?", showIf: { fact: "Q5", in: ["sea"] }, optional: true },
    { id: "Q7", section: "S1", type: "number", text: "Employees", integer: true, min: 0, max: 500 },
    { id: "Q8", section: "S1", type: "money", text: "Typical order" },
    { id: "Q9", section: "S1", type: "list", text: "Top products", maxItems: 3 },
    { id: "Q10", section: "S1", type: "single_choice", text: "Premises", options: [{ value: "own", label: "Own" }, { value: "rented", label: "Rented" }] },
    { id: "Q11", section: "S2", type: "yes_no", text: "I confirm", mustBe: "yes" },
  ],
};

/** Every question answered, taking the no-export branch. */
const COMPLETE: Answers = {
  Q1: "Acme",
  Q2: "no",
  Q4: "No buyer yet",
  Q5: ["road"],
  Q7: 12,
  Q8: { amount: 5000, currency: "ETB" },
  Q9: ["coffee"],
  Q10: "own",
  Q11: "yes",
};

const withQuestion = (id: string, change: Partial<FormQuestion>): FormDefinition => ({
  ...FORM,
  questions: FORM.questions.map((q) => (q.id === id ? { ...q, ...change } : q)),
});

describe("conditions", () => {
  it("are true, false or unknown", () => {
    const yes = { fact: "a", in: ["yes"] };
    expect(evaluateCondition(yes, { a: "yes" })).toBe(true);
    expect(evaluateCondition(yes, { a: "no" })).toBe(false);
    expect(evaluateCondition(yes, {})).toBeUndefined();
    expect(evaluateCondition(yes, { a: "  " })).toBeUndefined();
  });

  it("compare trimmed and case-insensitively, and test any value of a multi-valued fact", () => {
    expect(evaluateCondition({ fact: "a", in: ["US"] }, { a: " us " })).toBe(true);
    expect(evaluateCondition({ fact: "a", in: ["sea"] }, { a: ["road", "sea"] })).toBe(true);
  });

  it("combine with all, any and not", () => {
    const [a, b] = [{ fact: "a", in: ["1"] }, { fact: "b", in: ["1"] }];
    expect(evaluateCondition({ all: [a, b] }, { a: "0" })).toBe(false);
    expect(evaluateCondition({ all: [a, b] }, { a: "1" })).toBeUndefined();
    expect(evaluateCondition({ any: [a, b] }, { a: "1" })).toBe(true);
    expect(evaluateCondition({ any: [a, b] }, { a: "0" })).toBeUndefined();
    expect(evaluateCondition({ not: a }, { a: "0" })).toBe(true);
    expect(evaluateCondition({ not: a }, {})).toBeUndefined();
  });

  it("list the facts they mention", () => {
    expect(conditionFacts({ all: [{ fact: "a", in: ["1"] }, { not: { any: [{ fact: "b", in: ["1"] }] } }] })).toEqual(["a", "b"]);
  });
});

describe("a form definition", () => {
  it("validates", () => {
    expect(validateFormDefinitions([FORM])).toEqual([]);
  });

  it("can't be published twice", () => {
    expect(validateFormDefinitions([FORM, FORM])).toEqual(["test.form 1.0.0: published twice"]);
  });

  it("needs a version of major.minor.patch", () => {
    expect(formDefinitionErrors({ ...FORM, version: "1.0" })).toEqual(["the version is major.minor.patch"]);
  });

  it("fails on a duplicate ID", () => {
    expect(formDefinitionErrors({ ...FORM, questions: [...FORM.questions, FORM.questions[0] as FormQuestion] })).toEqual(["duplicate question Q1"]);
    expect(formDefinitionErrors({ ...FORM, sections: [...FORM.sections, FORM.sections[0] as FormSection] })).toContain("duplicate section S1");
  });

  it("fails on a question in an unknown section, and on a section with no questions", () => {
    expect(formDefinitionErrors(withQuestion("Q1", { section: "S9" }))).toEqual(["Q1: unknown section S9"]);
    expect(formDefinitionErrors({ ...FORM, sections: [...FORM.sections, { id: "S3", title: "Empty" }] })).toEqual(["section S3: has no questions"]);
  });

  it("fails when showIf names a missing question", () => {
    expect(formDefinitionErrors(withQuestion("Q3", { showIf: { fact: "Q99", in: ["yes"] } }))).toEqual(["Q3: shown by missing question Q99"]);
  });

  it("fails when showIf names a question that comes later, or itself", () => {
    expect(formDefinitionErrors(withQuestion("Q3", { showIf: { fact: "Q10", in: ["own"] } }))).toEqual(["Q3: shown by Q10, which doesn't come before it"]);
    expect(formDefinitionErrors(withQuestion("Q3", { showIf: { fact: "Q3", in: ["yes"] } }))).toEqual(["Q3: shown by Q3, which doesn't come before it"]);
  });

  it("fails when showIf tests an option that doesn't exist, or a question that has no options", () => {
    expect(formDefinitionErrors(withQuestion("Q6", { showIf: { fact: "Q5", in: ["rail"] } }))).toEqual(['Q6: Q5 has no option "rail"']);
    expect(formDefinitionErrors(withQuestion("Q3", { showIf: { fact: "Q2", in: ["maybe"] } }))).toEqual(['Q3: Q2 has no option "maybe"']);
    expect(formDefinitionErrors(withQuestion("Q3", { showIf: { fact: "Q1", in: ["Acme"] } }))).toEqual(["Q3: shown by Q1, a short_text question, which a condition can't test"]);
    expect(formDefinitionErrors(withQuestion("Q3", { showIf: { fact: "Q2", in: [] } }))).toEqual(["Q3: shown on no answer to Q2"]);
  });

  it("checks conditions inside all, any and not", () => {
    const showIf = { all: [{ fact: "Q2", in: ["yes"] }, { not: { fact: "Q5", in: ["rail"] } }] };
    expect(formDefinitionErrors(withQuestion("Q6", { showIf }))).toEqual(['Q6: Q5 has no option "rail"']);
  });

  it("fails on choices that aren't well formed", () => {
    expect(formDefinitionErrors(withQuestion("Q10", { options: [{ value: "own", label: "Own" }] }))).toEqual(["Q10: needs at least two options"]);
    expect(formDefinitionErrors(withQuestion("Q10", { options: [{ value: "own", label: "Own" }, { value: "OWN ", label: "Own again" }] }))).toEqual(["Q10: duplicate option own"]);
    expect(formDefinitionErrors(withQuestion("Q10", { options: [{ value: "a", label: "A", exclusive: true }, { value: "b", label: "B" }] }))).toEqual([
      "Q10: only a multiple-choice question has an exclusive option",
    ]);
    expect(formDefinitionErrors(withQuestion("Q1", { options: [{ value: "a", label: "A" }] }))).toEqual(["Q1: a short_text question has no options"]);
  });

  it("fails on constraints that don't fit the question", () => {
    expect(formDefinitionErrors(withQuestion("Q1", { min: 1 }))).toEqual(["Q1: integer, min and max only applies to number questions"]);
    expect(formDefinitionErrors(withQuestion("Q7", { min: 9, max: 1 }))).toEqual(["Q7: min is above max"]);
    expect(formDefinitionErrors(withQuestion("Q8", { currencies: ["GBP"] }))).toEqual(["Q8: unknown currency GBP"]);
    expect(formDefinitionErrors(withQuestion("Q9", { maxItems: 0 }))).toEqual(["Q9: maxItems is a whole number above 0"]);
    expect(formDefinitionErrors(withQuestion("Q11", { optional: true }))).toEqual(["Q11: a question that must be yes can't also be optional"]);
    expect(formDefinitionErrors(withQuestion("Q1", { mustBe: "yes" }))).toEqual(["Q1: mustBe only applies to yes_no questions"]);
  });
});

describe("placeholders", () => {
  const form: FormDefinition = { ...FORM, variables: ["country"], questions: FORM.questions.map((q) => (q.id === "Q1" ? { ...q, text: "Sold outside {country}?" } : q)) };

  it("must be declared by the form", () => {
    expect(formDefinitionErrors(form)).toEqual([]);
    expect(formDefinitionErrors({ ...form, variables: [] })).toEqual(["Q1: uses {country}, which the form doesn't declare"]);
    expect(formDefinitionErrors({ ...form, variables: ["country", "country"] })).toEqual(["variable country listed twice"]);
  });

  it("are filled in when the text is shown", () => {
    expect(renderText("Sold outside {country}?", { country: "Kenya" })).toBe("Sold outside Kenya?");
    expect(renderText("No placeholder", {})).toBe("No placeholder");
    expect(() => renderText("Sold outside {country}?", {})).toThrow("no value for {country}");
  });
});

describe("which questions are shown", () => {
  const ids = (answers: Answers) => visibleQuestions(FORM, answers).map((q) => q.id);

  it("hides a question until the answer it depends on arrives", () => {
    expect(ids({})).toEqual(["Q1", "Q2", "Q5", "Q7", "Q8", "Q9", "Q10", "Q11"]);
    expect(ids({ Q2: "yes" })).toContain("Q3");
    expect(ids({ Q2: "yes" })).not.toContain("Q4");
    expect(ids({ Q2: "no" })).toContain("Q4");
    expect(ids({ Q5: ["road", "sea"] })).toContain("Q6");
  });

  it("treats 'not known' like no answer", () => {
    expect(ids({ Q2: NOT_KNOWN })).not.toContain("Q3");
    expect(ids({ Q2: NOT_KNOWN })).not.toContain("Q4");
  });

  it("hides what hangs off a hidden question", () => {
    const form: FormDefinition = {
      ...FORM,
      questions: [
        ...FORM.questions,
        { id: "Q12", section: "S1", type: "yes_no", text: "Is it frequent?", showIf: { fact: "Q2", in: ["yes"] } },
        { id: "Q13", section: "S1", type: "short_text", text: "How often?", showIf: { fact: "Q12", in: ["yes"] } },
      ],
    };
    // Q12 was answered yes while Q2 was yes, then Q2 changed. Q13 hangs off a question no longer asked.
    const shown = visibleQuestions(form, { Q2: "no", Q12: "yes" }).map((q) => q.id);
    expect(shown).not.toContain("Q12");
    expect(shown).not.toContain("Q13");
  });

  it("keeps only the answers to shown questions", () => {
    expect(effectiveAnswers(FORM, { Q1: "Acme", Q2: "no", Q3: "2026-01-01", Q4: "Cost", Q6: "" })).toEqual({ Q1: "Acme", Q2: "no", Q4: "Cost" });
  });
});

describe("checking answers", () => {
  it("accepts a complete form", () => {
    const check = checkAnswers(FORM, COMPLETE);
    expect(check.errors).toEqual([]);
    expect(check.incomplete).toEqual([]);
    expect(check.ignored).toEqual([]);
    expect(canSubmit(check)).toBe(true);
    expect(check.progress).toMatchObject({ answered: 9, total: 9, percent: 100 });
  });

  it("lists the shown questions still to answer", () => {
    const check = checkAnswers(FORM, { Q1: "Acme", Q2: "yes" });
    expect(check.incomplete.map((p) => p.question)).toEqual(["Q3", "Q5", "Q7", "Q8", "Q9", "Q10", "Q11"]);
    expect(check.errors).toEqual([]);
    expect(canSubmit(check)).toBe(false);
  });

  it("never blocks on a hidden question, and lists its old answer as ignored", () => {
    const check = checkAnswers(FORM, { ...COMPLETE, Q2: "yes", Q3: "2026-01-01", Q4: "No buyer yet" });
    expect(check.incomplete).toEqual([]);
    expect(check.ignored).toEqual(["Q4"]);
    expect(canSubmit(check)).toBe(true);
  });

  it("doesn't judge the answer to a hidden question", () => {
    const check = checkAnswers(FORM, { ...COMPLETE, Q3: "not a date" });
    expect(check.errors).toEqual([]);
    expect(check.ignored).toEqual(["Q3"]);
  });

  it("accepts 'not known' for any question that isn't a confirmation", () => {
    const answers = { Q1: NOT_KNOWN, Q2: NOT_KNOWN, Q5: NOT_KNOWN, Q7: NOT_KNOWN, Q8: NOT_KNOWN, Q9: NOT_KNOWN, Q10: NOT_KNOWN, Q11: "yes" };
    const check = checkAnswers(FORM, answers);
    expect(check.errors).toEqual([]);
    expect(check.incomplete).toEqual([]);
    expect(canSubmit(check)).toBe(true);
  });

  it("doesn't accept 'not known' for a confirmation", () => {
    expect(checkAnswers(FORM, { ...COMPLETE, Q11: NOT_KNOWN }).errors.map((p) => p.message)).toEqual(["Q11: answer yes"]);
  });

  it("holds a submit until a confirmation is yes, but lets a draft save", () => {
    const check = checkAnswers(FORM, { ...COMPLETE, Q11: "no" });
    expect(check.errors).toEqual([]);
    expect(check.incomplete).toEqual([{ question: "Q11", code: "not_accepted", message: "Q11: answer yes to submit" }]);
    expect(canSubmit(check)).toBe(false);
  });

  it("treats a blank text or an empty list as unanswered", () => {
    const check = checkAnswers(FORM, { ...COMPLETE, Q1: "   ", Q9: [] });
    expect(check.errors).toEqual([]);
    expect(check.incomplete.map((p) => p.question)).toEqual(["Q1", "Q9"]);
  });

  it("lets an optional question stay empty", () => {
    expect(checkAnswers(FORM, { ...COMPLETE, Q5: ["sea"] }).incomplete).toEqual([]);
  });

  it("reports a question the form doesn't have", () => {
    expect(checkAnswers(FORM, { ...COMPLETE, Q99: "x" }).errors).toEqual([{ question: "Q99", code: "unknown_question", message: "Q99: this form has no such question" }]);
  });

  describe("by type", () => {
    const messages = (answers: Answers) => checkAnswers(FORM, { ...COMPLETE, ...answers }, { today: "2026-11-02" }).errors.map((p) => p.message);

    it("single choice", () => {
      expect(messages({ Q10: "leased" })).toEqual(["Q10: choose one of the options"]);
      expect(messages({ Q10: ["own"] })).toEqual(["Q10: choose one of the options"]);
    });

    it("multiple choice", () => {
      expect(messages({ Q5: ["rail"] })).toEqual(["Q5: choose some of the options, each once"]);
      expect(messages({ Q5: ["road", "road"] })).toEqual(["Q5: choose some of the options, each once"]);
      expect(messages({ Q5: ["road", "none"] })).toEqual(['Q5: "None of these" can\'t be combined with another option']);
      expect(messages({ Q5: ["none"] })).toEqual([]);
    });

    it("yes or no", () => {
      expect(messages({ Q2: "maybe" })).toEqual(["Q2: answer yes or no"]);
    });

    it("text", () => {
      expect(messages({ Q1: 5 as unknown as string })).toEqual(["Q1: enter text"]);
      expect(messages({ Q1: "x".repeat(301) })).toEqual(["Q1: keep it to 300 characters"]);
      expect(messages({ Q4: "x".repeat(301) })).toEqual([]);
    });

    it("number", () => {
      expect(messages({ Q7: "twelve" })).toEqual(["Q7: enter a number"]);
      expect(messages({ Q7: Number.NaN })).toEqual(["Q7: enter a number"]);
      expect(messages({ Q7: 1.5 })).toEqual(["Q7: enter a whole number"]);
      expect(messages({ Q7: -1 })).toEqual(["Q7: enter a number of at least 0"]);
      expect(messages({ Q7: 501 })).toEqual(["Q7: enter a number of at most 500"]);
    });

    it("money carries a currency", () => {
      expect(messages({ Q8: 5000 })).toEqual(["Q8: enter an amount and a currency"]);
      expect(messages({ Q8: { amount: "5000", currency: "ETB" } as never })).toEqual(["Q8: enter an amount and a currency"]);
      expect(messages({ Q8: { amount: -1, currency: "ETB" } })).toEqual(["Q8: the amount can't be negative"]);
      expect(messages({ Q8: { amount: 10, currency: "GBP" } })).toEqual(["Q8: the currency is ETB, USD, EUR"]);
      expect(messages({ Q8: { amount: 10, currency: "USD" } })).toEqual([]);
    });

    it("date", () => {
      expect(messages({ Q2: "yes", Q3: "02/11/2026" })).toEqual(["Q3: enter a date as YYYY-MM-DD"]);
      expect(messages({ Q2: "yes", Q3: "2026-02-30" })).toEqual(["Q3: enter a date as YYYY-MM-DD"]);
      expect(messages({ Q2: "yes", Q3: "2026-11-03" })).toEqual(["Q3: the date can't be in the future"]);
      expect(messages({ Q2: "yes", Q3: "2026-11-02" })).toEqual([]);
    });

    it("a future date is only caught when the day is given", () => {
      expect(checkAnswers(FORM, { ...COMPLETE, Q2: "yes", Q3: "2099-01-01" }).errors).toEqual([]);
      expect(() => checkAnswers(FORM, COMPLETE, { today: "tomorrow" })).toThrow(RangeError);
    });

    it("list", () => {
      expect(messages({ Q9: ["a", " "] })).toEqual(["Q9: list at least one item, each with some text"]);
      expect(messages({ Q9: ["a", "b", "c", "d"] })).toEqual(["Q9: list at most 3 items"]);
      expect(messages({ Q9: "coffee" })).toEqual(["Q9: list at least one item, each with some text"]);
    });
  });
});

describe("progress", () => {
  it("counts the shown questions that have to be answered", () => {
    const check = checkAnswers(FORM, { Q1: "Acme", Q2: "no" });
    // Q1, Q2, Q4, Q5, Q7, Q8, Q9, Q10 and Q11 are shown and required. Q6 is optional.
    expect(check.progress).toMatchObject({ total: 9, answered: 2, percent: 22 });
    expect(check.progress.bySection).toEqual({ S1: { answered: 2, total: 8 }, S2: { answered: 0, total: 1 } });
  });

  it("changes with the branch taken", () => {
    expect(checkAnswers(FORM, {}).progress.total).toBe(8);
    expect(checkAnswers(FORM, { Q2: "yes" }).progress.total).toBe(9);
  });

  it("doesn't count an invalid answer, and reaches 100 only when the form can be submitted", () => {
    expect(checkAnswers(FORM, { ...COMPLETE, Q7: -4 }).progress).toMatchObject({ answered: 8, total: 9, percent: 88 });
    expect(checkAnswers(FORM, COMPLETE).progress.percent).toBe(100);
    expect(checkAnswers(FORM, { ...COMPLETE, Q11: "no" }).progress.percent).toBe(88);
  });

  it("is 100 for a form with nothing to answer", () => {
    expect(checkAnswers({ ...FORM, questions: [{ id: "Q1", section: "S1", type: "short_text", text: "Optional", optional: true }], sections: [FORM.sections[0] as FormSection] }, {}).progress.percent).toBe(100);
  });
});

describe("isDate", () => {
  it("accepts real dates only", () => {
    expect(isDate("2024-02-29")).toBe(true);
    expect(isDate("2026-02-29")).toBe(false);
    expect(isDate("2026-13-01")).toBe(false);
    expect(isDate("2026-1-1")).toBe(false);
  });
});
