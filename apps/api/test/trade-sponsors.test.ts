import { and, eq, inArray, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { SPONSOR_DATA_KINDS } from "@entrust/trade-engine";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Sponsor organisations, what they see and what an SME agrees to share with them (#70).

interface World {
  owner: TestUser;
  member: TestUser;
  rivalOwner: TestUser;
  bankAdmin: TestUser;
  bankViewer: TestUser;
  otherBankAdmin: TestUser;
  newcomer: TestUser;
  admin: TestUser;
  reviewer: TestUser;
  org: string;
  rivalOrg: string;
  entrust: string;
  bank: string;
  otherBank: string;
  cohortA: string;
  cohortB: string;
  enrollment: string;
}
const w = {} as World;
const emails = new Map<string, string>();

const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const del = (user: TestUser | null, path: string) => callV1(user, "DELETE", `/trade${path}`);

async function emailOf(user: TestUser): Promise<string> {
  const [row] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, user.id));
  return row!.email;
}

beforeAll(async () => {
  await cleanup();
  const users = await Promise.all(["owner", "member", "rival", "bank-admin", "bank-viewer", "other-bank-admin", "newcomer", "admin", "reviewer"].map(signUp));
  const [owner, member, rivalOwner, bankAdmin, bankViewer, otherBankAdmin, newcomer, admin, reviewer] = users as TestUser[] as [
    TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser,
  ];
  Object.assign(w, { owner, member, rivalOwner, bankAdmin, bankViewer, otherBankAdmin, newcomer, admin, reviewer });
  for (const [name, user] of Object.entries({ bankAdmin, bankViewer, otherBankAdmin, newcomer })) emails.set(name, await emailOf(user));

  w.org = await createOrganization("sp-org", [[owner, "owner"], [member, "member"]], { platform: "trade" });
  w.rivalOrg = await createOrganization("sp-rival", [[rivalOwner, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("sp-entrust", [[admin, "admin"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;

  // The sponsors are made the way Entrust makes them.
  const bank = await post(admin, "/sponsors", { name: `${PREFIX}Zemen Test Bank`, slug: `${PREFIX}zemen-bank`, adminEmail: emails.get("bankAdmin") });
  const other = await post(admin, "/sponsors", { name: `${PREFIX}Other Test Bank`, slug: `${PREFIX}other-bank`, adminEmail: emails.get("otherBankAdmin") });
  expect([bank.status, other.status]).toEqual([201, 201]);
  w.bank = bank.body.id;
  w.otherBank = other.body.id;
  await post(bankAdmin, `/sponsors/${w.bank}/members`, { email: emails.get("bankViewer"), role: "sponsor_viewer" });

  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}program` }).returning();
  const cohorts = await db
    .insert(schema.cohort)
    .values([
      { programId: program!.id, name: `${PREFIX}cohort-a`, country: "ET", sponsorOrganizationId: w.bank },
      { programId: program!.id, name: `${PREFIX}cohort-b`, country: "ET", sponsorOrganizationId: w.otherBank },
    ])
    .returning();
  w.cohortA = cohorts[0]!.id;
  w.cohortB = cohorts[1]!.id;
  const enrollments = await db
    .insert(schema.enrollment)
    .values([
      { cohortId: w.cohortA, organizationId: w.org, status: "active" },
      { cohortId: w.cohortA, organizationId: w.rivalOrg, status: "active" },
      { cohortId: w.cohortB, organizationId: w.rivalOrg, status: "active" },
    ])
    .returning();
  w.enrollment = enrollments[0]!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  const sponsors = await db.select({ id: schema.organization.id }).from(schema.organization).where(like(schema.organization.slug, `${PREFIX}%`));
  const ids = sponsors.map((s) => s.id);
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}%`));
  if (ids.length) {
    await db.delete(schema.auditLog).where(inArray(schema.auditLog.organizationId, ids));
    await db.delete(schema.platformAccess).where(inArray(schema.platformAccess.organizationId, ids));
    await db.delete(schema.organization).where(inArray(schema.organization.id, ids));
  }
});

// ---- Sponsor organisations ----

describe("creating a sponsor", () => {
  it("is for an Entrust administrator", async () => {
    const body = { name: "Nope Bank", slug: `${PREFIX}nope`, adminEmail: emails.get("newcomer") };
    for (const user of [w.reviewer, w.owner, w.bankAdmin]) expect((await post(user, "/sponsors", body)).status).toBe(403);
    expect((await post(null, "/sponsors", body)).status).toBe(401);
  });

  it("makes an organisation of the sponsor kind with TRADE access and a first administrator", async () => {
    const [org] = await db.select().from(schema.organization).where(eq(schema.organization.id, w.bank));
    expect(JSON.parse(org!.metadata as string)).toEqual({ kind: "sponsor" });
    const [grant] = await db.select().from(schema.platformAccess).where(and(eq(schema.platformAccess.organizationId, w.bank), eq(schema.platformAccess.platform, "trade")));
    expect(grant).toBeTruthy();
    const view = await get(w.admin, `/sponsors/${w.bank}`);
    expect(view.body.members.map((m: Json) => `${m.email}:${m.role}`).sort()).toEqual([`${emails.get("bankAdmin")}:sponsor_admin`, `${emails.get("bankViewer")}:sponsor_viewer`].sort());
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.organizationId, w.bank));
    expect(audit.map((a) => a.action)).toContain("trade.sponsor.created");
  });

  it("refuses a slug that is taken and an administrator without an account", async () => {
    const taken = await post(w.admin, "/sponsors", { name: "Again", slug: `${PREFIX}zemen-bank` });
    expect(taken.status).toBe(422);
    const nobody = await post(w.admin, "/sponsors", { name: "Ghost Bank", slug: `${PREFIX}ghost`, adminEmail: "nobody-here@example.test" });
    expect(nobody.status).toBe(422);
    expect(nobody.body.error).toContain("account");
    const [ghost] = await db.select().from(schema.organization).where(eq(schema.organization.slug, `${PREFIX}ghost`));
    expect(ghost).toBeUndefined();
  });

  it("lists the sponsors for staff only", async () => {
    const list = await get(w.reviewer, "/sponsors");
    expect(list.status).toBe(200);
    expect(list.body.items.map((s: Json) => s.id)).toEqual(expect.arrayContaining([w.bank, w.otherBank]));
    expect((await get(w.owner, "/sponsors")).status).toBe(403);
    expect((await get(w.bankAdmin, "/sponsors")).status).toBe(403);
  });
});

describe("a sponsor's people", () => {
  it("lets a sponsor administrator add and remove colleagues, and a viewer do neither", async () => {
    expect((await post(w.bankViewer, `/sponsors/${w.bank}/members`, { email: emails.get("newcomer"), role: "sponsor_viewer" })).status).toBe(403);
    const added = await post(w.bankAdmin, `/sponsors/${w.bank}/members`, { email: emails.get("newcomer"), role: "sponsor_viewer" });
    expect(added.status).toBe(200);
    expect(added.body.members).toHaveLength(3);
    expect((await post(w.bankAdmin, `/sponsors/${w.bank}/members`, { email: emails.get("newcomer"), role: "sponsor_viewer" })).status).toBe(422);
    expect((await del(w.bankViewer, `/sponsors/${w.bank}/members/${w.newcomer.id}`)).status).toBe(403);
    const removed = await del(w.bankAdmin, `/sponsors/${w.bank}/members/${w.newcomer.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.members).toHaveLength(2);
  });

  it("keeps another sponsor's administrator out, and a person who has no account can't be added", async () => {
    expect((await post(w.otherBankAdmin, `/sponsors/${w.bank}/members`, { email: emails.get("newcomer"), role: "sponsor_viewer" })).status).toBe(404);
    expect((await get(w.otherBankAdmin, `/sponsors/${w.bank}`)).status).toBe(404);
    expect((await post(w.bankAdmin, `/sponsors/${w.bank}/members`, { email: "nobody-here@example.test", role: "sponsor_viewer" })).status).toBe(422);
  });

  it("can't remove the last administrator or yourself", async () => {
    expect((await del(w.bankAdmin, `/sponsors/${w.bank}/members/${w.bankAdmin.id}`)).status).toBe(422);
    expect((await del(w.admin, `/sponsors/${w.bank}/members/${w.bankAdmin.id}`)).status).toBe(422);
  });

  it("gives a sponsor role no weight in an organisation that isn't a sponsor", async () => {
    await db.update(schema.member).set({ role: "sponsor_admin" }).where(and(eq(schema.member.organizationId, w.rivalOrg), eq(schema.member.userId, w.rivalOwner.id)));
    expect((await get(w.rivalOwner, "/sponsor/cohorts")).status).toBe(404);
    await db.update(schema.member).set({ role: "owner" }).where(and(eq(schema.member.organizationId, w.rivalOrg), eq(schema.member.userId, w.rivalOwner.id)));
  });
});

// ---- What a sponsor sees ----

describe("a sponsor's cohorts", () => {
  it("shows the cohorts the sponsor sponsors, with figures that name nobody", async () => {
    const res = await get(w.bankViewer, "/sponsor/cohorts");
    expect(res.status).toBe(200);
    expect(res.body.items.map((c: Json) => c.id)).toEqual([w.cohortA]);
    expect(res.body.items[0].figures).toMatchObject({ enrolled: 2, byStatus: { active: 2 }, diagnosticsSubmitted: 0, pathwayA: 0, pathwayB: 0 });
    expect(res.body.disclaimer).toContain("not a credit assessment");
    expect(JSON.stringify(res.body)).not.toContain("sp-org");
    expect(JSON.stringify(res.body)).not.toContain(w.org);
  });

  it("is 404 for a cohort another organisation sponsors", async () => {
    for (const user of [w.bankAdmin, w.bankViewer]) {
      expect((await get(user, `/sponsor/cohorts/${w.cohortB}`)).status).toBe(404);
      expect((await get(user, `/sponsor/cohorts/${w.cohortB}/smes/${w.rivalOrg}`)).status).toBe(404);
    }
    expect((await get(w.otherBankAdmin, `/sponsor/cohorts/${w.cohortA}`)).status).toBe(404);
    expect((await get(w.bankViewer, `/sponsor/cohorts/00000000-0000-4000-8000-000000000000`)).status).toBe(404);
  });

  it("is not there for anyone who isn't in a sponsor organisation", async () => {
    for (const user of [w.owner, w.admin, w.newcomer]) {
      expect((await get(user, "/sponsor/cohorts")).status).toBe(404);
      expect((await get(user, `/sponsor/cohorts/${w.cohortA}`)).status).toBe(404);
    }
    expect((await get(null, "/sponsor/cohorts")).status).toBe(401);
  });

  it("counts a submitted diagnostic and the avenues without a name", async () => {
    const [assessment] = await db.insert(schema.tradeAssessment).values({ enrollmentId: w.enrollment, kind: "diagnostic", templateVersion: "1.0.0", status: "submitted" }).returning();
    await db.insert(schema.pathwayAssignment).values({ enrollmentId: w.enrollment, assessmentId: assessment!.id, pathway: "B", status: "provisional", rulesVersion: "0.2.0", reasonCodes: ["PATHWAY_RECENT_SHIPMENT"] });
    const res = await get(w.bankAdmin, `/sponsor/cohorts/${w.cohortA}`);
    expect(res.body.figures).toMatchObject({ enrolled: 2, diagnosticsSubmitted: 1, pathwayA: 0, pathwayB: 1 });
    expect(res.body.consenting).toEqual([]);
  });
});

// ---- Consent ----

describe("what an SME shares", () => {
  it("lists every kind for each sponsor of its cohorts, with the words the owner agrees to", async () => {
    const res = await get(w.owner, "/consents");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ organizationId: w.org, canChange: true, wordingVersion: "1.0.0" });
    expect(res.body.sponsors).toHaveLength(1);
    const [entry] = res.body.sponsors;
    expect(entry.sponsor.id).toBe(w.bank);
    expect(entry.kinds.map((k: Json) => k.kind)).toEqual([...SPONSOR_DATA_KINDS]);
    expect(entry.kinds.every((k: Json) => k.granted === false && k.consentId === null)).toBe(true);
    expect(entry.kinds[0].wording).toContain(`${PREFIX}Zemen Test Bank can see`);
    expect(entry.kinds.map((k: Json) => k.kind)).toContain("insurance_profile");
  });

  it("shows a member what is shared but lets only the owner change it", async () => {
    const view = await get(w.member, "/consents");
    expect(view.body.canChange).toBe(false);
    const attempt = await post(w.member, "/consents", { sponsorOrganizationId: w.bank, kinds: ["placement_results"] });
    expect(attempt.status).toBe(403);
    expect((await get(w.rivalOwner, `/consents?organizationId=${w.org}`)).status).toBe(404);
  });

  it("shows the sponsor nobody until the owner agrees", async () => {
    expect((await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}/smes/${w.org}`)).status).toBe(404);
    expect((await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}`)).body.consenting).toEqual([]);
  });

  it("shares only the kinds the owner agreed to, by name", async () => {
    const granted = await post(w.owner, "/consents", { sponsorOrganizationId: w.bank, kinds: ["placement_results", "learning_progress"] });
    expect(granted.status).toBe(200);
    const kinds = granted.body.sponsors[0].kinds;
    expect(kinds.filter((k: Json) => k.granted).map((k: Json) => k.kind)).toEqual(["placement_results", "learning_progress"]);

    const cohort = await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}`);
    expect(cohort.body.consenting).toEqual([{ organizationId: w.org, name: "sp-org", smeId: expect.any(String), kinds: ["placement_results", "learning_progress"] }]);

    const sme = await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}/smes/${w.org}`);
    expect(sme.status).toBe(200);
    expect(sme.body.sme).toMatchObject({ organizationId: w.org, name: "sp-org" });
    expect(sme.body.sharedKinds).toEqual(["placement_results", "learning_progress"]);
    expect(Object.keys(sme.body.data).sort()).toEqual(["learning_progress", "placement_results"]);
    expect(sme.body.data.placement_results.pathway).toMatchObject({ pathway: "B", status: "provisional" });
    expect(sme.body.disclaimer).toContain("not a credit assessment");
  });

  it("keeps the words agreed to, and records who and when", async () => {
    const rows = await db.select().from(schema.sponsorConsent).where(eq(schema.sponsorConsent.smeOrganizationId, w.org));
    const row = rows.find((r) => r.kind === "placement_results")!;
    expect(row).toMatchObject({ sponsorOrganizationId: w.bank, grantedByUserId: w.owner.id, wordingVersion: "1.0.0", withdrawnAt: null });
    expect(row.wording).toContain("I understand I can take this back at any time");
  });

  it("writes the audit log for the grant and for every view of a named SME", async () => {
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.organizationId, w.org));
    const actions = audit.map((a) => a.action);
    expect(actions.filter((a) => a === "trade.consent.granted")).toHaveLength(2);
    expect(actions).toContain("trade.sponsor.viewedSme");
    const viewed = audit.find((a) => a.action === "trade.sponsor.viewedSme");
    expect(viewed).toMatchObject({ actorUserId: w.bankViewer.id, after: { sponsorOrganizationId: w.bank, kinds: ["placement_results", "learning_progress"] } });
  });

  it("doesn't duplicate a grant", async () => {
    await post(w.owner, "/consents", { sponsorOrganizationId: w.bank, kinds: ["placement_results"] });
    const rows = await db.select().from(schema.sponsorConsent).where(and(eq(schema.sponsorConsent.smeOrganizationId, w.org), eq(schema.sponsorConsent.kind, "placement_results")));
    expect(rows).toHaveLength(1);
  });

  it("refuses a sponsor of a cohort the organisation isn't in", async () => {
    const res = await post(w.owner, "/consents", { sponsorOrganizationId: w.otherBank, kinds: ["placement_results"] });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("doesn't sponsor");
  });

  it("stops the sponsor at once when the owner takes it back", async () => {
    const live = (await get(w.owner, "/consents")).body.sponsors[0].kinds.find((k: Json) => k.kind === "learning_progress");
    expect((await post(w.member, `/consents/${live.consentId}/withdraw`)).status).toBe(403);
    expect((await post(w.rivalOwner, `/consents/${live.consentId}/withdraw`)).status).toBe(404);

    const withdrawn = await post(w.owner, `/consents/${live.consentId}/withdraw`);
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.sponsors[0].kinds.filter((k: Json) => k.granted).map((k: Json) => k.kind)).toEqual(["placement_results"]);
    const sme = await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}/smes/${w.org}`);
    expect(Object.keys(sme.body.data)).toEqual(["placement_results"]);
    expect((await post(w.owner, `/consents/${live.consentId}/withdraw`)).status).toBe(409);

    const everything = (await get(w.owner, "/consents")).body.sponsors[0].kinds.find((k: Json) => k.kind === "placement_results");
    await post(w.owner, `/consents/${everything.consentId}/withdraw`);
    expect((await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}/smes/${w.org}`)).status).toBe(404);
    expect((await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}`)).body.consenting).toEqual([]);

    const history = await db.select().from(schema.sponsorConsent).where(eq(schema.sponsorConsent.smeOrganizationId, w.org));
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history.every((r) => r.withdrawnAt !== null && r.withdrawnByUserId === w.owner.id)).toBe(true);
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.organizationId, w.org));
    expect(audit.filter((a) => a.action === "trade.consent.withdrawn")).toHaveLength(2);
  });

  it("lets the owner agree again after withdrawing", async () => {
    const again = await post(w.owner, "/consents", { sponsorOrganizationId: w.bank, kinds: ["placement_results"] });
    expect(again.body.sponsors[0].kinds.find((k: Json) => k.kind === "placement_results").granted).toBe(true);
    expect((await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}/smes/${w.org}`)).status).toBe(200);
  });

  it("keeps a sponsor from seeing an SME that hasn't agreed, in the same cohort", async () => {
    expect((await get(w.bankAdmin, `/sponsor/cohorts/${w.cohortA}/smes/${w.rivalOrg}`)).status).toBe(404);
  });

  it("holds financial data back until it is recorded, even when agreed to", async () => {
    await post(w.owner, "/consents", { sponsorOrganizationId: w.bank, kinds: ["financial_documents", "insurance_profile"] });
    const sme = await get(w.bankViewer, `/sponsor/cohorts/${w.cohortA}/smes/${w.org}`);
    expect(sme.body.data.financial_documents).toEqual({ available: false });
    expect(sme.body.data.insurance_profile).toEqual({ available: false });
  });
});

describe("a sponsor viewer", () => {
  it("can't change anything", async () => {
    expect((await post(w.bankViewer, "/sponsors", { name: "X", slug: `${PREFIX}x` })).status).toBe(403);
    expect((await post(w.bankViewer, `/sponsors/${w.bank}/members`, { email: emails.get("newcomer"), role: "sponsor_admin" })).status).toBe(403);
    expect((await post(w.bankViewer, "/consents", { sponsorOrganizationId: w.bank, kinds: ["placement_results"] })).status).toBe(404);
    const live = await db.select().from(schema.sponsorConsent).where(and(eq(schema.sponsorConsent.smeOrganizationId, w.org)));
    expect((await post(w.bankViewer, `/consents/${live[0]!.id}/withdraw`)).status).toBe(404);
    expect((await post(w.bankAdmin, "/consents", { sponsorOrganizationId: w.bank, kinds: ["placement_results"] })).status).toBe(404);
  });
});
