import { like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// The catalogue of pilot SMEs by cohort. The businesses here are invented.

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; owner: TestUser; entrust: string };
const CODE = PREFIX.toUpperCase();
const AGRO = `${PREFIX}agro-catalogue`;
const OTHER = `${PREFIX}coffee-catalogue`;

const get = (user: TestUser | null) => callV1(user, "GET", "/trade/catalogue");
const cohort = (body: Json, n: number): Json => body.cohorts.find((c: Json) => c.number === n);
const mine = (smes: Json[]) => smes.filter((s) => s.key.includes(CODE) || s.key.startsWith("application:"));

const leather = (n: string, over: Record<string, unknown> = {}) => ({ code: `${CODE}CAT-${n}`, companyName: `Catalogue Leather ${n}`, participantName: "Abebe", phone: "911000001", location: "AA (Bole)", employees: 12, currentBank: "CBE", mainProduct: "Bags", costingKnowledge: 4, productionCapacityStrength: 4, documentationKnowledge: 4, financialRecordKeeping: 4, marketReadiness: 4, ...over });
const application = (over: Record<string, unknown>) => ({
  program: AGRO,
  submittedAt: new Date("2026-03-27T12:00:00Z"),
  email: `${PREFIX}x@firm.test`,
  businessName: "X",
  contactName: "Contact",
  phone: "+251911105926",
  location: "Addis Ababa",
  country: "ET" as string | null,
  answers: { mainProducts: "Dried mango", employees: "10", bank: "Awash", exportedBefore: "No", zemenInterest: "Yes" } as Record<string, string>,
  ...over,
});

const FOREIGN = ["Lagos Ventures", "Chidi Okafor", "07063479837", "Mystery Ltd", "Kim Unknown", "lagos@firm", "mystery@firm", "Coffee Programme Co"];

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, owner] = (await Promise.all(["cat-admin", "cat-facilitator", "cat-reviewer", "cat-owner"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { admin, facilitator, reviewer, owner });
  await createOrganization("cat-org", [[owner, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("cat-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;

  await db.insert(schema.smeRegister).values([
    leather("2", { companyName: "Zeta Leather", phone: "911105926" }), // the same phone as an agro application
    leather("1", { companyName: "Alpha Leather", phone: null }),
    leather("3", { companyName: "Unscored Leather", phone: null, costingKnowledge: null }),
  ]);
  await db.insert(schema.programApplication).values([
    application({ email: `${PREFIX}acme@firm.test`, businessName: "Acme Foods PLC", submittedAt: new Date("2026-03-27T12:00:00Z"), location: "Addis Ababa" }),
    // The same business again, later.
    application({ email: `${PREFIX}acme@firm.test`, businessName: "Acme Foods PLC", submittedAt: new Date("2026-04-08T12:00:00Z"), location: "Addis Ababa / Dukem", phone: "+251911105926" }),
    application({ email: `${PREFIX}coffee@firm.test`, businessName: "Bahir Coffee", phone: "+251911246192", location: "Bahir Dar", answers: { mainProducts: "Roasted coffee", exportedBefore: "Yes", zemenInterest: "No" } }),
    // Kept, never shown.
    application({ email: `${PREFIX}lagos@firm.test`, businessName: "Lagos Ventures Ltd", contactName: "Chidi Okafor", phone: "07063479837", location: "Lagos", country: "NG" }),
    application({ email: `${PREFIX}mystery@firm.test`, businessName: "Mystery Ltd", contactName: "Kim Unknown", phone: "12345", location: "Online", country: null }),
    // Another programme, which isn't cohort 2.
    application({ program: OTHER, email: `${PREFIX}other@firm.test`, businessName: "Coffee Programme Co", location: "Addis Ababa" }),
  ]);
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await db.delete(schema.programApplication).where(like(schema.programApplication.program, `${PREFIX}%`));
  await cleanup();
});

describe("who can see the catalogue", () => {
  it("is refused to anyone signed out, and to an SME owner", async () => {
    expect((await get(null)).status).toBe(401);
    expect(await get(w.owner)).toMatchObject({ status: 403, body: { code: "forbidden" } });
  });

  it("is open to admins, facilitators and reviewers", async () => {
    for (const user of [w.admin, w.facilitator, w.reviewer]) expect((await get(user)).status).toBe(200);
  });

  it("makes nobody staff while ENTRUST_ORG_ID is unset", async () => {
    const id = process.env.ENTRUST_ORG_ID;
    delete process.env.ENTRUST_ORG_ID;
    try {
      expect((await get(w.admin)).status).toBe(403);
    } finally {
      process.env.ENTRUST_ORG_ID = id;
    }
  });
});

describe("the cohorts", () => {
  it("has cohort 1, leather, and cohort 2, agro-processing, even when either is empty", async () => {
    const { body } = await get(w.admin);
    expect(body.cohorts.map((c: Json) => [c.number, c.name])).toEqual([[1, "Leather"], [2, "Agro-processing"]]);
    expect(body.cohorts.every((c: Json) => c.count === c.smes.length)).toBe(true);
  });

  it("says cohort 1 is previous and cohort 2 active", async () => {
    const { body } = await get(w.admin);
    expect(body.cohorts.map((c: Json) => [c.number, c.status])).toEqual([[1, "previous"], [2, "active"]]);
  });

  it("gives each business the id of its stored record, so its page can be opened", async () => {
    const { body } = await get(w.admin);
    for (const sme of mine(cohort(body, 1).smes)) {
      expect((await callV1(w.admin, "GET", `/trade/register/${sme.id}`)).body.code).toBe(sme.reference);
    }
    for (const sme of mine(cohort(body, 2).smes)) {
      expect((await callV1(w.admin, "GET", `/trade/applications/${sme.id}`)).body.businessName).toBe(sme.name);
    }
  });

  it("lists the leather businesses in the register by name, with their SME ID and readiness", async () => {
    const smes = mine(cohort((await get(w.admin)).body, 1).smes);
    expect(smes.map((s: Json) => s.name)).toEqual(["Alpha Leather", "Unscored Leather", "Zeta Leather"]);
    expect(smes[0]).toMatchObject({ cohort: 1, reference: `${CODE}CAT-1`, contactName: "Abebe", employees: "12", bank: "CBE", product: "Bags", readinessLevel: "high", readinessScore: 20 });
    expect(smes[1]).toMatchObject({ readinessLevel: null, readinessScore: null });
  });

  it("lists the agro businesses from Ethiopia once each, from the latest response", async () => {
    const smes = mine(cohort((await get(w.admin)).body, 2).smes);
    expect(smes.map((s: Json) => [s.name, s.location])).toEqual([["Acme Foods PLC", "Addis Ababa / Dukem"], ["Bahir Coffee", "Bahir Dar"]]);
    expect(smes[0]).toMatchObject({ cohort: 2, reference: null, product: "Dried mango", employees: "10", bank: "Awash", exportedBefore: false, wantsZemenFinancing: true, phone: "+251911105926" });
    expect(smes[1]).toMatchObject({ exportedBefore: true, wantsZemenFinancing: false });
  });

  it("marks a business that is in both cohorts, found by its phone number", async () => {
    const { body } = await get(w.admin);
    expect(mine(cohort(body, 1).smes).find((s: Json) => s.name === "Zeta Leather")).toMatchObject({ alsoInCohorts: [2] });
    expect(mine(cohort(body, 2).smes).find((s: Json) => s.name === "Acme Foods PLC")).toMatchObject({ alsoInCohorts: [1] });
    expect(mine(cohort(body, 1).smes).find((s: Json) => s.name === "Alpha Leather")).toMatchObject({ alsoInCohorts: [] });
  });

  it("leaves out responses from elsewhere or from nowhere clear, and other programmes' applicants", async () => {
    const text = JSON.stringify((await get(w.reviewer)).body);
    for (const secret of FOREIGN) expect(text, secret).not.toContain(secret);
  });
});
