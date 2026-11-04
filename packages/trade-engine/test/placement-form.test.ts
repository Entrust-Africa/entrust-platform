import { describe, expect, it } from "vitest";
import { checkAnswers, validateFormDefinitions, visibleQuestions as formVisible } from "@entrust/forms";
import { isNotApplicable, placementAnswerFromForm, placementAnswerToForm, placementAsForm, visibleQuestions } from "../src";
import { rules } from "./helpers";

const form = placementAsForm(rules);
const question = (id: string) => rules.template.questions.find((q) => q.id === id)!;

describe("placementAsForm", () => {
  it("is a valid form definition with every question and section of the template", () => {
    expect(validateFormDefinitions([form])).toEqual([]);
    expect(form.questions.map((q) => q.id)).toEqual(rules.template.questions.map((q) => q.id));
    expect(form.sections.map((s) => s.id)).toEqual(rules.template.sections.map((s) => s.id));
    expect(form.version).toBe(rules.version);
  });

  it("turns each question kind into a form question type", () => {
    const type = (id: string) => form.questions.find((q) => q.id === id)!.type;
    expect(type("A1")).toBe("single_choice");
    expect(type("A5")).toBe("multiple_choice");
    expect(type("B1")).toBe("single_choice");
    expect(type("A4a")).toBe("long_text");
  });

  it("offers the scale as 0 to 3 with its wording, and allows \"does not apply\" on capability questions only", () => {
    const b1 = form.questions.find((q) => q.id === "B1")!;
    expect(b1.options!.map((o) => o.value)).toEqual(["0", "1", "2", "3"]);
    expect(b1.options!.every((o) => o.label && o.description)).toBe(true);
    expect(b1.allowNotApplicable).toBe(true);
    expect(form.questions.find((q) => q.id === "A1")!.allowNotApplicable).toBeUndefined();
  });

  it("keeps the exclusive option and the evidence flag", () => {
    const a5 = form.questions.find((q) => q.id === "A5")!;
    expect(a5.options!.find((o) => o.value === "not_available")!.exclusive).toBe(true);
    expect(form.questions.find((q) => q.id === "A2")!.evidenceBased).toBe(true);
    expect(form.questions.find((q) => q.id === "A3")!.evidenceBased).toBeUndefined();
  });

  it("shows the same questions as the template for the same answers", () => {
    for (const a4 of ["no", "product_only", "market_only", "both_not_validated", "both_validated"]) {
      const answers = { A4: a4 };
      expect(formVisible(form, answers).map((q) => q.id)).toEqual(visibleQuestions(rules, answers).map((q) => q.id));
    }
  });

  it("checks like the engine does: a complete set of answers passes, and a bad one fails", () => {
    const answers: Record<string, string | string[]> = {};
    for (let round = 0; round < 4; round++) {
      for (const q of formVisible(form, answers)) {
        if (q.id in answers) continue;
        answers[q.id] = q.type === "multiple_choice" ? [q.options![0]!.value] : q.options ? q.options[0]!.value : "Some words";
      }
    }
    expect(checkAnswers(form, answers).errors).toEqual([]);
    expect(checkAnswers(form, answers).incomplete).toEqual([]);
    expect(checkAnswers(form, { ...answers, A1: "sometimes" }).errors.map((e) => e.question)).toEqual(["A1"]);
  });
});

describe("answers between a form screen and the engine", () => {
  it("turns a capability score from text to a number and back", () => {
    expect(placementAnswerFromForm(rules, question("B1"), "2")).toBe(2);
    expect(placementAnswerToForm(question("B1"), 2)).toBe("2");
  });

  it("maps \"I don't know\" and \"does not apply\" to the engine's two unscored answers", () => {
    expect(placementAnswerFromForm(rules, question("B1"), { notKnown: true })).toBe("not_known");
    expect(placementAnswerFromForm(rules, question("B1"), { notApplicable: true, reason: "We sell at home." })).toBe("not_applicable");
    expect(placementAnswerToForm(question("B1"), "not_known")).toEqual({ notKnown: true });
    expect(placementAnswerToForm(question("B1"), "not_applicable", "We sell at home.")).toEqual({ notApplicable: true, reason: "We sell at home." });
    expect(isNotApplicable({ notApplicable: true, reason: "x" })).toBe(true);
    expect(isNotApplicable({ notKnown: true })).toBe(false);
  });

  it("leaves choices, lists and anything it doesn't recognise as they are", () => {
    expect(placementAnswerFromForm(rules, question("A1"), "never")).toBe("never");
    expect(placementAnswerFromForm(rules, question("A5"), ["shipment_record"])).toEqual(["shipment_record"]);
    expect(placementAnswerFromForm(rules, question("B1"), "9")).toBe("9");
    expect(placementAnswerToForm(question("A3"), "0")).toBe("0");
  });
});
