import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// The Verified SME Passport: staff issue it, anyone with the QR code reads it. The business here is invented.

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; owner: TestUser; entrust: string; org: string; org2: string; smeId: string; smeId2: string; applicationId: string };
const ID = "EA-TST-9001";
const APP_ID = "EA-TST-9005";

const body = (over: Record<string, unknown> = {}) => ({
  tier: "silver",
  status: "active",
  verifiedOn: "2026-11-13",
  validUntil: "2027-11-13",
  displayName: "Test Coffee",
  tagline: "Specialty Arabica",
  country: "ET",
  sector: "Specialty coffee",
  established: 2023,
  employeesRange: "11–20",
  ownership: "100% women-owned",
  founder: "A. Tester",
  headline: "Coffee, crafted with purpose.",
  overview: "A woman-led coffee brand.",
  products: [{ name: "Green coffee", detail: "Sidama", code: "HS 0901.11" }],
  womenInTrade: ["Woman founder & manager"],
  targetMarkets: [{ label: "Global", places: ["USA", "Europe"] }],
  seeking: "Specialty roasters.",
  checks: ["Company registration", "Site visit"],
  website: "www.example.com",
  email: "info@example.com",
  phones: ["+251 900 000 000"],
  address: "Addis Ababa",
  logoUrl: null,
  ...over,
});
const save = (user: TestUser | null, over: Record<string, unknown> = {}, number = ID) => callV1(user, "PUT", `/trade/passports/${number}`, body(over));
const publicGet = (id: string) => callV1(null, "GET", `/trade/passports/${id}/public`);

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, owner] = (await Promise.all(["pp-admin", "pp-facilitator", "pp-reviewer", "pp-owner"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { admin, facilitator, reviewer, owner });
  w.org = await createOrganization("pp-org", [[owner, "owner"]], { platform: "trade" });
  w.org2 = await createOrganization("pp-org2", [], { platform: "trade" });
  w.entrust = await createOrganization("pp-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
  const [p1] = await db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, w.org));
  const [p2] = await db.select().from(schema.smeProfile).where(eq(schema.smeProfile.organizationId, w.org2));
  w.smeId = p1!.smeId;
  w.smeId2 = p2!.smeId;
  const [app] = await db.insert(schema.programApplication).values({ program: `${PREFIX}program`, submittedAt: new Date(), email: `${PREFIX}roasters@example.test`, businessName: "Test Roasters PLC", contactName: "A. Tester", phone: "0922", location: "Ethiopia, Addis Ababa", country: "ET", answers: { employees: "1-10", yearEstablished: "2023", ownership: "Women-owned", category: "Coffee", contactEmail: "info@roasters.test" } }).returning();
  w.applicationId = app!.id;
  await db.update(schema.smeProfile).set({ permanentEmployees: 8, temporaryEmployees: 3, businessPhone: "0911" }).where(eq(schema.smeProfile.organizationId, w.org));
});

afterAll(async () => {
  await db.delete(schema.smePassport).where(like(schema.smePassport.passportId, "EA-TST-%"));
  await db.delete(schema.programApplication).where(like(schema.programApplication.program, `${PREFIX}%`));
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("who can issue a passport", () => {
  it("is refused to anyone signed out, an SME owner, a facilitator or a reviewer", async () => {
    expect((await save(null, { smeId: w.smeId })).status).toBe(401);
    expect((await save(w.owner, { smeId: w.smeId })).status).toBe(403);
    expect((await save(w.facilitator, { smeId: w.smeId })).status).toBe(403);
    expect((await save(w.reviewer, { smeId: w.smeId })).status).toBe(403);
  });
  it("lets staff, but not an SME owner, read the suggestion and the list", async () => {
    expect((await callV1(w.owner, "GET", `/trade/passports/prefill?smeId=${w.smeId}`)).status).toBe(403);
    expect((await callV1(w.owner, "GET", "/trade/passports")).status).toBe(403);
    expect((await callV1(w.facilitator, "GET", `/trade/passports/prefill?smeId=${w.smeId}`)).status).toBe(200);
  });
});

describe("the suggestion", () => {
  it("offers a headcount range from the diagnostic, to staff only", async () => {
    const res = await callV1(w.admin, "GET", `/trade/passports/prefill?smeId=${w.smeId}`);
    expect(res.body.existingPassportId).toBeNull();
    expect(res.body.source).toMatchObject({ kind: "business", smeId: w.smeId });
    expect(res.body.suggestion).toMatchObject({ employeesRange: "11–20", phones: ["0911"] });
  });
  it("404s an SME ID nobody has, and asks which business when given nothing", async () => {
    expect((await callV1(w.admin, "GET", "/trade/passports/prefill?smeId=NOPE-1")).status).toBe(404);
    expect((await callV1(w.admin, "GET", "/trade/passports/prefill")).status).toBe(422);
  });
  it("reads a register application, writing its headcount range the passport's way", async () => {
    const res = await callV1(w.admin, "GET", `/trade/passports/prefill?applicationId=${w.applicationId}`);
    expect(res.body.source).toMatchObject({ kind: "application", label: "Test Roasters PLC" });
    expect(res.body.suggestion).toMatchObject({ displayName: "Test Roasters PLC", employeesRange: "1–10", established: 2023, ownership: "Women-owned", country: "ET" });
  });
  it("won't read an application from outside Ethiopia", async () => {
    const [other] = await db.insert(schema.programApplication).values({ program: `${PREFIX}other`, submittedAt: new Date(), email: `${PREFIX}other@example.test`, businessName: "Elsewhere Ltd", country: "KE", answers: {} }).returning();
    expect((await callV1(w.admin, "GET", `/trade/passports/prefill?applicationId=${other!.id}`)).status).toBe(404);
  });
});

describe("issuing", () => {
  it("needs a well-formed number", async () => {
    expect((await save(w.admin, { smeId: w.smeId }, "EA-ET-1")).status).toBe(422);
  });
  it("issues a passport from a business and audits it", async () => {
    const res = await save(w.admin, { smeId: w.smeId }, ID.toLowerCase());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ passportId: ID, tier: "silver", employeesRange: "11–20" });
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.organizationId, w.org));
    expect(audit.map((a) => a.action)).toContain("trade.passport.issued");
  });
  it("keeps the link: the business now has a passport", async () => {
    expect((await callV1(w.admin, "GET", `/trade/passports/prefill?smeId=${w.smeId}`)).body.existingPassportId).toBe(ID);
    expect((await callV1(w.admin, "GET", `/trade/passports/${ID}`)).body.source).toMatchObject({ kind: "business", smeId: w.smeId });
  });
  it("won't give a second passport to the same business, or the same number to another", async () => {
    expect((await save(w.admin, { smeId: w.smeId }, "EA-TST-9002")).status).toBe(409);
    expect((await save(w.admin, { smeId: w.smeId2 }, ID)).status).toBe(409);
    expect((await callV1(w.admin, "GET", `/trade/passports/${ID}`)).body.source.smeId).toBe(w.smeId);
  });
  it("issues a passport for a business that is only in the register", async () => {
    const res = await save(w.admin, { applicationId: w.applicationId, displayName: "Test Roasters", employeesRange: "1–10" }, APP_ID);
    expect(res.status).toBe(200);
    expect((await callV1(w.admin, "GET", `/trade/passports/prefill?applicationId=${w.applicationId}`)).body.existingPassportId).toBe(APP_ID);
    expect((await publicGet(APP_ID)).body).toMatchObject({ displayName: "Test Roasters", standing: "active" });
    expect((await save(w.admin, { applicationId: w.applicationId }, "EA-TST-9003")).status).toBe(409);
  });
  it("refuses a link to both a business and an application", async () => {
    expect((await save(w.admin, { smeId: w.smeId2, applicationId: w.applicationId }, "EA-TST-9004")).status).toBe(422);
  });
  it("updates by number and keeps what it was made from", async () => {
    const res = await save(w.admin, { displayName: "Test Coffee Ltd" });
    expect(res.body.displayName).toBe("Test Coffee Ltd");
    expect((await callV1(w.admin, "GET", `/trade/passports/${ID}`)).body.source.smeId).toBe(w.smeId);
  });
  it("refuses an end date before the start, and a status change without a reason", async () => {
    expect((await save(w.admin, { validUntil: "2026-01-01" })).status).toBe(422);
    expect((await save(w.admin, { status: "revoked" })).status).toBe(422);
  });
  it("lists them for staff", async () => {
    const res = await callV1(w.facilitator, "GET", "/trade/passports");
    expect(res.body.items.find((i: { passportId: string }) => i.passportId === ID)).toMatchObject({ standing: expect.stringMatching(/active|expired/) });
    expect(res.body.items.map((i: { passportId: string }) => i.passportId)).toContain(APP_ID);
  });
});

describe("what a person scanning the code sees", () => {
  it("needs no sign-in and holds only the published lines", async () => {
    const res = await publicGet(ID);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ passportId: ID, tier: "silver", displayName: "Test Coffee Ltd" });
    expect(res.body.details).toMatchObject({ employeesRange: "11–20", overview: "A woman-led coffee brand." });
    expect(Object.keys(res.body.details).sort()).not.toContain("statusReason");
    expect(JSON.stringify(res.body)).not.toContain(w.org);
  });
  it("finds the number in any case", async () => {
    expect((await publicGet(ID.toLowerCase())).status).toBe(200);
  });
  it("404s a number that was never issued", async () => {
    expect((await publicGet("EA-TST-0000")).status).toBe(404);
  });
  it("shows an expired passport as expired", async () => {
    await save(w.admin, { verifiedOn: "2024-01-01", validUntil: "2025-01-01" });
    const res = await publicGet(ID);
    expect(res.body.standing).toBe("expired");
    expect(res.body.details).not.toBeNull();
  });
  it("shows a revoked passport as revoked, with no details and no reason", async () => {
    await save(w.admin, { status: "revoked", statusReason: "Ownership could not be confirmed." });
    const res = await publicGet(ID);
    expect(res.body).toMatchObject({ standing: "revoked", details: null });
    expect(JSON.stringify(res.body)).not.toContain("Ownership could not");
  });
  it("can be made active again, which clears the reason", async () => {
    await save(w.admin, { status: "active", statusReason: "ignored" });
    expect((await publicGet(ID)).body.standing).toBe("active");
    const [row] = await db.select().from(schema.smePassport).where(eq(schema.smePassport.passportId, ID));
    expect(row!.statusReason).toBeNull();
  });

  it("shows a logo path or https link on the public page and refuses anything else", async () => {
    expect((await save(w.admin, { logoUrl: "/passports/EA-TST-9001.png" })).status).toBe(200);
    expect((await publicGet(ID)).body.details.logoUrl).toBe("/passports/EA-TST-9001.png");
    for (const bad of ["javascript:alert(1)", "http://example.com/a.png", "//evil.test/a.png"]) {
      expect((await save(w.admin, { logoUrl: bad })).status).toBe(400);
    }
  });
});
