import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FACTS, PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

const w = {} as { owner: TestUser; rival: TestUser; admin: TestUser; reviewer: TestUser; org: string; rivalOrg: string; cohort: string; enrollment: string; tx: string; clearCase: string; rivalCase: string };
const get = (user: TestUser, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const patch = (user: TestUser, path: string, body?: unknown) => callV1(user, "PATCH", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};

beforeAll(async () => {
  await cleanup();
  const [owner, rival, admin, reviewer] = (await Promise.all(["tx-owner", "tx-rival", "tx-admin", "tx-reviewer"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, rival, admin, reviewer });
  process.env.ENTRUST_ORG_ID = await createOrganization("tx-entrust", [[admin, "admin"], [reviewer, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("tx-sme", [[owner, "owner"]], { platform: null });
  w.rivalOrg = await createOrganization("tx-rival-sme", [[rival, "owner"]], { platform: null });
  for (const organizationId of [w.org, w.rivalOrg]) {
    await db.insert(schema.platformAccess).values([{ organizationId, platform: "clear" }, { organizationId, platform: "trade" }]);
  }
  const program = ok(await post(admin, "/programs", { name: `${PREFIX}tx-program` }));
  w.cohort = ok(await post(admin, "/cohorts", { programId: program.id, name: `${PREFIX}tx-cohort`, country: "ET" })).id;
  w.enrollment = ok(await post(admin, "/enrollments", { cohortId: w.cohort, organizationId: w.org })).id;
  w.clearCase = ok(await callV1(owner, "POST", "/clear/cases", { organizationId: w.org, facts: FACTS })).id;
  w.rivalCase = ok(await callV1(rival, "POST", "/clear/cases", { organizationId: w.rivalOrg, facts: FACTS })).id;
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}tx-%`));
});

describe("the export transaction workspace", () => {
  it("gives each transaction its own reference, and more than one per business", async () => {
    expect((await post(w.owner, "/transactions", { organizationId: w.org, product: "" })).status).toBe(400);
    const first = ok(await post(w.owner, "/transactions", { organizationId: w.org, product: "Work suits", destination: "KE" }));
    const practice = ok(await post(w.owner, "/transactions", { organizationId: w.org, product: "Practice order", isPractice: true }));
    w.tx = first.id;
    expect(first.reference).toMatch(/^TX-\d{4}-[0-9A-F]{6}$/);
    expect(first.reference).not.toBe(practice.reference);
    expect(first).toMatchObject({ stage: "enquiry", isPractice: false, clearCase: null });
    expect(practice.isPractice).toBe(true);
    const list = ok(await get(w.owner, `/transactions?organizationId=${w.org}`));
    expect(list.items).toHaveLength(2);
  });

  it("records the transaction's details and stage, on the audit log", async () => {
    const updated = ok(await patch(w.owner, `/transactions/${w.tx}`, { stage: "quoted", incoterm: "FCA", namedPlace: "Addis Ababa", paymentRisk: "Open account refused", currency: "USD" }));
    expect(updated).toMatchObject({ stage: "quoted", incoterm: "FCA", namedPlace: "Addis Ababa", paymentRisk: "Open account refused" });
    expect((await patch(w.owner, `/transactions/${w.tx}`, { stage: "approved_by_customs" })).status).toBe(400);
    const logs = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.tx));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["trade.transaction.created", "trade.transaction.updated"]));
  });

  it("links to the business's own real CLEAR case, and no other", async () => {
    expect(ok(await get(w.owner, `/transactions?organizationId=${w.org}`)).clearCases.map((c: Json) => c.id)).toEqual([w.clearCase]);
    expect((await patch(w.owner, `/transactions/${w.tx}`, { clearCaseId: w.rivalCase })).status).toBe(404);
    const linked = ok(await patch(w.owner, `/transactions/${w.tx}`, { clearCaseId: w.clearCase }));
    expect(linked.clearCase.id).toBe(w.clearCase);
    expect(linked.clearCase.reference).toBeTruthy();
    expect(ok(await patch(w.owner, `/transactions/${w.tx}`, { clearCaseId: null })).clearCase).toBeNull();
  });

  it("stays available after the programme is completed", async () => {
    await db.update(schema.enrollment).set({ status: "completed", completedAt: new Date() }).where(eq(schema.enrollment.id, w.enrollment));
    ok(await patch(w.owner, `/transactions/${w.tx}`, { stage: "shipped" }));
  });

  it("keeps a transaction from anyone it doesn't belong to", async () => {
    expect((await get(w.rival, `/transactions?organizationId=${w.org}`)).status).toBe(404);
    expect((await patch(w.rival, `/transactions/${w.tx}`, { stage: "closed" })).status).toBe(404);
    expect((await get(w.reviewer, `/transactions?organizationId=${w.org}`)).status).toBe(404);
    ok(await post(w.admin, `/cohorts/${w.cohort}/staff`, { userId: w.reviewer.id }));
    expect((await get(w.reviewer, `/transactions?organizationId=${w.org}`)).status).toBe(200);
    expect((await patch(w.reviewer, `/transactions/${w.tx}`, { stage: "closed" })).status).toBe(403);
  });
});
