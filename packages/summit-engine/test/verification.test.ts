import { describe, expect, it } from "vitest";
import { VERIFIABLE_CLAIMS, VERIFICATION_CLASSES, verificationProblems } from "../src";

describe("verification", () => {
  it("has the five classes of the specification", () => {
    expect(VERIFICATION_CLASSES).toEqual(["self_reported", "document_supported", "independently_verified", "not_verified", "not_applicable"]);
  });

  it("lists the claims the specification gives as examples", () => {
    expect(VERIFIABLE_CLAIMS.map((c) => c.id)).toEqual([
      "business_registration",
      "annual_revenue",
      "export_history",
      "buyer_relationship",
      "production_capacity",
      "investment_requirement",
      "product_quality",
    ]);
    expect(VERIFIABLE_CLAIMS[0]).toMatchObject({ label: "Business registration", evidence: "Registration certificate" });
  });

  it("accepts a self-reported claim, and one supported by a document", () => {
    expect(verificationProblems({ claim: "annual_revenue", class: "self_reported" })).toEqual([]);
    expect(verificationProblems({ claim: "annual_revenue", class: "document_supported", documents: ["file-1"] })).toEqual([]);
  });

  it("doesn't take an uploaded document as independent verification", () => {
    expect(verificationProblems({ claim: "business_registration", class: "independently_verified", documents: ["file-1"] })).toEqual([
      "A claim can't be independently verified by an uploaded document alone: say what was checked outside the application.",
    ]);
    expect(verificationProblems({ claim: "business_registration", class: "independently_verified", documents: ["file-1"], independentCheck: "Found in the trade registry" })).toEqual([]);
  });

  it("needs a document for a document-supported claim", () => {
    expect(verificationProblems({ claim: "export_history", class: "document_supported" })).toEqual(["A claim supported by documents needs at least one document."]);
  });

  it("keeps an independent check to a claim classed as independently verified", () => {
    expect(verificationProblems({ claim: "export_history", class: "document_supported", documents: ["f"], independentCheck: "Called the buyer" })).toEqual([
      "An independent check belongs only on a claim classed as independently verified.",
    ]);
  });

  it("lets a claim that couldn't be verified keep its documents, but not one that doesn't apply", () => {
    expect(verificationProblems({ claim: "export_history", class: "not_verified", documents: ["f"] })).toEqual([]);
    expect(verificationProblems({ claim: "investment_requirement", class: "not_applicable", documents: ["f"] })).toEqual(["A claim that doesn't apply has no documents."]);
  });

  it("needs a claim", () => {
    expect(verificationProblems({ claim: " ", class: "self_reported" })).toEqual(["Name the claim."]);
  });
});
