import { canSubmit, checkAnswers } from "@entrust/forms";
import type { Answers, FormQuestion } from "@entrust/forms";
import { describe, expect, it } from "vitest";
import {
  APPLICATION_TEMPLATES,
  DOCUMENT_KINDS,
  SUMMIT_RULES,
  UPLOADABLE_DOCUMENT_KINDS,
  eligibilityFindings,
  findApplicationTemplate,
  findSummitRules,
  latestApprovedRules,
  latestPublishedTemplate,
  validateSummitRules,
} from "../src";
import { answerFor, approvedRules } from "./helpers";

// The partner pack says financial records do not need to be submitted, so the application never asks for them: the
// applicant types in key figures, and a missing financial document can neither block a submission nor lower a score.

const form = findApplicationTemplate("0.2.0")!;
const rules = findSummitRules("1.1.0")!;
const answersFor = (overrides: Answers = {}): Answers => ({
  ...Object.fromEntries(form.questions.map((q) => [q.id, answerFor(q)])),
  "S4.1": "no",
  ...overrides,
});
const question = (id: string) => form.questions.find((q) => q.id === id) as FormQuestion | undefined;

describe("application form 0.2.0", () => {
  it("is the form new applications use", () => {
    expect(latestPublishedTemplate()?.version).toBe("0.2.0");
    expect(form.status).toBe("published");
  });

  it("no longer asks about financial statements, and offers no financial document to upload", () => {
    expect(question("S5.2")).toBeUndefined();
    expect(question("S8.1")?.options?.map((o) => o.value)).not.toContain("financial_statements");
    for (const q of form.questions) expect(`${q.text} ${q.help ?? ""}`).not.toMatch(/financial (statements|model)|management accounts/i);
    expect(form.inputs.report.financialStatements).toBeUndefined();
  });

  it("asks for key figures to be typed in, with no document", () => {
    expect(question("S5.6")).toMatchObject({ type: "yes_no" });
    expect(question("S5.7")).toMatchObject({ type: "money" });
    expect(question("S2.4")).toMatchObject({ type: "money" });
  });

  it("keeps every other question as it was in 0.1.0, so an earlier answer still fits", () => {
    const before = findApplicationTemplate("0.1.0")!;
    const kept = before.questions.filter((q) => !["S5.2", "S4.7", "S8.1"].includes(q.id));
    expect(form.questions.filter((q) => kept.some((k) => k.id === q.id))).toEqual(kept);
  });

  it("can be submitted with every question answered and no document at all", () => {
    const check = checkAnswers(form, answersFor());
    expect(check.errors).toEqual([]);
    expect(canSubmit(check)).toBe(true);
  });

  it("can be submitted when the applicant says it has no documents", () => {
    expect(canSubmit(checkAnswers(form, answersFor({ "S8.1": ["none"] })))).toBe(true);
  });

  it("still lists the old version for the applications that already use it", () => {
    expect(APPLICATION_TEMPLATES.map((t) => t.version)).toEqual(["0.1.0", "0.2.0"]);
  });
});

describe("rules 1.1.0", () => {
  it("are the rules new periods use, and validate with the others", () => {
    expect(latestApprovedRules()?.version).toBe("1.1.0");
    expect(validateSummitRules(SUMMIT_RULES)).toEqual([]);
  });

  it("score the same: every criterion and its points are as in 1.0.0", () => {
    const before = findSummitRules("1.0.0")!;
    const shape = (r: typeof rules) => r.rubric.categories.map((c) => [c.id, c.maxPoints, c.criteria.map((k) => [k.id, k.maxPoints, k.guidance])]);
    expect(shape(rules)).toEqual(shape(before));
  });

  it("list no financial document as evidence to look for", () => {
    const evidence = rules.rubric.categories.flatMap((c) => c.evidence ?? []);
    expect(evidence.join("\n")).not.toMatch(/financial statements|management accounts|financial model|cash-flow/i);
    expect(evidence.some((e) => /missing one lowers no score/.test(e))).toBe(true);
  });

  it("require no financial document of any pathway, and the validator refuses a version that does", () => {
    for (const kinds of Object.values(rules.eligibility.requiredDocuments)) expect(kinds).not.toContain("financial_statements");
    const bad = { ...approvedRules, version: "9.9.9", eligibility: { requiredDocuments: { ...approvedRules.eligibility.requiredDocuments, investment: ["financial_statements" as const] } } };
    expect(validateSummitRules([bad]).join("\n")).toMatch(/investment can't require financial statements/);
  });

  it("find an application eligible on its documents without any financial statement", () => {
    const { findings, missingDocuments } = eligibilityFindings(rules, form, answersFor(), ["registration_certificate", "product_information"]);
    expect(missingDocuments).toEqual([]);
    expect(findings.find((f) => f.id === "documents")?.result).toBe("met");
  });
});

describe("document kinds", () => {
  it("can't be uploaded for financial statements, though an earlier file still has its kind", () => {
    expect(DOCUMENT_KINDS).toContain("financial_statements");
    expect(UPLOADABLE_DOCUMENT_KINDS).not.toContain("financial_statements");
    expect(UPLOADABLE_DOCUMENT_KINDS).toHaveLength(DOCUMENT_KINDS.length - 1);
  });
});
