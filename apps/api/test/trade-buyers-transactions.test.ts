import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, makeFile, signUp, type Json, type TestUser } from "./support";

// Buyers shared by the pipeline and the transactions, and what sits under a transaction: events, documents and cost revisions (#195).

const w = {} as { owner: TestUser; stranger: TestUser; admin: TestUser; assessor: TestUser; org: string; otherOrg: string };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);
const post = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "POST", `/trade${path}`, body);
const patch = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "PATCH", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};

beforeAll(async () => {
  await cleanup();
  const [owner, stranger, admin, assessor] = (await Promise.all(["bt-owner", "bt-stranger", "bt-admin", "bt-assessor"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, stranger, admin, assessor });
  process.env.ENTRUST_ORG_ID = await createOrganization("bt-entrust", [[admin, "admin"], [assessor, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("bt-sme", [[owner, "owner"]], { platform: "trade" });
  w.otherOrg = await createOrganization("bt-other", [[stranger, "owner"]], { platform: "trade" });
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("the buyer record", () => {
  it("is made once from a pipeline opportunity, however the name is spelled, and shared by a transaction", async () => {
    const a = ok(await post(w.owner, "/pipeline", { organizationId: w.org, title: "Hamburg order", companyName: "Roaster GmbH", country: "DE" }));
    ok(await post(w.owner, "/pipeline", { organizationId: w.org, title: "Second order", companyName: "  roaster   gmbh ", country: "DE" }));
    ok(await post(w.owner, "/pipeline", { organizationId: w.org, title: "Kenyan branch", companyName: "Roaster GmbH", country: "KE" }));
    const tx = ok(await post(w.owner, "/transactions", { organizationId: w.org, product: "Coffee" }));
    ok(await patch(w.owner, `/transactions/${tx.id}`, { buyerName: "ROASTER gmbh" }));

    const buyers = ok(await get(w.owner, `/buyers?organizationId=${w.org}`)).items;
    expect(buyers.map((b: Json) => [b.name, b.country, b.opportunities, b.transactions])).toEqual([
      ["Roaster GmbH", "DE", 2, 1],
      ["Roaster GmbH", "KE", 1, 0],
    ]);
    const [row] = await db.select().from(schema.commercialOpportunity).where(eq(schema.commercialOpportunity.id, a.id));
    expect(row!.buyerId).toBe(buyers[0].id);
  });

  it("moves up when a pipeline activity moves the opportunity up, and never down that way", async () => {
    const [first] = ok(await get(w.owner, `/pipeline?organizationId=${w.org}`)).items.filter((o: Json) => o.title === "Hamburg order");
    ok(await post(w.owner, `/pipeline/${first.id}/activities`, { type: "email", summary: "Introduced ourselves", occurredAt: new Date().toISOString() }));
    const [buyer] = ok(await get(w.owner, `/buyers?organizationId=${w.org}`)).items;
    expect(buyer.verificationStatus).toBe("identity_checked");
  });

  it("lets only staff set the evidence status, and carries it to the buyer's opportunities", async () => {
    const [buyer] = ok(await get(w.owner, `/buyers?organizationId=${w.org}`)).items;
    expect((await patch(w.owner, `/buyers/${buyer.id}`, { verificationStatus: "qualified_opportunity" })).status).toBe(403);
    expect((await patch(w.assessor, `/buyers/${buyer.id}`, { verificationStatus: "qualified_opportunity" })).status).toBe(404);
    ok(await patch(w.owner, `/buyers/${buyer.id}`, { website: "https://roaster.example", contactName: "A. Buyer" }));
    const set = ok(await patch(w.admin, `/buyers/${buyer.id}`, { verificationStatus: "commercially_relevant", evidenceNote: "Companies register checked" }));
    expect(set).toMatchObject({ verificationStatus: "commercially_relevant", website: "https://roaster.example", evidenceNote: "Companies register checked" });
    const statuses = (await db.select({ s: schema.commercialOpportunity.verificationStatus }).from(schema.commercialOpportunity).where(eq(schema.commercialOpportunity.buyerId, buyer.id))).map((r) => r.s);
    expect(statuses).toEqual(["commercially_relevant", "commercially_relevant"]);
  });

  it("adds a buyer by hand, refuses a duplicate, and keeps one business's buyers from another", async () => {
    ok(await post(w.owner, "/buyers", { organizationId: w.org, name: "Tea Traders", country: "GB", contactEmail: "buy@tea.example" }));
    expect((await post(w.owner, "/buyers", { organizationId: w.org, name: "tea  traders", country: "GB" })).status).toBe(409);
    expect((await post(w.owner, "/buyers", { organizationId: w.org, name: "X", contactEmail: "nope" })).status).toBe(400);
    expect((await get(w.stranger, `/buyers?organizationId=${w.org}`)).status).toBe(404);
    expect((await get(w.stranger, `/buyers?organizationId=${w.otherOrg}`)).body.items).toEqual([]);
  });
});

describe("a transaction's records", () => {
  let tx: Json;
  beforeAll(async () => {
    tx = ok(await post(w.owner, "/transactions", { organizationId: w.org, product: "Honey" }));
  });

  it("keeps stage changes and notes in order", async () => {
    ok(await patch(w.owner, `/transactions/${tx.id}`, { stage: "order_confirmed" }));
    ok(await post(w.owner, `/transactions/${tx.id}/events`, { type: "exception", summary: "Packaging delayed two days" }));
    ok(await patch(w.owner, `/transactions/${tx.id}`, { stage: "in_production" }));
    const events = ok(await get(w.owner, `/transactions/${tx.id}/events`)).items;
    expect(events.map((e: Json) => [e.type, e.summary])).toEqual([
      ["stage_change", "Moved from order confirmed to in production"],
      ["exception", "Packaging delayed two days"],
      ["stage_change", "Moved from enquiry to order confirmed"],
    ]);
    expect((await post(w.owner, `/transactions/${tx.id}/events`, { type: "stage_change", summary: "x" })).status).toBe(400);
  });

  it("holds documents, with an uploaded file only if it is the business's own", async () => {
    const mine = await makeFile(w.org, w.owner.id, "invoice.pdf");
    const theirs = await makeFile(w.otherOrg, w.stranger.id, "theirs.pdf");
    const doc = ok(await post(w.owner, `/transactions/${tx.id}/documents`, { kind: "commercial_invoice", name: "Invoice 101", fileId: mine }));
    expect(doc).toMatchObject({ kind: "commercial_invoice", fileId: mine });
    expect((await post(w.owner, `/transactions/${tx.id}/documents`, { kind: "other", name: "Not mine", fileId: theirs })).status).toBe(404);
    expect(ok(await get(w.owner, `/transactions/${tx.id}/documents`)).items).toHaveLength(1);
    expect((await callV1(w.stranger, "DELETE", `/trade/transactions/${tx.id}/documents/${doc.id}`)).status).toBe(404);
    ok(await callV1(w.owner, "DELETE", `/trade/transactions/${tx.id}/documents/${doc.id}`));
    expect(ok(await get(w.owner, `/transactions/${tx.id}/documents`)).items).toEqual([]);
  });

  it("keeps cost revisions, counting the newest figure and never adding currencies together", async () => {
    ok(await post(w.owner, `/transactions/${tx.id}/costs`, { category: "freight", basis: "quoted", amount: 1200, currency: "usd" }));
    ok(await post(w.owner, `/transactions/${tx.id}/costs`, { category: "production", basis: "quoted", amount: 3000.5, currency: "USD" }));
    ok(await post(w.owner, `/transactions/${tx.id}/costs`, { category: "freight", basis: "quoted", amount: 1350, currency: "USD", note: "Carrier raised the rate" }));
    ok(await post(w.owner, `/transactions/${tx.id}/costs`, { category: "freight", basis: "actual", amount: 900, currency: "EUR" }));
    const costs = ok(await get(w.owner, `/transactions/${tx.id}/costs`));
    expect(costs.revisions).toHaveLength(4);
    expect(costs.current.filter((c: Json) => c.basis === "quoted" && c.category === "freight")[0]).toMatchObject({ amount: "1350.00", note: "Carrier raised the rate" });
    expect(costs.totals).toEqual(expect.arrayContaining([{ basis: "quoted", currency: "USD", total: "4350.5" }, { basis: "actual", currency: "EUR", total: "900" }]));
    expect((await post(w.owner, `/transactions/${tx.id}/costs`, { category: "freight", basis: "quoted", amount: -5, currency: "USD" })).status).toBe(400);
    expect((await post(w.owner, `/transactions/${tx.id}/costs`, { category: "freight", basis: "quoted", amount: 5, currency: "USDX" })).status).toBe(400);
  });

  it("is private to the business, open to staff who can reach it, and not writable by an assessor", async () => {
    expect((await get(w.stranger, `/transactions/${tx.id}/costs`)).status).toBe(404);
    expect((await post(w.stranger, `/transactions/${tx.id}/events`, { type: "note", summary: "x" })).status).toBe(404);
    expect((await get(w.admin, `/transactions/${tx.id}/events`)).status).toBe(200);
    // An assessor sees only the cohorts they're on, and can't write even then.
    expect((await get(w.assessor, `/transactions/${tx.id}/events`)).status).toBe(404);
    const [program] = await db.insert(schema.program).values({ name: `${PREFIX}bt-program` }).returning();
    const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}bt-cohort`, country: "ET" }).returning();
    await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: w.org, status: "active" });
    await db.insert(schema.cohortStaff).values({ cohortId: cohort!.id, userId: w.assessor.id });
    expect((await get(w.assessor, `/transactions/${tx.id}/events`)).status).toBe(200);
    expect((await post(w.assessor, `/transactions/${tx.id}/events`, { type: "note", summary: "x" })).status).toBe(403);
  });
});
