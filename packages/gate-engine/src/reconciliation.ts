import {
  BULK_GOODS,
  DOCUMENT_FIELDS,
  RECONCILIATION_DOCUMENTS,
  type DocumentFieldDefinition,
  type DocumentFieldKey,
  type ReconciliationDocument,
} from "@entrust/rules";
import { evaluateCondition } from "./conditions";
import { KG_PER_UNIT, parsePriceUnit, type PriceUnit } from "./minimum-price";
import type { CaseFacts } from "./types";

// The shipping document comparison (#12, STEP-099). A person enters the fields from each document
// (there is no OCR yet) and this compares them: every field that two or more documents carry must
// agree, the quantity within its UCP 600 tolerance, plus two rules from the bank side. Pure, like
// the rest of the engine: the API loads the entered values and passes them in.

/** What was entered from one document, by field. A field the document doesn't show is left out. */
export type DocumentValues = Partial<Record<DocumentFieldKey, string>>;

/** What was entered for a case, by document (an evidence type id). */
export type CaseDocuments = Readonly<Record<string, DocumentValues | undefined>>;

export interface ReconciliationInput {
  facts: CaseFacts;
  documents: CaseDocuments;
}

/**
 * - differs: the documents give different values
 * - outside_tolerance: quantities that differ by more than the tolerance allows
 * - rule: a rule from the bank side is broken (the B/L's consignee, the invoice against the permit)
 */
export interface ReconciliationMismatch {
  field: DocumentFieldKey;
  label: string;
  kind: "differs" | "outside_tolerance" | "rule";
  /** The documents involved, with what each says. */
  documents: { document: string; name: string; value: string }[];
  message: string;
}

/** A document that is needed and isn't complete. */
export interface MissingDocument {
  document: string;
  name: string;
  /** True when nothing has been entered from it. */
  empty: boolean;
  /** The fields that must be entered and aren't. */
  fields: DocumentFieldKey[];
}

/**
 * - waiting: documents or fields are still to be entered, or nothing could be compared yet
 * - mismatch: at least one difference
 * - clear: everything needed is entered and nothing differs
 */
export type ReconciliationStatus = "waiting" | "mismatch" | "clear";

export interface Reconciliation {
  status: ReconciliationStatus;
  message: string;
  mismatches: ReconciliationMismatch[];
  missing: MissingDocument[];
  /** How many fields were compared, because two or more documents have them. */
  compared: number;
  /** The quantity tolerance in use, and where it comes from. */
  tolerance: { percent: number; basis: string };
  /** Things that were left out of the comparison, such as quantities in different units. */
  notes: string[];
}

// ---- Reading values ----

const FIELDS = new Map(DOCUMENT_FIELDS.map((f) => [f.key, f]));

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** Words only: no case, accents or punctuation. */
const words = (text: string) => plain(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
/** Letters and digits only. */
const alnum = (text: string) => plain(text).replace(/[^\p{L}\p{N}]+/gu, "");

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;

const WEIGHT_UNITS: Record<string, PriceUnit> = {
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  mt: "mt", mts: "mt", tonne: "mt", tonnes: "mt", "metric ton": "mt", "metric tons": "mt", "metric tonne": "mt", "metric tonnes": "mt",
};

interface Measure {
  amount: number;
  /** A weight unit, or the name of a packing unit (bag, carton). */
  unit: string;
  /** The amount in kilograms, for weight units. */
  kg: number | undefined;
}

function parseNumber(text: string): number | undefined {
  if (!/^(\d[\d,]*(\.\d+)?|\.\d+)$/.test(text)) return undefined;
  const number = Number(text.replaceAll(",", ""));
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parseMeasure(raw: string): Measure | undefined {
  const match = /^\s*([\d,]*\.?\d+)\s*(\p{L}.*?)\s*$/u.exec(raw);
  const amount = match?.[1] ? parseNumber(match[1]) : undefined;
  const unitText = match?.[2] ? words(match[2]) : "";
  if (amount === undefined || !unitText) return undefined;
  const weight = WEIGHT_UNITS[unitText];
  if (weight) return { amount, unit: weight, kg: amount * KG_PER_UNIT[weight] };
  // A packing unit: bag and bags are the same.
  return { amount, unit: unitText.replace(/s$/, ""), kg: undefined };
}

interface Price {
  currency: string;
  /** The price per kilogram, to compare prices quoted per kg, lb or mt. */
  perKg: number;
}

function parseUnitPrice(raw: string): Price | undefined {
  const match = /^\s*([\d,]*\.?\d+)\s+(.+?)\s*$/.exec(raw);
  const amount = match?.[1] ? parseNumber(match[1]) : undefined;
  const unit = match?.[2] ? parsePriceUnit(match[2]) : undefined;
  if (amount === undefined || !unit) return undefined;
  return { currency: unit.currency, perKg: amount / KG_PER_UNIT[unit.unit] };
}

function parseAmount(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^[\d,]*\.?\d+$/.test(text) || /\.\d{5,}$/.test(text)) return undefined;
  return parseNumber(text);
}

function parseDate(raw: string): string | undefined {
  const day = raw.trim();
  // The round trip catches dates that don't exist, such as 2026-02-30.
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day ? day : undefined;
}

const digitsOf = (raw: string) => (/^[\d.\s-]+$/.test(raw.trim()) ? raw.replace(/\D/g, "") : undefined);

// Items are separated by commas, semicolons, slashes or line breaks; a space belongs to the number (TCLU 7654321).
const codeList = (raw: string) => [...new Set(raw.split(/[,;/\n]+/).map(alnum).filter(Boolean))].sort();

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
/** A country by its English name, from a name or an ISO alpha-2 code. */
function countryName(raw: string): string {
  const text = raw.trim();
  if (/^[A-Za-z]{2}$/.test(text)) {
    try {
      const name = regionNames.of(text.toUpperCase());
      if (name && name !== text.toUpperCase()) return words(name);
    } catch {
      // Not a region code: compare it as written.
    }
  }
  return words(text);
}

type Tolerance = { kind: "about" } | { kind: "percent"; percent: number } | { kind: "none" } | { kind: "not_stated" };

/** What a letter of credit says about the quantity. */
function parseTolerance(raw: string): Tolerance | undefined {
  const text = words(raw);
  if (["about", "approximately", "circa"].includes(text)) return { kind: "about" };
  if (["none", "exact", "no tolerance"].includes(text)) return { kind: "none" };
  if (["not stated", "default"].includes(text)) return { kind: "not_stated" };
  const match = /^(?:\+\s*\/?\s*-|±|plus or minus)?\s*(\d+(?:\.\d+)?)\s*%?$/.exec(plain(raw).trim());
  const percent = match?.[1] ? Number(match[1]) : Number.NaN;
  return percent >= 0 && percent <= 100 ? { kind: "percent", percent } : undefined;
}

/**
 * Check a value entered for a field, and return it trimmed. Throws a RangeError saying what is
 * wrong, so a mistake is caught when it is typed in and not as a mismatch later.
 */
export function checkDocumentValue(key: DocumentFieldKey, raw: string): string {
  const field = FIELDS.get(key);
  if (!field) throw new RangeError(`${key} is not a document field.`);
  const value = raw.trim();
  const refuse = (expected: string) => new RangeError(`${field.label}: "${value}" isn't ${expected}.`);
  if (!value) throw new RangeError(`${field.label} is empty.`);
  if (value.length > 500) throw new RangeError(`${field.label} is too long.`);

  switch (field.kind) {
    case "text":
      break;
    case "code":
      if (!alnum(value)) throw refuse("a reference");
      break;
    case "codes":
      if (codeList(value).length === 0) throw refuse("a list of numbers");
      break;
    case "hs_code": {
      const digits = digitsOf(value);
      if (!digits || digits.length < 6 || digits.length > 12) throw refuse("an HS code of 6 to 12 digits");
      break;
    }
    case "date":
      if (!parseDate(value)) throw refuse("a date. Use YYYY-MM-DD");
      break;
    case "count":
      if (!/^\d[\d,]*$/.test(value) || !parseNumber(value)) throw refuse("a whole number");
      break;
    case "quantity":
      if (!parseMeasure(value)) throw refuse("a quantity with its unit, such as 19200 kg or 320 bags");
      break;
    case "weight":
      if (parseMeasure(value)?.kg === undefined) throw refuse("a weight with its unit, such as 19200 kg");
      break;
    case "price":
      if (!parseUnitPrice(value)) throw refuse("a unit price, such as 6.80 USD/kg");
      break;
    case "amount":
      if (parseAmount(value) === undefined) throw refuse("an amount, such as 47040.00");
      break;
    case "currency":
      if (!/^[A-Za-z]{3}$/.test(value)) throw refuse("a currency code, such as USD");
      break;
    case "country":
      if (words(value).length < 2) throw refuse("a country");
      break;
    case "tolerance":
      if (!parseTolerance(value)) throw refuse('a percentage, "about", "none" or "not stated"');
      break;
  }
  return value;
}

// ---- The tolerance ----

export const ABOUT_TOLERANCE_PERCENT = 10;
export const BULK_TOLERANCE_PERCENT = 5;

function toleranceOf(facts: CaseFacts, documents: CaseDocuments): Reconciliation["tolerance"] {
  const stated = documents.letter_of_credit?.quantityTolerance;
  const parsed = stated ? parseTolerance(stated) : undefined;
  if (parsed?.kind === "about") return { percent: ABOUT_TOLERANCE_PERCENT, basis: 'the letter of credit says "about" (UCP 600 Art. 30(a))' };
  if (parsed?.kind === "percent") return { percent: parsed.percent, basis: `the letter of credit states ${parsed.percent}%` };
  if (parsed?.kind === "none") return { percent: 0, basis: "the letter of credit fixes the quantity" };
  if (evaluateCondition(BULK_GOODS, facts) === true) {
    return { percent: BULK_TOLERANCE_PERCENT, basis: "bulk goods (UCP 600 Art. 30(b))" };
  }
  return { percent: 0, basis: "the goods are sold in packs, so the count has to match" };
}

// ---- The comparison ----

interface Entry {
  document: string;
  name: string;
  value: string;
}

const list = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items.at(-1)}` : (items[0] ?? "");
const quoted = (entries: readonly Entry[]) => entries.map((e) => `${e.name} "${e.value}"`).join("; ");

/** The key two values must share to agree, for the fields compared by equality. */
function agreementKey(field: DocumentFieldDefinition, raw: string): string {
  switch (field.kind) {
    case "code":
      return alnum(raw);
    case "codes":
      return codeList(raw).join("|");
    case "date":
      return parseDate(raw) ?? raw.trim();
    case "count":
      return String(parseNumber(raw.trim()) ?? raw.trim());
    case "currency":
      return raw.trim().toUpperCase();
    case "country":
      return countryName(raw);
    case "weight":
      return String(round(parseMeasure(raw)?.kg ?? Number.NaN, 3));
    case "price": {
      const price = parseUnitPrice(raw);
      return price ? `${price.currency} ${round(price.perKg, 4)}` : raw.trim();
    }
    case "amount":
      return String(round(parseAmount(raw) ?? Number.NaN, 2));
    default:
      return words(raw);
  }
}

/** HS codes agree when the shorter is the start of the longer: 090111 and 09011100. */
function hsAgree(entries: readonly Entry[]): boolean {
  const codes = entries.map((e) => digitsOf(e.value) ?? "").toSorted((a, b) => b.length - a.length);
  const longest = codes[0] ?? "";
  return codes.every((code) => longest.startsWith(code));
}

/** Quantities and net weights, compared in kilograms within the tolerance, or by count in the same packing unit. */
function compareQuantities(
  field: DocumentFieldDefinition,
  entries: readonly Entry[],
  tolerance: Reconciliation["tolerance"],
  notes: string[],
): { compared: boolean; mismatch?: ReconciliationMismatch } {
  const measured = entries.flatMap((entry) => {
    const measure = parseMeasure(entry.value);
    return measure ? [{ entry, measure, base: measure.kg === undefined ? measure.unit : "kg" }] : [];
  });
  const bases = [...new Set(measured.map((m) => m.base))];
  if (bases.length > 1) {
    notes.push(`${field.label}: ${quoted(entries)} are in different units, so they weren't compared.`);
  }
  const group = bases.map((base) => measured.filter((m) => m.base === base)).find((g) => g.length > 1);
  if (!group) return { compared: false };

  const amountOf = (m: (typeof group)[number]) => m.measure.kg ?? m.measure.amount;
  const reference = group[0];
  if (!reference) return { compared: false };
  // Packing units have no tolerance: the count on each document has to match.
  const percent = reference.base === "kg" ? tolerance.percent : 0;
  const outside = group.filter((m) => {
    const difference = Math.abs(amountOf(m) - amountOf(reference));
    return percent === 0 ? difference > 0.0005 : (difference / amountOf(reference)) * 100 > percent + 1e-9;
  });
  if (outside.length === 0) return { compared: true };

  const involved = [reference, ...outside].map((m) => m.entry);
  const withTolerance = percent > 0;
  return {
    compared: true,
    mismatch: {
      field: field.key,
      label: field.label,
      kind: withTolerance ? "outside_tolerance" : "differs",
      documents: involved,
      message: withTolerance
        ? `${field.label} is outside the ±${percent}% tolerance (${tolerance.basis}): ${quoted(involved)}.`
        : `${field.label} differs: ${quoted(involved)}.`,
    },
  };
}

function compareField(
  field: DocumentFieldDefinition,
  entries: readonly Entry[],
  tolerance: Reconciliation["tolerance"],
  notes: string[],
): { compared: boolean; mismatch?: ReconciliationMismatch } {
  if (field.tolerance) return compareQuantities(field, entries, tolerance, notes);
  const agree =
    field.kind === "hs_code" ? hsAgree(entries) : new Set(entries.map((e) => agreementKey(field, e.value))).size === 1;
  if (agree) return { compared: true };
  return {
    compared: true,
    mismatch: { field: field.key, label: field.label, kind: "differs", documents: [...entries], message: `${field.label} differs: ${quoted(entries)}.` },
  };
}

/** Whether a document is needed on this case. A condition that isn't known yet counts as needed. */
export function isDocumentRequired(document: ReconciliationDocument, facts: CaseFacts): boolean {
  return !document.requiredWhen || evaluateCondition(document.requiredWhen.condition, facts) !== false;
}

/** The fields that have to be entered from a document on this case. */
export function requiredFieldsOf(document: ReconciliationDocument, facts: CaseFacts): DocumentFieldKey[] {
  return (document.requires ?? [])
    .filter((r) => !r.when || evaluateCondition(r.when.condition, facts) !== false)
    .flatMap((r) => r.fields);
}

/**
 * Compare the shipping documents' fields. Each field that two or more documents carry must agree:
 * text without regard to case, accents or punctuation; the quantity and net weight within the
 * tolerance (5% for bulk goods, 10% where the letter of credit says "about", or what it states,
 * UCP 600 Art. 30); everything else exactly. On top of that: under a letter of credit or CAD the
 * bill of lading is made out to the order of a bank (NBE FXD/01/2024, Annex One 1.3.7(a)), and
 * the invoice total can't exceed the bank permit's value.
 *
 * The result is clear only when every document the case needs has its fields entered. Nothing
 * entered is not the same as nothing wrong.
 */
export function reconcileDocuments({ facts, documents }: ReconciliationInput): Reconciliation {
  const valueOf = (document: string, key: DocumentFieldKey): string | undefined => documents[document]?.[key]?.trim() || undefined;
  const tolerance = toleranceOf(facts, documents);
  const byBank = evaluateCondition({ fact: "paymentTerms", in: ["lc", "cad"] }, facts) === true;
  const mode = typeof facts.transportMode === "string" ? facts.transportMode.trim().toLowerCase() : undefined;

  const mismatches: ReconciliationMismatch[] = [];
  const notes: string[] = [];
  let compared = 0;

  for (const field of DOCUMENT_FIELDS) {
    // Compared by the rules below, not by equality.
    if (field.kind === "tolerance" || field.key === "totalValue") continue;
    const entries = RECONCILIATION_DOCUMENTS.flatMap((document): Entry[] => {
      const value = valueOf(document.id, field.key);
      if (!value || !document.fields.includes(field.key)) return [];
      // Under an LC or CAD the bill of lading names a bank, and the rule below checks that.
      if (byBank && document.id === "transport_document" && field.key === "consignee") return [];
      return [{ document: document.id, name: document.name, value }];
    });
    if (entries.length < 2) continue;
    const result = compareField(field, entries, tolerance, notes);
    if (result.compared) compared += 1;
    if (result.mismatch) mismatches.push(result.mismatch);
  }

  const transport = RECONCILIATION_DOCUMENTS.find((d) => d.id === "transport_document");
  const consignee = valueOf("transport_document", "consignee");
  if (byBank && transport && consignee) {
    compared += 1;
    const text = words(consignee);
    const namesBank = /\b(bank|banque|banco)\b/.test(text);
    const toOrder = /\border\b/.test(text);
    const needsOrder = mode === "sea";
    if (!namesBank || (needsOrder && !toOrder)) {
      const label = DOCUMENT_FIELDS.find((f) => f.key === "consignee")?.label ?? "Consignee";
      mismatches.push({
        field: "consignee",
        label,
        kind: "rule",
        documents: [{ document: transport.id, name: transport.name, value: consignee }],
        message: `The consignee on the ${transport.name.toLowerCase()} reads "${consignee}", but under a letter of credit or CAD it must be made out ${needsOrder ? "to the order of a bank" : "to a bank"} (NBE FXD/01/2024, Annex One 1.3.7(a)).`,
      });
    }
  }

  const invoice = valueOf("final_commercial_invoice", "totalValue");
  const permit = valueOf("bank_export_permit", "totalValue");
  const invoiceTotal = invoice ? parseAmount(invoice) : undefined;
  const permitValue = permit ? parseAmount(permit) : undefined;
  if (invoice && permit && invoiceTotal !== undefined && permitValue !== undefined) {
    compared += 1;
    const invoiceCurrency = valueOf("final_commercial_invoice", "currency");
    const permitCurrency = valueOf("bank_export_permit", "currency");
    const sameCurrency = invoiceCurrency && permitCurrency ? invoiceCurrency.toUpperCase() === permitCurrency.toUpperCase() : true;
    // Different currencies are a mismatch of their own, and the amounts can't be compared.
    if (sameCurrency && round(invoiceTotal, 2) > round(permitValue, 2)) {
      const documents = ["final_commercial_invoice", "bank_export_permit"].map((id) => ({
        document: id,
        name: RECONCILIATION_DOCUMENTS.find((d) => d.id === id)?.name ?? id,
        value: id === "bank_export_permit" ? permit : invoice,
      }));
      mismatches.push({
        field: "totalValue",
        label: "Total value",
        kind: "rule",
        documents,
        message: `The invoice total ${invoice} is above the bank permit value ${permit}.`,
      });
    }
  }

  const missing: MissingDocument[] = RECONCILIATION_DOCUMENTS.flatMap((document) => {
    if (!isDocumentRequired(document, facts)) return [];
    const empty = !document.fields.some((key) => valueOf(document.id, key));
    const fields = requiredFieldsOf(document, facts).filter((key) => !valueOf(document.id, key));
    return empty || fields.length ? [{ document: document.id, name: document.name, empty, fields }] : [];
  });

  const status: ReconciliationStatus = mismatches.length ? "mismatch" : missing.length || compared === 0 ? "waiting" : "clear";
  return { status, message: messageOf(status, mismatches, missing, compared, tolerance), mismatches, missing, compared, tolerance, notes };
}

function messageOf(
  status: ReconciliationStatus,
  mismatches: readonly ReconciliationMismatch[],
  missing: readonly MissingDocument[],
  compared: number,
  tolerance: Reconciliation["tolerance"],
): string {
  if (status === "mismatch") {
    return `The shipping documents don't agree on ${list(mismatches.map((m) => m.label))}. ${mismatches.map((m) => m.message).join(" ")}`;
  }
  if (status === "waiting") {
    if (missing.length === 0) return "No field appears on two documents yet, so there is nothing to compare.";
    const label = (key: DocumentFieldKey) => FIELDS.get(key)?.label.toLowerCase() ?? key;
    const items = missing.map((m) => (m.empty ? m.name : `${m.name} (${list(m.fields.map(label))})`));
    return `Fields are still to be entered from: ${list(items)}.`;
  }
  const quantity = tolerance.percent > 0 ? ` Quantities may differ by ${tolerance.percent}% (${tolerance.basis}).` : "";
  return `${compared} fields compared across the documents, and they agree.${quantity}`;
}
