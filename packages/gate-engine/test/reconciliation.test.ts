import { DOCUMENT_FIELDS, RECONCILIATION_DOCUMENTS } from "@entrust/rules";
import { describe, expect, it } from "vitest";
import { checkDocumentValue, reconcileDocuments, type CaseDocuments, type CaseFacts, type DocumentValues } from "../src";

const INV = "final_commercial_invoice";
const PL = "final_packing_list";
const BL = "transport_document";
const COO = "certificate_of_origin";
const QC = "quality_certificate";
const PHYTO = "phytosanitary_certificate";
const PERMIT = "bank_export_permit";
const LC = "letter_of_credit";

const FACTS: CaseFacts = {
  product: "green_coffee",
  destinationCountry: "US",
  transportMode: "sea",
  paymentTerms: ["advance_tt"],
  phytoCertificateRequired: "no",
};

/** A complete set of documents that agree, written the way each document would write it. */
const agreeing = (): Record<string, DocumentValues> => ({
  [INV]: {
    exporter: "Zebu Coffee PLC, Bole, Addis Ababa",
    consignee: "Buyer GmbH, Hamburg",
    goodsDescription: "Green coffee, Yirgacheffe, grade 1",
    hsCode: "0901.11.00",
    quantity: "19200 kg",
    netWeight: "19200 kg",
    grossWeight: "19500 kg",
    packages: "320",
    containerNumbers: "MSKU1234567, TCLU7654321",
    portOfLoading: "Djibouti",
    shippedOnBoardDate: "2026-03-05",
    invoiceReference: "INV-0042 2026-03-01",
    unitPrice: "6.80 USD/kg",
    totalValue: "130,560.00",
    currency: "USD",
    countryOfOrigin: "Ethiopia",
  },
  [PL]: {
    exporter: "ZEBU COFFEE PLC Bole Addis Ababa",
    consignee: "Buyer GmbH Hamburg",
    goodsDescription: "Green Coffee - Yirgacheffe - Grade 1",
    hsCode: "090111",
    quantity: "19.2 mt",
    netWeight: "19200 kgs",
    grossWeight: "19.5 mt",
    packages: "320",
    containerNumbers: "TCLU 7654321, MSKU 1234567",
    portOfLoading: "DJIBOUTI",
    shippedOnBoardDate: "2026-03-05",
    invoiceReference: "INV-0042, 2026-03-01",
    countryOfOrigin: "ET",
  },
  [BL]: {
    consignee: "Buyer GmbH, Hamburg",
    grossWeight: "19500 kg",
    packages: "320",
    containerNumbers: "MSKU1234567; TCLU7654321",
    portOfLoading: "Djibouti",
    shippedOnBoardDate: "2026-03-05",
  },
  [COO]: { exporter: "Zebu Coffee PLC, Bole, Addis Ababa", shippedOnBoardDate: "2026-03-05", countryOfOrigin: "Ethiopia", invoiceReference: "INV-0042 / 2026-03-01" },
  [QC]: { goodsDescription: "Green coffee, Yirgacheffe, grade 1", netWeight: "19200 kg" },
  [PERMIT]: { totalValue: "135000.00", currency: "usd" },
});

const run = (documents: CaseDocuments = agreeing(), facts: CaseFacts = FACTS) => reconcileDocuments({ facts, documents });
/** The agreeing set with changes: a document's values replace the original's, field by field. */
const changed = (changes: Record<string, DocumentValues>): CaseDocuments => {
  const set = agreeing();
  for (const [id, values] of Object.entries(changes)) set[id] = { ...set[id], ...values };
  return set;
};
const labels = (r: ReturnType<typeof run>) => r.mismatches.map((m) => m.label);

describe("documents that agree", () => {
  it("come out clear, however each one writes the same thing", () => {
    const result = run();
    expect(result).toMatchObject({ status: "clear", mismatches: [], missing: [], notes: [] });
    expect(result.compared).toBeGreaterThan(12);
    expect(result.message).toMatch(/fields compared across the documents, and they agree\. Quantities may differ by 5% \(bulk goods/);
  });

  it("ignore case, accents and punctuation in names, but not in what they say", () => {
    expect(run(changed({ [PL]: { consignee: "BUYER  GmbH – Hamburg" } })).status).toBe("clear");
    expect(run(changed({ [PL]: { consignee: "Büyer GmbH Hamburg" } })).status).toBe("clear");
    expect(labels(run(changed({ [PL]: { consignee: "Buyer AG, Hamburg" } })))).toEqual(["Consignee"]);
  });
});

describe("a difference", () => {
  it("is reported with the field, the documents and what each says", () => {
    const result = run(changed({ [PL]: { goodsDescription: "Roasted coffee, grade 1" } }));
    expect(result.status).toBe("mismatch");
    expect(result.mismatches).toHaveLength(1);
    const [mismatch] = result.mismatches;
    expect(mismatch).toMatchObject({ field: "goodsDescription", label: "Goods description", kind: "differs" });
    expect(mismatch?.documents).toEqual([
      { document: INV, name: "Commercial invoice", value: "Green coffee, Yirgacheffe, grade 1" },
      { document: PL, name: "Packing list", value: "Roasted coffee, grade 1" },
      { document: QC, name: "Quality certificate", value: "Green coffee, Yirgacheffe, grade 1" },
    ]);
    expect(mismatch?.message).toBe(
      'Goods description differs: Commercial invoice "Green coffee, Yirgacheffe, grade 1"; Packing list "Roasted coffee, grade 1"; Quality certificate "Green coffee, Yirgacheffe, grade 1".',
    );
    expect(result.message).toMatch(/^The shipping documents don't agree on Goods description\. Goods description differs/);
  });

  it("is reported once per field, and every field in the message", () => {
    const result = run(changed({ [PL]: { packages: "321", portOfLoading: "Berbera" } }));
    expect(labels(result)).toEqual(["Number of packages", "Port of loading"]);
    expect(result.message).toMatch(/don't agree on Number of packages and Port of loading\./);
  });

  it("takes an 8-digit HS code to match its 6-digit prefix, and nothing else", () => {
    expect(run(changed({ [PL]: { hsCode: "0901 11" } })).status).toBe("clear");
    expect(run(changed({ [PL]: { hsCode: "09011100" } })).status).toBe("clear");
    expect(labels(run(changed({ [PL]: { hsCode: "090121" } })))).toEqual(["HS code"]);
    expect(labels(run(changed({ [PL]: { hsCode: "09011200" } })))).toEqual(["HS code"]);
  });

  it("compares container and seal numbers as a set, in any order", () => {
    expect(run(changed({ [PL]: { sealNumbers: "S1, S2" }, [BL]: { sealNumbers: "s2, s1" } })).status).toBe("clear");
    expect(labels(run(changed({ [BL]: { containerNumbers: "MSKU1234567" } })))).toEqual(["Container numbers"]);
    expect(labels(run(changed({ [PL]: { sealNumbers: "S1, S2" }, [BL]: { sealNumbers: "S1" } })))).toEqual(["Seal numbers"]);
  });

  it("compares dates, countries, currencies and references on what they mean", () => {
    expect(run(changed({ [PL]: { countryOfOrigin: "Ethiopia" } })).status).toBe("clear"); // "ET" and "Ethiopia"
    expect(labels(run(changed({ [PL]: { countryOfOrigin: "Kenya" } })))).toEqual(["Country of origin"]);
    expect(labels(run(changed({ [PL]: { invoiceReference: "INV-0042 2026-03-02" } })))).toEqual(["Invoice number and date"]);
    expect(labels(run(changed({ [PERMIT]: { currency: "EUR" } })))).toEqual(["Currency"]);
    expect(labels(run(changed({ [BL]: { shippedOnBoardDate: "2026-04-01" } })))).toEqual(["B/L or AWB date (shipped on board)"]);
    expect(run(changed({ [BL]: { shippedOnBoardDate: "2026-03-05" } })).status).toBe("clear");
  });

  it("compares unit prices across kg, lb and mt", () => {
    const withPermitPrice = (unitPrice: string) => changed({ [PERMIT]: { unitPrice } });
    expect(run(withPermitPrice("6.8 USD/kg")).status).toBe("clear");
    expect(run(withPermitPrice("6800 USD/mt")).status).toBe("clear");
    expect(labels(run(withPermitPrice("6.79 USD/kg")))).toEqual(["Unit price"]);
    expect(labels(run(withPermitPrice("6.80 EUR/kg")))).toEqual(["Unit price"]);
    expect(run({ ...changed({ [INV]: { unitPrice: "2.00 USD/lb" } }), [PERMIT]: { ...agreeing()[PERMIT], unitPrice: "4.4092 USD/kg" } }).status).toBe("clear");
  });
});

describe("the quantity tolerance", () => {
  const packed = (quantity: string) => changed({ [PL]: { quantity } });

  it("is 5% for bulk goods, to the boundary", () => {
    expect(run(packed("20160 kg")).status).toBe("clear"); // +5%
    expect(run(packed("18240 kg")).status).toBe("clear"); // -5%
    const over = run(packed("20161 kg"));
    expect(over.mismatches[0]).toMatchObject({ field: "quantity", kind: "outside_tolerance" });
    expect(over.mismatches[0]?.message).toBe(
      'Quantity is outside the ±5% tolerance (bulk goods (UCP 600 Art. 30(b))): Commercial invoice "19200 kg"; Packing list "20161 kg".',
    );
    expect(run(packed("18239 kg")).status).toBe("mismatch");
  });

  it("applies to the net weight, and converts units first", () => {
    expect(run(changed({ [QC]: { netWeight: "19.9 mt" } })).status).toBe("clear");
    expect(run(changed({ [QC]: { netWeight: "44000 lb" } })).status).toBe("clear"); // 19958 kg
    expect(run(changed({ [QC]: { netWeight: "20.5 mt" } })).mismatches[0]).toMatchObject({ field: "netWeight", kind: "outside_tolerance" });
  });

  it("does not apply to the gross weight or the number of packages", () => {
    expect(labels(run(changed({ [BL]: { grossWeight: "19600 kg" } })))).toEqual(["Gross weight"]);
    expect(run(changed({ [PL]: { grossWeight: "19500.0004 kg" } })).status).toBe("clear");
  });

  it("is what the letter of credit says: about, a percentage, or no tolerance", () => {
    const facts: CaseFacts = { ...FACTS, paymentTerms: ["lc"] };
    const check = (tolerance: string, quantity: string) =>
      run({ ...changed({ [PL]: { quantity }, [BL]: { consignee: "To the order of Awash Bank" } }), [LC]: { quantityTolerance: tolerance } }, facts);

    expect(check("about", "21000 kg")).toMatchObject({ status: "clear", tolerance: { percent: 10 } });
    expect(check("About", "21200 kg").mismatches[0]?.message).toMatch(/±10% tolerance \(the letter of credit says "about" \(UCP 600 Art\. 30\(a\)\)\)/);
    expect(check("+/-3%", "19776 kg").status).toBe("clear");
    expect(check("±3 %", "19777 kg").status).toBe("mismatch");
    expect(check("3", "19776 kg").tolerance).toEqual({ percent: 3, basis: "the letter of credit states 3%" });
    expect(check("none", "19201 kg")).toMatchObject({ status: "mismatch", tolerance: { percent: 0 } });
    expect(check("none", "19201 kg").mismatches[0]).toMatchObject({ kind: "differs" });
    expect(check("not stated", "20160 kg")).toMatchObject({ status: "clear", tolerance: { percent: 5 } });
  });

  it("doesn't exist for goods sold in packs: the count has to match", () => {
    const roasted: CaseFacts = { ...FACTS, product: "roasted_coffee" };
    expect(run(packed("19201 kg"), roasted).mismatches[0]).toMatchObject({ field: "quantity", kind: "differs" });
    expect(run(packed("19200 kg"), roasted).status).toBe("clear");
    expect(run(packed("19201 kg"), { ...FACTS, product: "oilseeds_spices" }).status).toBe("clear"); // bulk
  });

  it("is not given to a quantity stated in packing units", () => {
    const bags = (invoice: string, packing: string) => changed({ [INV]: { quantity: invoice }, [PL]: { quantity: packing }, [BL]: { quantity: invoice } });
    expect(run(bags("320 bags", "320 Bag")).status).toBe("clear");
    expect(run(bags("320 bags", "321 bags")).mismatches[0]).toMatchObject({ field: "quantity", kind: "differs" });
  });

  it("leaves quantities in different units uncompared, and says so", () => {
    const result = run(changed({ [PL]: { quantity: "320 bags" } }));
    expect(result.status).toBe("clear");
    expect(result.notes).toEqual(['Quantity: Commercial invoice "19200 kg"; Packing list "320 bags" are in different units, so they weren\'t compared.']);
  });
});

describe("a bill of lading under a letter of credit or CAD", () => {
  const byLc: CaseFacts = { ...FACTS, paymentTerms: ["lc"] };
  const lcDocuments = (consignee: string, tolerance = "not stated") =>
    ({ ...changed({ [BL]: { consignee } }), [LC]: { quantityTolerance: tolerance } }) as CaseDocuments;

  it("must be made out to the order of a bank, and is not compared with the invoice's consignee", () => {
    for (const consignee of ["To the order of Commercial Bank of Ethiopia", "TO ORDER OF AWASH BANK S.C.", "Order of Banque Misr"]) {
      expect(run(lcDocuments(consignee), byLc), consignee).toMatchObject({ status: "clear", mismatches: [] });
    }
  });

  it("is refused when it names the buyer, or an order that isn't a bank's", () => {
    for (const consignee of ["Buyer GmbH, Hamburg", "To order of shipper", "Awash Bank"]) {
      const result = run(lcDocuments(consignee), byLc);
      expect(result.mismatches, consignee).toHaveLength(1);
      expect(result.mismatches[0]).toMatchObject({ field: "consignee", kind: "rule", documents: [{ document: BL, value: consignee }] });
    }
    expect(run(lcDocuments("Buyer GmbH"), byLc).mismatches[0]?.message).toBe(
      'The consignee on the bill of lading or air waybill reads "Buyer GmbH", but under a letter of credit or CAD it must be made out to the order of a bank (NBE FXD/01/2024, Annex One 1.3.7(a)).',
    );
  });

  it("applies to CAD too, and by air only needs to name a bank", () => {
    const cad: CaseFacts = { ...FACTS, paymentTerms: ["advance_tt", "cad"] };
    expect(run(lcDocuments("Buyer GmbH"), cad).mismatches).toHaveLength(1);
    expect(run(lcDocuments("Awash Bank"), cad).mismatches).toHaveLength(1);
    const byAir: CaseFacts = { ...cad, transportMode: "air" };
    expect(run(lcDocuments("Awash Bank"), byAir).status).toBe("clear");
    expect(run(lcDocuments("Buyer GmbH"), byAir).mismatches[0]?.message).toMatch(/must be made out to a bank/);
  });

  it("is compared with the invoice like any other consignee when the buyer pays in advance", () => {
    expect(labels(run(lcDocuments("To the order of Awash Bank"), FACTS))).toEqual(["Consignee"]);
    expect(run(changed({}), FACTS).status).toBe("clear");
  });

  it("must have its consignee entered, under an LC or CAD", () => {
    const documents = { ...changed({}), [LC]: { quantityTolerance: "none" } } as Record<string, DocumentValues>;
    documents[BL] = { ...documents[BL], consignee: undefined };
    const result = run(documents, byLc);
    expect(result.status).toBe("waiting");
    expect(result.missing).toEqual([{ document: BL, name: "Bill of lading or air waybill", empty: false, fields: ["consignee"] }]);
  });
});

describe("the invoice against the bank permit", () => {
  const total = (invoice: string, permit: string) => changed({ [INV]: { totalValue: invoice }, [PERMIT]: { totalValue: permit } });

  it("can't be above the permit value, and can be below it", () => {
    expect(run(total("130560.00", "130560.00")).status).toBe("clear");
    expect(run(total("100,000.50", "130560")).status).toBe("clear");
    const over = run(total("130560.01", "130560.00"));
    expect(over.mismatches).toHaveLength(1);
    expect(over.mismatches[0]).toMatchObject({ field: "totalValue", kind: "rule", label: "Total value" });
    expect(over.mismatches[0]?.message).toBe("The invoice total 130560.01 is above the bank permit value 130560.00.");
    expect(over.mismatches[0]?.documents.map((d) => [d.document, d.value])).toEqual([[INV, "130560.01"], [PERMIT, "130560.00"]]);
  });

  it("is not compared when the currencies differ, which is a mismatch of its own", () => {
    const result = run({ ...total("200000", "130560"), [PERMIT]: { totalValue: "130560", currency: "EUR" } });
    expect(labels(result)).toEqual(["Currency"]);
  });
});

describe("what is still to be entered", () => {
  it("keeps the audit waiting while nothing has been entered, naming each document", () => {
    const result = run({});
    expect(result).toMatchObject({ status: "waiting", compared: 0, mismatches: [] });
    expect(result.missing.map((m) => m.document)).toEqual([INV, PL, BL, COO, QC, PERMIT]);
    expect(result.message).toBe(
      "Fields are still to be entered from: Commercial invoice, Packing list, Bill of lading or air waybill, Certificate of origin, Quality certificate and Bank export permit.",
    );
  });

  it("wants the required fields of a document that has others entered", () => {
    const documents = changed({ [INV]: { totalValue: undefined, currency: undefined } });
    const result = run(documents);
    expect(result.status).toBe("waiting");
    expect(result.message).toBe("Fields are still to be entered from: Commercial invoice (total value and currency).");
  });

  it("wants the documents the case needs: the phytosanitary certificate when required, the letter of credit when paid by one", () => {
    expect(run(agreeing(), { ...FACTS, phytoCertificateRequired: "yes" }).missing.map((m) => m.document)).toEqual([PHYTO]);
    expect(run(agreeing(), { ...FACTS, phytoCertificateRequired: "no" }).missing).toEqual([]);
    // Not known yet counts as needed, so the audit doesn't pass on a guess.
    const unknown = { ...FACTS };
    delete unknown.phytoCertificateRequired;
    expect(run(agreeing(), unknown).missing.map((m) => m.document)).toEqual([PHYTO]);
    const lc = run(changed({ [BL]: { consignee: "To order of Awash Bank" } }), { ...FACTS, paymentTerms: ["lc"] });
    expect(lc.missing).toEqual([{ document: LC, name: "Letter of credit", empty: true, fields: ["quantityTolerance"] }]);
  });

  it("is clear once the phytosanitary certificate is entered and agrees", () => {
    const documents = changed({ [PHYTO]: { exporter: "Zebu Coffee PLC Bole Addis Ababa", netWeight: "19200 kg", countryOfOrigin: "Ethiopia" } });
    expect(run(documents, { ...FACTS, phytoCertificateRequired: "yes" }).status).toBe("clear");
  });

  it("still reports a difference while documents are missing", () => {
    const result = run({ [INV]: { quantity: "19200 kg" }, [PL]: { quantity: "9000 kg" } });
    expect(result.status).toBe("mismatch");
    expect(result.missing.length).toBeGreaterThan(0);
  });
});

describe("checking what is typed in", () => {
  const accepted: [string, string][] = [
    ["exporter", "Zebu Coffee PLC"], ["hsCode", "0901.11.00"], ["hsCode", "090111"], ["quantity", "19,200 kg"], ["quantity", "320 bags"],
    ["quantity", "19.2 MT"], ["netWeight", "19200 kg"], ["grossWeight", "42,328 lb"], ["packages", "320"], ["containerNumbers", "MSKU1234567, TCLU7654321"],
    ["shippedOnBoardDate", "2026-03-05"], ["unitPrice", "6.80 USD/kg"], ["unitPrice", "3 usd/lb"], ["totalValue", "130,560.00"], ["currency", "usd"],
    ["countryOfOrigin", "ET"], ["paymentReference", "LC-2026/114"], ["invoiceReference", "INV-0042 2026-03-01"],
    ["quantityTolerance", "about"], ["quantityTolerance", "+/-5%"], ["quantityTolerance", "none"], ["quantityTolerance", "not stated"],
  ];
  it.each(accepted)("accepts %s: %s", (field, value) => {
    expect(checkDocumentValue(field as never, `  ${value} `)).toBe(value);
  });

  const refused: [string, string, RegExp][] = [
    ["exporter", "   ", /is empty/],
    ["hsCode", "0901", /HS code of 6 to 12 digits/],
    ["hsCode", "coffee", /HS code/],
    ["quantity", "19200", /quantity with its unit/],
    ["quantity", "kg", /quantity with its unit/],
    ["netWeight", "320 bags", /weight with its unit/],
    ["grossWeight", "heavy", /weight with its unit/],
    ["packages", "3.5", /whole number/],
    ["packages", "0", /whole number/],
    ["containerNumbers", ",;", /list of numbers/],
    ["shippedOnBoardDate", "2026-02-30", /Use YYYY-MM-DD/],
    ["shippedOnBoardDate", "05/03/2026", /Use YYYY-MM-DD/],
    ["unitPrice", "6.80", /unit price, such as 6.80 USD\/kg/],
    ["unitPrice", "6.80 USD/bag", /unit price/],
    ["totalValue", "USD 100", /an amount/],
    ["totalValue", "100.123456", /an amount/],
    ["currency", "US", /currency code/],
    ["countryOfOrigin", "x", /a country/],
    ["country", "x", /not a document field/],
    ["quantityTolerance", "lots", /percentage, "about"/],
    ["quantityTolerance", "150%", /percentage, "about"/],
  ];
  it.each(refused)("refuses %s: %s", (field, value, message) => {
    expect(() => checkDocumentValue(field as never, value)).toThrow(RangeError);
    expect(() => checkDocumentValue(field as never, value)).toThrow(message);
  });

  it("names the field in the message", () => {
    expect(() => checkDocumentValue("netWeight", "320 bags")).toThrow('Net weight: "320 bags" isn\'t a weight with its unit, such as 19200 kg.');
  });
});

describe("the field matrix", () => {
  it("lets every field be compared, except the ones a single document has", () => {
    const carriers = (key: string) => RECONCILIATION_DOCUMENTS.filter((d) => d.fields.some((f) => f === key)).map((d) => d.id);
    const single = DOCUMENT_FIELDS.filter((f) => carriers(f.key).length < 2).map((f) => f.key);
    expect(single).toEqual(["quantityTolerance"]);
  });
});
