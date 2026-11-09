import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

const w = {} as { owner: TestUser; rival: TestUser; admin: TestUser; reviewer: TestUser; org: string; enrollment: string; item: string; cohort: string };
const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};
const plan = (user = w.owner) => get(user, `/action-plan?organizationId=${w.org}`);

beforeAll(async () => {
  await cleanup();
  const [owner, rival, admin, reviewer] = (await Promise.all(["ap-owner", "ap-rival", "ap-admin", "ap-reviewer"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, rival, admin, reviewer });
  process.env.ENTRUST_ORG_ID = await createOrganization("ap-entrust", [[admin, "admin"], [reviewer, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("ap-sme", [[owner, "owner"]], { platform: null });
  await createOrganization("ap-rival-sme", [[rival, "owner"]], { platform: "trade" });
  const program = ok(await post(admin, "/programs", { name: `${PREFIX}ap-program` }));
  w.cohort = ok(await post(admin, "/cohorts", { programId: program.id, name: `${PREFIX}ap-cohort`, country: "ET" })).id;
  w.enrollment = ok(await post(admin, "/enrollments", { cohortId: w.cohort, organizationId: w.org })).id;
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}ap-%`));
});

describe("the 90-day action plan", () => {
  it("adds an action with an owner and a deadline, and flags it when it's late", async () => {
    expect((await post(w.owner, "/action-plan/items", { organizationId: w.org, description: "No owner", dueDate: "2026-12-01" })).status).toBe(400);
    const item = ok(await post(w.owner, "/action-plan/items", { organizationId: w.org, description: "Qualify 10 buyers", responsible: "Sara", dueDate: "2020-01-15", milestone: 30 }));
    w.item = item.id;
    expect(item).toMatchObject({ status: "not_started", overdue: true, milestone: 30, fromRegister: false });
    const body = ok(await plan());
    expect(body.milestones).toEqual([
      { day: 30, total: 1, completed: 0, overdue: 1 },
      { day: 60, total: 0, completed: 0, overdue: 0 },
      { day: 90, total: 0, completed: 0, overdue: 0 },
    ]);
  });

  it("tracks status and evidence, and records the change", async () => {
    const done = ok(await callV1(w.owner, "PATCH", `/trade/action-plan/items/${w.item}`, { status: "completed", evidence: "Buyer pipeline" }));
    expect(done).toMatchObject({ status: "completed", evidence: "Buyer pipeline", overdue: false });
    expect(ok(await plan()).milestones[0]).toEqual({ day: 30, total: 1, completed: 1, overdue: 0 });
    const logs = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.item));
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(["trade.action_item.created", "trade.action_item.updated"]));
    expect((await callV1(w.owner, "PATCH", `/trade/action-plan/items/${w.item}`, { status: "made_up" })).status).toBe(400);
  });

  it("brings in the submitted M12 register once, and only what the SME wrote", async () => {
    const early = await post(w.owner, "/action-plan/import", { organizationId: w.org });
    expect(early.status).toBeGreaterThanOrEqual(400);
    expect(early.body.error).toContain("M12");

    const rows = [1, 2, 3, 4, 5].map((n) => ({ area: "Buyers", result: `Result ${n}`, action: `Action ${n}`, responsible: "Sara", resources: "Time", deadline: "2030-01-01", measure: `Measure ${n}`, evidence: `Evidence ${n}`, status: "in_progress" }));
    const [version] = await db
      .insert(schema.worksheetVersion)
      .values({ enrollmentId: w.enrollment, worksheetId: "m12-action-register", moduleId: "M12", version: 1, values: { actions: rows }, status: "submitted", submittedAt: new Date() })
      .returning();
    expect(ok(await post(w.owner, "/action-plan/import", { organizationId: w.org })).imported).toBe(5);
    expect(ok(await post(w.owner, "/action-plan/import", { organizationId: w.org })).imported).toBe(0);
    const items = ok(await plan()).items.filter((i: Json) => i.fromRegister);
    expect(items).toHaveLength(5);
    expect(items[0]).toMatchObject({ description: "Action 1", responsible: "Sara", expectedResult: "Result 1", performanceIndicator: "Measure 1", status: "in_progress", milestone: 90 });
    expect(version).toBeTruthy();
  });

  it("records M12's reviews against the plan", async () => {
    expect((await post(w.owner, "/action-plan/reviews", { organizationId: w.org, day: 45, answers: {} })).status).toBe(400);
    expect((await post(w.owner, "/action-plan/reviews", { organizationId: w.org, day: 30, answers: { made_up: "x" } })).status).toBe(422);
    ok(await post(w.owner, "/action-plan/reviews", { organizationId: w.org, day: 30, answers: { started: "Two of them" } }));
    const body = ok(await plan());
    expect(body.reviews).toHaveLength(1);
    expect(body.reviews[0]).toMatchObject({ day: 30, answers: { started: "Two of them" } });
    expect(body.questions["90"].at(-1).text).toBe("What should the next 90-day plan address?");
  });

  it("stays available after the programme is completed", async () => {
    await db.update(schema.enrollment).set({ status: "completed", completedAt: new Date() }).where(eq(schema.enrollment.id, w.enrollment));
    expect(ok(await plan()).items.length).toBeGreaterThan(0);
    ok(await post(w.owner, "/action-plan/items", { organizationId: w.org, description: "After the certificate", responsible: "Sara", dueDate: "2030-02-01" }));
    ok(await post(w.owner, "/action-plan/reviews", { organizationId: w.org, day: 60, answers: { changes: "More buyers" } }));
  });

  it("keeps a plan from anyone it doesn't belong to", async () => {
    expect((await plan(w.rival)).status).toBe(404);
    expect((await callV1(w.rival, "PATCH", `/trade/action-plan/items/${w.item}`, { status: "cancelled" })).status).toBe(404);
    // A reviewer who isn't on the cohort can't reach it. Once on it, they read but don't write.
    expect((await plan(w.reviewer)).status).toBe(404);
    ok(await post(w.admin, `/cohorts/${w.cohort}/staff`, { userId: w.reviewer.id }));
    expect((await plan(w.reviewer)).status).toBe(200);
    expect((await callV1(w.reviewer, "PATCH", `/trade/action-plan/items/${w.item}`, { status: "cancelled" })).status).toBe(403);
  });
});
