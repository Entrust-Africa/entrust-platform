import { NOT_KNOWN, canSubmit, checkAnswers, effectiveAnswers, renderText, visibleQuestions } from "@entrust/forms";
import type { Answer, Answers, FormQuestion } from "@entrust/forms";
import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_TEMPLATES, findDiagnosticTemplate, latestDiagnosticTemplate, validateDiagnosticTemplates } from "../src";
import type { DiagnosticTemplate } from "../src";

const template = findDiagnosticTemplate("1.0.0") as DiagnosticTemplate;
const errorsFor = (...versions: DiagnosticTemplate[]) => validateDiagnosticTemplates(versions);
const question = (id: string) => template.questions.find((q) => q.id === id) as FormQuestion;

// The content of every published version. Each diagnostic stores the version it was answered against, so
// a published version must not change: put a correction in a new version instead. Add a line here when a
// version is published.
const PUBLISHED: Record<string, string> = {
  "1.0.0": "e3c79e9b3d38075b2137c627392aca82078a5cfe7f642098c8faff738693f7d6",
};

/** A valid answer to a question, taking the first option and the earliest sensible value. */
function answerFor(q: FormQuestion): Answer {
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
      return { amount: 1000, currency: "ETB" };
    case "date":
      return "2026-10-01";
    case "list":
      return ["one", "two"];
  }
}

const answerAll = (overrides: Answers = {}): Answers => ({ ...Object.fromEntries(template.questions.map((q) => [q.id, answerFor(q)])), ...overrides });

describe("the onboarding diagnostic", () => {
  it("validates", () => {
    expect(errorsFor(...DIAGNOSTIC_TEMPLATES)).toEqual([]);
  });

  it("never changes once published", async () => {
    const sha256 = async (text: string) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const hashes = Object.fromEntries(await Promise.all(DIAGNOSTIC_TEMPLATES.map(async (t) => [t.version, await sha256(JSON.stringify(t))])));
    expect(hashes).toEqual(PUBLISHED);
  });

  it("finds a version, and the newest", () => {
    expect(findDiagnosticTemplate("9.9.9")).toBeUndefined();
    expect(latestDiagnosticTemplate().version).toBe("1.0.0");
  });

  it("asks Q1 to Q169 except the two it leaves out, then the declaration", () => {
    const expected = Array.from({ length: 169 }, (_, i) => `Q${i + 1}`).filter((id) => id !== "Q7" && id !== "Q60");
    expect(template.questions.map((q) => q.id)).toEqual([...expected, "D1", "D2", "D3", "D4"].sort(byDocumentOrder));
    expect(Object.keys(template.omitted)).toEqual(["Q7", "Q60"]);
  });

  it("is split into the document's ten sections", () => {
    expect(template.sections.map((s) => s.title)).toEqual([
      "Business registration and profile",
      "Products and business operations",
      "Financial readiness and bankability",
      "Insurance and business risk profile",
      "Production capacity and operational readiness",
      "Market access and buyer readiness",
      "Export readiness and compliance",
      "Management and digital systems",
      "SME priorities and support requirements",
      "Declaration and consent",
    ]);
    const first = (section: string) => template.questions.find((q) => q.section === section)?.id;
    const last = (section: string) => template.questions.filter((q) => q.section === section).at(-1)?.id;
    expect([first("S1"), last("S1")]).toEqual(["Q1", "Q18"]);
    expect([first("S2"), last("S2")]).toEqual(["Q19", "Q30"]);
    expect([first("S3"), last("S3")]).toEqual(["Q31", "Q50"]);
    expect([first("S4"), last("S4")]).toEqual(["Q51", "Q98"]);
    expect([first("S5"), last("S5")]).toEqual(["Q99", "Q117"]);
    expect([first("S6"), last("S6")]).toEqual(["Q118", "Q134"]);
    expect([first("S7"), last("S7")]).toEqual(["Q135", "Q148"]);
    expect([first("S8"), last("S8")]).toEqual(["Q149", "Q158"]);
    expect([first("S9"), last("S9")]).toEqual(["Q159", "Q164"]);
    expect([first("S10"), last("S10")]).toEqual(["Q165", "D4"]);
  });

  it("copies the wording of the questions the pathway rule reads", () => {
    expect(question("Q132").text).toBe("Do you have a confirmed purchase order or signed supply agreement?");
    expect(question("Q135").text).toBe("Have you completed an export transaction?");
    expect(question("Q137").text).toBe("When was your most recent export shipment?");
    expect(question("Q139").text).toBe("Do you have an active purchase order or export contract?");
  });

  it("offers the options the document lists", () => {
    const labels = (id: string) => question(id).options?.map((o) => o.label);
    expect(labels("Q6")).toEqual(["Sole proprietorship", "Private limited company", "PLC", "Partnership", "Cooperative", "Other"]);
    expect(labels("Q14")).toEqual(["Manufacturing", "Agro-processing", "Agriculture", "Trading", "Services", "Other"]);
    expect(labels("Q52")).toHaveLength(10);
    expect(labels("Q90")).toEqual(["Road", "Air", "Sea", "Multimodal"]);
    expect(labels("Q161")).toHaveLength(9);
  });

  describe("conditional questions", () => {
    it("are exactly the ones the document makes conditional", () => {
      const conditional = Object.fromEntries(template.questions.filter((q) => q.showIf).map((q) => [q.id, JSON.stringify(q.showIf)]));
      const on = (id: string, answer: string) => JSON.stringify({ fact: id, in: [answer] });
      expect(conditional).toEqual({
        Q44: on("Q43", "yes"),
        Q46: on("Q45", "yes"),
        Q52: on("Q51", "yes"),
        Q53: on("Q51", "yes"),
        Q54: on("Q51", "yes"),
        Q55: on("Q51", "yes"),
        Q57: on("Q56", "yes"),
        Q59: on("Q51", "no"),
        Q117: on("Q116", "no"),
        Q129: on("Q128", "yes"),
        Q136: on("Q135", "yes"),
        Q137: on("Q135", "yes"),
      });
    });

    const shown = (answers: Answers) => new Set(visibleQuestions(template, answers).map((q) => q.id));

    it("show and hide with the answer", () => {
      expect(shown({}).has("Q44")).toBe(false);
      expect(shown({ Q43: "yes" }).has("Q44")).toBe(true);
      expect(shown({ Q43: "no" }).has("Q44")).toBe(false);
      for (const id of ["Q52", "Q53", "Q54", "Q55"]) {
        expect(shown({ Q51: "yes" }).has(id)).toBe(true);
        expect(shown({ Q51: "no" }).has(id)).toBe(false);
      }
      expect(shown({ Q51: "no" }).has("Q59")).toBe(true);
      expect(shown({ Q51: "yes" }).has("Q59")).toBe(false);
      expect(shown({ Q116: "no" }).has("Q117")).toBe(true);
      expect(shown({ Q135: "yes" }).has("Q137")).toBe(true);
      expect(shown({ Q135: "no" }).has("Q137")).toBe(false);
    });

    it("stay hidden when the answer is 'not known'", () => {
      expect(shown({ Q135: NOT_KNOWN }).has("Q137")).toBe(false);
      expect(shown({ Q51: NOT_KNOWN }).has("Q59")).toBe(false);
    });
  });

  it("takes the country of the cohort in Q128", () => {
    expect(question("Q128").text).toBe("Have you sold to customers outside {country}?");
    expect(renderText(question("Q128").text, { country: "Ethiopia" })).toBe("Have you sold to customers outside Ethiopia?");
  });

  describe("where the answers go", () => {
    it("sends each section to one place", () => {
      expect(template.storage).toEqual({
        S1: "sme_profile",
        S2: "responses",
        S3: "responses",
        S4: "insurance_profile",
        S5: "responses",
        S6: "responses",
        S7: "responses",
        S8: "responses",
        S9: "responses",
        S10: "consent",
      });
    });

    it("keeps the pathway inputs where the rule reads them", () => {
      expect(template.pathwayInputs).toEqual({ exported: "Q135", lastShipment: "Q137", liveOrder: ["Q132", "Q139"] });
    });
  });

  describe("the declaration", () => {
    it("needs a yes to Q165 to Q168", () => {
      for (const id of ["Q165", "Q166", "Q167", "Q168"]) expect(question(id).mustBe).toBe("yes");
      const check = checkAnswers(template, answerAll({ Q166: "no" }), { today: "2026-11-02" });
      expect(check.incomplete.map((p) => p.question)).toEqual(["Q166"]);
      expect(canSubmit(check)).toBe(false);
    });

    it("records Q169 whichever way it is answered", () => {
      expect(question("Q169").mustBe).toBeUndefined();
      expect(canSubmit(checkAnswers(template, answerAll({ Q169: "no" }), { today: "2026-11-02" }))).toBe(true);
      expect(checkAnswers(template, answerAll({ Q169: undefined as never }), { today: "2026-11-02" }).incomplete.map((p) => p.question)).toEqual(["Q169"]);
    });

    it("asks for the signature's name, position, date and signature", () => {
      expect(["D1", "D2", "D3", "D4"].map((id) => question(id).type)).toEqual(["short_text", "short_text", "date", "short_text"]);
    });
  });

  describe("answering it", () => {
    const today = "2026-11-02";

    it("can be submitted once every shown question has an answer", () => {
      const check = checkAnswers(template, answerAll(), { today });
      expect(check.errors).toEqual([]);
      expect(check.incomplete).toEqual([]);
      expect(check.progress.percent).toBe(100);
      expect(canSubmit(check)).toBe(true);
    });

    it("ignores the answers to hidden questions", () => {
      // Everything is answered yes, so Q59 (asked after a no to Q51) and Q117 (after a no to Q116) are hidden.
      const check = checkAnswers(template, answerAll({ Q59: "No reason", Q117: "No reason" }), { today });
      expect(check.ignored).toEqual(["Q59", "Q117"].sort(byDocumentOrder));
      expect(check.incomplete).toEqual([]);
    });

    it("accepts 'not known' for every question except the four confirmations", () => {
      const notKnown = Object.fromEntries(template.questions.filter((q) => !q.mustBe).map((q) => [q.id, NOT_KNOWN]));
      const check = checkAnswers(template, { ...notKnown, Q165: "yes", Q166: "yes", Q167: "yes", Q168: "yes" }, { today });
      expect(check.errors).toEqual([]);
      expect(canSubmit(check)).toBe(true);
    });

    it("counts a first-time exporter's form as shorter than an experienced one's", () => {
      const first = checkAnswers(template, answerAll({ Q135: "no" }), { today }).progress.total;
      const experienced = checkAnswers(template, answerAll({ Q135: "yes" }), { today }).progress.total;
      expect(experienced - first).toBe(2);
    });

    it("rejects a latest shipment in the future", () => {
      expect(checkAnswers(template, answerAll({ Q137: "2026-12-01" }), { today }).errors.map((p) => p.message)).toEqual(["Q137: the date can't be in the future"]);
    });

    it("keeps the answers that count, for storage", () => {
      const effective = effectiveAnswers(template, answerAll({ Q135: "no" }));
      expect(effective.Q135).toBe("no");
      expect(effective).not.toHaveProperty("Q136");
      expect(effective).not.toHaveProperty("Q137");
    });
  });

  describe("when it is changed", () => {
    const changed = (change: Partial<DiagnosticTemplate>): DiagnosticTemplate => ({ ...template, ...change });
    const withQuestion = (id: string, change: Partial<FormQuestion>) =>
      changed({ questions: template.questions.map((q) => (q.id === id ? { ...q, ...change } : q)) });

    it("fails on a form problem, with the version", () => {
      expect(errorsFor(withQuestion("Q44", { showIf: { fact: "Q999", in: ["yes"] } }))).toEqual(["1.0.0: Q44: shown by missing question Q999"]);
    });

    it("fails on a section with no storage", () => {
      const { S4: _, ...storage } = template.storage;
      expect(errorsFor(changed({ storage }))).toEqual(["1.0.0: section S4: says nowhere to store its answers"]);
      expect(errorsFor(changed({ storage: { ...template.storage, S99: "responses" } }))).toEqual(["1.0.0: storage names missing section S99"]);
    });

    it("fails on a question that is both asked and omitted", () => {
      expect(errorsFor(changed({ omitted: { ...template.omitted, Q1: "x" } }))).toEqual(["1.0.0: Q1: is both asked and listed as omitted"]);
    });

    it("fails when a pathway input names the wrong question", () => {
      expect(errorsFor(changed({ pathwayInputs: { ...template.pathwayInputs, exported: "Q999" } }))).toContain("1.0.0: pathway input exported names missing question Q999");
      expect(errorsFor(changed({ pathwayInputs: { ...template.pathwayInputs, lastShipment: "Q136" } }))).toContain("1.0.0: pathway input lastShipment: Q136 is a long_text question, not date");
      expect(errorsFor(changed({ pathwayInputs: { ...template.pathwayInputs, liveOrder: [] } }))).toEqual(["1.0.0: pathway input liveOrder names no question"]);
      expect(errorsFor(withQuestion("Q137", { showIf: undefined }))).toEqual(["1.0.0: Q137: should be asked only after Q135, which says whether there was a shipment"]);
    });
  });
});

/** Sorts question IDs the way the document numbers them: Q2 before Q10, the declaration last. */
function byDocumentOrder(a: string, b: string): number {
  const rank = (id: string) => (id.startsWith("D") ? 1000 + Number(id.slice(1)) : Number(id.slice(1)));
  return rank(a) - rank(b);
}
