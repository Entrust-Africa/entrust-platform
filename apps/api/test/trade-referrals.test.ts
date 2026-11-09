import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Partner referrals and integration records (#195): nothing is released without the business's consent, and MIZAN stays pending.

vi.mock("@entrust/jobs", async (importOriginal) => ({ ...(await importOriginal<typeof import("@entrust/jobs")>()), enqueue: vi.fn(async () => "job") }));

const w = {} as { owner: TestUser; member: TestUser; stranger: TestUser; admin: TestUser; facilitator: TestUser; assessor: TestUser; org: string; otherOrg: string };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);
const post = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "POST", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};
const refer = async (over: Json = {}) => ok(await post(w.admin, "/referrals", { organizationId: w.org, destinationName: "Zemen Bank", destinationType: "bank", reason: "Working capital for a confirmed order", sharedDataKinds: ["profile", "products"], ...over }));

beforeAll(async () => {
  await cleanup();
  const [owner, member, stranger, admin, facilitator, assessor] = (await Promise.all(["rf-owner", "rf-member", "rf-stranger", "rf-admin", "rf-facilitator", "rf-assessor"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, member, stranger, admin, facilitator, assessor });
  process.env.ENTRUST_ORG_ID = await createOrganization("rf-entrust", [[admin, "admin"], [facilitator, "facilitator"], [assessor, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("rf-sme", [[owner, "owner"], [member, "member"]], { platform: "trade" });
  w.otherOrg = await createOrganization("rf-other", [[stranger, "owner"]], { platform: "trade" });
  await db.insert(schema.smeProduct).values({ organizationId: w.org, name: "Washed Yirgacheffe" });
  await db.insert(schema.smeExportHistory).values({ organizationId: w.org, product: "Coffee", destination: "Germany" });
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("a referral and its consent", () => {
  let referral: Json;

  it("is made by a Super Admin or Cohort Manager, and shares nothing yet", async () => {
    expect((await post(w.assessor, "/referrals", { organizationId: w.org, destinationName: "X", destinationType: "bank", reason: "y", sharedDataKinds: [] })).status).toBe(403);
    expect((await post(w.owner, "/referrals", { organizationId: w.org, destinationName: "X", destinationType: "bank", reason: "y", sharedDataKinds: [] })).status).toBe(403);
    expect((await post(w.admin, "/referrals", { organizationId: w.org, destinationName: "", destinationType: "bank", reason: "y", sharedDataKinds: [] })).status).toBe(400);
    expect((await post(w.admin, "/referrals", { organizationId: w.org, destinationName: "X", destinationType: "bank", reason: "y", sharedDataKinds: ["tin_numbers"] })).status).toBe(400);
    referral = await refer();
    expect(referral).toMatchObject({ status: "draft", consentStatus: "not_requested", sharedDataKinds: ["profile", "products"], destinationType: "bank" });
    // Without consent there is nothing to release.
    const refused = await post(w.admin, `/referrals/${referral.id}/release`);
    expect(refused.status).toBe(403);
    expect(refused.body.error).toContain("hasn't agreed");
  });

  it("stays hidden from the business while it is a draft, then shows what would be shared", async () => {
    expect((await get(w.owner, `/referrals?organizationId=${w.org}`)).body.items).toEqual([]);
    ok(await post(w.admin, `/referrals/${referral.id}/request-consent`));
    const seen = (await get(w.owner, `/referrals?organizationId=${w.org}`)).body.items;
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ status: "awaiting_consent", consentStatus: "requested", destinationName: "Zemen Bank", reason: "Working capital for a confirmed order", sharedDataKinds: ["profile", "products"] });
    const told = await db.select().from(schema.notification).where(eq(schema.notification.userId, w.owner.id));
    expect(told.map((n) => n.kind)).toContain("referral_status");
    expect((await post(w.admin, `/referrals/${referral.id}/request-consent`)).status).toBe(200);
  });

  it("can be decided only by an owner of the business, not staff or a colleague", async () => {
    for (const user of [w.member, w.admin, w.stranger]) expect((await post(user, `/referrals/${referral.id}/consent`, { decision: "grant" })).status).toBeGreaterThanOrEqual(403);
    expect((await post(w.owner, `/referrals/${referral.id}/consent`, { decision: "withdraw" })).status).toBe(409);
  });

  it("releases only the agreed kinds once the owner agrees, and records the release", async () => {
    const granted = ok(await post(w.owner, `/referrals/${referral.id}/consent`, { decision: "grant" }));
    expect(granted).toMatchObject({ consentStatus: "granted", status: "ready" });
    const pack = ok(await post(w.admin, `/referrals/${referral.id}/release`));
    expect(pack.kinds).toEqual(["profile", "products"]);
    expect(pack.profile.legalName).toBe("rf-sme");
    expect(pack.products.map((p: Json) => p.name)).toEqual(["Washed Yirgacheffe"]);
    // Shipments weren't agreed to, so they aren't in it.
    expect(pack.exportHistory).toBeUndefined();
    expect(pack.financialWorksheets).toBeUndefined();
    expect((await get(w.admin, `/referrals?organizationId=${w.org}`)).body.items[0].status).toBe("shared");
    const events = (await get(w.admin, `/referrals/${referral.id}/events`)).body.items.map((e: Json) => e.type);
    expect(events).toEqual(expect.arrayContaining(["created", "consent_requested", "consent_granted", "package_released"]));
    expect((await post(w.assessor, `/referrals/${referral.id}/release`)).status).toBe(403);
  });

  it("closes the door again when the business withdraws", async () => {
    ok(await post(w.owner, `/referrals/${referral.id}/consent`, { decision: "withdraw" }));
    const refused = await post(w.admin, `/referrals/${referral.id}/release`);
    expect(refused.status).toBe(403);
    const after = (await get(w.admin, `/referrals?organizationId=${w.org}`)).body.items[0];
    expect(after).toMatchObject({ consentStatus: "withdrawn", status: "closed" });
    expect((await get(w.admin, `/referrals/${referral.id}/events`)).body.items.map((e: Json) => e.type)).toContain("consent_withdrawn");
  });

  it("closes the referral when the business declines", async () => {
    const second = await refer({ destinationName: "EthioLife", destinationType: "insurer", sharedDataKinds: ["export_history"] });
    ok(await post(w.admin, `/referrals/${second.id}/request-consent`));
    const declined = ok(await post(w.owner, `/referrals/${second.id}/consent`, { decision: "decline" }));
    expect(declined).toMatchObject({ consentStatus: "declined", status: "closed" });
    expect((await post(w.admin, `/referrals/${second.id}/release`)).status).toBe(403);
  });

  it("follows the referral to an outcome, and refuses a jump", async () => {
    const third = await refer({ destinationName: "Export Advisory Ltd", destinationType: "service_provider", sharedDataKinds: ["profile", "export_history"] });
    expect((await post(w.admin, `/referrals/${third.id}/status`, { status: "completed" })).status).toBe(409);
    ok(await post(w.admin, `/referrals/${third.id}/request-consent`));
    ok(await post(w.owner, `/referrals/${third.id}/consent`, { decision: "grant" }));
    const pack = ok(await post(w.admin, `/referrals/${third.id}/release`));
    expect(pack.exportHistory.map((s: Json) => s.product)).toEqual(["Coffee"]);
    ok(await post(w.admin, `/referrals/${third.id}/status`, { status: "accepted" }));
    const done = ok(await post(w.admin, `/referrals/${third.id}/status`, { status: "completed", outcome: "Advisory contract signed" }));
    expect(done).toMatchObject({ status: "completed", outcome: "Advisory contract signed" });
  });

  it("is private to the business and to staff who can reach it", async () => {
    expect((await get(w.stranger, `/referrals?organizationId=${w.org}`)).status).toBe(404);
    expect((await post(w.stranger, `/referrals/${referral.id}/consent`, { decision: "grant" })).status).toBe(404);
    // An assessor not on the cohort sees none, and can't see the business's referrals by naming it.
    expect((await get(w.assessor, "/referrals")).body.items).toEqual([]);
    expect((await get(w.assessor, `/referrals?organizationId=${w.org}`)).status).toBe(404);
  });
});

describe("integration records", () => {
  it("shows MIZAN as pending and refuses to record anything for it", async () => {
    const res = ok(await get(w.owner, `/integrations?organizationId=${w.org}`));
    expect(res.providers).toEqual([
      { provider: "mizan", available: false, status: "pending" },
      { provider: "clear", available: true, status: "pending" },
      { provider: "africonnect", available: true, status: "pending" },
    ]);
    const refused = await post(w.admin, "/integrations", { organizationId: w.org, provider: "mizan", recordType: "assessment", syncStatus: "synced" });
    expect(refused.status).toBe(422);
    expect(refused.body.error).toContain("isn't connected yet");
  });

  it("records a sync, updates the same record, and keeps a failure out of the way of everything else", async () => {
    ok(await post(w.admin, "/integrations", { organizationId: w.org, provider: "clear", recordType: "workflow", externalReference: "CLR-1", syncStatus: "synced" }));
    ok(await post(w.admin, "/integrations", { organizationId: w.org, provider: "clear", recordType: "workflow", externalReference: "CLR-1", syncStatus: "failed", errorCode: "timeout", errorDescription: "CLEAR did not answer" }));
    const res = ok(await get(w.owner, `/integrations?organizationId=${w.org}`));
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({ provider: "clear", syncStatus: "failed", errorCode: "timeout", errorDescription: "CLEAR did not answer" });
    expect(res.providers.find((p: Json) => p.provider === "clear").status).toBe("failed");
    // The business profile and everything else still answer.
    expect((await get(w.owner, `/business-profile?organizationId=${w.org}`)).status).toBe(200);
    ok(await post(w.admin, "/integrations", { organizationId: w.org, provider: "clear", recordType: "workflow", syncStatus: "synced" }));
    expect(ok(await get(w.owner, `/integrations?organizationId=${w.org}`)).items[0]).toMatchObject({ syncStatus: "synced", errorCode: null });
  });

  it("is for a Super Admin to write and the business and its staff to read", async () => {
    expect((await post(w.facilitator, "/integrations", { organizationId: w.org, provider: "clear", recordType: "x", syncStatus: "synced" })).status).toBe(403);
    expect((await post(w.owner, "/integrations", { organizationId: w.org, provider: "clear", recordType: "x", syncStatus: "synced" })).status).toBe(403);
    expect((await get(w.stranger, `/integrations?organizationId=${w.org}`)).status).toBe(404);
  });
});
