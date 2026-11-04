import { describe, expect, it } from "vitest";
import { CONSENT_WORDING_VERSION, DATA_KINDS, SPONSOR_DATA_KINDS, SPONSOR_DISCLAIMER, consentWording, isSponsorDataKind } from "../src";

describe("sponsor consent", () => {
  it("describes every kind of data a sponsor can be shown", () => {
    expect(Object.keys(DATA_KINDS).sort()).toEqual([...SPONSOR_DATA_KINDS].sort());
    for (const kind of SPONSOR_DATA_KINDS) {
      expect(DATA_KINDS[kind].kind).toBe(kind);
      expect(DATA_KINDS[kind].label.length).toBeGreaterThan(3);
      expect(DATA_KINDS[kind].description.length).toBeGreaterThan(20);
    }
  });

  it("covers the kinds the placement spec and the diagnostic ask for", () => {
    expect(SPONSOR_DATA_KINDS).toEqual(
      expect.arrayContaining(["placement_results", "learning_progress", "financial_worksheets", "financial_documents", "m04_brief", "commercial_outcomes", "insurance_profile"]),
    );
  });

  it("words the agreement with the sponsor's name, what is shared and the right to take it back", () => {
    for (const kind of SPONSOR_DATA_KINDS) {
      const wording = consentWording(kind, "Zemen Bank");
      expect(wording).toContain("Zemen Bank can see my business's name");
      expect(wording).toContain(DATA_KINDS[kind].label.toLowerCase());
      expect(wording).toContain("take this back at any time");
      expect(wording).toContain("stop seeing it at once");
    }
  });

  it("is versioned, and says training scores are not a credit decision", () => {
    expect(CONSENT_WORDING_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(SPONSOR_DISCLAIMER).toContain("not a credit assessment");
  });

  it("tells a kind from other text", () => {
    expect(isSponsorDataKind("m04_brief")).toBe(true);
    expect(isSponsorDataKind("everything")).toBe(false);
  });
});
