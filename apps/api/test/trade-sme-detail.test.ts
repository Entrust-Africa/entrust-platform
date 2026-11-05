import { like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// The page for one business: a record in the SME register, or an application to a programme. The businesses here are invented.

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; owner: TestUser; entrust: string };
const CODE = `${PREFIX.toUpperCase()}DET-`;
const PROGRAM = `${PREFIX}agro-detail`;
const NOBODY = "00000000-0000-4000-8000-000000000000";

const register = (id: string) => callV1(w.admin, "GET", `/trade/register/${id}`);
const application = (id: string) => callV1(w.admin, "GET", `/trade/applications/${id}`);

const apply = (over: Record<string, unknown>) => ({
  program: PROGRAM,
  submittedAt: new Date("2026-03-27T12:00:00Z"),
  email: `${PREFIX}x@firm.test`,
  businessName: "X",
  contactName: "Contact",
  phone: "+251911105926",
  location: "Addis Ababa",
  country: "ET" as string | null,
  answers: { mainProducts: "Dried mango", employees: "10", bank: "Awash", exportedBefore: "No", zemenInterest: "Yes", additional: "A note" } as Record<string, string>,
  ...over,
});

const ids = {} as Record<string, string>;

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, owner] = (await Promise.all(["det-admin", "det-facilitator", "det-reviewer", "det-owner"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { admin, facilitator, reviewer, owner });
  await createOrganization("det-org", [[owner, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("det-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;

  const rows = await db
    .insert(schema.smeRegister)
    .values([
      {
        code: `${CODE}1`,
        companyName: "Zeta Leather",
        participantName: "Abebe",
        phone: "911105926", // the same phone as an agro application
        email: null,
        yearEstablished: 2017,
        location: "AA (Bole)",
        employees: 12,
        exportLicence: true,
        currentBank: "CBE/Dashen",
        mainProduct: "Bags",
        averageMonthlyRevenue: 400_000,
        existingLoan: false,
        cashflowStability: "Moderate",
        workingCapitalGap: 2_000_000,
        equipmentInvestmentNeeded: 1_000_000,
        exportLogisticsGap: 500_000,
        costingKnowledge: 4,
        productionCapacityStrength: 4,
        documentationKnowledge: 4,
        financialRecordKeeping: 4,
        marketReadiness: 4,
        entrustSupportNeeded: "Costing",
        serviceNotes: "Two buyer introductions",
      },
      { code: `${CODE}2`, companyName: "Lonely Leather", phone: null, email: null },
    ])
    .returning({ id: schema.smeRegister.id, code: schema.smeRegister.code });
  for (const r of rows) ids[r.code.slice(CODE.length)] = r.id;

  const apps = await db
    .insert(schema.programApplication)
    .values([
      apply({ email: `${PREFIX}acme@firm.test`, businessName: "Acme Foods PLC", submittedAt: new Date("2026-03-27T12:00:00Z") }),
      // The same business again, later, under another spelling of its name.
      apply({ email: `${PREFIX}acme@firm.test`, businessName: "ACME  Foods plc", submittedAt: new Date("2026-04-08T12:00:00Z"), location: "Addis Ababa / Dukem" }),
      apply({ email: `${PREFIX}coffee@firm.test`, businessName: "Bahir Coffee", phone: "+251911246192", location: "Bahir Dar" }),
      // Kept, never shown: it uses the same phone number as Zeta Leather and the same email as Acme.
      apply({ email: `${PREFIX}acme@firm.test`, submittedAt: new Date("2026-03-28T12:00:00Z"), businessName: "Lagos Ventures Ltd", contactName: "Chidi Okafor", phone: "07063479837", location: "Lagos", country: "NG", answers: { additional: "Secret Lagos plans" } }),
      apply({ email: `${PREFIX}mystery@firm.test`, businessName: "Mystery Ltd", contactName: "Kim Unknown", phone: "12345", location: "Online", country: null }),
    ])
    .returning({ id: schema.programApplication.id, businessName: schema.programApplication.businessName, submittedAt: schema.programApplication.submittedAt });
  for (const a of apps) ids[`${a.businessName}@${a.submittedAt.toISOString().slice(0, 10)}`] = a.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await db.delete(schema.programApplication).where(like(schema.programApplication.program, `${PREFIX}%`));
  await db.delete(schema.smeRegister).where(like(schema.smeRegister.code, `${CODE}%`));
  await cleanup();
});

describe("who can open a business's page", () => {
  it("is refused to anyone signed out, and to an SME owner, for either kind of record", async () => {
    for (const path of [`/trade/register/${ids["1"]}`, `/trade/applications/${ids["Bahir Coffee@2026-03-27"]}`]) {
      expect((await callV1(null, "GET", path)).status).toBe(401);
      expect(await callV1(w.owner, "GET", path)).toMatchObject({ status: 403, body: { code: "forbidden" } });
    }
  });

  it("is open to admins, facilitators and reviewers", async () => {
    for (const user of [w.admin, w.facilitator, w.reviewer]) {
      expect((await callV1(user, "GET", `/trade/register/${ids["1"]}`)).status).toBe(200);
      expect((await callV1(user, "GET", `/trade/applications/${ids["Bahir Coffee@2026-03-27"]}`)).status).toBe(200);
    }
  });

  it("makes nobody staff while ENTRUST_ORG_ID is unset", async () => {
    const id = process.env.ENTRUST_ORG_ID;
    delete process.env.ENTRUST_ORG_ID;
    try {
      expect((await register(ids["1"]!)).status).toBe(403);
      expect((await application(ids["Bahir Coffee@2026-03-27"]!)).status).toBe(403);
    } finally {
      process.env.ENTRUST_ORG_ID = id;
    }
  });
});

describe("a business in the register", () => {
  it("has everything recorded about it, with its figures worked out", async () => {
    const { status, body } = await register(ids["1"]!);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: ids["1"],
      code: `${CODE}1`,
      companyName: "Zeta Leather",
      participantName: "Abebe",
      location: "AA (Bole)",
      yearEstablished: 2017,
      employees: 12,
      exportLicence: true,
      currentBank: "CBE/Dashen",
      existingLoan: false,
      averageMonthlyRevenue: 400_000,
      totalCapitalGap: 3_500_000,
      exportReadinessScore: 20,
      financeReadinessLevel: "high",
      financePriority: "high",
      serviceNotes: "Two buyer introductions",
    });
  });

  it("lists the responses from Ethiopia that come from the same business, and none from elsewhere", async () => {
    // Zeta Leather has the same phone number as Acme, so both of Acme's responses are listed, newest first.
    const { body } = await register(ids["1"]!);
    expect(body.alsoApplied.map((a: Json) => [a.businessName, a.submittedAt.slice(0, 10)])).toEqual([["ACME  Foods plc", "2026-04-08"], ["Acme Foods PLC", "2026-03-27"]]);
    expect(body.alsoApplied[0]).toMatchObject({ id: ids["ACME  Foods plc@2026-04-08"], program: PROGRAM });
    const text = JSON.stringify(body);
    for (const secret of ["Lagos Ventures", "Chidi Okafor", "Secret Lagos plans", "Mystery Ltd", "Kim Unknown"]) expect(text, secret).not.toContain(secret);
  });

  it("has no applications when nothing matches it", async () => {
    expect((await register(ids["2"]!)).body.alsoApplied).toEqual([]);
  });

  it("is 404 for a record that doesn't exist, and 400 for an id that isn't one", async () => {
    expect(await register(NOBODY)).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect((await register("not-an-id")).status).toBe(400);
  });
});

describe("an application", () => {
  it("has every answer as typed, and the business's other responses, newest first", async () => {
    const { status, body } = await application(ids["Acme Foods PLC@2026-03-27"]!);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      id: ids["Acme Foods PLC@2026-03-27"],
      program: PROGRAM,
      businessName: "Acme Foods PLC",
      contactName: "Contact",
      phone: "+251911105926",
      location: "Addis Ababa",
      country: "ET",
      answers: { mainProducts: "Dried mango", bank: "Awash", additional: "A note" },
      timesApplied: 2,
    });
    expect(body.otherResponses.map((o: Json) => [o.id, o.submittedAt.slice(0, 10)])).toEqual([[ids["ACME  Foods plc@2026-04-08"], "2026-04-08"]]);
  });

  it("says which business in the register it is, by phone number", async () => {
    const { body } = await application(ids["Acme Foods PLC@2026-03-27"]!);
    expect(body.alsoInRegister).toEqual([{ id: ids["1"], code: `${CODE}1`, companyName: "Zeta Leather" }]);
    const alone = (await application(ids["Bahir Coffee@2026-03-27"]!)).body;
    expect(alone).toMatchObject({ timesApplied: 1, otherResponses: [], alsoInRegister: [] });
  });

  it("doesn't count a response from elsewhere as one of the business's, even with the same email address", async () => {
    const text = JSON.stringify((await application(ids["Acme Foods PLC@2026-03-27"]!)).body);
    for (const secret of ["Lagos Ventures", "Chidi Okafor", "Secret Lagos plans"]) expect(text, secret).not.toContain(secret);
  });

  it("is 404 for a response from outside Ethiopia or that doesn't say where from: the same as one that doesn't exist", async () => {
    const lagos = await application(ids["Lagos Ventures Ltd@2026-03-28"]!);
    const mystery = await application(ids["Mystery Ltd@2026-03-27"]!);
    const nobody = await application(NOBODY);
    for (const res of [lagos, mystery, nobody]) expect(res).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect(lagos.body).toEqual(nobody.body);
    expect(JSON.stringify([lagos.body, mystery.body])).not.toMatch(/Lagos|Mystery|Chidi|Kim Unknown/);
  });

  it("is 400 for an id that isn't one", async () => {
    expect((await application("not-an-id")).status).toBe(400);
  });
});
