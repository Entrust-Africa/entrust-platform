import { describe, expect, it } from "vitest";
import { calculatePricing, type PricingInput } from "../src/pricing";

// M06's worked example: 1,000 uniforms costing ETB 855,000.
const order = (change: Partial<PricingInput> = {}): PricingInput => ({
  quantity: 1000,
  productionCost: 735000,
  packagingCost: 35000,
  inlandTransport: 25000,
  exportPreparation: 20000,
  freightAndInsurance: 0,
  otherCosts: 40000,
  basis: "markup",
  targetPercent: 25,
  ...change,
});

describe("the pricing calculator", () => {
  it("gives M06's answer for a 25% markup, which is a 20% margin and not 25%", () => {
    expect(calculatePricing(order())).toEqual({ totalCost: 855000, unitCost: 855, sellingPrice: 1068750, unitPrice: 1068.75, grossProfit: 213750, grossMarginPercent: 20, markupPercent: 25 });
  });

  it("gives M06's answer for a 25% gross margin", () => {
    expect(calculatePricing(order({ basis: "margin" }))).toMatchObject({ sellingPrice: 1140000, grossProfit: 285000, grossMarginPercent: 25, markupPercent: 33.33 });
  });

  it("gives M06's case answer for a 20% gross margin", () => {
    expect(calculatePricing(order({ basis: "margin", targetPercent: 20 }))).toMatchObject({ sellingPrice: 1068750 });
  });

  it("agrees with M06's knowledge check", () => {
    const eight = order({ productionCost: 800000, packagingCost: 0, inlandTransport: 0, exportPreparation: 0, otherCosts: 0, targetPercent: 20 });
    expect(calculatePricing(eight)).toMatchObject({ sellingPrice: 960000 });
    expect(calculatePricing({ ...eight, basis: "margin" })).toMatchObject({ sellingPrice: 1000000 });
  });

  it("refuses what it can't work out", () => {
    expect(calculatePricing(order({ quantity: 0 }))).toEqual({ problem: "Enter the order quantity." });
    expect(calculatePricing(order({ basis: "margin", targetPercent: 100 }))).toEqual({ problem: "A gross margin has to be below 100%." });
    expect(calculatePricing(order({ otherCosts: -1 }))).toEqual({ problem: "Costs can't be negative." });
    expect(calculatePricing(order({ productionCost: 0, packagingCost: 0, inlandTransport: 0, exportPreparation: 0, otherCosts: 0 }))).toEqual({ problem: "Enter at least one cost." });
  });
});
