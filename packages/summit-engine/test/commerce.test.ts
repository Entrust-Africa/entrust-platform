import { describe, expect, it } from "vitest";
import {
  COMMERCE_REPORTS,
  boothFigures,
  boothTotals,
  revenueOf,
  badgeProblems,
  badgeState,
  parseBadgeCode,
  ENQUIRY_OPEN,
  ENQUIRY_STATUSES,
  ENQUIRY_STATUS_LABELS,
  ENQUIRY_TRANSITIONS,
  BOOKING_HOLDS_BOOTH,
  BOOKING_TRANSITIONS,
  BUSINESS_SECTORS,
  PAYMENT_STATUSES,
  PAYMENT_TRANSITIONS,
  confirmationBlockers,
  EXHIBITION_COMPARISON,
  STANDARD_EDITION,
  STANDARD_PRODUCTS,
  availability,
  catalogueProblems,
  formatUsd,
  productPriceLabel,
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

  it("has the six Pan African Chamber of Commerce sponsorship levels, with their approved ranges, highest first", () => {
    const levels = STANDARD_PRODUCTS.filter((p) => p.kind === "sponsorship_level");
    expect(levels.map((p) => [p.name, p.priceCents / 100, p.attributes.priceRange])).toEqual([
      ["Mission Presenting Partner", 50000, "$50,000 and above"],
      ["Banking & Finance Partner", 25000, "$25,000 to $40,000"],
      ["Logistics & Supply Chain Partner", 20000, "$20,000 to $30,000"],
      ["Market Entry Partner", 15000, "$15,000 to $25,000"],
      ["Travel & Hospitality Partner", 10000, "$10,000 to $25,000, or in-kind"],
      ["Delegation Supporting Partner", 5000, "$5,000 to $10,000"],
    ]);
  });

  it("promises nothing a level's agreement has not set: no passes, booths, speaking slots or exclusivity", () => {
    const levels = STANDARD_PRODUCTS.filter((p) => p.kind === "sponsorship_level");
    expect(levels.every((p) => Object.keys(p.benefits).length === 0)).toBe(true);
    expect(new Set(levels.map((p) => p.summary)).size).toBe(levels.length);
  });

  it("shows a range for a product that has one, and the price for the rest", () => {
    expect(productPriceLabel(2_500_000, { priceRange: "$25,000 to $40,000" })).toBe("$25,000 to $40,000");
    expect(productPriceLabel(2_500_000, { priceRange: "  " })).toBe("$25,000");
    expect(productPriceLabel(0, {})).toBe("Complimentary");
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
    expect(productProblems({ ...bySlug("banking-finance-partner"), benefits: { nonsense: "x" } as never })[0]).toMatch(/area that doesn't exist/);
  });

  it("finds two products with the same address", () => {
    expect(catalogueProblems([good, good])).toEqual([`${good.slug}: two products have this address.`]);
  });
});

describe("booking and payment rules", () => {
  it("lets a booking be confirmed only when approved, paid (verified) and given a booth", () => {
    expect(confirmationBlockers({ status: "approved", boothNumber: "A12" }, "confirmed")).toEqual([]);
    expect(confirmationBlockers({ status: "submitted", boothNumber: "A12" }, "confirmed")).toHaveLength(1);
    expect(confirmationBlockers({ status: "approved", boothNumber: "A12" }, "awaiting_verification")).toEqual(["The payment has not been verified."]);
    expect(confirmationBlockers({ status: "approved", boothNumber: null }, "confirmed")).toEqual(["No booth number has been assigned."]);
    expect(confirmationBlockers({ status: "approved", boothNumber: null }, null)).toHaveLength(2);
  });

  it("holds a booth only for approved and confirmed bookings", () => {
    expect(BOOKING_HOLDS_BOOTH).toEqual(["approved", "confirmed"]);
  });

  it("never goes from submitted straight to confirmed, and a rejected or cancelled booking stays so", () => {
    expect(BOOKING_TRANSITIONS.submitted).not.toContain("confirmed");
    expect(BOOKING_TRANSITIONS.rejected).toEqual([]);
    expect(BOOKING_TRANSITIONS.cancelled).toEqual([]);
  });

  it("sends a payment to refunded only from confirmed", () => {
    for (const status of PAYMENT_STATUSES) expect(PAYMENT_TRANSITIONS[status].includes("refunded")).toBe(status === "confirmed");
  });

  it("lists the eleven target sectors and Other", () => {
    expect(BUSINESS_SECTORS).toHaveLength(12);
    expect(BUSINESS_SECTORS.at(-1)).toBe("Other");
  });
});

describe("sponsorship enquiries", () => {
  it("has the six statuses of the instructions, in pipeline order", () => {
    expect(ENQUIRY_STATUSES.map((s) => ENQUIRY_STATUS_LABELS[s])).toEqual(["New enquiry", "Contacted", "Negotiation", "Proposal sent", "Confirmed", "Declined"]);
  });

  it("lets an open enquiry move to any other status, a confirmed sponsor only withdraw, and a declined one reopen", () => {
    for (const status of ENQUIRY_OPEN) {
      const others = ENQUIRY_STATUSES.filter((s) => s !== status);
      expect([...ENQUIRY_TRANSITIONS[status]].sort()).toEqual([...others].sort());
    }
    expect(ENQUIRY_TRANSITIONS.confirmed).toEqual(["declined"]);
    expect(ENQUIRY_TRANSITIONS.declined).toEqual(["new", "contacted", "negotiation", "proposal_sent"]);
  });
});

describe("delegate badges", () => {
  const registered = { status: "registered" as const, checkedInAt: null };

  it("is valid only for a registered delegate whose payment is verified", () => {
    expect(badgeProblems(registered, "confirmed")).toEqual([]);
    expect(badgeState(registered, "confirmed")).toBe("valid");
    expect(badgeProblems(registered, "pending")).toEqual(["The payment has not been verified."]);
    expect(badgeProblems(registered, "awaiting_verification")).toEqual(["The payment has not been verified."]);
    expect(badgeProblems(registered, null)).toEqual(["The payment has not been verified."]);
    expect(badgeProblems(registered, "refunded")).toEqual(["The payment was refunded."]);
    expect(badgeProblems({ status: "cancelled", checkedInAt: null }, "confirmed")).toEqual(["This registration was cancelled."]);
  });

  it("shows a badge already used", () => {
    expect(badgeState({ status: "registered", checkedInAt: new Date() }, "confirmed")).toBe("already_checked_in");
    expect(badgeState({ status: "registered", checkedInAt: new Date() }, "pending")).toBe("not_valid");
  });

  it("reads a scanned address, a bare token or a reference", () => {
    const token = "Zk3b9XqL2mNp7RsTuVwY4a";
    expect(parseBadgeCode(`https://adtis.entrust-africa.com/badge/${token}`)).toEqual({ token });
    expect(parseBadgeCode(`  http://localhost:3002/badge/${token}/?x=1 `)).toEqual({ token });
    expect(parseBadgeCode(token)).toEqual({ token });
    expect(parseBadgeCode("del-00042")).toEqual({ number: "DEL-00042" });
    expect(parseBadgeCode("")).toBeNull();
    expect(parseBadgeCode("hello world")).toBeNull();
    expect(parseBadgeCode("https://example.com/other/path")).toBeNull();
  });
});

describe("dashboard figures", () => {
  const f = (status: "pending" | "awaiting_verification" | "confirmed" | "cancelled" | "refunded", dueCents: number, receivedCents = dueCents, count = 1) => ({ status, count, dueCents, receivedCents });

  it("counts only verified payments as received, and the unverified as outstanding", () => {
    const r = revenueOf([f("confirmed", 50000), f("pending", 90000), f("awaiting_verification", 25000), f("confirmed", 6500)]);
    expect(r).toEqual({ expectedCents: 171500, receivedCents: 56500, outstandingCents: 115000, refundedCents: 0 });
  });

  it("leaves cancelled payments out of the expected revenue, and shows refunds on their own", () => {
    const r = revenueOf([f("cancelled", 100000), f("refunded", 40000), f("confirmed", 10000)]);
    expect(r).toEqual({ expectedCents: 10000, receivedCents: 10000, outstandingCents: 0, refundedCents: 40000 });
  });

  it("expects nothing from nothing", () => {
    expect(revenueOf([])).toEqual({ expectedCents: 0, receivedCents: 0, outstandingCents: 0, refundedCents: 0 });
  });

  it("is not thrown by an overpayment: the expected revenue is what was due", () => {
    expect(revenueOf([f("confirmed", 50000, 55000)])).toMatchObject({ expectedCents: 50000, receivedCents: 55000 });
  });

  it("works out what is left in a package, and sold out at capacity or when marked", () => {
    const base = { submitted: 4, reserved: 2, confirmed: 1, markedSoldOut: false };
    expect(boothFigures({ ...base, capacity: 10 })).toMatchObject({ available: 7, soldOut: false });
    expect(boothFigures({ ...base, capacity: 3 })).toMatchObject({ available: 0, soldOut: true });
    expect(boothFigures({ ...base, capacity: 2 })).toMatchObject({ available: 0, soldOut: true });
    expect(boothFigures({ ...base, capacity: null })).toMatchObject({ available: null, soldOut: false });
    expect(boothFigures({ ...base, capacity: 50, markedSoldOut: true }).soldOut).toBe(true);
  });

  it("totals the booths of the packages that have a capacity, and says when some have none", () => {
    const pkg = (capacity: number | null, reserved: number, confirmed: number) => ({ capacity, submitted: 0, reserved, confirmed, markedSoldOut: false });
    expect(boothTotals([pkg(10, 2, 1), pkg(5, 0, 0)])).toEqual({ capacitySet: true, totalBooths: 15, available: 12 });
    expect(boothTotals([pkg(10, 2, 1), pkg(null, 3, 0)])).toEqual({ capacitySet: false, totalBooths: 10, available: 7 });
    expect(boothTotals([pkg(null, 0, 0)])).toEqual({ capacitySet: false, totalBooths: null, available: null });
  });

  it("lists the six reports of the instructions", () => {
    expect(COMMERCE_REPORTS.map((r) => r.id)).toEqual(["delegates", "exhibitors", "sponsorship", "payments", "revenue", "country_sector"]);
  });
});
