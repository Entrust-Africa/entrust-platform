import { describe, expect, it } from "vitest";
import {
  MAX_PRICE_ROWS,
  PriceTableError,
  checkMinimumPrice,
  checkMinimumPrices,
  parseMinimumPriceCsv,
  parsePriceUnit,
  type ContractTerms,
  type MinimumPrice,
  type RawMinimumPrice,
} from "../src";

const HEADER = "effective_from,effective_to,coffee_type,grade,origin,unit,min_price";

const raw = (rest: Partial<RawMinimumPrice> = {}): RawMinimumPrice => ({
  effectiveFrom: "2026-10-20",
  effectiveTo: "2026-10-26",
  coffeeType: "washed",
  grade: "1",
  unit: "USD/kg",
  minPrice: "6.61",
  ...rest,
});

const price = (rest: Partial<MinimumPrice> = {}): MinimumPrice => ({
  id: "p1",
  tableId: "t1",
  recordedAt: "2026-10-19T08:00:00Z",
  effectiveFrom: "2026-10-20",
  effectiveTo: "2026-10-26",
  coffeeType: "washed",
  grade: "1",
  origin: null,
  currency: "USD",
  unit: "kg",
  minPrice: 6.61,
  ...rest,
});

const contract = (rest: Partial<ContractTerms> = {}): ContractTerms => ({
  contractDate: "2026-10-22",
  unitPrice: { amount: 7, currency: "USD", unit: "kg" },
  coffeeType: "washed",
  grade: "1",
  origin: null,
  ...rest,
});

const problemsOf = (run: () => unknown): readonly string[] => {
  try {
    run();
  } catch (error) {
    if (error instanceof PriceTableError) return error.problems;
    throw error;
  }
  throw new Error("Expected a PriceTableError");
};

describe("price rows", () => {
  it("are checked and stored in a normal form", () => {
    expect(checkMinimumPrices([raw({ coffeeType: " Washed ", grade: " 1 ", origin: " Yirgacheffe ", unit: "usd / KG", minPrice: 6.61 })])).toEqual([
      {
        effectiveFrom: "2026-10-20",
        effectiveTo: "2026-10-26",
        coffeeType: "washed",
        grade: "1",
        origin: "Yirgacheffe",
        currency: "USD",
        unit: "kg",
        minPrice: 6.61,
      },
    ]);
    expect(checkMinimumPrices([raw({ origin: "  " })])[0]?.origin).toBeNull();
  });

  it("read the units USD/kg and USD/lb, and refuse others", () => {
    expect(parsePriceUnit("USD/kg")).toEqual({ currency: "USD", unit: "kg" });
    expect(parsePriceUnit("usd/LB")).toEqual({ currency: "USD", unit: "lb" });
    expect(parsePriceUnit("USD/bag")).toBeUndefined();
    expect(parsePriceUnit("USD")).toBeUndefined();
    expect(parsePriceUnit("US/kg")).toBeUndefined();
  });

  it("report every mistake, with the row it is on", () => {
    const problems = problemsOf(() =>
      checkMinimumPrices([
        raw({ effectiveFrom: "2026-02-30" }),
        raw({ effectiveTo: "2026-10-19" }),
        raw({ coffeeType: "natural", grade: " " }),
        raw({ unit: "USD/bag", minPrice: "6,61" }),
        raw({ minPrice: 0 }),
      ]),
    );
    expect(problems).toEqual([
      'Row 1: the start date "2026-02-30" isn\'t a date. Use YYYY-MM-DD.',
      "Row 2: the end date 2026-10-19 is before the start date 2026-10-20.",
      'Row 3: the coffee type "natural" isn\'t washed or unwashed.',
      "Row 3: the grade is empty.",
      'Row 4: the unit "USD/bag" isn\'t a currency and a unit, such as USD/kg. The units are kg, lb, mt.',
      'Row 4: the minimum price "6,61" isn\'t a positive number with at most 4 decimals.',
      'Row 5: the minimum price "0" isn\'t a positive number with at most 4 decimals.',
    ]);
  });

  it("refuse more than four decimals and numbers that aren't plain decimals", () => {
    for (const minPrice of ["6.61234", "-1", "1e3", "abc", "", 0.00001, Number.NaN]) {
      expect(problemsOf(() => checkMinimumPrices([raw({ minPrice })])), String(minPrice)).toHaveLength(1);
    }
    expect(checkMinimumPrices([raw({ minPrice: "6.6123" })])[0]?.minPrice).toBe(6.6123);
  });

  it("refuse two prices for the same coffee on the same day, but not for different grades, origins or weeks", () => {
    const problems = problemsOf(() => checkMinimumPrices([raw(), raw({ effectiveFrom: "2026-10-26", effectiveTo: "2026-11-01" })]));
    expect(problems).toEqual(["Row 1 and Row 2 both give a price for washed coffee, grade 1, on overlapping days."]);
    expect(
      checkMinimumPrices([
        raw(),
        raw({ grade: "2" }),
        raw({ coffeeType: "unwashed" }),
        raw({ origin: "Yirgacheffe" }),
        raw({ effectiveFrom: "2026-10-27", effectiveTo: "2026-11-02" }),
      ]),
    ).toHaveLength(5);
  });

  it("need at least one price, and no more than the limit", () => {
    expect(problemsOf(() => checkMinimumPrices([]))).toEqual(["There are no prices."]);
    expect(problemsOf(() => checkMinimumPrices(Array.from({ length: MAX_PRICE_ROWS + 1 }, () => raw())))[0]).toMatch(/at most 2000/);
  });
});

describe("price tables as CSV", () => {
  it("read the issue's example row", () => {
    const csv = `${HEADER}\n2026-10-20,2026-10-26,washed,1,Yirgacheffe,USD/kg,6.61\n2026-10-20,2026-10-26,unwashed,1,,USD/lb,3.00\n`;
    expect(parseMinimumPriceCsv(csv)).toMatchObject([
      { coffeeType: "washed", grade: "1", origin: "Yirgacheffe", currency: "USD", unit: "kg", minPrice: 6.61 },
      { coffeeType: "unwashed", grade: "1", origin: null, currency: "USD", unit: "lb", minPrice: 3 },
    ]);
  });

  it("take the columns in any order, without the optional origin, from a spreadsheet export", () => {
    const csv = "﻿Min_Price,Unit,Grade,Coffee_Type,Effective_To,Effective_From\r\n6.61,USD/kg,1,Washed,2026-10-26,2026-10-20\r\n\r\n";
    expect(parseMinimumPriceCsv(csv)).toMatchObject([{ minPrice: 6.61, grade: "1", coffeeType: "washed", origin: null }]);
  });

  it("read quoted values with commas, quotes and line breaks", () => {
    const csv = `${HEADER}\n2026-10-20,2026-10-26,washed,1,"Sidamo, ""Bensa""\nzone",USD/kg,6.61\n2026-10-20,2026-10-26,washed,2,,USD/kg,6.00`;
    const rows = parseMinimumPriceCsv(csv);
    expect(rows[0]?.origin).toBe('Sidamo, "Bensa"\nzone');
    expect(rows[1]?.grade).toBe("2"); // the last row has no line break after it
  });

  it("name the line of each mistake, counting the lines a quoted value spans", () => {
    const csv = `${HEADER}\n2026-10-20,2026-10-26,washed,1,"two\nlines",USD/kg,6.61\n2026-10-20,2026-10-26,washed,2,,USD/kg,cheap\n`;
    expect(problemsOf(() => parseMinimumPriceCsv(csv))).toEqual([
      'Line 4: the minimum price "cheap" isn\'t a positive number with at most 4 decimals.',
    ]);
  });

  it("refuse a header that misspells a column, because a dropped origin would widen a price to every origin", () => {
    const csv = "effective_from,effective_to,coffee_type,grade,orgin,unit,min_price\n2026-10-20,2026-10-26,washed,1,Yirgacheffe,USD/kg,6.61\n";
    expect(problemsOf(() => parseMinimumPriceCsv(csv))).toEqual([
      'The header has columns that aren\'t part of the format: "orgin".',
      "Expected: effective_from, effective_to, coffee_type, grade, unit, min_price, origin.",
    ]);
  });

  it("refuse a header with a missing or repeated column, a row of the wrong width, and an empty file", () => {
    expect(problemsOf(() => parseMinimumPriceCsv("effective_from,grade\n"))[0]).toBe(
      "The header is missing effective_to, coffee_type, unit, min_price.",
    );
    expect(problemsOf(() => parseMinimumPriceCsv(`${HEADER},grade\n`))[0]).toBe("The header repeats grade.");
    expect(problemsOf(() => parseMinimumPriceCsv(`${HEADER}\n2026-10-20,2026-10-26,washed,1,USD/kg,6.61\n`))).toEqual([
      "Line 2: expected 7 values, found 6.",
    ]);
    expect(problemsOf(() => parseMinimumPriceCsv(""))).toEqual(["The file is empty."]);
    expect(problemsOf(() => parseMinimumPriceCsv(`${HEADER}\n`))).toEqual(["There are no prices."]);
    expect(problemsOf(() => parseMinimumPriceCsv(`${HEADER}\n2026-10-20,"2026-10-26,washed\n`))[0]).toBe("Line 2: a quoted value is never closed.");
  });
});

describe("the minimum price check", () => {
  it("passes a price above the minimum, and one exactly at it", () => {
    const above = checkMinimumPrice(contract(), [price()]);
    expect(above).toMatchObject({ status: "met", contractPrice: 7, minimum: { id: "p1", minPrice: 6.61 } });
    expect(above.message).toBe(
      "The contract price of 7.00 USD/kg is at or above the minimum export price of 6.61 USD/kg in force on 2026-10-22 (washed coffee, grade 1, set for 2026-10-20 to 2026-10-26).",
    );
    expect(checkMinimumPrice(contract({ unitPrice: { amount: 6.61, currency: "USD", unit: "kg" } }), [price()]).status).toBe("met");
  });

  it("fails a price below the minimum, and says by how it was compared", () => {
    const below = checkMinimumPrice(contract({ unitPrice: { amount: 5.9, currency: "USD", unit: "kg" } }), [price()]);
    expect(below.status).toBe("below");
    expect(below.message).toBe(
      "The contract price of 5.90 USD/kg is below the minimum export price of 6.61 USD/kg in force on 2026-10-22 (washed coffee, grade 1, set for 2026-10-20 to 2026-10-26).",
    );
    expect(checkMinimumPrice(contract({ unitPrice: { amount: 6.6099, currency: "USD", unit: "kg" } }), [price()]).status).toBe("below");
  });

  it("converts between kg, lb and mt before comparing", () => {
    // 3.00 USD/lb is 6.6139 USD/kg.
    const perLb = (amount: number) => contract({ unitPrice: { amount, currency: "USD", unit: "lb" } });
    const met = checkMinimumPrice(perLb(3), [price()]);
    expect(met).toMatchObject({ status: "met", contractPrice: 6.6139 });
    expect(met.message).toMatch(/^The contract price of 3\.00 USD\/lb \(6\.6139 USD\/kg\) is at or above/);
    expect(checkMinimumPrice(perLb(2.99), [price()]).status).toBe("below");

    // And the other way: a minimum of 3.00 USD/lb against a price in kg.
    const minimumPerLb = price({ unit: "lb", minPrice: 3 });
    expect(checkMinimumPrice(contract({ unitPrice: { amount: 6.6139, currency: "USD", unit: "kg" } }), [minimumPerLb]).status).toBe("met");
    expect(checkMinimumPrice(contract({ unitPrice: { amount: 6.6, currency: "USD", unit: "kg" } }), [minimumPerLb]).status).toBe("below");
    expect(checkMinimumPrice(contract({ unitPrice: { amount: 6610, currency: "USD", unit: "mt" } }), [price()]).status).toBe("met");
    expect(checkMinimumPrice(contract({ unitPrice: { amount: 6609, currency: "USD", unit: "mt" } }), [price()]).status).toBe("below");
  });

  it("uses the price in force on the contract date, to the day at each end", () => {
    const run = (contractDate: string) => checkMinimumPrice(contract({ contractDate }), [price()]).status;
    expect(run("2026-10-19")).toBe("no_price");
    expect(run("2026-10-20")).toBe("met");
    expect(run("2026-10-26")).toBe("met");
    expect(run("2026-10-27")).toBe("no_price");

    const weeks = [price(), price({ id: "p2", effectiveFrom: "2026-10-27", effectiveTo: "2026-11-02", minPrice: 7.5 })];
    const cheap = contract({ unitPrice: { amount: 7, currency: "USD", unit: "kg" } });
    expect(checkMinimumPrice({ ...cheap, contractDate: "2026-10-26" }, weeks).status).toBe("met");
    expect(checkMinimumPrice({ ...cheap, contractDate: "2026-10-27" }, weeks).status).toBe("below");
  });

  it("stays open with 'no minimum price on file' when no row covers the date, and never passes silently", () => {
    const result = checkMinimumPrice(contract({ contractDate: "2026-12-01" }), [price()]);
    expect(result).toMatchObject({ status: "no_price", minimum: null, contractPrice: null });
    expect(result.message).toBe("No minimum price on file for washed coffee, grade 1, on 2026-12-01.");
    expect(checkMinimumPrice(contract(), []).status).toBe("no_price");
  });

  it("matches the coffee type and grade, ignoring the case of the grade", () => {
    expect(checkMinimumPrice(contract({ coffeeType: "unwashed" }), [price()]).status).toBe("no_price");
    expect(checkMinimumPrice(contract({ grade: "2" }), [price()]).status).toBe("no_price");
    expect(checkMinimumPrice(contract({ grade: "q1" }), [price({ grade: "Q1" })]).status).toBe("met");
  });

  it("matches an origin-specific price only to that origin, and a general price to any", () => {
    const yirgacheffe = price({ id: "y", origin: "Yirgacheffe", minPrice: 8 });
    expect(checkMinimumPrice(contract({ origin: "yirgacheffe", unitPrice: { amount: 8, currency: "USD", unit: "kg" } }), [yirgacheffe]).status).toBe("met");
    expect(checkMinimumPrice(contract({ origin: "yirgacheffe" }), [yirgacheffe]).status).toBe("below"); // 7.00 against 8.00
    expect(checkMinimumPrice(contract({ origin: "Sidamo" }), [yirgacheffe]).status).toBe("no_price");
    expect(checkMinimumPrice(contract({ origin: null }), [yirgacheffe]).status).toBe("no_price");
    expect(checkMinimumPrice(contract({ origin: "Sidamo" }), [price()]).minimum?.id).toBe("p1");
    expect(checkMinimumPrice(contract({ origin: null }), [price()]).minimum?.id).toBe("p1");
  });

  it("prefers the latest table, then the most specific origin within it", () => {
    const old = price({ id: "old", recordedAt: "2026-10-01T00:00:00Z", minPrice: 5 });
    const corrected = price({ id: "new", tableId: "t2", recordedAt: "2026-10-21T00:00:00Z", minPrice: 7.5 });
    expect(checkMinimumPrice(contract(), [old, corrected]).minimum?.id).toBe("new");
    expect(checkMinimumPrice(contract(), [corrected, old]).minimum?.id).toBe("new");
    expect(checkMinimumPrice(contract(), [corrected, old]).status).toBe("below");

    const specific = price({ id: "specific", tableId: "t2", recordedAt: "2026-10-21T00:00:00Z", origin: "Yirgacheffe", minPrice: 8 });
    expect(checkMinimumPrice(contract({ origin: "Yirgacheffe" }), [corrected, specific, old]).minimum?.id).toBe("specific");
    // An older table's specific price doesn't outrank a newer table's general one.
    const olderSpecific = price({ id: "older-specific", recordedAt: "2026-10-01T00:00:00Z", origin: "Yirgacheffe", minPrice: 9 });
    expect(checkMinimumPrice(contract({ origin: "Yirgacheffe" }), [olderSpecific, corrected]).minimum?.id).toBe("new");
  });

  it("does not convert between currencies", () => {
    const eur = checkMinimumPrice(contract({ unitPrice: { amount: 6, currency: "EUR", unit: "kg" } }), [price()]);
    expect(eur).toMatchObject({ status: "not_comparable", contractPrice: null, minimum: { id: "p1" } });
    expect(eur.message).toMatch(/^The contract is priced in EUR but the minimum export price in force on 2026-10-22 .* is in USD, so they can't be compared here\.$/);
  });

  it("waits for a contract with its price, coffee type and grade", () => {
    expect(checkMinimumPrice(null, [price()])).toMatchObject({ status: "waiting", message: "The sales contract isn't recorded yet, so its price can't be checked." });
    const empty = checkMinimumPrice(contract({ unitPrice: null, coffeeType: null, grade: null }), [price()]);
    expect(empty).toMatchObject({
      status: "waiting",
      message: "The sales contract needs the unit price, the coffee type (washed or unwashed) and the grade before its price can be checked.",
    });
    expect(checkMinimumPrice(contract({ grade: "  " }), [price()]).message).toBe(
      "The sales contract needs the grade before its price can be checked.",
    );
  });
});
