import { CONTRACT_FIELDS, LC_FIELDS, STEPS, type AmendableField, type StepId } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { AMENDABLE_FIELDS, amendmentImpact, dependentsOf, fieldLabel, type CaseFacts, type CaseState } from "../src";

const NOW = "2026-10-24T09:00:00Z";
const BASE: CaseFacts = { product: "green_coffee", destinationCountry: "US", transportMode: "sea" };

const state = (facts: CaseFacts, completed: readonly StepId[] = []): CaseState => ({
  facts,
  steps: Object.fromEntries(completed.map((id) => [id, { status: "completed" as const }])),
  evidence: [],
  raisedExceptions: [],
});
const impact = (before: CaseState, after: CaseState, ...fields: AmendableField[]) =>
  amendmentImpact(STEPS, before, after, fields, { asOf: NOW });

describe("the steps that depend on a field", () => {
  it("are read from the conditions for a case fact, and the step that establishes it", () => {
    const payment = dependentsOf(STEPS, "paymentTerms");
    expect(payment).toEqual(expect.arrayContaining(["STEP-025", "STEP-026", "STEP-027", "STEP-028", "STEP-103", "STEP-109", "STEP-110", "STEP-112"]));
    expect(payment).not.toContain("STEP-024");
    // Evidence that is only required under a condition counts too: the insurance certificate under CIF.
    expect(dependentsOf(STEPS, "incoterm")).toEqual(expect.arrayContaining(["STEP-022", "STEP-102"]));
    expect(dependentsOf(STEPS, "product")).toEqual(["STEP-024", "STEP-057", "STEP-061"]);
  });

  it("are listed on the steps for contract and letter of credit terms", () => {
    expect(dependentsOf(STEPS, "contract.unitPrice")).toEqual(["STEP-020", "STEP-021", "STEP-023", "STEP-024", "STEP-034"]);
    expect(dependentsOf(STEPS, "contract.buyerName")).toEqual(["STEP-020", "STEP-021", "STEP-034"]);
    expect(dependentsOf(STEPS, "lc.expiry")).toEqual(["STEP-026"]);
    expect(dependentsOf(STEPS, "lc.reference")).toEqual(["STEP-026", "STEP-109"]);
  });

  it("exist for every contract and letter of credit field, so none can be amended without effect", () => {
    for (const field of [...CONTRACT_FIELDS, ...LC_FIELDS]) expect(dependentsOf(STEPS, field).length, field).toBeGreaterThan(0);
  });

  it("have a label for every field", () => {
    for (const field of AMENDABLE_FIELDS) expect(fieldLabel(field), field).toBeTruthy();
    expect(fieldLabel("paymentTerms")).toBe("Payment terms");
    expect(fieldLabel("contract.unitPrice")).toBe("Unit price");
    expect(fieldLabel("lc.expiry")).toBe("Letter of credit expiry");
  });
});

describe("what an amendment sets back", () => {
  it("re-verifies the steps behind a changed payment instrument, and reopens the signed gate", () => {
    const signed: StepId[] = ["STEP-025", "STEP-027", "STEP-035"];
    const before = state({ ...BASE, paymentTerms: ["cad"] }, signed);
    const after = state({ ...BASE, paymentTerms: ["lc"] }, signed);
    const result = impact(before, after, "paymentTerms");

    // STEP-025 established the instrument and is done again. STEP-026 and STEP-112 apply now.
    expect(result.reopen).toEqual(["STEP-025"]);
    expect(result.reverify).toEqual(["STEP-025", "STEP-026", "STEP-112", "STEP-035"].sort((a, b) => STEPS.findIndex((s) => s.id === a) - STEPS.findIndex((s) => s.id === b)));
    expect(result.unlock).toEqual(["STEP-035"]);
    // The CAD agreement no longer applies, so it isn't asked for again.
    expect(result.affected).not.toContain("STEP-027");
    expect(result.because["STEP-026"]).toEqual(["paymentTerms"]);
    expect(result.evidence).toEqual(expect.arrayContaining(["letter_of_credit", "bank_cover_letter", "bank_presentation_receipt"]));
    expect(result.evidence).not.toContain("collection_instruction");
  });

  it("leaves evidence and steps the change doesn't touch alone", () => {
    const signed: StepId[] = ["STEP-020", "STEP-021", "STEP-023", "STEP-024", "STEP-034", "STEP-035", "STEP-001", "STEP-010"];
    const facts = { ...BASE, paymentTerms: ["advance_tt"] };
    const result = impact(state(facts, signed), state(facts, signed), "contract.unitPrice");

    expect(result.reopen).toEqual(["STEP-020", "STEP-021", "STEP-023", "STEP-024", "STEP-034"]);
    expect(result.reverify).toEqual(["STEP-020", "STEP-021", "STEP-023", "STEP-024", "STEP-034", "STEP-035"]);
    expect(result.unlock).toEqual(["STEP-035"]);
    expect(result.evidence).toEqual(expect.arrayContaining(["sales_contract", "proforma_invoice", "minimum_price_check", "contract_registration"]));
    for (const untouched of ["business_registration", "hs_classification", "letter_of_credit", "bank_export_permit"]) {
      expect(result.evidence, untouched).not.toContain(untouched);
    }
    expect(result.affected).not.toContain("STEP-001");
  });

  it("does not touch a dependent that no longer applies, even if it was completed", () => {
    const signed: StepId[] = ["STEP-024", "STEP-035"];
    const result = impact(state(BASE, signed), state({ ...BASE, product: "fresh_produce" }, signed), "product");
    expect(result.affected).not.toContain("STEP-024");
    expect(result.reopen).not.toContain("STEP-024");
    expect(result.evidence).not.toContain("minimum_price_check");
  });

  it("sends a dependent that wasn't done back for evidence, without calling it a reopened step", () => {
    const facts = { ...BASE, paymentTerms: ["advance_tt"] };
    const result = impact(state(facts), state(facts), "contract.unitPrice");
    expect(result.affected).toContain("STEP-024");
    expect(result.reopen).toEqual([]);
    expect(result.reverify).toEqual([]); // nothing was signed, so there is nothing to do again
    expect(result.unlock).toEqual([]);
    expect(result.evidence).toContain("minimum_price_check");
  });

  it("only reopens a gate whose phase has a step to do again", () => {
    // Phase 1 is signed too, but nothing in it depends on the unit price.
    const signed: StepId[] = ["STEP-020", "STEP-018", "STEP-035"];
    const facts = { ...BASE, paymentTerms: ["advance_tt"] };
    expect(impact(state(facts, signed), state(facts, signed), "contract.unitPrice").unlock).toEqual(["STEP-035"]);
  });

  it("has nothing to do for a letter of credit term when payment isn't by letter of credit", () => {
    const facts = { ...BASE, paymentTerms: ["cad"] };
    const signed: StepId[] = ["STEP-026", "STEP-035"];
    const result = impact(state(facts, signed), state(facts, signed), "lc.expiry");
    expect(result).toMatchObject({ affected: [], reopen: [], reverify: [], unlock: [], evidence: [] });
  });

  it("combines the effects of several changed fields", () => {
    const signed: StepId[] = ["STEP-020", "STEP-026", "STEP-035"];
    const facts = { ...BASE, paymentTerms: ["lc"] };
    const result = impact(state(facts, signed), state(facts, signed), "contract.buyerName", "lc.expiry");
    expect(result.reopen).toEqual(["STEP-020", "STEP-026"]);
    expect(result.because).toMatchObject({ "STEP-020": ["contract.buyerName"], "STEP-026": ["lc.expiry"] });
    expect(result.unlock).toEqual(["STEP-035"]);
  });
});
