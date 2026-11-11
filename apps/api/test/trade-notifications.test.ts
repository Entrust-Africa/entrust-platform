import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";
import { notify, sendDueReminders } from "../src/services/trade-notifications";

// Notifications (FRD section 8): in the platform and by email, as each person prefers. The email queue is replaced.

const queue = vi.hoisted(() => ({ jobs: [] as { name: string; data: Json }[], fail: false }));
vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: vi.fn(async (name: string, data: Json) => {
    if (queue.fail) throw new Error("The queue is down");
    queue.jobs.push({ name, data });
    return "job";
  }),
}));

const w = {} as { owner: TestUser; member: TestUser; stranger: TestUser; admin: TestUser; assessor: TestUser; org: string; cohort: string };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);
const post = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "POST", `/trade${path}`, body);
const put = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "PUT", `/trade${path}`, body);

beforeAll(async () => {
  process.env.TRADE_APP_URL = "https://trade.example.test";
  await cleanup();
  const [owner, member, stranger, admin, assessor] = (await Promise.all(["nt-owner", "nt-member", "nt-stranger", "nt-admin", "nt-assessor"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, member, stranger, admin, assessor });
  process.env.ENTRUST_ORG_ID = await createOrganization("nt-entrust", [[admin, "admin"], [assessor, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("nt-sme", [[owner, "owner"], [member, "member"]], { platform: "trade" });
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}nt-program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}nt-cohort`, country: "ET" }).returning();
  w.cohort = cohort!.id;
  await db.insert(schema.enrollment).values({ cohortId: w.cohort, organizationId: w.org, status: "active" });
  await db.insert(schema.cohortStaff).values({ cohortId: w.cohort, userId: w.assessor.id });
});

beforeEach(async () => {
  queue.jobs.length = 0;
  queue.fail = false;
  await db.delete(schema.notification);
  await db.delete(schema.notificationPreference);
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  delete process.env.TRADE_APP_URL;
  await cleanup();
});

const tell = (userIds: string[], over: Partial<Parameters<typeof notify>[1]> = {}) =>
  notify(db, { userIds, kind: "assessment_result", title: "Your M04 practical has been scored", body: "Outcome: pass.", path: "/modules/M04", ...over });

describe("telling people", () => {
  it("puts a message in the platform and queues an email with a link, for each person", async () => {
    expect(await tell([w.owner.id, w.member.id])).toBe(2);
    const mine = (await get(w.owner, "/notifications")).body;
    expect(mine.unread).toBe(1);
    expect(mine.items[0]).toMatchObject({ kind: "assessment_result", title: "Your M04 practical has been scored", path: "/modules/M04", read: false });
    expect(queue.jobs).toHaveLength(2);
    expect(queue.jobs[0]!.data).toMatchObject({ template: "trade-notice", subject: "Your M04 practical has been scored" });
    expect(queue.jobs[0]!.data.props.action).toEqual({ label: "Open in TRADE", url: "https://trade.example.test/modules/M04" });
    expect((await get(w.stranger, "/notifications")).body.items).toEqual([]);
  });

  it("follows each person's choice for each kind", async () => {
    expect((await get(w.owner, "/notification-preferences")).body.items.find((p: Json) => p.kind === "assessment_result")).toMatchObject({ email: true, inApp: true });
    await put(w.owner, "/notification-preferences", { kind: "assessment_result", email: false, inApp: true });
    await put(w.member, "/notification-preferences", { kind: "assessment_result", email: true, inApp: false });
    // Both are told: the owner in the platform only, the member by email only.
    expect(await tell([w.owner.id, w.member.id])).toBe(2);
    expect((await get(w.owner, "/notifications")).body.items).toHaveLength(1);
    expect((await get(w.member, "/notifications")).body.items).toHaveLength(0);
    expect(queue.jobs.map((j) => j.data.to)).toHaveLength(1);
    await put(w.owner, "/notification-preferences", { kind: "assessment_result", email: false, inApp: false });
    queue.jobs.length = 0;
    expect(await tell([w.owner.id])).toBe(0);
    expect(queue.jobs).toEqual([]);
    expect((await put(w.owner, "/notification-preferences", { kind: "nope", email: true, inApp: true })).status).toBe(400);
  });

  it("still shows the message when the email queue is down, and says the email failed", async () => {
    queue.fail = true;
    expect(await tell([w.owner.id])).toBe(1);
    const [row] = await db.select().from(schema.notification);
    expect(row!.emailStatus).toBe("failed");
  });

  it("tells a person once for the same thing, in the platform and by email", async () => {
    expect(await tell([w.owner.id], { dedupeKey: "same-thing" })).toBe(1);
    expect(await tell([w.owner.id], { dedupeKey: "same-thing" })).toBe(0);
    expect(await db.select().from(schema.notification)).toHaveLength(1);
    // The email is what people notice: the second call mustn't queue another.
    expect(queue.jobs).toHaveLength(1);
  });

  it("emails a person who wants email only once for the same thing, and keeps it out of their list", async () => {
    await put(w.owner, "/notification-preferences", { kind: "assessment_result", email: true, inApp: false });
    expect(await tell([w.owner.id], { dedupeKey: "email-only" })).toBe(1);
    expect(await tell([w.owner.id], { dedupeKey: "email-only" })).toBe(0);
    expect(queue.jobs).toHaveLength(1);
    expect((await get(w.owner, "/notifications")).body).toEqual({ unread: 0, items: [] });
  });

  it("records that an email was queued, or that it failed", async () => {
    await tell([w.owner.id], { dedupeKey: "queued" });
    expect((await db.select().from(schema.notification))[0]!.emailStatus).toBe("queued");
  });

  it("lets a person read their own and no one else's", async () => {
    await tell([w.owner.id, w.owner.id].slice(0, 1));
    await tell([w.owner.id], { title: "Second" });
    const [first] = (await get(w.owner, "/notifications")).body.items;
    expect((await post(w.stranger, "/notifications/read", { ids: [first.id] })).body.unread).toBe(0);
    expect((await get(w.owner, "/notifications")).body.unread).toBe(2);
    expect((await post(w.owner, "/notifications/read", { ids: [first.id] })).body.unread).toBe(1);
    expect((await get(w.owner, "/notifications?unreadOnly=true")).body.items).toHaveLength(1);
    expect((await post(w.owner, "/notifications/read", { all: true })).body.unread).toBe(0);
    expect((await post(w.owner, "/notifications/read", {})).status).toBe(422);
  });
});

describe("what sets them off", () => {
  it("tells the cohort's assessors when a business records its first completed shipment", async () => {
    const tx = (await post(w.owner, "/transactions", { organizationId: w.org, product: "Coffee" })).body;
    await callV1(w.owner, "PATCH", `/trade/transactions/${tx.id}`, { stage: "closed" });
    const items = (await get(w.assessor, "/notifications")).body.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "admin_alert", title: "A business recorded its first completed shipment" });
    expect((await get(w.admin, "/notifications")).body.items).toEqual([]);
  });

  it("reminds a business once about an overdue action item, and not about one that is done", async () => {
    await db.insert(schema.actionItem).values([
      { organizationId: w.org, description: "Register with the customs authority", responsible: "Owner", dueDate: "2020-01-01", status: "in_progress" },
      { organizationId: w.org, description: "Already finished", responsible: "Owner", dueDate: "2020-01-01", status: "completed" },
      { organizationId: w.org, description: "Not due yet", responsible: "Owner", dueDate: "2999-01-01", status: "not_started" },
    ]);
    const first = await sendDueReminders(db);
    expect(first.overdueActions).toBe(2);
    expect(queue.jobs).toHaveLength(2);
    // The next day's run: nothing new, and no second email to either person.
    const second = await sendDueReminders(db, new Date(Date.now() + 86_400_000));
    expect(second.overdueActions).toBe(0);
    expect(queue.jobs).toHaveLength(2);
    const items = (await get(w.owner, "/notifications")).body.items;
    expect(items).toHaveLength(1);
    expect(items[0].body).toContain("Register with the customs authority");
  });

  it("doesn't chase a business that withdrew or finished", async () => {
    const left = await createOrganization("nt-left", [[w.stranger, "owner"]], { platform: "trade" });
    const [cohort] = await db.select({ id: schema.cohort.id }).from(schema.cohort).where(eq(schema.cohort.id, w.cohort));
    await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: left, status: "withdrawn" });
    await db.insert(schema.actionItem).values({ organizationId: left, description: "Left behind", responsible: "Owner", dueDate: "2020-01-01", status: "in_progress" });
    await sendDueReminders(db);
    expect((await get(w.stranger, "/notifications")).body.items).toEqual([]);
    expect(queue.jobs.filter((j) => j.data.props.paragraphs?.[0]?.includes("Left behind"))).toEqual([]);
  });

  it("reminds a business about learning it left unfinished, once a week", async () => {
    const [enrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.organizationId, w.org));
    await db.insert(schema.moduleProgress).values({ enrollmentId: enrollment!.id, moduleId: "M04", contentVersion: "1.0.0", status: "in_progress", lessonProgress: {}, updatedAt: new Date(Date.now() - 20 * 86_400_000) });
    expect((await sendDueReminders(db)).incompleteLearning).toBe(2);
    expect((await sendDueReminders(db)).incompleteLearning).toBe(0);
    expect((await get(w.owner, "/notifications")).body.items[0]).toMatchObject({ kind: "learning_incomplete", path: "/modules/M04" });
  });

  it("keeps to one learning reminder a week across the new year", async () => {
    const [enrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.organizationId, w.org));
    await db.insert(schema.moduleProgress).values({ enrollmentId: enrollment!.id, moduleId: "M05", contentVersion: "1.0.0", status: "in_progress", lessonProgress: {}, updatedAt: new Date("2026-12-01T00:00:00Z") });
    // 31 December and 1 January are in the same week: the second run tells nobody again.
    expect((await sendDueReminders(db, new Date("2026-12-31T06:00:00Z"))).incompleteLearning).toBeGreaterThan(0);
    expect((await sendDueReminders(db, new Date("2027-01-01T06:00:00Z"))).incompleteLearning).toBe(0);
  });

  it("lets only an administrator send the reminders", async () => {
    expect((await post(w.owner, "/notifications/send-reminders")).status).toBe(403);
    expect((await post(w.assessor, "/notifications/send-reminders")).status).toBe(403);
    expect((await post(w.admin, "/notifications/send-reminders")).status).toBe(200);
  });
});
