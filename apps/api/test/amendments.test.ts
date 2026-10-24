import { and, asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FACTS, PREFIX, call, cleanup, createOrganization, db, lockPhase, signUp, type Json, type TestUser } from "./support";

// Amendments after a phase gate is signed (#13). The dependency rules are tested in the GATE engine
// (amendment.test.ts); here the point is what the API does with them: versions, what is set back,
// what stays, the case status, and the audit trail.
const w = {} as { owner: TestUser; other: TestUser; stranger: TestUser; admin: TestUser; facilitator: TestUser; reviewer: TestUser; org: string; org2: string };

const BY_CAD = { ...FACTS, paymentTerms: ["cad"], phytoCertificateRequired: "no" };
const BY_LC = { ...BY_CAD, paymentTerms: ["lc"] };

let counter = 0;
const nextGrade = () => `A${++counter}`;

const openCase = async (facts: object = BY_CAD) => {
  const res = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
};
const get = async (caseId: string) => (await call(w.owner, "GET", `/cases/${caseId}`)).body as Json;
const step = (detail: Json, id: string) => detail.workflow.steps.find((s: Json) => s.id === id);
const evidenceOf = (detail: Json, type: string) => detail.evidence.findLast((e: Json) => e.type === type);
const amend = (user: TestUser | null, caseId: string, body: object) => call(user, "POST", `/cases/${caseId}/amendments`, body);
const flagOf = (detail: Json, rule: string, status?: string) => detail.flags.find((f: Json) => f.rule === rule && (status === undefined || f.status === status));

const contractOf = (grade: string, rest: object = {}) => ({
  number: "PO-114",
  buyerName: "Buyer GmbH",
  contractDate: "2026-03-04",
  unitPrice: { amount: 7, currency: "USD", per: "kg" },
  coffeeType: "washed",
  grade,
  ...rest,
});

/** A case whose commercial phase is signed off, with a contract on file. */
async function signedCase(facts: object = BY_CAD, grade = nextGrade()): Promise<{ id: string; grade: string }> {
  const id = await openCase(facts);
  const recorded = await call(w.owner, "PUT", `/cases/${id}/contract`, contractOf(grade));
  expect(recorded.status, JSON.stringify(recorded.body)).toBe(200);
  await lockPhase(id, 2);
  const detail = await get(id);
  expect(detail.workflow.phases[1].status).toBe("locked");
  return { id, grade };
}

/** Does what an amendment set back, as the database would after the work is redone. */
async function redo(caseId: string, stepIds: readonly string[]) {
  for (const stepId of stepIds) {
    await db
      .insert(schema.caseStep)
      .values({ caseId, stepId: stepId as never, status: "completed" })
      .onConflictDoUpdate({ target: [schema.caseStep.caseId, schema.caseStep.stepId], set: { status: "completed" } });
  }
  await db
    .update(schema.evidence)
    .set({ status: "approved" })
    .where(and(eq(schema.evidence.caseId, caseId), eq(schema.evidence.status, "changes_required")));
}

const auditOf = (caseId: string) => db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, caseId)).orderBy(asc(schema.auditLog.occurredAt));
const eventsOf = (caseId: string) => db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, caseId)).orderBy(asc(schema.caseEvent.recordedAt));

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

describe("who can amend, and when", () => {
  it("is for Entrust admins and facilitators, and the case's own organisation can't", async () => {
    const { id } = await signedCase();
    const body = { reason: "The buyer asked", facts: { incoterm: "FOB" } };
    for (const user of [w.owner, w.other, w.reviewer]) expect((await amend(user, id, body)).status, user.id).toBe(403);
    expect((await amend(w.stranger, id, body)).status).toBe(404);
    expect((await amend(null, id, body)).status).toBe(401);
    expect((await amend(w.facilitator, id, body)).status).toBe(201);
    expect((await amend(w.admin, id, { reason: "And again", facts: { incoterm: "CIF" } })).status).toBe(201);
  });

  it("wants a reason, and something to change", async () => {
    const { id } = await signedCase();
    expect((await amend(w.admin, id, { reason: "  ", facts: { incoterm: "FOB" } })).body.error).toBe("Give the reason for the amendment.");
    expect((await amend(w.admin, id, { reason: "Because" })).body.error).toBe("Say what to amend: facts, contract or lc.");
    expect((await amend(w.admin, id, { facts: { incoterm: "FOB" } })).status).toBe(400);
  });

  it("is for a case with a signed-off phase: before that, changes are made directly", async () => {
    const id = await openCase();
    const res = await amend(w.admin, id, { reason: "Early", facts: { incoterm: "FOB" } });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("No phase is signed off yet, so there is nothing to amend: change it directly.");
  });

  it("refuses a change that changes nothing, and a closed case, and leaves nothing behind", async () => {
    const { id } = await signedCase();
    const same = await amend(w.admin, id, { reason: "No change", facts: { paymentTerms: ["cad"] } });
    expect(same.status).toBe(422);
    expect(same.body.error).toBe("Nothing changed: the case already says what the amendment says.");
    expect((await get(id)).version).toBe(1);

    await db.update(schema.exportCase).set({ status: "closed" }).where(eq(schema.exportCase.id, id));
    const closed = await amend(w.admin, id, { reason: "Too late", facts: { incoterm: "FOB" } });
    expect(closed.status).toBe(422);
    expect(closed.body.error).toBe("A closed case can't be amended.");
  });

  it("checks what it changes like any other change: facts, contract and LC values", async () => {
    const { id } = await signedCase();
    expect((await amend(w.admin, id, { reason: "Typo", facts: { incoterm: "XYZ" } })).status).toBe(422);
    expect((await amend(w.admin, id, { reason: "Typo", facts: { product: null } })).status).toBe(422);
    expect((await amend(w.admin, id, { reason: "Typo", contract: { unitPrice: { amount: 6.123456, currency: "USD", per: "kg" } } })).status).toBe(422);
    expect((await amend(w.admin, id, { reason: "Typo", contract: { contractDate: "2099-01-01" } })).body.error).toMatch(/can't be in the future/);
    expect((await amend(w.admin, id, { reason: "Typo", lc: { expiry: "next week" } })).status).toBe(422);
    expect((await amend(w.admin, id, { reason: "Typo", lc: { quantityTolerance: "lots" } })).status).toBe(422);
    expect((await get(id)).version).toBe(1);
  });

  it("is what the other endpoints point to when they refuse a change after a gate is signed", async () => {
    const { id, grade } = await signedCase();
    const facts = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { incoterm: "FOB" } });
    expect(facts.status).toBe(200); // not recorded yet: always fine
    const refused = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { incoterm: "CIF" } });
    expect(refused.status).toBe(422);
    expect(refused.body.error).toMatch(/Phase 2 is signed off.*amendment: use POST \/v1\/clear\/cases\/\{id\}\/amendments/);
    const contract = await call(w.owner, "PUT", `/cases/${id}/contract`, contractOf(grade, { number: "PO-115" }));
    expect(contract.body.error).toMatch(/amendment: use POST \/v1\/clear\/cases\/\{id\}\/amendments/);
  });
});

describe("amending the facts", () => {
  it("makes the next version, with what changed, before and after", async () => {
    const { id } = await signedCase();
    const res = await amend(w.admin, id, { reason: "  The buyer moved to a letter of credit  ", facts: { paymentTerms: ["lc"] } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.version).toBe(2);
    expect(res.body.amendments).toHaveLength(1);
    expect(res.body.amendments[0]).toMatchObject({
      version: 2,
      reason: "The buyer moved to a letter of credit",
      changes: [{ field: "paymentTerms", label: "Payment terms", before: ["cad"], after: ["lc"] }],
      madeByUserId: w.admin.id,
      status: "pending",
      resolvedAt: null,
    });
    expect(res.body.facts.paymentTerms).toEqual(["lc"]);

    const [stored] = await db.select().from(schema.caseAmendment).where(eq(schema.caseAmendment.caseId, id));
    expect(stored).toMatchObject({ version: 2, madeByUserId: w.admin.id, resolvedAt: null });
  });

  it("verifies again the steps that depend on it, reopens their gate, and holds the case as amendments pending", async () => {
    const { id } = await signedCase();
    const res = await amend(w.admin, id, { reason: "Letter of credit instead of CAD", facts: { paymentTerms: ["lc"] } });
    const amendment = res.body.amendments[0];

    // The step that establishes the payment instrument is reopened; the LC steps now apply; the CAD step doesn't.
    expect(amendment.reopenedSteps).toContain("STEP-025");
    expect(amendment.reverifySteps).toEqual(expect.arrayContaining(["STEP-025", "STEP-026", "STEP-112", "STEP-035"]));
    expect(amendment.reopenedGates).toEqual(["STEP-035"]);
    expect(step(res.body, "STEP-025")).toMatchObject({ status: "in_progress" });
    expect(step(res.body, "STEP-026")).toMatchObject({ applicability: "applicable", status: "blocked" });
    expect(step(res.body, "STEP-027").applicability).toBe("not_applicable");
    expect(step(res.body, "STEP-035").status).not.toBe("completed");
    expect(res.body.workflow.phases[1].status).toBe("open");
    expect(res.body.currentPhase).toBe(1); // phase 1 was never signed off here
    expect(res.body.status).toBe("amendments_pending");
  });

  it("sends back the evidence of those steps and keeps the rest approved", async () => {
    const { id } = await signedCase();
    const res = await amend(w.admin, id, { reason: "Letter of credit instead of CAD", facts: { paymentTerms: ["lc"] } });
    expect(res.body.amendments[0].evidenceSentBack).toContain("letter_of_credit");
    expect(evidenceOf(res.body, "letter_of_credit")).toMatchObject({ status: "changes_required", reviewNote: expect.stringMatching(/^Amendment v2: Letter of credit instead of CAD$/) });
    for (const untouched of ["sales_contract", "proforma_invoice", "delivery_schedule", "buyer_quality_requirements", "contract_registration"]) {
      expect(evidenceOf(res.body, untouched), untouched).toMatchObject({ status: "approved" });
    }
    // The CAD agreement doesn't apply any more, so its approved evidence isn't asked for again.
    expect(evidenceOf(res.body, "collection_instruction")).toMatchObject({ status: "approved" });
    expect(res.body.amendments[0].evidenceSentBack).not.toContain("collection_instruction");
  });

  it("leaves a step alone that no longer applies, and its evidence approved", async () => {
    const { id } = await signedCase();
    expect(step(await get(id), "STEP-024")).toMatchObject({ status: "completed" });
    const res = await amend(w.admin, id, { reason: "It is avocados now", facts: { product: "fresh_produce" } });
    expect(step(res.body, "STEP-024")).toMatchObject({ applicability: "not_applicable", status: "not_applicable" });
    expect(res.body.amendments[0].reopenedSteps).not.toContain("STEP-024");
    expect(evidenceOf(res.body, "minimum_price_check")).toMatchObject({ status: "approved" });
    expect(res.body.minimumPrice).toBeNull();
  });

  it("is complete at once when nothing needs doing again", async () => {
    const { id } = await signedCase();
    // The customs channel is only known in phase 5; no step that depends on it is done.
    const res = await amend(w.admin, id, { reason: "Customs gave the channel", facts: { customsChannel: "green" } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.amendments[0]).toMatchObject({ version: 2, reopenedSteps: [], reverifySteps: [], status: "complete", resolvedAt: expect.any(String) });
    expect(res.body.status).toBe("open");
  });
});

describe("amending the contract", () => {
  it("verifies again the steps that rely on the unit price, and sends back only their evidence", async () => {
    const { id } = await signedCase();
    const res = await amend(w.facilitator, id, { reason: "The buyer raised the price in writing", contract: { unitPrice: { amount: 7.5, currency: "usd", per: "kg" } } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.contract.unitPrice).toEqual({ amount: 7.5, currency: "USD", per: "kg" });
    expect(res.body.contract).toMatchObject({ number: "PO-114", buyerName: "Buyer GmbH", coffeeType: "washed" }); // left out, so kept

    const amendment = res.body.amendments[0];
    expect(amendment.changes).toEqual([
      { field: "contract.unitPrice", label: "Unit price", before: { amount: 7, currency: "USD", per: "kg" }, after: { amount: 7.5, currency: "USD", per: "kg" } },
    ]);
    expect(amendment.reopenedSteps).toEqual(["STEP-020", "STEP-021", "STEP-023", "STEP-024", "STEP-034"]);
    expect(amendment.reopenedGates).toEqual(["STEP-035"]);
    expect(amendment.evidenceSentBack.sort()).toEqual(["contract_registration", "minimum_price_check", "proforma_invoice", "sales_contract"]);
    for (const untouched of ["delivery_schedule", "buyer_identity", "buyer_quality_requirements", "collection_instruction"]) {
      expect(evidenceOf(res.body, untouched), untouched).toMatchObject({ status: "approved" });
    }
    expect(res.body.status).toBe("amendments_pending");
  });

  it("changes only what it names, and clears an optional term with null", async () => {
    const { id } = await signedCase();
    const res = await amend(w.admin, id, { reason: "Origin dropped", contract: { origin: null, buyerName: "Buyer AG" } });
    expect(res.body.amendments[0].changes.map((c: Json) => [c.field, c.before, c.after])).toEqual([
      ["contract.buyerName", "Buyer GmbH", "Buyer AG"],
    ]); // there was no origin to clear
    const withOrigin = await amend(w.admin, id, { reason: "Origin recorded", contract: { origin: "Yirgacheffe" } });
    const cleared = await amend(w.admin, id, { reason: "Origin dropped", contract: { origin: null } });
    expect(withOrigin.body.contract.origin).toBe("Yirgacheffe");
    expect(cleared.body.contract.origin).toBeNull();
    expect(cleared.body.version).toBe(4);
  });

  it("runs the minimum price check again: a price now below the floor raises FL-03", async () => {
    const grade = nextGrade();
    await call(w.admin, "POST", "/minimum-prices", {
      label: `${PREFIX}amend-${grade}`,
      prices: [{ effectiveFrom: "2026-03-02", effectiveTo: "2026-03-08", coffeeType: "washed", grade, unit: "USD/kg", minPrice: 6.61 }],
    });
    const { id } = await signedCase(BY_CAD, grade);
    const res = await amend(w.admin, id, { reason: "Price cut agreed", contract: { unitPrice: { amount: 5.9, currency: "USD", per: "kg" } } });
    expect(res.body.minimumPrice).toMatchObject({ status: "below" });
    expect(flagOf(res.body, "FL-03", "open")).toBeDefined();
    expect(step(res.body, "STEP-024").status).not.toBe("completed");
    expect(step(res.body, "STEP-033").heldBy).toEqual(["FL-03"]);
  });

  it("is refused for a contract the case doesn't have yet, unless it says enough to create one", async () => {
    const id = await openCase();
    await lockPhase(id, 2);
    const partial = await amend(w.admin, id, { reason: "Add it", contract: { unitPrice: { amount: 7, currency: "USD", per: "kg" } } });
    expect(partial.status).toBe(422);
    expect(partial.body.error).toBe("The contract needs its number and the buyer's name.");
    const full = await amend(w.admin, id, { reason: "Add it", contract: { number: "PO-9", buyerName: "Buyer", contractDate: "2026-03-04" } });
    expect(full.status, JSON.stringify(full.body)).toBe(201);
    expect(full.body.amendments[0].changes.map((c: Json) => c.field)).toEqual(["contract.number", "contract.buyerName", "contract.contractDate"]);
  });
});

describe("amending the letter of credit", () => {
  it("records the new expiry and terms, and verifies the LC audit again", async () => {
    const { id } = await signedCase(BY_LC);
    const res = await amend(w.admin, id, { reason: "The bank amended the credit (MT707)", lc: { expiry: "2026-12-31", quantityTolerance: "about", reference: "LC-2026/114" } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.amendments[0].changes.map((c: Json) => [c.field, c.before, c.after])).toEqual([
      ["lc.expiry", null, "2026-12-31"],
      ["lc.quantityTolerance", null, "about"],
      ["lc.reference", null, "LC-2026/114"],
    ]);
    expect(res.body.documents.find((d: Json) => d.document === "letter_of_credit").fields).toEqual({ quantityTolerance: "about", paymentReference: "LC-2026/114" });
    expect(res.body.amendments[0].reopenedSteps).toContain("STEP-026");
    expect(evidenceOf(res.body, "letter_of_credit")).toMatchObject({ status: "changes_required" });

    // The deadline clocks read the new expiry from the case history, as they do for a first one.
    const events = await eventsOf(id);
    expect(events.filter((e) => e.type === "clock_input_set").map((e) => e.data)).toEqual([{ key: "lcExpiry", value: "2026-12-31" }]);
  });

  it("changes the expiry again as a new version, with the old one as 'before'", async () => {
    const { id } = await signedCase(BY_LC);
    await amend(w.admin, id, { reason: "First amendment", lc: { expiry: "2026-12-31" } });
    const second = await amend(w.admin, id, { reason: "Extended", lc: { expiry: "2027-01-31" } });
    expect(second.body.version).toBe(3);
    expect(second.body.amendments[0].changes).toEqual([{ field: "lc.expiry", label: "Letter of credit expiry", before: "2026-12-31", after: "2027-01-31" }]);
  });

  it("does nothing to the steps when payment isn't by letter of credit", async () => {
    const { id } = await signedCase(BY_CAD);
    const res = await amend(w.admin, id, { reason: "Recorded for the file", lc: { expiry: "2026-12-31" } });
    expect(res.body.amendments[0]).toMatchObject({ reopenedSteps: [], reverifySteps: [], reopenedGates: [], status: "complete" });
    expect(res.body.status).toBe("open");
  });
});

describe("versions, the audit trail and finishing", () => {
  it("lists the amendments newest first, each with its own version", async () => {
    const { id } = await signedCase();
    await amend(w.admin, id, { reason: "First", facts: { incoterm: "FOB" } });
    await amend(w.admin, id, { reason: "Second", facts: { incoterm: "CIF" } });
    const third = await amend(w.facilitator, id, { reason: "Third", contract: { buyerName: "Buyer AG" } });
    expect(third.body.version).toBe(4);
    expect(third.body.amendments.map((a: Json) => [a.version, a.reason])).toEqual([[4, "Third"], [3, "Second"], [2, "First"]]);
    expect(third.body.amendments[0].madeByUserId).toBe(w.facilitator.id);
    expect((await get(id)).amendments).toHaveLength(3);
  });

  it("writes who amended, why and what to the audit log and the case history", async () => {
    const { id } = await signedCase();
    await amend(w.facilitator, id, { reason: "Letter of credit instead of CAD", facts: { paymentTerms: ["lc"] } });
    const audit = await auditOf(id);
    const amended = audit.find((a) => a.action === "case.amended");
    expect(amended).toMatchObject({
      actorUserId: w.facilitator.id, organizationId: w.org, platform: "clear", reason: "Letter of credit instead of CAD",
      before: { version: 1, fields: { paymentTerms: ["cad"] } }, after: { version: 2, fields: { paymentTerms: ["lc"] } },
    });
    // What it set back is in the log too, as the same person.
    expect(audit.find((a) => a.action === "step.reopen" && (a.after as Json).stepId === "STEP-025")).toMatchObject({ actorUserId: w.facilitator.id });
    expect(audit.find((a) => a.action === "step.unlock" && (a.after as Json).stepId === "STEP-035")).toMatchObject({ actorUserId: w.facilitator.id });
    expect(audit.find((a) => a.action === "evidence.amendment_reset" && (a.after as Json).type === "letter_of_credit")).toMatchObject({ actorUserId: w.facilitator.id });

    const event = (await eventsOf(id)).find((e) => e.type === "case_amended");
    expect(event?.data).toMatchObject({ version: 2, fields: ["paymentTerms"], reopened: expect.arrayContaining(["STEP-025"]), unlocked: ["STEP-035"] });
  });

  it("stays pending until everything set back is done again, then reopens the case as normal", async () => {
    const { id } = await signedCase();
    const res = await amend(w.admin, id, { reason: "Letter of credit instead of CAD", facts: { paymentTerms: ["lc"] } });
    const reverify: string[] = res.body.amendments[0].reverifySteps;
    expect(reverify).toEqual(expect.arrayContaining(["STEP-025", "STEP-026", "STEP-112", "STEP-035"]));

    // Most of it is done again: still pending, because one step isn't.
    await redo(id, reverify.filter((s) => s !== "STEP-035"));
    const nearly = await call(w.facilitator, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "no" } });
    expect(nearly.body.status).toBe("amendments_pending");
    expect(nearly.body.amendments[0].status).toBe("pending");

    // The gate is signed off again: complete.
    await redo(id, ["STEP-035"]);
    const done = await call(w.facilitator, "PATCH", `/cases/${id}/facts`, { facts: { sourcingChannel: "ecx" } });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.status).toBe("open");
    expect(done.body.amendments[0]).toMatchObject({ status: "complete", resolvedAt: expect.any(String) });
    expect(done.body.workflow.phases[1].status).toBe("locked");

    const resolved = (await auditOf(id)).filter((a) => a.action === "amendment.resolve");
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({ actorUserId: null, after: { version: 2, resolved: true } });
    expect((await eventsOf(id)).filter((e) => e.type === "amendment_resolved")).toHaveLength(1);
  });

  it("keeps changes in the versions while an amendment is pending: a direct change to a recorded fact or the contract is refused", async () => {
    const { id, grade } = await signedCase();
    await amend(w.admin, id, { reason: "Letter of credit instead of CAD", facts: { paymentTerms: ["lc"] } });
    expect((await get(id)).workflow.phases[1].status).toBe("open"); // the gate is open again, so only the pending amendment keeps this out of the versions

    const fact = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { paymentTerms: ["cad"] } });
    expect(fact.status).toBe(422);
    expect(fact.body.error).toMatch(/^An amendment is still pending\. Changing a recorded fact now is an amendment: use POST/);
    const contract = await call(w.owner, "PUT", `/cases/${id}/contract`, contractOf(grade, { number: "PO-115" }));
    expect(contract.status).toBe(422);
    expect(contract.body.error).toMatch(/^An amendment is still pending\. Changing the contract now is an amendment/);

    // A second amendment is how it is done, and it is the next version.
    const second = await amend(w.admin, id, { reason: "Back to CAD", facts: { paymentTerms: ["cad"] } });
    expect(second.status, JSON.stringify(second.body)).toBe(201);
    expect(second.body.version).toBe(3);
    // Recording what wasn't known yet is always fine.
    expect((await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { sourcingChannel: "ecx" } })).status).toBe(200);
  });

  it("shows pending amendments in the case list's status filter", async () => {
    const { id } = await signedCase();
    await amend(w.admin, id, { reason: "Letter of credit instead of CAD", facts: { paymentTerms: ["lc"] } });
    const list = await call(w.owner, "GET", "/cases?status=amendments_pending&limit=100");
    expect(list.body.items.map((c: Json) => c.id)).toContain(id);
    expect((await call(w.owner, "GET", "/cases?status=open&limit=100")).body.items.map((c: Json) => c.id)).not.toContain(id);
  });

  it("is checked by the failure rules like any change: a reopened case with a new conflict raises its flag", async () => {
    const { id } = await signedCase();
    const res = await amend(w.admin, id, { reason: "Air freight now", facts: { transportMode: "air", incoterm: "FOB" } });
    expect(flagOf(res.body, "FL-02", "open")?.message).toMatch(/FOB is an Incoterm for sea transport, but the cargo goes by air/);
  });
});
