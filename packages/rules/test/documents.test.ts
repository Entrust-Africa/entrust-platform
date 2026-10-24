import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FIELDS,
  DOCUMENT_FIELD_KEYS,
  EVIDENCE_TYPES,
  FACTS,
  RECONCILIATION_DOCUMENTS,
  validateDocuments,
} from "../src";

describe("the shipping document comparison data", () => {
  it("defines the 24 points once each, in order, and the LC's quantity tolerance on top", () => {
    expect(DOCUMENT_FIELDS.map((f) => f.key)).toEqual([...DOCUMENT_FIELD_KEYS]);
    expect(DOCUMENT_FIELDS.filter((f) => f.number !== null).map((f) => f.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(DOCUMENT_FIELDS.filter((f) => f.number === null).map((f) => f.key)).toEqual(["quantityTolerance"]);
  });

  it("names the points the issue lists", () => {
    const label = (n: number) => DOCUMENT_FIELDS.find((f) => f.number === n)?.label;
    expect([label(1), label(6), label(9), label(12), label(17), label(19), label(23), label(24)]).toEqual([
      "Exporter name and address", "HS code", "Gross weight", "Container numbers", "B/L or AWB date (shipped on board)",
      "Unit price", "LC or collection reference", "Country of origin",
    ]);
  });

  it("is consistent: known fields and evidence types, and requirements a document can meet", () => {
    expect(validateDocuments(DOCUMENT_FIELDS, RECONCILIATION_DOCUMENTS, EVIDENCE_TYPES, FACTS)).toEqual([]);
  });

  it("uses the documents the issue lists, plus the permit and the letter of credit the rules read", () => {
    expect(RECONCILIATION_DOCUMENTS.filter((d) => d.role === "shipping").map((d) => d.id)).toEqual([
      "final_commercial_invoice", "final_packing_list", "transport_document", "certificate_of_origin", "phytosanitary_certificate", "quality_certificate",
    ]);
    expect(RECONCILIATION_DOCUMENTS.filter((d) => d.role === "reference").map((d) => d.id)).toEqual(["bank_export_permit", "letter_of_credit"]);
  });

  it("catches a field defined twice, a document that carries or requires what it can't, and an unknown document", () => {
    const [first, ...rest] = DOCUMENT_FIELDS;
    const [invoice, ...others] = RECONCILIATION_DOCUMENTS;
    if (!first || !invoice) throw new Error("no data");
    const errors = validateDocuments(
      [first, first, ...rest.filter((f) => f.key !== "buyer")],
      [
        { ...invoice, fields: [...invoice.fields, "exporter"], requires: [{ fields: ["sealNumbers"] }] },
        { ...invoice, id: "not_a_document", fields: ["bogus" as never] },
        ...others,
      ],
      EVIDENCE_TYPES,
      FACTS,
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        "exporter: duplicate field",
        "buyer: not defined",
        "final_commercial_invoice: lists exporter twice",
        "final_commercial_invoice: requires sealNumbers, which it doesn't carry",
        "not_a_document: not an evidence type",
        "not_a_document: carries unknown field bogus",
      ]),
    );
  });

  it("catches a gap in the numbering and a field no document carries", () => {
    const errors = validateDocuments(
      DOCUMENT_FIELDS.map((f) => (f.number === 5 ? { ...f, number: 7 } : f)),
      RECONCILIATION_DOCUMENTS.map((d) => ({ ...d, fields: d.fields.filter((f) => f !== "sealNumbers") })),
      EVIDENCE_TYPES,
      FACTS,
    );
    expect(errors).toContain("sealNumbers: no document carries it");
    expect(errors.some((e) => e.startsWith("The field numbers are"))).toBe(true);
  });
});
