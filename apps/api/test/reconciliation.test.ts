import { asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FACTS, call, cleanup, createOrganization, db, markCompleted, signUp, type Json, type TestUser } from "./support";

// The shipping document comparison (STEP-099): people enter what each document says, the engine
// compares, CLEAR completes the step when everything agrees and FL-06 holds the bank handoff when
// it doesn't. The comparison's own rules are tested in the GATE engine; here the point is what the
// API does with them.
const w = {} as { owner: TestUser; other: TestUser; stranger: TestUser; admin: TestUser; facilitator: TestUser; reviewer: TestUser; org: string; org2: string };

const INV = "final_commercial_invoice";
const PL = "final_packing_list";
const BL = "transport_document";
const COO = "certificate_of_origin";
const QC = "quality_certificate";
const PHYTO = "phytosanitary_certificate";
const PERMIT = "bank_export_permit";
const LC = "letter_of_credit";

// Advance payment, no phytosanitary certificate: the documents the case needs are the invoice,
// packing list, bill of lading, certificate of origin, quality certificate and the permit.
const ADVANCE = { ...FACTS, paymentTerms: ["advance_tt"], phytoCertificateRequired: "no" };
const BY_CAD = { ...ADVANCE, paymentTerms: ["cad"] };
const BY_LC = { ...ADVANCE, paymentTerms: ["lc"] };

/** What each document says, in agreement. The bill of lading names the buyer unless it is given a bank. */
const documents = (consigneeOnBl = "Buyer GmbH, Hamburg"): Record<string, Record<string, string>> => ({
  [INV]: {
    exporter: "Zebu Coffee PLC, Bole, Addis Ababa",
    consignee: "Buyer GmbH, Hamburg",
    goodsDescription: "Green coffee, Yirgacheffe, grade 1",
    quantity: "19200 kg",
    netWeight: "19200 kg",
    grossWeight: "19500 kg",
    packages: "320",
    portOfLoading: "Djibouti",
    invoiceReference: "INV-0042 2026-03-01",
    totalValue: "130560.00",
    currency: "USD",
    countryOfOrigin: "Ethiopia",
  },
  [PL]: {
    exporter: "ZEBU COFFEE PLC Bole Addis Ababa",
    consignee: "Buyer GmbH Hamburg",
    goodsDescription: "Green Coffee - Yirgacheffe - Grade 1",
    quantity: "19.2 mt",
    netWeight: "19200 kg",
    grossWeight: "19500 kg",
    packages: "320",
    portOfLoading: "DJIBOUTI",
  },
  [BL]: { consignee: consigneeOnBl, grossWeight: "19.5 mt", packages: "320", portOfLoading: "Djibouti" },
  [COO]: { exporter: "Zebu Coffee PLC, Bole, Addis Ababa", countryOfOrigin: "ET", invoiceReference: "INV-0042, 2026-03-01" },
  [QC]: { goodsDescription: "Green coffee, Yirgacheffe, grade 1", netWeight: "19200 kg" },
  [PERMIT]: { totalValue: "135000.00", currency: "USD" },
});

const openCase = async (facts: object = ADVANCE) => {
  const res = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
};
const get = async (caseId: string, user = w.owner) => (await call(user, "GET", `/cases/${caseId}`)).body as Json;
const step = (detail: Json, id: string) => detail.workflow.steps.find((s: Json) => s.id === id);
const flagOf = (detail: Json, rule: string, status?: string) => detail.flags.find((f: Json) => f.rule === rule && (status === undefined || f.status === status));
const latestOf = (detail: Json, type: string) => detail.evidence.findLast((e: Json) => e.type === type);
const documentOf = (detail: Json, id: string) => detail.documents.find((d: Json) => d.document === id);

const enter = (user: TestUser | null, caseId: string, document: string, fields: object) =>
  call(user, "PUT", `/cases/${caseId}/documents/${document}/fields`, { fields });

/** Enters every document, returning the case as it ends up. */
async function enterAll(caseId: string, set: Record<string, Record<string, string>> = documents()): Promise<Json> {
  let detail: Json = {};
  for (const [document, fields] of Object.entries(set)) {
    const res = await enter(w.owner, caseId, document, fields);
    expect(res.status, `${document}: ${JSON.stringify(res.body)}`).toBe(200);
    detail = res.body;
  }
  return detail;
}

/** The steps the audit waits for, done, so the comparison is free to complete it. */
const finishPrerequisites = (caseId: string) =>
  markCompleted(caseId, ["STEP-050", "STEP-068", "STEP-069", "STEP-070", "STEP-094", "STEP-100", "STEP-101"]);

const auditOf = (caseId: string) =>
  db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, caseId)).orderBy(asc(schema.auditLog.occurredAt));
const eventsOf = (caseId: string) =>
  db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, caseId)).orderBy(asc(schema.caseEvent.recordedAt));

beforeAll(async () => {
  await cleanup();
  const [owner, other, stranger, admin, facilitator, reviewer] = await Promise.all(["owner", "other", "stranger", "admin", "facilitator", "reviewer"].map(signUp));
  Object.assign(w, { owner, other, stranger, admin, facilitator, reviewer });
  w.org = await createOrganization("org", [[owner!, "owner"], [other!, "member"]]);
  w.org2 = await createOrganization("org-2", [[stranger!, "owner"]]);
  const entrust = await createOrganization("entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = entrust;
});
afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("the fields and documents", () => {
  it("are listed for building the forms, for anyone signed in", async () => {
    const res = await call(w.owner, "GET", "/document-fields");
    expect(res.status).toBe(200);
    expect(res.body.fields).toHaveLength(25);
    expect(res.body.fields.filter((f: Json) => f.number !== null).map((f: Json) => f.number)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(res.body.fields.find((f: Json) => f.key === "quantity")).toMatchObject({ number: 7, label: "Quantity", kind: "quantity", tolerance: true });
    expect(res.body.documents.map((d: Json) => d.document)).toEqual([INV, PL, BL, COO, PHYTO, QC, PERMIT, LC]);
    expect(res.body.documents.find((d: Json) => d.document === PHYTO)).toMatchObject({ role: "shipping", requiredWhen: "A phytosanitary certificate is required" });
    expect(res.body.documents.find((d: Json) => d.document === BL).requires).toEqual([
      { fields: ["consignee"], when: "Payment is by letter of credit or cash against documents" },
    ]);
    expect((await call(null, "GET", "/document-fields")).status).toBe(401);
  });

  it("show on a new case as empty documents, with the comparison waiting for all of them", async () => {
    const created = await get(await openCase());
    expect(created.documents.map((d: Json) => [d.document, d.required, d.fields])).toEqual([
      [INV, true, {}], [PL, true, {}], [BL, true, {}], [COO, true, {}], [PHYTO, false, {}], [QC, true, {}], [PERMIT, true, {}], [LC, false, {}],
    ]);
    expect(created.reconciliation).toMatchObject({ status: "waiting", compared: 0, mismatches: [] });
    expect(created.reconciliation.message).toMatch(/^Fields are still to be entered from: Commercial invoice, Packing list/);
    expect(step(created, "STEP-099")).toMatchObject({ owner: "system", status: "blocked" }); // its prerequisites come first
    expect(step(created, "STEP-099").warnings).toContain(created.reconciliation.message);
    expect(created.flags).toEqual([]);
  });
});

describe("entering what a document says", () => {
  it("keeps the values, trimmed, and shows them with the document", async () => {
    const id = await openCase();
    const res = await enter(w.owner, id, INV, { quantity: "  19200 kg ", totalValue: "130,560.00", currency: "usd" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(documentOf(res.body, INV).fields).toEqual({ quantity: "19200 kg", totalValue: "130,560.00", currency: "usd" });
    const rows = await db.select().from(schema.documentField).where(eq(schema.documentField.caseId, id));
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.enteredByUserId === w.owner.id)).toBe(true);
  });

  it("writes each change to the audit log and the case history, and ignores a repeat", async () => {
    const id = await openCase();
    expect((await enter(w.owner, id, PL, { packages: "320", portOfLoading: "Djibouti" })).status).toBe(200);
    expect((await enter(w.owner, id, PL, { packages: "320" })).status).toBe(200); // the same again

    const changed = await enter(w.other, id, PL, { packages: "321", portOfLoading: null });
    expect(documentOf(changed.body, PL).fields).toEqual({ packages: "321" });

    const recorded = (await auditOf(id)).filter((a) => a.action === "case.document_fields_recorded");
    expect(recorded).toHaveLength(2);
    expect(recorded[0]).toMatchObject({
      actorUserId: w.owner.id, organizationId: w.org, before: { document: PL, fields: { packages: null, portOfLoading: null } },
      after: { document: PL, fields: { packages: "320", portOfLoading: "Djibouti" } },
    });
    expect(recorded[1]).toMatchObject({
      actorUserId: w.other.id, before: { document: PL, fields: { packages: "320", portOfLoading: "Djibouti" } }, after: { document: PL, fields: { packages: "321", portOfLoading: null } },
    });
    const events = (await eventsOf(id)).filter((e) => e.type === "document_fields_recorded");
    expect(events.map((e) => e.data)).toEqual([
      { document: PL, set: ["packages", "portOfLoading"], cleared: [] },
      { document: PL, set: ["packages"], cleared: ["portOfLoading"] },
    ]);
  });

  it("refuses a value that isn't what the field should hold, saying which", async () => {
    const id = await openCase();
    const bad = await enter(w.owner, id, INV, { netWeight: "320 bags", shippedOnBoardDate: "2026-02-30", currency: "dollars", quantity: "19200 kg" });
    expect(bad.status).toBe(422);
    expect(bad.body.error).toContain('Net weight: "320 bags" isn\'t a weight with its unit, such as 19200 kg.');
    expect(bad.body.error).toContain('B/L or AWB date (shipped on board): "2026-02-30" isn\'t a date. Use YYYY-MM-DD.');
    expect(bad.body.error).toContain('Currency: "dollars" isn\'t a currency code, such as USD.');
    // Nothing was saved, not even the good value.
    expect(documentOf(await get(id), INV).fields).toEqual({});
  });

  it("refuses a field the document can't carry, and a document that isn't compared", async () => {
    const id = await openCase();
    const wrong = await enter(w.owner, id, PERMIT, { sealNumbers: "S1", quantityTolerance: "about" });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error).toBe("Seal numbers isn't a field of the bank export permit. Quantity tolerance in the letter of credit isn't a field of the bank export permit.");
    expect((await enter(w.owner, id, "sales_contract", { quantity: "1 kg" })).status).toBe(404);
    expect((await enter(w.owner, id, INV, { nonsense: "x" })).status).toBe(422);
    expect((await call(w.owner, "PUT", `/cases/${id}/documents/${INV}/fields`, { fields: [] })).status).toBe(400);
  });

  it("is for the SME team and Entrust's admins and facilitators, and only their own cases", async () => {
    const id = await openCase();
    for (const user of [w.owner, w.other, w.facilitator, w.admin]) {
      expect((await enter(user, id, QC, { netWeight: "19200 kg" })).status, user.id).toBe(200);
    }
    expect((await enter(w.reviewer, id, QC, { netWeight: "19300 kg" })).status).toBe(403);
    expect((await enter(w.stranger, id, QC, { netWeight: "19300 kg" })).status).toBe(404);
    expect((await enter(null, id, QC, { netWeight: "19300 kg" })).status).toBe(401);
  });
});

describe("while fields are still to be entered", () => {
  it("keeps STEP-099 open and says what is missing, without flagging anything", async () => {
    const id = await openCase();
    await finishPrerequisites(id);
    const res = await enter(w.owner, id, INV, documents()[INV]!);
    expect(res.body.reconciliation.status).toBe("waiting");
    expect(res.body.reconciliation.missing.map((m: Json) => m.document)).toEqual([PL, BL, COO, QC, PERMIT]);
    expect(res.body.reconciliation.message).toBe(
      "Fields are still to be entered from: Packing list, Bill of lading or air waybill, Certificate of origin, Quality certificate and Bank export permit.",
    );
    expect(step(res.body, "STEP-099")).toMatchObject({ status: "not_started", canComplete: false });
    expect(step(res.body, "STEP-099").warnings).toContain(res.body.reconciliation.message);
    expect(res.body.flags).toEqual([]);
  });

  it("wants the documents this case needs: a phytosanitary certificate when required, the LC when paid by one", async () => {
    const phyto = await get(await openCase({ ...ADVANCE, phytoCertificateRequired: "yes" }));
    expect(documentOf(phyto, PHYTO).required).toBe(true);
    expect(phyto.reconciliation.missing.map((m: Json) => m.document)).toContain(PHYTO);

    const lc = await get(await openCase(BY_LC));
    expect(documentOf(lc, LC).required).toBe(true);
    expect(lc.reconciliation.missing.find((m: Json) => m.document === LC)).toEqual({ document: LC, name: "Letter of credit", empty: true, fields: ["quantityTolerance"] });
    expect(lc.reconciliation.missing.find((m: Json) => m.document === BL)).toMatchObject({ fields: ["consignee"] });
  });
});

describe("documents that agree", () => {
  it("complete STEP-099 as CLEAR, with its evidence approved, once its prerequisites are done", async () => {
    const id = await openCase();
    // The documents agree, but the steps before the audit aren't done: nothing is completed or approved early.
    const early = await enterAll(id);
    expect(early.reconciliation).toMatchObject({ status: "clear", mismatches: [], missing: [], tolerance: { percent: 5 } });
    expect(early.reconciliation.compared).toBeGreaterThan(8);
    expect(step(early, "STEP-099").status).toBe("blocked");
    expect(latestOf(early, "discrepancy_audit_report")).toBeUndefined();

    await finishPrerequisites(id);
    const done = await enter(w.owner, id, QC, { packages: "320" }); // any change to the case runs the comparison again
    expect(step(done.body, "STEP-099")).toMatchObject({ status: "completed", missingEvidence: [] });
    expect(latestOf(done.body, "discrepancy_audit_report")).toMatchObject({
      status: "approved", reviewerUserId: null, submittedByUserId: null, reviewNote: done.body.reconciliation.message,
    });
    expect(done.body.flags).toEqual([]);

    const audit = await auditOf(id);
    expect(audit.find((a) => a.action === "evidence.auto_approve")).toMatchObject({ actorUserId: null, after: { type: "discrepancy_audit_report", status: "approved" } });
    expect(audit.find((a) => a.action === "step.complete")).toMatchObject({ actorUserId: null, after: { stepId: "STEP-099", status: "completed" } });
    expect((await eventsOf(id)).some((e) => e.type === "step_completed" && e.stepId === "STEP-099")).toBe(true);
  });

  it("accept the quantities within the tolerance, and say what it is", async () => {
    const id = await openCase();
    const res = await enterAll(id, { ...documents(), [PL]: { ...documents()[PL]!, quantity: "20.1 mt" } }); // +4.7%
    expect(res.reconciliation.status).toBe("clear");
    expect(res.reconciliation.message).toMatch(/Quantities may differ by 5% \(bulk goods/);
  });
});

describe("a difference", () => {
  it("raises FL-06 with the mismatch, and holds the handoff to the bank", async () => {
    const id = await openCase(BY_CAD);
    await enterAll(id, documents("To the order of Awash Bank"));
    const res = await enter(w.owner, id, PL, { quantity: "20.5 mt", portOfLoading: "Berbera" }); // +6.8% and another port

    expect(res.body.reconciliation.status).toBe("mismatch");
    expect(res.body.reconciliation.mismatches.map((m: Json) => [m.field, m.kind])).toEqual([["quantity", "outside_tolerance"], ["portOfLoading", "differs"]]);
    expect(res.body.reconciliation.mismatches[1].documents).toEqual([
      { document: INV, name: "Commercial invoice", value: "Djibouti" },
      { document: PL, name: "Packing list", value: "Berbera" },
      { document: BL, name: "Bill of lading or air waybill", value: "Djibouti" },
    ]);

    const flag = flagOf(res.body, "FL-06", "open");
    expect(flag).toMatchObject({ name: "Shipping document discrepancy", severity: "high", blocks: ["STEP-110"], raises: [] });
    expect(flag.message).toBe(res.body.reconciliation.message);
    expect(flag.message).toMatch(/^The shipping documents don't agree on Quantity and Port of loading\. Quantity is outside the ±5% tolerance/);
    expect(step(res.body, "STEP-110")).toMatchObject({ status: "blocked", heldBy: ["FL-06"] });
    expect(step(res.body, "STEP-099").warnings).toContain(flag.message);
    expect(res.body.openFlags).toBe(1);
    expect((await auditOf(id)).find((a) => a.action === "flag.raise")).toMatchObject({ actorUserId: null, after: { rule: "FL-06", blocks: ["STEP-110"] } });
  });

  it("resolves the flag when the document is corrected, releasing the bank handoff", async () => {
    const id = await openCase(BY_CAD);
    await enterAll(id, documents("To the order of Awash Bank"));
    const raised = await enter(w.owner, id, PL, { portOfLoading: "Berbera" });
    expect(flagOf(raised.body, "FL-06", "open")).toBeDefined();

    const fixed = await enter(w.owner, id, PL, { portOfLoading: "Djibouti" });
    expect(flagOf(fixed.body, "FL-06")).toMatchObject({ status: "resolved", resolvedAt: expect.any(String) });
    expect(step(fixed.body, "STEP-110").heldBy).toEqual([]);
    expect(fixed.body.reconciliation.status).toBe("clear");
  });

  it("is caught when a document is corrected after the audit passed, which doesn't reopen the step", async () => {
    const id = await openCase(BY_CAD);
    await finishPrerequisites(id);
    const passed = await enterAll(id, documents("To the order of Awash Bank"));
    expect(step(passed, "STEP-099").status).toBe("completed");

    const changed = await enter(w.owner, id, BL, { packages: "310" });
    expect(flagOf(changed.body, "FL-06", "open").message).toMatch(/Number of packages differs/);
    expect(step(changed.body, "STEP-099").status).toBe("completed");
    expect(step(changed.body, "STEP-110").heldBy).toEqual(["FL-06"]);
  });

  it("can be waived by an Entrust reviewer with a reason, like any flag", async () => {
    const id = await openCase(BY_CAD);
    await enterAll(id, documents("To the order of Awash Bank"));
    const raised = await enter(w.owner, id, PL, { grossWeight: "19.7 mt" });
    const flag = flagOf(raised.body, "FL-06", "open");

    const waived = await call(w.reviewer, "POST", `/cases/${id}/flags/${flag.id}/waive`, { reason: "Weighbridge slip attached; the carrier's figure stands" });
    expect(waived.status, JSON.stringify(waived.body)).toBe(200);
    expect(flagOf(waived.body, "FL-06")).toMatchObject({ status: "waived", waiveReason: "Weighbridge slip attached; the carrier's figure stands" });
    expect(step(waived.body, "STEP-110").heldBy).toEqual([]);
    expect(waived.body.openFlags).toBe(0);
  });

  it("drops the flag when Entrust marks the audit not applicable", async () => {
    const id = await openCase();
    await enterAll(id);
    const raised = await enter(w.owner, id, PL, { packages: "321" });
    expect(flagOf(raised.body, "FL-06", "open")).toBeDefined();
    const marked = await call(w.facilitator, "POST", `/cases/${id}/steps/STEP-099/transition`, { to: "not_applicable", reason: "Entrust checked the documents by hand" });
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);
    expect(marked.body.reconciliation).toBeNull();
    expect(flagOf(marked.body, "FL-06")).toMatchObject({ status: "resolved" });
  });
});

describe("the rules from the bank side", () => {
  it("want the bill of lading made out to the order of a bank under a letter of credit", async () => {
    const id = await openCase(BY_LC);
    await enter(w.owner, id, LC, { quantityTolerance: "not stated", paymentReference: "LC-2026/114" });
    const raised = await enterAll(id, documents("Buyer GmbH, Hamburg"));
    const flag = flagOf(raised, "FL-06", "open");
    expect(flag.message).toContain('The consignee on the bill of lading or air waybill reads "Buyer GmbH, Hamburg", but under a letter of credit or CAD it must be made out to the order of a bank');
    expect(raised.reconciliation.mismatches).toHaveLength(1);

    const fixed = await enter(w.owner, id, BL, { consignee: "To the order of Commercial Bank of Ethiopia" });
    expect(flagOf(fixed.body, "FL-06")).toMatchObject({ status: "resolved" });
    expect(fixed.body.reconciliation.status).toBe("clear");
  });

  it("don't let the invoice total go above the bank permit value", async () => {
    const id = await openCase();
    await enterAll(id);
    const over = await enter(w.owner, id, INV, { totalValue: "135000.01" });
    expect(flagOf(over.body, "FL-06", "open").message).toContain("The invoice total 135000.01 is above the bank permit value 135000.00.");
    const fixed = await enter(w.owner, id, PERMIT, { totalValue: "136,000.00" });
    expect(flagOf(fixed.body, "FL-06")).toMatchObject({ status: "resolved" });
  });

  it("take the tolerance from the letter of credit: 'about' allows 10%", async () => {
    const id = await openCase(BY_LC);
    const set = { ...documents("To the order of Awash Bank"), [PL]: { ...documents()[PL]!, quantity: "21 mt" } }; // +9.4%
    const without = await enterAll(id, { ...set, [LC]: { quantityTolerance: "not stated" } });
    expect(without.reconciliation.mismatches.map((m: Json) => m.field)).toEqual(["quantity"]);

    const about = await enter(w.owner, id, LC, { quantityTolerance: "about" });
    expect(about.body.reconciliation).toMatchObject({ status: "clear", tolerance: { percent: 10 } });
    expect(flagOf(about.body, "FL-06")).toMatchObject({ status: "resolved" });
  });

  it("have no tolerance for goods sold in packs", async () => {
    const id = await openCase({ ...ADVANCE, product: "roasted_coffee" });
    const res = await enterAll(id, { ...documents(), [PL]: { ...documents()[PL]!, quantity: "19.21 mt" } });
    expect(res.reconciliation.mismatches[0]).toMatchObject({ field: "quantity", kind: "differs" });
    expect(res.reconciliation.tolerance.percent).toBe(0);
  });
});
