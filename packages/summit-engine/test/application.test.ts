import { NOT_KNOWN, canSubmit, checkAnswers, visibleQuestions } from "@entrust/forms";
import type { Answers, FormQuestion } from "@entrust/forms";
import { describe, expect, it } from "vitest";
import { DOCUMENT_KINDS, OPPORTUNITY_PATHWAYS, validateApplicationTemplates } from "../src";
import type { ApplicationTemplate } from "../src";
import { application, template } from "./helpers";

const shown = (answers: Answers) => new Set(visibleQuestions(template, answers).map((q) => q.id));
const question = (id: string) => template.questions.find((q) => q.id === id) as FormQuestion;
const errorsFor = (t: ApplicationTemplate) => validateApplicationTemplates([t]);
const changed = (change: Partial<ApplicationTemplate>): ApplicationTemplate => ({ ...template, ...change });
const INVESTMENT = ["S4.2", "S4.3", "S4.4", "S4.5", "S4.6", "S4.7"];

describe("the Summit application form", () => {
  it("validates, and is a draft until Entrust confirms the questions", () => {
    expect(errorsFor(template)).toEqual([]);
    expect(template.status).toBe("draft");
  });

  it("has the nine sections of the specification", () => {
    expect(template.sections.map((s) => s.title)).toEqual([
      "Business identity",
      "Business overview",
      "Trade opportunity",
      "Investment opportunity",
      "Business readiness",
      "Diaspora engagement",
      "Summit objectives",
      "Supporting documents",
      "Declaration",
    ]);
  });

  it("offers the four opportunity pathways", () => {
    expect(question(template.inputs.pathway).options?.map((o) => o.value)).toEqual([...OPPORTUNITY_PATHWAYS]);
  });

  it("offers the document kinds eligibility checks, and 'none of these' on its own", () => {
    const options = question("S8.1").options ?? [];
    expect(options.filter((o) => !o.exclusive).map((o) => o.value)).toEqual([...DOCUMENT_KINDS]);
    expect(options.filter((o) => o.exclusive).map((o) => o.value)).toEqual(["none"]);
  });

  it("can be submitted once a trade applicant answers what is shown", () => {
    const check = checkAnswers(template, application());
    expect(check.errors).toEqual([]);
    expect(check.incomplete).toEqual([]);
    expect(canSubmit(check)).toBe(true);
    expect(check.progress.percent).toBe(100);
  });

  it("needs a yes to the declaration to submit", () => {
    for (const id of ["S9.1", "S9.2", "S9.3"]) {
      expect(question(id).mustBe).toBe("yes");
      expect(checkAnswers(template, application({ [id]: "no" })).incomplete.map((p) => p.question)).toEqual([id]);
    }
  });

  describe("conditional questions", () => {
    it("hide the investment questions when the applicant isn't seeking investment", () => {
      const trade = shown(application({ "S2.12": "trade_and_market_access", "S4.1": "no" }));
      expect(trade.has("S4.1")).toBe(true);
      for (const id of INVESTMENT) expect(trade.has(id)).toBe(false);
      const partnership = shown(application({ "S2.12": "strategic_partnership", "S4.1": "no" }));
      for (const id of INVESTMENT) expect(partnership.has(id)).toBe(false);
    });

    it("don't ask a trade applicant for investment details until it says it is seeking investment", () => {
      expect(shown({ "S2.12": "trade_and_market_access" }).has("S4.2")).toBe(false);
      expect(shown({ "S2.12": "trade_and_market_access", "S4.1": NOT_KNOWN }).has("S4.2")).toBe(false);
      for (const pathway of ["trade_and_market_access", "strategic_partnership"]) {
        const seeking = shown({ "S2.12": pathway, "S4.1": "yes" });
        for (const id of INVESTMENT) expect(seeking.has(id)).toBe(true);
      }
    });

    it("always ask the investment and combined pathways for investment details, without asking if they seek it", () => {
      for (const pathway of ["investment", "combined_trade_and_investment"]) {
        const asked = shown({ "S2.12": pathway });
        expect(asked.has("S4.1")).toBe(false);
        for (const id of INVESTMENT) expect(asked.has(id)).toBe(true);
      }
    });

    it("need the investment answers from an investment applicant to submit, but not S4.1", () => {
      // S4.1 is never asked of an investment applicant, so leaving it out blocks nothing.
      expect(checkAnswers(template, application({ "S2.12": "investment", "S4.1": undefined as never })).incomplete).toEqual([]);
      const unanswered = { ...application({ "S2.12": "investment" }) } as Record<string, unknown>;
      for (const id of INVESTMENT) delete unanswered[id];
      expect(checkAnswers(template, unanswered as Answers).incomplete.map((p) => p.question)).toEqual(INVESTMENT);
    });

    it("ignore investment answers left behind after the applicant stops seeking investment", () => {
      const check = checkAnswers(template, application({ "S2.12": "trade_and_market_access", "S4.1": "no" }));
      expect([...check.ignored].sort()).toEqual([...INVESTMENT].sort());
    });

    it("don't ask a first-time exporter about its export history, so it can't fail it", () => {
      const first = shown(application({ "S3.1": "no" }));
      expect(first.has("S3.2")).toBe(false);
      expect(first.has("S3.3")).toBe(false);
      const answers = { ...application({ "S3.1": "no" }) } as Record<string, unknown>;
      delete answers["S3.2"];
      expect(canSubmit(checkAnswers(template, answers as Answers))).toBe(true);
      expect(shown(application({ "S3.1": "yes" })).has("S3.2")).toBe(true);
    });

    it("ask for the transaction when the applicant has an active buyer or purchase order", () => {
      const buyer = shown(application({ "S3.5": "yes" }));
      for (const id of ["S3.6", "S3.7", "S3.8"]) expect(buyer.has(id)).toBe(true);
      const none = shown(application({ "S3.5": "no" }));
      for (const id of ["S3.6", "S3.7", "S3.8"]) expect(none.has(id)).toBe(false);
    });

    it("ask for the proposed structure when the applicant is seeking a joint venture", () => {
      expect(shown(application({ "S6.4": ["joint_venture", "co_investment"] })).has("S6.5")).toBe(true);
      expect(shown(application({ "S6.4": ["distribution_or_agency"] })).has("S6.5")).toBe(false);
    });

    it("ask for a registration number only of a business with a legal status", () => {
      expect(shown(application({ "S1.4": "registered" })).has("S1.5")).toBe(true);
      expect(shown(application({ "S1.4": "accepted_legal_status" })).has("S1.5")).toBe(true);
      expect(shown(application({ "S1.4": "not_registered" })).has("S1.5")).toBe(false);
    });
  });

  describe("when changed", () => {
    const withInputs = (change: Partial<ApplicationTemplate["inputs"]>) => changed({ inputs: { ...template.inputs, ...change } });

    it("fails on a form problem, with the version", () => {
      expect(errorsFor(changed({ questions: template.questions.map((q) => (q.id === "S4.2" ? { ...q, showIf: { fact: "S9.9", in: ["yes"] } } : q)) }))).toEqual([
        "0.1.0: S4.2: shown by missing question S9.9",
      ]);
    });

    it("fails when an input names the wrong question", () => {
      expect(errorsFor(withInputs({ pathway: "S9.9" }))).toContain("0.1.0: pathway names missing question S9.9");
      expect(errorsFor(withInputs({ representative: "S1.1" }))).toContain("0.1.0: representative: S1.1 is a short_text question, not yes_no");
      expect(errorsFor(withInputs({ pathway: "S1.4" }))[0]).toContain("pathway: S1.4 offers registered, accepted_legal_status, not_registered");
      expect(errorsFor(withInputs({ declaration: ["S9.4"] }))).toContain("0.1.0: declaration: S9.4 is a short_text question, not yes_no");
      expect(errorsFor(withInputs({ declaration: [] }))).toContain("0.1.0: declaration names no question");
    });

    it("fails when a rule names an answer the question doesn't offer", () => {
      expect(errorsFor(withInputs({ registration: { question: "S1.4", met: ["registered", "licensed"], notMet: ["not_registered"] } }))).toEqual([
        '0.1.0: registration: S1.4 has no option "licensed"',
      ]);
      expect(errorsFor(withInputs({ operating: { question: "S2.8", met: ["operating"], notMet: [] } }))).toContain("0.1.0: operating: needs answers that meet it and answers that don't");
    });

    it("fails when the registry names a missing question, or a declaration can be skipped", () => {
      expect(errorsFor(changed({ registry: ["S1.1", "S9.9"] }))).toEqual(["0.1.0: registry names missing question S9.9"]);
      expect(errorsFor(changed({ questions: template.questions.map((q) => (q.id === "S9.1" ? { ...q, mustBe: undefined } : q)) }))).toEqual([
        "0.1.0: declaration: S9.1 must be yes to submit",
      ]);
    });
  });
});
