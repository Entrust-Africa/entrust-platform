// The minimum export price check (STEP-024). ECTA sets a minimum export price for coffee every week
// and doesn't publish it online, so an Entrust admin loads the figures into CLEAR as price tables.
// This file holds the table format, its validation, and the check of a contract's unit price
// against the price in force on the contract date. Pure, like the rest of the engine: the API loads
// the rows and the contract and passes them in.

export const COFFEE_TYPES = ["washed", "unwashed"] as const;
export type CoffeeType = (typeof COFFEE_TYPES)[number];

export const PRICE_UNITS = ["kg", "lb", "mt"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

const KG_PER_UNIT: Record<PriceUnit, number> = { kg: 1, lb: 0.45359237, mt: 1000 };

/** The columns of a price table (CSV header), in the order the examples give them. */
export const PRICE_TABLE_COLUMNS = {
  required: ["effective_from", "effective_to", "coffee_type", "grade", "unit", "min_price"],
  optional: ["origin"],
} as const;

/** More rows than a weekly price list ever has, so a wrong file fails early. */
export const MAX_PRICE_ROWS = 2000;

/** A price as stored: valid for the days from `effectiveFrom` to `effectiveTo`, both included. */
export interface NewMinimumPrice {
  effectiveFrom: string;
  effectiveTo: string;
  coffeeType: CoffeeType;
  /** As ECTA writes it, such as "1". */
  grade: string;
  /** Set for a price that applies to one origin only; null applies to every origin. */
  origin: string | null;
  /** ISO 4217 code, upper case. */
  currency: string;
  unit: PriceUnit;
  /** In `currency` per `unit`, with at most 4 decimals. */
  minPrice: number;
}

export interface MinimumPrice extends NewMinimumPrice {
  id: string;
  tableId: string;
  /** When its table was recorded. Of two tables that cover a day, the later one decides. */
  recordedAt: string;
}

/** A price as someone typed or uploaded it, before it is checked. */
export interface RawMinimumPrice {
  effectiveFrom: string;
  effectiveTo: string;
  coffeeType: string;
  grade: string;
  origin?: string | null;
  /** Currency and unit, such as "USD/kg". */
  unit: string;
  minPrice: string | number;
}

/** A price table that can't be recorded. `problems` has one message per mistake, so they can be fixed together. */
export class PriceTableError extends RangeError {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    const shown = problems.slice(0, 10).join(" ");
    super(problems.length > 10 ? `${shown} (and ${problems.length - 10} more problems)` : shown);
    this.name = "PriceTableError";
    this.problems = problems;
  }
}

// ---- Checking rows ----

const same = (a: string | null, b: string | null) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

function isoDate(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const day = value.trim();
  // The round trip catches dates that don't exist, such as 2026-02-30.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return undefined;
  return day;
}

/** A positive number with at most 4 decimals, as a stored price allows; undefined for anything else. */
export function parsePrice(value: unknown): number | undefined {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^\d{1,10}(\.\d{1,4})?$/.test(text)) return undefined;
  const number = Number(text);
  return number > 0 ? number : undefined;
}

/** The currency and unit of a price such as "USD/kg". */
export function parsePriceUnit(value: string): { currency: string; unit: PriceUnit } | undefined {
  const match = /^([A-Za-z]{3})\s*\/\s*([A-Za-z]+)$/.exec(value.trim());
  const unit = match?.[2]?.toLowerCase();
  if (!match?.[1] || !unit || !PRICE_UNITS.includes(unit as PriceUnit)) return undefined;
  return { currency: match[1].toUpperCase(), unit: unit as PriceUnit };
}

/** The coffee type as written, in lower case, or undefined if it is neither washed nor unwashed. */
export function parseCoffeeType(value: string): CoffeeType | undefined {
  const type = value.trim().toLowerCase();
  return COFFEE_TYPES.find((t) => t === type);
}

/**
 * Check price rows and return them as stored. `where` names a row in the messages ("Line 3" for a
 * file, "Row 3" for rows typed in). Throws a PriceTableError with every mistake found.
 */
export function checkMinimumPrices(
  raw: readonly RawMinimumPrice[],
  where: (index: number) => string = (index) => `Row ${index + 1}`,
): NewMinimumPrice[] {
  if (raw.length === 0) throw new PriceTableError(["There are no prices."]);
  if (raw.length > MAX_PRICE_ROWS) throw new PriceTableError([`A table holds at most ${MAX_PRICE_ROWS} prices, and this one has ${raw.length}.`]);

  const problems: string[] = [];
  const rows: (NewMinimumPrice | undefined)[] = raw.map((row, index) => {
    const at = where(index);
    const before = problems.length;
    const effectiveFrom = isoDate(row.effectiveFrom);
    const effectiveTo = isoDate(row.effectiveTo);
    if (!effectiveFrom) problems.push(`${at}: the start date "${row.effectiveFrom}" isn't a date. Use YYYY-MM-DD.`);
    if (!effectiveTo) problems.push(`${at}: the end date "${row.effectiveTo}" isn't a date. Use YYYY-MM-DD.`);
    if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
      problems.push(`${at}: the end date ${effectiveTo} is before the start date ${effectiveFrom}.`);
    }
    const coffeeType = parseCoffeeType(String(row.coffeeType));
    if (!coffeeType) problems.push(`${at}: the coffee type "${row.coffeeType}" isn't washed or unwashed.`);
    const grade = String(row.grade ?? "").trim();
    if (!grade) problems.push(`${at}: the grade is empty.`);
    else if (grade.length > 20) problems.push(`${at}: the grade "${grade}" is too long.`);
    const origin = row.origin?.trim() || null;
    const unit = parsePriceUnit(String(row.unit));
    if (!unit) problems.push(`${at}: the unit "${row.unit}" isn't a currency and a unit, such as USD/kg. The units are ${PRICE_UNITS.join(", ")}.`);
    const minPrice = parsePrice(row.minPrice);
    if (minPrice === undefined) problems.push(`${at}: the minimum price "${row.minPrice}" isn't a positive number with at most 4 decimals.`);

    if (problems.length > before || !effectiveFrom || !effectiveTo || !coffeeType || !unit || minPrice === undefined) return undefined;
    return { effectiveFrom, effectiveTo, coffeeType, grade, origin, currency: unit.currency, unit: unit.unit, minPrice };
  });

  // Two prices for the same coffee on the same day would leave the check guessing.
  rows.forEach((a, i) =>
    rows.slice(i + 1).forEach((b, offset) => {
      if (!a || !b || a.coffeeType !== b.coffeeType || !same(a.grade, b.grade) || !same(a.origin, b.origin)) return;
      if (a.effectiveFrom > b.effectiveTo || b.effectiveFrom > a.effectiveTo) return;
      problems.push(`${where(i)} and ${where(i + 1 + offset)} both give a price for ${describeLot(a)}, on overlapping days.`);
    }),
  );

  if (problems.length) throw new PriceTableError(problems);
  return rows.filter((row): row is NewMinimumPrice => row !== undefined);
}

// ---- Reading a CSV file ----

interface CsvRecord {
  line: number;
  fields: string[];
}

/** Splits CSV text into records: quoted values may hold commas, quotes ("") and line breaks. */
function csvRecords(text: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let value = "";
  let quoted = false;
  let line = 1;
  let startLine = 1;
  let open = false;
  const endValue = () => {
    fields.push(value);
    value = "";
  };
  const endRecord = () => {
    endValue();
    if (fields.some((f) => f.trim() !== "")) records.push({ line: startLine, fields });
    fields = [];
    open = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!open) {
      startLine = line;
      open = true;
    }
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else {
        if (ch === "\n") line++;
        value += ch;
      }
    } else if (ch === '"' && value.trim() === "") {
      quoted = true;
      value = "";
    } else if (ch === ",") endValue();
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      line++;
      endRecord();
    } else value += ch;
  }
  if (quoted) throw new PriceTableError([`Line ${startLine}: a quoted value is never closed.`]);
  if (open) endRecord();
  return records;
}

/**
 * Reads a price table from CSV text: a header row naming the columns (effective_from, effective_to,
 * coffee_type, grade, unit, min_price and optionally origin, in any order) and one row per price.
 * Throws a PriceTableError listing what is wrong, with line numbers.
 */
export function parseMinimumPriceCsv(text: string): NewMinimumPrice[] {
  const [header, ...records] = csvRecords(text.replace(/^﻿/, ""));
  if (!header) throw new PriceTableError(["The file is empty."]);

  const columns = header.fields.map((name) => name.trim().toLowerCase());
  const known: readonly string[] = [...PRICE_TABLE_COLUMNS.required, ...PRICE_TABLE_COLUMNS.optional];
  const problems: string[] = [];
  const unknown = columns.filter((name) => !known.includes(name));
  if (unknown.length) problems.push(`The header has columns that aren't part of the format: ${unknown.map((c) => `"${c}"`).join(", ")}.`);
  const repeated = columns.filter((name, i) => columns.indexOf(name) !== i);
  if (repeated.length) problems.push(`The header repeats ${[...new Set(repeated)].join(", ")}.`);
  const missing = PRICE_TABLE_COLUMNS.required.filter((name) => !columns.includes(name));
  if (missing.length) problems.push(`The header is missing ${missing.join(", ")}.`);
  if (problems.length) throw new PriceTableError([...problems, `Expected: ${known.join(", ")}.`]);

  const wrongWidth = records.filter((r) => r.fields.length !== columns.length);
  if (wrongWidth.length) {
    throw new PriceTableError(wrongWidth.map((r) => `Line ${r.line}: expected ${columns.length} values, found ${r.fields.length}.`));
  }
  const cell = (record: CsvRecord, name: string) => record.fields[columns.indexOf(name)] ?? "";
  return checkMinimumPrices(
    records.map((record) => ({
      effectiveFrom: cell(record, "effective_from"),
      effectiveTo: cell(record, "effective_to"),
      coffeeType: cell(record, "coffee_type"),
      grade: cell(record, "grade"),
      origin: cell(record, "origin"),
      unit: cell(record, "unit"),
      minPrice: cell(record, "min_price"),
    })),
    (index) => `Line ${records[index]?.line ?? index + 2}`,
  );
}

// ---- The check ----

/** What the check reads from a contract. */
export interface ContractTerms {
  /** ISO date. The price in force on this day is the one the contract is held to. */
  contractDate: string;
  unitPrice: { amount: number; currency: string; unit: PriceUnit } | null;
  coffeeType: CoffeeType | null;
  grade: string | null;
  origin: string | null;
}

/**
 * - waiting: the contract, its unit price, coffee type or grade isn't recorded yet
 * - no_price: no table gives a price for this coffee on the contract date
 * - not_comparable: the contract and the price are in different currencies
 * - met: the contract price is at or above the minimum
 * - below: the contract price is below the minimum
 */
export type MinimumPriceStatus = "waiting" | "no_price" | "not_comparable" | "met" | "below";

export interface MinimumPriceCheck {
  status: MinimumPriceStatus;
  /** Why, in words. The step shows it while it isn't met, and a flag carries it when it is below. */
  message: string;
  /** The minimum export price in force on the contract date, when a table gives one. */
  minimum: MinimumPrice | null;
  /** The contract price in the minimum's unit, when the two could be compared. */
  contractPrice: number | null;
}

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** At least two decimals, up to four: 6.61, 5.90, 6.6139. */
function decimals(n: number): string {
  let text = n.toFixed(4);
  while (text.endsWith("0") && !/\.\d\d$/.test(text)) text = text.slice(0, -1);
  return text;
}

const priceText = (n: number, currency: string, unit: PriceUnit) => `${decimals(n)} ${currency}/${unit}`;

function describeLot(lot: { coffeeType: CoffeeType; grade: string; origin: string | null }): string {
  return `${lot.coffeeType} coffee, grade ${lot.grade}${lot.origin ? `, ${lot.origin}` : ""}`;
}

/** The price in force for a coffee on a day: the latest table that gives one, then the most specific origin. */
function inForce(prices: readonly MinimumPrice[], lot: { coffeeType: CoffeeType; grade: string; origin: string | null }, day: string) {
  return prices
    .filter(
      (p) =>
        p.coffeeType === lot.coffeeType &&
        same(p.grade, lot.grade) &&
        (p.origin === null || same(p.origin, lot.origin)) &&
        p.effectiveFrom <= day &&
        day <= p.effectiveTo,
    )
    .toSorted(
      (a, b) =>
        Date.parse(b.recordedAt) - Date.parse(a.recordedAt) ||
        Number(b.origin !== null) - Number(a.origin !== null) ||
        a.id.localeCompare(b.id),
    )[0];
}

/**
 * Checks a contract's unit price against the minimum export price in force on the contract date,
 * converting units where the two differ (kg, lb, mt). Prices in different currencies aren't
 * converted: that is left to a person. A price exactly at the minimum passes. Unit conversion is
 * compared to 4 decimals, so 3.00 USD/lb isn't held to be a hair under 6.6139 USD/kg.
 *
 * `prices` may hold every price on file; the ones that don't match the contract are ignored.
 */
export function checkMinimumPrice(contract: ContractTerms | null, prices: readonly MinimumPrice[]): MinimumPriceCheck {
  const waiting = (message: string): MinimumPriceCheck => ({ status: "waiting", message, minimum: null, contractPrice: null });
  if (!contract) return waiting("The sales contract isn't recorded yet, so its price can't be checked.");

  const missing = [
    contract.unitPrice ? null : "the unit price",
    contract.coffeeType ? null : "the coffee type (washed or unwashed)",
    contract.grade?.trim() ? null : "the grade",
  ].filter((m): m is string => m !== null);
  const { unitPrice, coffeeType, grade } = contract;
  if (missing.length || !unitPrice || !coffeeType || !grade) {
    const needs = missing.length > 1 ? `${missing.slice(0, -1).join(", ")} and ${missing.at(-1)}` : missing[0];
    return waiting(`The sales contract needs ${needs} before its price can be checked.`);
  }

  const lot = { coffeeType, grade: grade.trim(), origin: contract.origin?.trim() || null };
  const minimum = inForce(prices, lot, contract.contractDate);
  if (!minimum) {
    return {
      status: "no_price",
      message: `No minimum price on file for ${describeLot(lot)}, on ${contract.contractDate}.`,
      minimum: null,
      contractPrice: null,
    };
  }

  const where = `in force on ${contract.contractDate} (${describeLot(minimum)}, set for ${minimum.effectiveFrom} to ${minimum.effectiveTo})`;
  if (unitPrice.currency !== minimum.currency) {
    return {
      status: "not_comparable",
      message: `The contract is priced in ${unitPrice.currency} but the minimum export price ${where} is in ${minimum.currency}, so they can't be compared here.`,
      minimum,
      contractPrice: null,
    };
  }

  const converted = unitPrice.unit === minimum.unit ? unitPrice.amount : round4((unitPrice.amount * KG_PER_UNIT[minimum.unit]) / KG_PER_UNIT[unitPrice.unit]);
  const contractText =
    unitPrice.unit === minimum.unit
      ? priceText(unitPrice.amount, unitPrice.currency, unitPrice.unit)
      : `${priceText(unitPrice.amount, unitPrice.currency, unitPrice.unit)} (${priceText(converted, minimum.currency, minimum.unit)})`;
  const below = converted < minimum.minPrice;
  return {
    status: below ? "below" : "met",
    message: `The contract price of ${contractText} is ${below ? "below" : "at or above"} the minimum export price of ${priceText(minimum.minPrice, minimum.currency, minimum.unit)} ${where}.`,
    minimum,
    contractPrice: converted,
  };
}
