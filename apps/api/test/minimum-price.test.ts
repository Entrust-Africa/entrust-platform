import { asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  FACTS, PREFIX, call, cleanup, createOrganization, db, lockPhase, markCompleted, signUp, type Json, type TestUser,
} from "./support";

// The minimum export price check (STEP-024): an Entrust admin loads ECTA's weekly prices, the SME
// records the contract, and CLEAR completes the step or raises FL-03. The engine tests cover the
// comparison itself; here the point is what the API does with it.
//
// Each test uses a grade of its own, so the price tables of one test never decide another's, and
// the tables are labelled with the test prefix so they can be removed (they belong to no organisation).
const w = {} as { owner: TestUser; other: TestUser; stranger: TestUser; admin: TestUser; facilitator: TestUser; reviewer: TestUser; org: string; org2: string };

let counter = 0;
const nextGrade = () => `T${++counter}`;

const WEEK = { effectiveFrom: "2026-03-02", effectiveTo: "2026-03-08" };
const priceRow = (grade: string, rest: object = {}) => ({ ...WEEK, coffeeType: "washed", grade, unit: "USD/kg", minPrice: 6.61, ...rest });
const loadPrices = (grade: string, rest: object = {}, label = `${PREFIX}week-${grade}`) =>
  call(w.admin, "POST", "/minimum-prices", { label, prices: [priceRow(grade, rest)] });

const contractOf = (grade: string, rest: object = {}) => ({
  number: "PO-114",
  buyerName: "Buyer GmbH",
  contractDate: "2026-03-04",
  unitPrice: { amount: 7, currency: "USD", per: "kg" },
  coffeeType: "washed",
  grade,
  ...rest,
});
const putContract = (user: TestUser | null, caseId: string, body: object) => call(user, "PUT", `/cases/${caseId}/contract`, body);

const openCase = async (facts: object = FACTS) => {
  const res = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
};
const get = async (caseId: string, user = w.owner) => (await call(user, "GET", `/cases/${caseId}`)).body as Json;
const step = (detail: Json, id: string) => detail.workflow.steps.find((s: Json) => s.id === id);
const flagOf = (detail: Json, rule: string, status?: string) =>
  detail.flags.find((f: Json) => f.rule === rule && (status === undefined || f.status === status));
const latestOf = (detail: Json, type: string) => detail.evidence.findLast((e: Json) => e.type === type);
/** The steps STEP-024 waits for, done, so the check is free to complete it. */
const finishPrerequisites = (caseId: string) => markCompleted(caseId, ["STEP-010", "STEP-023"]);

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

describe("loading price tables", () => {
  it("lets an Entrust admin type a table in, and records who did it", async () => {
    const grade = nextGrade();
    const res = await call(w.admin, "POST", "/minimum-prices", {
      label: `${PREFIX}typed`,
      prices: [priceRow(grade, { origin: " Yirgacheffe ", minPrice: "6.6100" }), priceRow(grade, { coffeeType: "Unwashed", unit: "usd/lb", minPrice: 3 })],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({
      source: "manual",
      label: `${PREFIX}typed`,
      createdByUserId: w.admin.id,
      priceCount: 2,
      effectiveFrom: "2026-03-02",
      effectiveTo: "2026-03-08",
      casesRechecked: 0,
    });
    expect(res.body.prices).toContainEqual(
      expect.objectContaining({ coffeeType: "washed", grade, origin: "Yirgacheffe", currency: "USD", unit: "kg", minPrice: 6.61 }),
    );
    expect(res.body.prices).toContainEqual(expect.objectContaining({ coffeeType: "unwashed", origin: null, unit: "lb", minPrice: 3 }));

    const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, res.body.id));
    expect(audit).toMatchObject({
      action: "minimum_price_table.record", actorUserId: w.admin.id, platform: "clear", entityType: "minimum_price_table", organizationId: null,
      after: { source: "manual", priceCount: 2 },
    });
  });

  it("takes the CSV format from the issue, and keeps what it was uploaded as", async () => {
    const grade = nextGrade();
    const csv = `effective_from,effective_to,coffee_type,grade,origin,unit,min_price\n2026-03-02,2026-03-08,washed,${grade},Yirgacheffe,USD/kg,6.61\n2026-03-02,2026-03-08,unwashed,${grade},,USD/lb,3.00\n`;
    const res = await call(w.admin, "POST", "/minimum-prices/csv", { csv, label: `${PREFIX}file.csv` });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ source: "csv", label: `${PREFIX}file.csv`, priceCount: 2 });

    const read = await call(w.facilitator, "GET", `/minimum-prices/${res.body.id}`);
    expect(read.status).toBe(200);
    expect(read.body.prices.map((p: Json) => [p.coffeeType, p.origin, p.unit, p.minPrice])).toEqual(
      expect.arrayContaining([["washed", "Yirgacheffe", "kg", 6.61], ["unwashed", null, "lb", 3]]),
    );
  });

  it("refuses a whole file with a wrong row, naming each problem and its line", async () => {
    const csv = "effective_from,effective_to,coffee_type,grade,origin,unit,min_price\n2026-03-02,2026-03-08,washed,1,,USD/kg,6.61\n2026-03-09,2026-03-02,roasted,1,,USD/bag,cheap\n";
    const res = await call(w.admin, "POST", "/minimum-prices/csv", { csv, label: `${PREFIX}bad.csv` });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("invalid");
    expect(res.body.error).toContain("Line 3: the end date 2026-03-02 is before the start date 2026-03-09.");
    expect(res.body.error).toContain('Line 3: the coffee type "roasted" isn\'t washed or unwashed.');
    expect(res.body.error).toContain('Line 3: the unit "USD/bag"');
    expect((await call(w.admin, "POST", "/minimum-prices", { label: `${PREFIX}bad`, prices: [] })).body.error).toBe("There are no prices.");
    const listed = (await call(w.admin, "GET", "/minimum-prices")).body.items;
    expect(listed.some((t: Json) => t.label === `${PREFIX}bad.csv` || t.label === `${PREFIX}bad`)).toBe(false);
  });

  it("keeps every table, newest first, and doesn't change a table once loaded", async () => {
    const grade = nextGrade();
    const first = await loadPrices(grade, { minPrice: 5 }, `${PREFIX}first-${grade}`);
    const second = await loadPrices(grade, { minPrice: 7.5 }, `${PREFIX}second-${grade}`);
    const items = (await call(w.reviewer, "GET", "/minimum-prices")).body.items as Json[];
    const mine = items.filter((t) => [first.body.id, second.body.id].includes(t.id));
    expect(mine.map((t) => t.id)).toEqual([second.body.id, first.body.id]);
    expect((await call(w.reviewer, "GET", `/minimum-prices/${first.body.id}`)).body.prices[0].minPrice).toBe(5);
  });

  it("is for Entrust staff: only an admin loads a table, staff read them, and an SME sees none", async () => {
    const grade = nextGrade();
    const body = { label: `${PREFIX}denied`, prices: [priceRow(grade)] };
    for (const user of [w.facilitator, w.reviewer, w.owner, w.stranger]) {
      expect((await call(user, "POST", "/minimum-prices", body)).status).toBe(403);
      expect((await call(user, "POST", "/minimum-prices/csv", { csv: "x" })).status).toBe(403);
    }
    expect((await call(null, "POST", "/minimum-prices", body)).status).toBe(401);
    expect((await call(null, "GET", "/minimum-prices")).status).toBe(401);
    expect((await call(w.owner, "GET", "/minimum-prices")).status).toBe(403);
    expect((await call(w.facilitator, "GET", "/minimum-prices/00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await call(w.facilitator, "GET", "/minimum-prices/not-a-uuid")).status).toBe(400);
  });
});

describe("recording the contract", () => {
  it("shows no contract and a waiting check on a new coffee case", async () => {
    const created = await get(await openCase());
    expect(created.contract).toBeNull();
    expect(created.minimumPrice).toMatchObject({ status: "waiting", minimum: null, contractPrice: null });
    expect(created.minimumPrice.message).toBe("The sales contract isn't recorded yet, so its price can't be checked.");
    expect(step(created, "STEP-024")).toMatchObject({ applicability: "applicable", class: "conditional", owner: "system" });
  });

  it("keeps the step open until the contract has a price, coffee type and grade", async () => {
    const id = await openCase();
    const res = await putContract(w.owner, id, { number: " PO-1 ", buyerName: "Buyer GmbH", contractDate: "2026-03-04" });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.contract).toEqual({
      number: "PO-1", buyerName: "Buyer GmbH", contractDate: "2026-03-04", unitPrice: null, coffeeType: null, grade: null, origin: null,
    });
    expect(res.body.minimumPrice.message).toBe(
      "The sales contract needs the unit price, the coffee type (washed or unwashed) and the grade before its price can be checked.",
    );
    expect(step(res.body, "STEP-024").warnings).toContain(res.body.minimumPrice.message);
  });

  it("writes the contract to the audit log and the case history, and ignores a repeat", async () => {
    const grade = nextGrade();
    const id = await openCase();
    const body = contractOf(grade, { origin: "Yirgacheffe" });
    expect((await putContract(w.owner, id, body)).status).toBe(200);
    expect((await putContract(w.owner, id, body)).status).toBe(200); // the same terms again

    const recorded = (await auditOf(id)).filter((a) => a.action === "case.contract_recorded");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      actorUserId: w.owner.id, organizationId: w.org, before: null,
      after: { number: "PO-114", unitPrice: { amount: 7, currency: "USD", per: "kg" }, coffeeType: "washed", grade, origin: "Yirgacheffe" },
    });
    expect((await eventsOf(id)).filter((e) => e.type === "contract_recorded")).toHaveLength(1);

    const changed = await putContract(w.owner, id, contractOf(grade, { origin: "Yirgacheffe", unitPrice: { amount: 7.25, currency: "usd", per: "kg" } }));
    expect(changed.body.contract.unitPrice).toEqual({ amount: 7.25, currency: "USD", per: "kg" });
    const again = (await auditOf(id)).filter((a) => a.action === "case.contract_recorded");
    expect(again).toHaveLength(2);
    expect(again[1]).toMatchObject({ before: { unitPrice: { amount: 7 } }, after: { unitPrice: { amount: 7.25 } } });
  });

  it("is recorded by the SME team and Entrust's admins and facilitators, and nobody else", async () => {
    const grade = nextGrade();
    const id = await openCase();
    expect((await putContract(w.other, id, contractOf(grade))).status).toBe(200); // a member of the organisation
    expect((await putContract(w.facilitator, id, contractOf(grade, { number: "PO-115" }))).status).toBe(200);
    expect((await putContract(w.admin, id, contractOf(grade, { number: "PO-116" }))).status).toBe(200);
    expect((await putContract(w.reviewer, id, contractOf(grade, { number: "PO-117" }))).status).toBe(403);
    expect((await putContract(w.stranger, id, contractOf(grade))).status).toBe(404); // another organisation's case
    expect((await putContract(null, id, contractOf(grade))).status).toBe(401);
  });

  it("refuses a contract that can't be right", async () => {
    const grade = nextGrade();
    const id = await openCase();
    const refused = async (body: object, status: number, error?: RegExp) => {
      const res = await putContract(w.owner, id, body);
      expect(res.status, JSON.stringify(body)).toBe(status);
      if (error) expect(res.body.error).toMatch(error);
    };
    await refused(contractOf(grade, { contractDate: "2099-01-01" }), 422, /can't be in the future/);
    await refused(contractOf(grade, { contractDate: "2026-02-30" }), 400);
    await refused(contractOf(grade, { number: "  " }), 422, /needs its number/);
    await refused(contractOf(grade, { unitPrice: { amount: 0, currency: "USD", per: "kg" } }), 400);
    await refused(contractOf(grade, { unitPrice: { amount: 6.123456, currency: "USD", per: "kg" } }), 422, /at most 4 decimals/);
    await refused(contractOf(grade, { unitPrice: { amount: 6, currency: "US", per: "kg" } }), 400);
    await refused(contractOf(grade, { unitPrice: { amount: 6, currency: "USD", per: "bag" } }), 400);
    await refused(contractOf(grade, { coffeeType: "natural" }), 400);
    expect((await get(id)).contract).toBeNull();
  });

  it("can't be changed once the commercial phase is signed off", async () => {
    const grade = nextGrade();
    const id = await openCase();
    expect((await putContract(w.owner, id, contractOf(grade))).status).toBe(200);
    await lockPhase(id, 2);
    const res = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 5, currency: "USD", per: "kg" } }));
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Phase 2 is signed off/);
    expect((await putContract(w.owner, id, contractOf(grade))).status).toBe(200); // unchanged terms are no amendment
  });
});

describe("the check completes STEP-024 when the price is in order", () => {
  it("approves the check's evidence and completes the step once its prerequisites are done, as CLEAR", async () => {
    const grade = nextGrade();
    expect((await loadPrices(grade)).status).toBe(201);
    const id = await openCase();

    // The price is fine, but the HS code (STEP-010) and unit price verification (STEP-023) come first.
    const early = await putContract(w.owner, id, contractOf(grade));
    expect(early.body.minimumPrice).toMatchObject({ status: "met", contractPrice: 7, minimum: { minPrice: 6.61, unit: "kg" } });
    expect(step(early.body, "STEP-024")).toMatchObject({ status: "blocked", blockedBy: ["STEP-010", "STEP-023"] });
    expect(latestOf(early.body, "minimum_price_check")).toBeUndefined();

    await finishPrerequisites(id);
    const done = await putContract(w.owner, id, contractOf(grade)); // any change to the case runs the check again
    expect(step(done.body, "STEP-024")).toMatchObject({ status: "completed", missingEvidence: [] });
    expect(latestOf(done.body, "minimum_price_check")).toMatchObject({
      status: "approved", reviewerUserId: null, submittedByUserId: null, latest: true, reviewNote: done.body.minimumPrice.message,
    });
    expect(done.body.flags).toEqual([]);

    const audit = await auditOf(id);
    expect(audit.find((a) => a.action === "evidence.auto_approve")).toMatchObject({
      actorUserId: null, organizationId: w.org, before: { type: "minimum_price_check", status: "not_provided" }, after: { status: "approved" },
    });
    expect(audit.find((a) => a.action === "step.complete")).toMatchObject({ actorUserId: null, after: { stepId: "STEP-024", status: "completed" } });
    const events = await eventsOf(id);
    expect(events.some((e) => e.type === "step_completed" && e.stepId === "STEP-024")).toBe(true);
    expect(events.some((e) => e.type === "evidence_reviewed" && (e.data as Json)?.automatic === true)).toBe(true);
  });

  it("passes a price exactly at the floor, and converts the contract's unit", async () => {
    const grade = nextGrade();
    await loadPrices(grade);
    const id = await openCase();
    const atFloor = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 6.61, currency: "USD", per: "kg" } }));
    expect(atFloor.body.minimumPrice.status).toBe("met");

    // 3.00 USD/lb is 6.6139 USD/kg, above 6.61; 2.99 USD/lb is 6.5918.
    const perLb = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 3, currency: "USD", per: "lb" } }));
    expect(perLb.body.minimumPrice).toMatchObject({ status: "met", contractPrice: 6.6139 });
    expect(perLb.body.minimumPrice.message).toMatch(/3\.00 USD\/lb \(6\.6139 USD\/kg\)/);
    const under = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 2.99, currency: "USD", per: "lb" } }));
    expect(under.body.minimumPrice.status).toBe("below");
  });

  it("uses the price in force on the contract date", async () => {
    const grade = nextGrade();
    await call(w.admin, "POST", "/minimum-prices", {
      label: `${PREFIX}two-weeks-${grade}`,
      prices: [priceRow(grade, { minPrice: 6 }), priceRow(grade, { effectiveFrom: "2026-03-09", effectiveTo: "2026-03-15", minPrice: 8 })],
    });
    const id = await openCase();
    const week1 = await putContract(w.owner, id, contractOf(grade, { contractDate: "2026-03-08" }));
    expect(week1.body.minimumPrice).toMatchObject({ status: "met", minimum: { minPrice: 6, effectiveTo: "2026-03-08" } });
    const week2 = await putContract(w.owner, id, contractOf(grade, { contractDate: "2026-03-09" }));
    expect(week2.body.minimumPrice).toMatchObject({ status: "below", minimum: { minPrice: 8, effectiveFrom: "2026-03-09" } });
  });

  it("lets the latest table decide when a corrected one covers the same days", async () => {
    const grade = nextGrade();
    await loadPrices(grade, { minPrice: 5 }, `${PREFIX}old-${grade}`);
    const id = await openCase();
    expect((await putContract(w.owner, id, contractOf(grade))).body.minimumPrice.status).toBe("met");

    const corrected = await loadPrices(grade, { minPrice: 7.5 }, `${PREFIX}corrected-${grade}`);
    expect(corrected.body.casesRechecked).toBe(1);
    const after = await get(id);
    expect(after.minimumPrice).toMatchObject({ status: "below", minimum: { tableId: corrected.body.id, minPrice: 7.5 } });
    expect(flagOf(after, "FL-03", "open")).toBeDefined();
  });
});

describe("the check raises FL-03 below the floor", () => {
  it("raises the flag with the words of the check, raises STEP-029 and holds the commercial sign-off", async () => {
    const grade = nextGrade();
    await loadPrices(grade);
    const id = await openCase();
    const res = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 5.9, currency: "USD", per: "kg" } }));
    expect(res.body.minimumPrice.status).toBe("below");

    const flag = flagOf(res.body, "FL-03");
    expect(flag).toMatchObject({
      name: "Price below the minimum export price", severity: "high", status: "open", blocks: ["STEP-033", "STEP-035"], raises: ["STEP-029"],
    });
    expect(flag.message).toBe(res.body.minimumPrice.message);
    expect(flag.message).toBe(
      `The contract price of 5.90 USD/kg is below the minimum export price of 6.61 USD/kg in force on 2026-03-04 (washed coffee, grade ${grade}, set for 2026-03-02 to 2026-03-08).`,
    );
    expect(step(res.body, "STEP-029")).toMatchObject({ applicability: "applicable", class: "exception" });
    expect(step(res.body, "STEP-033")).toMatchObject({ status: "blocked", heldBy: ["FL-03"] });
    expect(step(res.body, "STEP-024").warnings).toContain(flag.message);
    expect(res.body.openFlags).toBe(1);
  });

  it("leaves STEP-024 open however far the case has got, and resolves the flag when the price is fixed", async () => {
    const grade = nextGrade();
    await loadPrices(grade);
    const id = await openCase();
    await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 5.9, currency: "USD", per: "kg" } }));
    await finishPrerequisites(id);
    const stuck = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 5.9, currency: "USD", per: "kg" } }));
    expect(step(stuck.body, "STEP-024")).toMatchObject({ status: "not_started", canComplete: false });
    expect(latestOf(stuck.body, "minimum_price_check")).toBeUndefined();

    const fixed = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 6.8, currency: "USD", per: "kg" } }));
    expect(flagOf(fixed.body, "FL-03")).toMatchObject({ status: "resolved", resolvedAt: expect.any(String) });
    expect(step(fixed.body, "STEP-033").heldBy).toEqual([]);
    expect(step(fixed.body, "STEP-029").applicability).toBe("applicable"); // resolving it is work for a person
    expect(step(fixed.body, "STEP-024").status).toBe("completed");
  });

  it("lets an Entrust reviewer waive the flag with a reason, like any other", async () => {
    const grade = nextGrade();
    await loadPrices(grade);
    const id = await openCase();
    const res = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 5.9, currency: "USD", per: "kg" } }));
    const waived = await call(w.reviewer, "POST", `/cases/${id}/flags/${flagOf(res.body, "FL-03").id}/waive`, { reason: "ECTA approved this price in writing" });
    expect(waived.status, JSON.stringify(waived.body)).toBe(200);
    expect(flagOf(waived.body, "FL-03")).toMatchObject({ status: "waived", waiveReason: "ECTA approved this price in writing" });
    expect(step(waived.body, "STEP-033").heldBy).toEqual([]);
    expect(waived.body.openFlags).toBe(0);
  });

  it("drops the flag when Entrust marks STEP-024 not applicable", async () => {
    const grade = nextGrade();
    await loadPrices(grade);
    const id = await openCase();
    await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 5.9, currency: "USD", per: "kg" } }));
    const marked = await call(w.facilitator, "POST", `/cases/${id}/steps/STEP-024/transition`, { to: "not_applicable", reason: "ECTA exempted this contract" });
    expect(marked.status, JSON.stringify(marked.body)).toBe(200);
    expect(marked.body.minimumPrice).toBeNull();
    expect(flagOf(marked.body, "FL-03")).toMatchObject({ status: "resolved" });
  });
});

describe("when the check can't tell", () => {
  it("stays open with 'no minimum price on file' instead of passing, then decides once the prices are loaded", async () => {
    const grade = nextGrade();
    const id = await openCase();
    await finishPrerequisites(id);
    const res = await putContract(w.owner, id, contractOf(grade, { contractDate: "2026-04-15" }));
    expect(res.body.minimumPrice).toMatchObject({ status: "no_price", minimum: null, contractPrice: null });
    expect(res.body.minimumPrice.message).toBe(`No minimum price on file for washed coffee, grade ${grade}, on 2026-04-15.`);
    expect(step(res.body, "STEP-024")).toMatchObject({ status: "not_started", canComplete: false });
    expect(step(res.body, "STEP-024").warnings).toContain(res.body.minimumPrice.message);
    expect(res.body.flags).toEqual([]); // nothing to flag: there is nothing to compare with

    // A table for another week, another grade or another type of coffee doesn't count.
    await loadPrices(grade, { effectiveFrom: "2026-04-20", effectiveTo: "2026-04-26" });
    await loadPrices(nextGrade(), { effectiveFrom: "2026-04-13", effectiveTo: "2026-04-19" });
    expect((await get(id)).minimumPrice.status).toBe("no_price");

    // The admin loads the week of the contract, and the case is checked again without anyone touching it.
    const loaded = await loadPrices(grade, { effectiveFrom: "2026-04-13", effectiveTo: "2026-04-19", minPrice: 6.5 });
    expect(loaded.body.casesRechecked).toBe(1);
    const after = await get(id);
    expect(after.minimumPrice.status).toBe("met");
    expect(step(after, "STEP-024").status).toBe("completed");
  });

  it("does not compare prices in different currencies", async () => {
    const grade = nextGrade();
    await loadPrices(grade);
    const id = await openCase();
    const res = await putContract(w.owner, id, contractOf(grade, { unitPrice: { amount: 6, currency: "EUR", per: "kg" } }));
    expect(res.body.minimumPrice).toMatchObject({ status: "not_comparable", contractPrice: null, minimum: { currency: "USD" } });
    expect(res.body.minimumPrice.message).toMatch(/priced in EUR but the minimum export price .* is in USD/);
    expect(res.body.flags).toEqual([]);
    expect(step(res.body, "STEP-024").warnings).toContain(res.body.minimumPrice.message);
  });
});

describe("other products", () => {
  it("don't have the check: STEP-024 doesn't apply and nothing is flagged", async () => {
    const id = await openCase({ product: "fresh_produce", destinationCountry: "AE" });
    const created = await get(id);
    expect(created.minimumPrice).toBeNull();
    expect(step(created, "STEP-024")).toMatchObject({ applicability: "not_applicable", status: "not_applicable" });

    const res = await putContract(w.owner, id, contractOf("1", { unitPrice: { amount: 0.5, currency: "USD", per: "kg" } }));
    expect(res.status).toBe(200);
    expect(res.body.contract.unitPrice).toEqual({ amount: 0.5, currency: "USD", per: "kg" });
    expect(res.body.minimumPrice).toBeNull();
    expect(res.body.flags).toEqual([]);
  });
});
