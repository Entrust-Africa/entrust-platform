import { and, eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Worksheets (#64, #65): structured forms with values that save as the learner types, arithmetic done by the engine, and
// submitted versions that are kept and never edited. The calculators' own tests are in packages/trade-engine.

interface World {
  owner: TestUser;
  member: TestUser;
  rival: TestUser;
  noTrade: TestUser;
  admin: TestUser;
  facilitator: TestUser;
  reviewer: TestUser;
  org: string;
  rivalOrg: string;
  entrust: string;
  enrollment: string;
  rivalEnrollment: string;
}
const w = {} as World;

const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const put = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PUT", `/trade${path}`, body);

beforeAll(async () => {
  await cleanup();
  const users = await Promise.all(["owner", "member", "rival", "no-trade", "admin", "facilitator", "reviewer"].map(signUp));
  const [owner, member, rival, noTrade, admin, facilitator, reviewer] = users as [TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, member, rival, noTrade, admin, facilitator, reviewer });
  w.org = await createOrganization("ws-org", [[owner, "owner"], [member, "member"]], { platform: "trade" });
  w.rivalOrg = await createOrganization("ws-rival", [[rival, "owner"]], { platform: "trade" });
  await createOrganization("ws-clear", [[noTrade, "owner"]], { platform: "clear" });
  w.entrust = await createOrganization("ws-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;

  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}ws-program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}ws-cohort`, country: "ET" }).returning();
  const [mine, theirs] = await db
    .insert(schema.enrollment)
    .values([
      { cohortId: cohort!.id, organizationId: w.org, status: "active" },
      { cohortId: cohort!.id, organizationId: w.rivalOrg, status: "active" },
    ])
    .returning();
  w.enrollment = mine!.id;
  w.rivalEnrollment = theirs!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}%`));
});

const q = (enrollmentId = w.enrollment) => `?enrollmentId=${enrollmentId}`;

async function draft(id: string, user = w.owner, enrollmentId = w.enrollment): Promise<Json> {
  const res = await post(user, `/worksheets/${id}/draft`, { enrollmentId });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}
async function save(versionId: string, values: Record<string, unknown>, user = w.owner): Promise<Json> {
  const res = await put(user, `/worksheet-versions/${versionId}/values`, { values });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}
async function submit(versionId: string, user = w.owner) {
  return post(user, `/worksheet-versions/${versionId}/submit`);
}

const INCOME = { currency: "ETB", revenue: 2_400_000, cost_of_goods_sold: 1_560_000, operating_expenses: 600_000 };

describe("the worksheet definitions", () => {
  it("need a signed-in user, and describe the six worksheets", async () => {
    expect((await get(null, "/worksheets/definitions")).status).toBe(401);
    const res = await get(w.owner, "/worksheets/definitions");
    expect(res.status).toBe(200);
    expect(res.body.items.map((d: Json) => d.id)).toEqual([
      "m01-export-opportunity-brief",
      "m03-income-statement",
      "m03-cash-flow-forecast",
      "m03-working-capital-brief",
      "m03-information-pack",
      "m04-transaction-brief",
    ]);
    const m04 = res.body.items.find((d: Json) => d.id === "m04-transaction-brief");
    expect(m04).toMatchObject({ module: "M04", money: true, prefillFrom: "m03-working-capital-brief", printable: true });
    expect(m04.sections.map((s: Json) => s.title[0])).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I"]);
    expect(m04.tables.map((t: Json) => t.id)).toEqual(["outlays", "advances", "risks"]);
    expect((await get(w.owner, "/worksheets/definitions/m03-income-statement")).body.computed.map((c: Json) => c.id)).toEqual(["gross_profit", "gross_margin", "operating_profit", "operating_margin"]);
    expect((await get(w.owner, "/worksheets/definitions/nope")).status).toBe(404);
  });
});

describe("an enrolment's worksheets", () => {
  it("lists each worksheet with its newest submitted version and its draft", async () => {
    const res = await get(w.owner, `/worksheets${q()}`);
    expect(res.status).toBe(200);
    expect(res.body.enrollmentId).toBe(w.enrollment);
    expect(res.body.items).toHaveLength(6);
    expect(res.body.items.every((i: Json) => i.latest === null && i.draft === null)).toBe(true);
    // The only enrolment, found from the caller's organisation.
    expect((await get(w.owner, "/worksheets")).body.enrollmentId).toBe(w.enrollment);
  });

  it("keeps an SME's worksheets from every other SME", async () => {
    expect((await get(null, "/worksheets")).status).toBe(401);
    expect((await get(w.rival, `/worksheets${q()}`)).status).toBe(404);
    expect((await get(w.noTrade, `/worksheets${q()}`)).status).toBe(404);
    expect((await get(w.member, `/worksheets${q()}`)).status).toBe(200);
    for (const staff of [w.admin, w.facilitator, w.reviewer]) expect((await get(staff, `/worksheets${q()}`)).status, staff.id).toBe(200);
  });
});

describe("a draft", () => {
  it("is opened once and returned again, never a second draft", async () => {
    const first = await draft("m03-income-statement");
    expect(first).toMatchObject({ worksheetId: "m03-income-statement", module: "M03", version: 1, status: "draft", canEdit: true, confidence: "self_reported", confidenceLabel: "Self-reported", basedOn: null, prefilledFrom: null });
    expect(first.mizan).toMatchObject({ connected: false });
    const again = await draft("m03-income-statement", w.member);
    expect(again.id).toBe(first.id);
    const rows = await db.select().from(schema.worksheetVersion).where(and(eq(schema.worksheetVersion.enrollmentId, w.enrollment), eq(schema.worksheetVersion.worksheetId, "m03-income-statement")));
    expect(rows).toHaveLength(1);
    const listed = await get(w.owner, `/worksheets${q()}`);
    expect(listed.body.items.find((i: Json) => i.id === "m03-income-statement").draft).toMatchObject({ id: first.id, version: 1 });
  });

  it("is for the SME's own team: staff read it, they don't fill it in, and another SME can't open it", async () => {
    const d = await draft("m03-income-statement");
    expect((await get(w.admin, `/worksheet-versions/${d.id}`)).body).toMatchObject({ id: d.id, canEdit: false });
    expect((await post(w.admin, "/worksheets/m03-income-statement/draft", { enrollmentId: w.enrollment })).status).toBe(403);
    expect((await put(w.admin, `/worksheet-versions/${d.id}/values`, { values: { revenue: 1 } })).status).toBe(403);
    expect((await get(w.rival, `/worksheet-versions/${d.id}`)).status).toBe(404);
    expect((await put(w.rival, `/worksheet-versions/${d.id}/values`, { values: { revenue: 1 } })).status).toBe(404);
    expect((await post(w.rival, "/worksheets/m03-income-statement/draft", { enrollmentId: w.enrollment })).status).toBe(404);
    expect((await post(w.owner, "/worksheets/nope/draft", { enrollmentId: w.enrollment })).status).toBe(404);
  });

  it("starts M01's brief with the business's name from the registry", async () => {
    const d = await draft("m01-export-opportunity-brief");
    const [profile] = await db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, w.org));
    expect(d.values.company_name).toBe(profile!.legalName);
  });
});

describe("saving values", () => {
  it("works the result out as the learner types, with a blank never taken as zero", async () => {
    const d = await draft("m03-income-statement");
    const partial = await save(d.id, { currency: "ETB", revenue: 1_000 });
    expect(partial.values).toMatchObject({ currency: "ETB", revenue: 1_000 });
    expect(partial.result.computed).toEqual({ gross_profit: null, gross_margin: null, operating_profit: null, operating_margin: null });
    const full = await save(d.id, { cost_of_goods_sold: 400, operating_expenses: 100 });
    expect(full.values).toMatchObject({ revenue: 1_000, cost_of_goods_sold: 400 });
    expect(full.result.computed).toEqual({ gross_profit: 600, gross_margin: 60, operating_profit: 500, operating_margin: 50 });
    // null clears a value and the rest stay.
    const cleared = await save(d.id, { operating_expenses: null });
    expect(cleared.values.operating_expenses).toBeUndefined();
    expect(cleared.values.revenue).toBe(1_000);
    expect(cleared.result.computed.operating_profit).toBeNull();
  });

  it("reproduces the worked examples through the API: 2.4M revenue is 35% gross and 10% operating margin", async () => {
    const d = await draft("m03-income-statement");
    const res = await save(d.id, INCOME);
    expect(res.result.computed).toEqual({ gross_profit: 840_000, gross_margin: 35, operating_profit: 240_000, operating_margin: 10 });

    const cash = await draft("m03-cash-flow-forecast");
    const forecast = await save(cash.id, { currency: "ETB", opening_balance: 120_000, months: [{ label: "Jan", inflows: 400_000, outflows: 510_000 }, { inflows: 50_000, outflows: 20_000 }, {}] });
    expect(forecast.result.rows.months[0]).toEqual({ opening: 120_000, net: -110_000, closing: 10_000 });
    expect(forecast.result.flags.map((f: Json) => [f.code, f.severity])).toEqual([]);
  });

  it("shows the ETB figure from the rate and date the learner entered", async () => {
    const d = await draft("m03-working-capital-brief");
    const res = await save(d.id, { currency: "USD", pre_shipment_outflows: 1_000, post_shipment_outflows: 500, internal_cash: 300, buyer_advance: 200 });
    expect(res.result.computed).toMatchObject({ total_outflows: 1_500, gap: 1_000 });
    expect(res.result.etb).toEqual({ total_outflows: null, available_funds: null, gap: null, funding_needed: null });
    const withRate = await save(d.id, { exchange_rate: 56.5, rate_date: "2026-11-01" });
    expect(withRate.result.etb).toMatchObject({ total_outflows: 84_750, gap: 56_500 });
  });

  it("refuses what isn't a field of the worksheet or has the wrong shape, and says what a figure can't be", async () => {
    const d = await draft("m03-cash-flow-forecast");
    for (const values of [{ nonsense: 1 }, { opening_balance: { amount: 5 } }, { months: "three" }, { months: [{ nonsense: 1 }] }, { months: [{}, {}, {}, {}] }, { months: [{ inflows: { a: 1 } }] }]) {
      expect((await put(w.owner, `/worksheet-versions/${d.id}/values`, { values })).status, JSON.stringify(values)).toBe(422);
    }
    const bad = await save(d.id, { opening_balance: "lots" });
    expect(bad.result.problems).toContainEqual({ field: "opening_balance", message: "Cash you have at the start of month 1 must be a number." });
  });
});

describe("submitting", () => {
  it("keeps the version with what it worked out, and never lets it be edited", async () => {
    const d = await draft("m03-income-statement");
    await save(d.id, INCOME);
    const res = await submit(d.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "submitted", version: 1, canEdit: false });
    expect(res.body.submittedAt).toEqual(expect.any(String));
    expect(res.body.result.computed.operating_margin).toBe(10);

    expect((await put(w.owner, `/worksheet-versions/${d.id}/values`, { values: { revenue: 5 } })).status).toBe(409);
    expect((await submit(d.id)).status).toBe(409);
    // Reads the same later.
    expect((await get(w.owner, `/worksheet-versions/${d.id}`)).body).toEqual(res.body);
    const [row] = await db.select().from(schema.worksheetVersion).where(eq(schema.worksheetVersion.id, d.id));
    expect(row).toMatchObject({ status: "submitted", submittedByUserId: w.owner.id, confidence: "self_reported" });
    expect((row!.result as { computed: Json }).computed).toMatchObject({ gross_margin: 35 });
  });

  it("starts the next draft from it when the learner edits, and keeps the first as it was", async () => {
    const list = await get(w.owner, "/worksheets/m03-income-statement/versions" + q());
    expect(list.body.items.map((v: Json) => [v.version, v.status])).toEqual([[1, "submitted"]]);
    const first = list.body.items[0].id;

    const second = await draft("m03-income-statement");
    expect(second).toMatchObject({ version: 2, status: "draft", basedOn: { id: first, version: 1 } });
    expect(second.values).toMatchObject(INCOME);
    const changed = await save(second.id, { revenue: 3_000_000 });
    expect(changed.result.computed.gross_profit).toBe(1_440_000);
    expect((await submit(second.id)).body.version).toBe(2);

    expect((await get(w.owner, `/worksheet-versions/${first}`)).body.result.computed.gross_profit).toBe(840_000);
    const after = await get(w.owner, "/worksheets/m03-income-statement/versions" + q());
    expect(after.body.items.map((v: Json) => [v.version, v.status])).toEqual([[2, "submitted"], [1, "submitted"]]);
    const summary = (await get(w.owner, `/worksheets${q()}`)).body.items.find((i: Json) => i.id === "m03-income-statement");
    expect(summary).toMatchObject({ latest: { version: 2 }, draft: null });
  });

  it("says what is still missing, and refuses a figure it can't use", async () => {
    const d = await draft("m03-working-capital-brief");
    // Start from a clean sheet: an earlier test filled this draft in.
    await save(d.id, { currency: null, exchange_rate: null, rate_date: null, start_date: null, payment_date: null });
    const empty = await submit(d.id);
    expect(empty.status).toBe(422);
    expect(empty.body.error).toContain("Currency");
    await save(d.id, { currency: "USD", start_date: "2026-04-01", payment_date: "2026-01-01" });
    const wrong = await submit(d.id);
    expect(wrong.status).toBe(422);
    expect(wrong.body.error).toContain("Payment can't arrive before the first outflow");
    await save(d.id, { payment_date: "2026-07-01" });
    const noRate = await submit(d.id);
    expect(noRate.status).toBe(422);
    expect(noRate.body.error).toContain("Exchange rate");
    await save(d.id, { exchange_rate: 56.5, rate_date: "2026-11-01" });
    expect((await submit(d.id)).status).toBe(200);
  });

  it("needs a table's rows and their required columns, and submits M01's brief", async () => {
    const d = await draft("m01-export-opportunity-brief");
    const base = { product: "Dried chilli", destination: "Germany", buyer_profile: "A spice wholesaler", journey_stage: "buyer_identified", bottleneck: "No samples" };
    await save(d.id, base);
    expect((await submit(d.id)).body.error).toContain("Three actions for the next 30 days: at least 3 rows");
    await save(d.id, { brief_date: "2026-11-10", actions: [{ action: "Send samples", owner: "Me", deadline: "2026-11-20" }, { action: "Book a call", owner: "Me", deadline: "2026-12-20" }, { action: "Price list", owner: "", deadline: "2026-11-25" }] });
    const partial = await submit(d.id);
    expect(partial.status).toBe(422);
    expect(partial.body.error).toContain("row 3: Who does it");
    const saved = await save(d.id, { actions: [{ action: "Send samples", owner: "Me", deadline: "2026-11-20" }, { action: "Book a call", owner: "Me", deadline: "2026-12-20" }, { action: "Price list", owner: "Me", deadline: "2026-11-25" }] });
    expect(saved.result.flags.map((f: Json) => f.code)).toEqual(["deadline_beyond_30_days"]);
    const done = await submit(d.id);
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    // A warning doesn't stop it: the assessor sees it.
    expect(done.body.result.flags.map((f: Json) => f.code)).toEqual(["deadline_beyond_30_days"]);
  });

  it("submits the information pack from the ticks alone", async () => {
    const d = await draft("m03-information-pack");
    const res = await save(d.id, { doc_01: true, doc_02: true, doc_03: true });
    expect(res.result.computed).toMatchObject({ provided: 3, completion_percent: 25 });
    expect((await submit(d.id)).status).toBe(200);
  });

  it("writes the audit log for starting and submitting", async () => {
    const rows = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.organizationId, w.org), eq(schema.auditLog.entityType, "worksheet_version")));
    const actions = rows.map((r) => r.action);
    expect(actions).toContain("trade.worksheet.started");
    expect(actions).toContain("trade.worksheet.submitted");
    expect(rows.every((r) => r.platform === "trade")).toBe(true);
    expect(rows.find((r) => r.action === "trade.worksheet.submitted")?.after).toMatchObject({ worksheetId: expect.any(String), version: expect.any(Number) });
  });
});

describe("the M04 brief", () => {
  const outlays = [
    { stage: "sourcing", description: "Sesame", date: "2026-01-10", amount: 400_000 },
    { stage: "production", date: "2026-02-01", amount: 200_000 },
    { stage: "logistics", date: "2026-03-01", amount: 100_000 },
    { stage: "customs", date: "2026-03-10", amount: 60_000 },
  ];

  it("is prefilled from the M03 working-capital brief, with where it came from", async () => {
    const wc = await draft("m03-working-capital-brief");
    // The earlier test left this enrolment's working-capital brief submitted as USD; its values are what prefills.
    const latest = (await get(w.owner, "/worksheets/m03-working-capital-brief/versions" + q())).body.items.find((v: Json) => v.status === "submitted");
    expect(latest).toBeDefined();
    expect(wc.status).toBe("draft");
    const source = (await get(w.owner, `/worksheet-versions/${latest.id}`)).body;

    const brief = await draft("m04-transaction-brief");
    expect(brief).toMatchObject({ version: 1, prefilledFrom: { id: latest.id, worksheetId: "m03-working-capital-brief", title: "Export working-capital brief", version: source.version } });
    expect(brief.values).toMatchObject({ currency: "USD", exchange_rate: 56.5, rate_date: "2026-11-01" });
    expect(brief.values.internal_cash).toBe(300);
    expect(brief.values.advances).toEqual([{ amount: 200 }]);
    expect(brief.mizan).toMatchObject({ connected: false });
  });

  it("reproduces the garment case: 760k of outlays, a 200k advance and 150k of its own cash leave a 410k gap", async () => {
    const d = await draft("m04-transaction-brief");
    const res = await save(d.id, { currency: "ETB", outlays, internal_cash: 150_000, advances: [{ amount: 200_000 }] });
    expect(res.result.computed).toMatchObject({ total_outlay: 760_000, peak_cumulative: 760_000, peak_date: "2026-03-10", available_funds: 350_000, gap: 410_000, funding_needed: 410_000 });
    expect(res.result.rows.outlays.map((r: Json) => r.cumulative)).toEqual([400_000, 600_000, 700_000, 760_000]);
  });

  it("raises the open-account flag as soon as that combination is chosen", async () => {
    const d = await draft("m04-transaction-brief");
    const first = await save(d.id, { payment_method: "open_account" });
    expect(first.result.flags.map((f: Json) => f.code)).not.toContain("open_account_unverified_buyer");
    const second = await save(d.id, { buyer_verified: "no" });
    expect(second.result.flags).toContainEqual(expect.objectContaining({ code: "open_account_unverified_buyer", severity: "critical_candidate" }));
    expect((await save(d.id, { buyer_verified: "yes" })).result.flags.map((f: Json) => f.code)).not.toContain("open_account_unverified_buyer");
  });

  it("checks the dates and the schedule, and expects a verified order on Pathway B", async () => {
    const d = await draft("m04-transaction-brief");
    const res = await save(d.id, { production_start: "2026-03-01", delivery_date: "2026-02-01", outlays: outlays.slice(0, 2) });
    const codes = res.result.flags.map((f: Json) => f.code);
    expect(codes).toEqual(expect.arrayContaining(["delivery_before_production", "freight_missing"]));
    expect(codes).not.toContain("no_verified_order");

    await db.insert(schema.pathwayAssignment).values({ enrollmentId: w.enrollment, pathway: "B", status: "confirmed", liveOrder: false, rulesVersion: "0.2.0", reasonCodes: ["PATHWAY_RECENT_SHIPMENT"] });
    const onB = await save(d.id, { order_document_verified: "no" });
    expect(onB.result.flags).toContainEqual(expect.objectContaining({ code: "no_verified_order", severity: "critical_candidate" }));
    expect((await save(d.id, { order_document_verified: "yes" })).result.flags.map((f: Json) => f.code)).not.toContain("no_verified_order");
  });

  it("submits with its figures and its flags kept for the assessor", async () => {
    const d = await draft("m04-transaction-brief");
    const empty = await submit(d.id);
    expect(empty.status).toBe(422);
    expect(empty.body.error).toContain("Name of the transaction");
    await save(d.id, { transaction_name: "Sesame to Germany", buyer_name: "Schmidt GmbH", product: "Sesame", deal_basis: "a_live_order", payment_method: "advance_payment", currency: "ETB", exchange_rate: null, rate_date: null, outlays, internal_cash: 150_000, advances: [{ amount: 200_000 }], order_document_verified: "yes", production_start: "2026-01-05", delivery_date: "2026-03-20" });
    const done = await submit(d.id);
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body.result.computed.gap).toBe(410_000);
    expect(done.body.result.flags.map((f: Json) => f.code)).toEqual([]);
  });
});
