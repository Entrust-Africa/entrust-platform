import { describe, expect, it } from "vitest";
import { ServiceError } from "../src/services/errors";
import { applyFacts, changesRecordedFact, checkFacts, sameFacts } from "../src/services/facts";

const refuses = (input: Parameters<typeof checkFacts>[0]) => {
  try {
    checkFacts(input);
  } catch (error) {
    expect(error).toBeInstanceOf(ServiceError);
    return (error as ServiceError).message;
  }
  throw new Error("expected checkFacts to refuse");
};

describe("checkFacts", () => {
  it("stores options in their canonical spelling and country codes in capitals", () => {
    expect(checkFacts({ product: " Green_Coffee ", destinationCountry: "us", transportMode: "SEA" }).set).toEqual({
      product: "green_coffee",
      destinationCountry: "US",
      transportMode: "sea",
    });
  });

  it("keeps multi-valued facts as lists without repeats, and accepts a bare string for one", () => {
    expect(checkFacts({ paymentTerms: ["cad", "advance_tt", "CAD"] }).set).toEqual({ paymentTerms: ["cad", "advance_tt"] });
    expect(checkFacts({ paymentTerms: "lc" }).set).toEqual({ paymentTerms: ["lc"] });
  });

  it("clears a fact with null, except the product and destination", () => {
    expect(checkFacts({ transportMode: null })).toEqual({ set: {}, clear: ["transportMode"] });
    expect(refuses({ product: null })).toMatch(/can't be cleared/);
    expect(refuses({ destinationCountry: null })).toMatch(/can't be cleared/);
  });

  it("refuses unknown facts, values outside the options, bad country codes and empty values", () => {
    expect(refuses({ colour: "red" })).toMatch(/not a case fact/);
    expect(refuses({ transportMode: "rail" })).toMatch(/Allowed: sea, air/);
    expect(refuses({ destinationCountry: "USA" })).toMatch(/two-letter/);
    expect(refuses({ destinationCountry: "U1" })).toMatch(/two-letter/);
    expect(refuses({ product: "  " })).toMatch(/needs a value/);
    expect(refuses({ paymentTerms: [] })).toMatch(/needs a value/);
  });

  it("refuses several values for a single-valued fact", () => {
    expect(refuses({ transportMode: ["sea", "air"] })).toMatch(/single value/);
  });
});

describe("applyFacts and sameFacts", () => {
  const current = { product: "green_coffee", destinationCountry: "US", paymentTerms: ["cad", "advance_tt"] } as const;

  it("merges the new facts over the old and drops the cleared ones", () => {
    const next = applyFacts({ ...current }, { set: { transportMode: "sea" }, clear: ["paymentTerms"] });
    expect(next).toEqual({ product: "green_coffee", destinationCountry: "US", transportMode: "sea" });
  });

  it("compares list facts without regard to order", () => {
    expect(sameFacts({ ...current }, { ...current, paymentTerms: ["advance_tt", "cad"] })).toBe(true);
    expect(sameFacts({ ...current }, { ...current, paymentTerms: ["cad"] })).toBe(false);
    expect(sameFacts({ ...current }, { product: "green_coffee", destinationCountry: "US" })).toBe(false);
  });
});

describe("changesRecordedFact", () => {
  const current = { product: "green_coffee", destinationCountry: "US", paymentTerms: ["cad"] } as const;

  it("is true when a recorded fact is changed or cleared", () => {
    expect(changesRecordedFact({ ...current }, { set: { destinationCountry: "DE" }, clear: [] })).toBe(true);
    expect(changesRecordedFact({ ...current }, { set: {}, clear: ["paymentTerms"] })).toBe(true);
    expect(changesRecordedFact({ ...current }, { set: { paymentTerms: ["cad", "lc"] }, clear: [] })).toBe(true);
  });

  it("is false when a fact is first recorded, repeated, or cleared while unknown", () => {
    expect(changesRecordedFact({ ...current }, { set: { transportMode: "air" }, clear: [] })).toBe(false);
    expect(changesRecordedFact({ ...current }, { set: { destinationCountry: "US" }, clear: [] })).toBe(false);
    expect(changesRecordedFact({ ...current }, { set: {}, clear: ["customsChannel"] })).toBe(false);
  });
});
