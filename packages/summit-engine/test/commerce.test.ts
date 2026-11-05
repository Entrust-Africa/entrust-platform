import { describe, expect, it } from "vitest";
import {
  BENEFIT_AREAS,
  EXHIBITION_COMPARISON,
  STANDARD_EDITION,
  STANDARD_PRODUCTS,
  availability,
  catalogueProblems,
  formatUsd,
  priceLabel,
  productProblems,
  toCents,
  type ProductDefinition,
} from "../src";

const bySlug = (slug: string) => {
  const found = STANDARD_PRODUCTS.find((p) => p.slug === slug);
  if (!found) throw new Error(`No product ${slug}`);
  return found;
};

describe("the standard catalogue", () => {
  it("is valid", () => {
    expect(catalogueProblems(STANDARD_PRODUCTS)).toEqual([]);
  });

  it("has the five exhibition packages at the specified prices", () => {
    const prices = STANDARD_PRODUCTS.filter((p) => p.kind === "exhibition_package").map((p) => [p.name, p.priceCents / 100]);
    expect(prices).toEqual([
      ["Standard SME Booth", 500],
      ["Premium SME Booth", 900],
      ["Corporate / Institutional Booth", 1600],
      ["International Exhibitor Booth", 1500],
      ["SME Table-top Exhibition", 250],
    ]);
  });

  it("has the six sponsorship levels at the specified prices, highest first", () => {
    const levels = STANDARD_PRODUCTS.filter((p) => p.kind === "sponsorship_level");
    expect(levels.map((p) => [p.name, p.priceCents / 100])).toEqual([
      ["Title Partner", 31250],
      ["Diamond Partner", 18750],
      ["Platinum Partner", 12500],
      ["Gold Partner", 6250],
      ["Silver Partner", 3125],
      ["Supporting Partner", 1560],
    ]);
  });

  it("does not give every sponsorship level the same benefits", () => {
    const levels = STANDARD_PRODUCTS.filter((p) => p.kind === "sponsorship_level");
    const texts = levels.map((p) => JSON.stringify(p.benefits));
    expect(new Set(texts).size).toBe(levels.length);
    // Only the title partner has category exclusivity, and it is subject to the agreement.
    expect(levels.filter((p) => p.benefits.exclusivity).map((p) => p.slug)).toEqual(["title-partner"]);
    expect(bySlug("title-partner").benefits.exclusivity).toMatch(/signed sponsorship agreement/i);
    // Every benefit area is covered by the Title Partner, which has the most.
    for (const area of BENEFIT_AREAS) expect(bySlug("title-partner").benefits[area.id], area.label).toBeTruthy();
  });

  it("has the five delegate categories, the first complimentary and tied to the selection list", () => {
    const categories = STANDARD_PRODUCTS.filter((p) => p.kind === "delegate_category");
    expect(categories.map((p) => [p.name, p.priceCents / 100])).toEqual([
      ["Selected SME Delegate", 0],
      ["General Business Delegate", 65],
      ["Premium Delegate", 160],
      ["Diaspora Business Delegate", 150],
      ["Investor / International Buyer", 250],
    ]);
    expect(categories[0]?.attributes.eligibility).toBe("selected_sme");
    expect(categories.slice(1).every((p) => p.attributes.eligibility === undefined)).toBe(true);
  });

  it("has the seven additional opportunities at the specified prices", () => {
    const prices = STANDARD_PRODUCTS.filter((p) => p.kind === "opportunity").map((p) => [p.name, p.priceCents / 100]);
    expect(prices).toEqual([
      ["Country Pavilion", 4700],
      ["Industry Pavilion", 3125],
      ["Sponsored B2B Matchmaking Session", 1875],
      ["Sponsored Conference Session", 1560],
      ["Digital Directory Advertisement", 313],
      ["SME Opportunity Profile Sponsorship", 625],
      ["Investor Networking Reception Sponsorship", 3125],
    ]);
  });

  it("gives every exhibition package a value for each comparison row", () => {
    for (const p of STANDARD_PRODUCTS.filter((p) => p.kind === "exhibition_package")) {
      for (const row of EXHIBITION_COMPARISON) expect(p.attributes[row.id], `${p.slug} ${row.id}`).toBeDefined();
    }
  });

  it("sets no capacity and publishes nothing but what is specified, and leaves the tax question open", () => {
    expect(STANDARD_PRODUCTS.every((p) => p.capacity === null)).toBe(true);
    expect(STANDARD_EDITION.pricesIncludeTax).toBeNull();
    expect(STANDARD_EDITION.paymentMethods).toEqual([]);
    expect(STANDARD_EDITION.datesNote).toMatch(/January 2027/);
    expect(JSON.stringify([STANDARD_EDITION, STANDARD_PRODUCTS])).not.toMatch(/October/i);
  });
});

describe("money", () => {
  it("shows whole dollars without cents and uses a thousands separator", () => {
    expect(formatUsd(toCents(31250))).toBe("$31,250");
    expect(formatUsd(toCents(313))).toBe("$313");
    expect(formatUsd(156050)).toBe("$1,560.50");
  });

  it("calls a zero price complimentary", () => {
    expect(priceLabel(0)).toBe("Complimentary");
    expect(priceLabel(6500)).toBe("$65");
  });
});

describe("availability", () => {
  it("has no limit when no capacity is set, unless marked sold out", () => {
    expect(availability({ capacity: null, taken: 40, markedSoldOut: false })).toEqual({ capacity: null, taken: 40, remaining: null, soldOut: false });
    expect(availability({ capacity: null, taken: 0, markedSoldOut: true }).soldOut).toBe(true);
  });

  it("is sold out once what is approved fills the capacity", () => {
    expect(availability({ capacity: 10, taken: 9, markedSoldOut: false })).toMatchObject({ remaining: 1, soldOut: false });
    expect(availability({ capacity: 10, taken: 10, markedSoldOut: false })).toMatchObject({ remaining: 0, soldOut: true });
    // Lowering the capacity under what is taken doesn't make the number negative.
    expect(availability({ capacity: 4, taken: 6, markedSoldOut: false })).toMatchObject({ remaining: 0, soldOut: true });
  });

  it("is sold out at capacity zero", () => {
    expect(availability({ capacity: 0, taken: 0, markedSoldOut: false }).soldOut).toBe(true);
  });
});

describe("product checks", () => {
  const good: ProductDefinition = { ...bySlug("general-business"), features: ["One"] };

  it("accepts a good product", () => {
    expect(productProblems(good)).toEqual([]);
  });

  it("refuses a bad address, a negative or huge price and a fractional capacity", () => {
    expect(productProblems({ ...good, slug: "Not A Slug" })).toHaveLength(1);
    expect(productProblems({ ...good, priceCents: -1 })[0]).toMatch(/price/);
    expect(productProblems({ ...good, priceCents: 2_000_000 * 100 })[0]).toMatch(/price/);
    expect(productProblems({ ...good, capacity: 2.5 })[0]).toMatch(/capacity/);
  });

  it("refuses benefits by area on anything but a sponsorship level, and a made-up area", () => {
    expect(productProblems({ ...good, benefits: { logo: "Big" } })[0]).toMatch(/only sponsorship levels/);
    expect(productProblems({ ...bySlug("gold-partner"), benefits: { nonsense: "x" } as never })[0]).toMatch(/area that doesn't exist/);
  });

  it("finds two products with the same address", () => {
    expect(catalogueProblems([good, good])).toEqual([`${good.slug}: two products have this address.`]);
  });
});
