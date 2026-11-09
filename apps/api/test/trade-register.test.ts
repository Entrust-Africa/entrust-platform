import { eq, like } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";
import { workbook, type Cell, type Extra } from "./workbook";

// Entrust's register of pilot SMEs, loaded from the diagnostic workbook. The businesses here are invented.

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; owner: TestUser; entrust: string; org: string };
const CODE = PREFIX.toUpperCase();
const code = (n: string) => `${CODE}REG-${n}`;

const get = (user: TestUser | null) => callV1(user, "GET", "/trade/register");
const load = (user: TestUser | null, bytes: Uint8Array | string, fileName = "diagnostic.xlsx") =>
  callV1(user, "POST", "/trade/register/import", {
    fileName,
    contentBase64: typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64"),
  });

const HEADINGS: Cell[] = [
  "SME ID", "Company Name", "Participant Name ", "Phone", null, "Location", "Employees", "Export Lincese", "Current Bank", "Main Product Category",
  "Monthly production Capacity", "Average monthly revenue", "Largest order completed", "Current markets(local/export)", "Target export market",
  "Monthly Operating Cost", "Estimated monthly Profit", "Existing loan (Yes/No)", "Loan Amount", "Cashflow Stability (stable/moderate/unstable)",
  "Working Capital Gap", "Equipment Investment Needed", "Export Logistics Gap", "Total capital Gap", "Costing Knowledge (1-5)",
  "Production Capacity Strength (1-5)", "Documentation Knowledge (1-5)", "Financial Record keeping (1-5)", "Market Readiness (1-5)",
  "Export Readiness Score", "Finance readiness level", "Entrust Support Needed(export strategy/costing)", "Zemen opportunity type (working capital)",
];
const business = (n: string, over: Record<number, Cell | Extra> = {}) => {
  const row: (Cell | Extra)[] = [
    code(n), `Test Leather ${n} & Sons`, "Abebe", 911000001, 2017, "AA (Bole)", 12, "Yes", "CBE/Dashen", "Bags", 500, 400_000, 2_000_000, "Local/Export", "Africa",
    150_000, 250_000, "No", 0, "Moderate", 2_000_000, 1_000_000, 500_000, 3_500_000, 4, 4, 4, 4, 4, 20, "High", "Buyer intro", "Working capital",
  ];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
};
const master = (...rows: ReturnType<typeof business>[]) => ({ "Master SME Database": [["TRADE Program – Diagnostic Database"], HEADINGS, ...rows] });

const mine = (items: Json[]) => items.filter((i) => i.code.startsWith(CODE));

async function clean() {
  await db.delete(schema.smeRegister).where(like(schema.smeRegister.code, `${CODE}%`));
}

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, owner] = (await Promise.all(["reg-admin", "reg-facilitator", "reg-reviewer", "reg-owner"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { admin, facilitator, reviewer, owner });
  w.org = await createOrganization("reg-org", [[owner, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("reg-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await clean();
  await cleanup();
});

describe("who can use the register", () => {
  it("is refused to anyone signed out", async () => {
    expect((await get(null)).status).toBe(401);
    expect((await load(null, "UEsDBA==")).status).toBe(401);
  });

  it("is staff only: an SME owner sees and loads nothing", async () => {
    expect(await get(w.owner)).toMatchObject({ status: 403, body: { code: "forbidden" } });
    expect(await load(w.owner, workbook(master(business("X"))))).toMatchObject({ status: 403, body: { code: "forbidden" } });
    expect((await get(w.owner)).body.items).toBeUndefined();
  });

  it("lets admins and facilitators read it and load it, and keeps it from a reviewer", async () => {
    for (const user of [w.admin, w.facilitator]) expect((await get(user)).status).toBe(200);
    expect((await get(w.reviewer)).status).toBe(403);
    expect(await load(w.reviewer, workbook(master(business("X"))))).toMatchObject({ status: 403, body: { code: "forbidden" } });
    expect(mine((await get(w.admin)).body.items)).toEqual([]);
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

describe("loading the workbook", () => {
  it("adds the businesses and works their figures out", async () => {
    const res = await load(
      w.facilitator,
      workbook({
        ...master(
          business("A"),
          // A total typed over by hand, and a score nobody has given.
          business("B", { 23: 9_999_999, 24: 0, 25: 0, 26: 0, 27: 0, 28: 0, 29: 0 }),
          // Text that is inline, a formula's saved result, and a bank typed another way.
          business("C", { 1: { inline: "Inline <Leather> Plc" }, 8: "abyssinia /cbe", 23: { formula: "SUM(U3:W3)", value: 3_500_000 } }),
        ),
        "Entrust Service Pipeline": [
          ["SME ID", "Company Name", "Participant Name", "Phone", "Email", "Service Area", "Service Description"],
          [code("1"), "Test Leather A & Sons", "Abebe", 911000001, "abebe@example.test", "Buyer Intro", "Two buyer introductions"],
        ],
      }),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ total: 3, created: 3, updated: 0, unchanged: 0 });
    expect(res.body.warnings).toEqual([`${code("B")}: the workbook's total capital gap is 9,999,999, but its three gaps add up to 3,500,000. The register uses 3,500,000.`]);

    const items = mine((await get(w.facilitator)).body.items);
    expect(items.map((i: Json) => i.code)).toEqual([code("A"), code("B"), code("C")]);
    expect(items[0]).toMatchObject({
      companyName: "Test Leather A & Sons",
      participantName: "Abebe",
      phone: "911000001",
      email: "abebe@example.test",
      serviceNotes: "Two buyer introductions",
      yearEstablished: 2017,
      employees: 12,
      exportLicence: true,
      existingLoan: false,
      averageMonthlyRevenue: 400_000,
      totalCapitalGap: 3_500_000,
      exportReadinessScore: 20,
      financeReadinessLevel: "high",
      financePriority: "high",
    });
    expect(items[1]).toMatchObject({ costingKnowledge: null, exportReadinessScore: null, financeReadinessLevel: null, totalCapitalGap: 3_500_000 });
    expect(items[2]).toMatchObject({ companyName: "Inline <Leather> Plc", currentBank: "abyssinia /cbe" });
  });

  it("totals the register by bank, level and gap", async () => {
    const { items, summary } = (await get(w.admin)).body;
    expect(summary.total).toBe(items.length);
    expect(summary.byLevel.notAssessed).toBeGreaterThanOrEqual(1);
    expect(summary.totalCapitalGap).toBeGreaterThanOrEqual(10_500_000);
    expect(summary.banks).toEqual(expect.arrayContaining([expect.objectContaining({ bank: "CBE" }), expect.objectContaining({ bank: "Dashen" }), expect.objectContaining({ bank: "Abyssinia" })]));
  });

  it("brings the register up to date when it is loaded again, and keeps a business the file leaves out", async () => {
    const same = await load(w.admin, workbook(master(business("A"), business("B", { 23: 1, 24: 0, 25: 0, 26: 0, 27: 0, 28: 0, 29: 0 }))));
    // A's email and notes came from the service sheet, which this file doesn't have, so they stay.
    expect(same.body).toMatchObject({ total: 2, created: 0, unchanged: 2, updated: 0 });

    const changed = await load(w.admin, workbook(master(business("A", { 11: 650_000, 8: "CBE" }), business("D"))));
    expect(changed.body).toMatchObject({ total: 2, created: 1, updated: 1, unchanged: 0 });
    const items = mine((await get(w.admin)).body.items);
    expect(items.map((i: Json) => i.code)).toEqual([code("A"), code("B"), code("C"), code("D")]);
    expect(items[0]).toMatchObject({ averageMonthlyRevenue: 650_000, currentBank: "CBE", email: "abebe@example.test", serviceNotes: "Two buyer introductions" });
  });

  it("records who loaded which file", async () => {
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.actorUserId, w.admin.id));
    const imports = rows.filter((r) => r.action === "sme_register.import");
    expect(imports.length).toBeGreaterThanOrEqual(2);
    expect(imports.at(-1)).toMatchObject({ platform: "trade", entityType: "sme_register", after: { fileName: "diagnostic.xlsx", total: 2 } });
    await db.delete(schema.auditLog).where(eq(schema.auditLog.actorUserId, w.admin.id));
  });
});

describe("a file that isn't the workbook", () => {
  const refused = async (bytes: Uint8Array | string, pattern: RegExp) => {
    const res = await load(w.admin, bytes);
    expect([res.status, res.body.code]).toEqual([422, "invalid"]);
    expect(res.body.error).toMatch(pattern);
  };

  it("is refused with the reason", async () => {
    await refused(strToU8("not a workbook at all"), /isn't an Excel workbook/);
    await refused(zipSync({ "hello.txt": strToU8("hi") }), /isn't an Excel workbook/);
    await refused(workbook({ Sheet1: [["a", "b"]] }), /no sheet called "Master SME Database"/);
    await refused(workbook({ "Master SME Database": [["Name", "Phone"], ["x", 1]] }), /needs "SME ID" and "Company Name"/);
    await refused(workbook(master()), /has no businesses in it/);
    await refused("!!! not base64 !!!", /couldn't be read|isn't an Excel workbook/);
  });

  it("changes nothing when it is refused", async () => {
    expect(mine((await get(w.admin)).body.items)).toHaveLength(4);
  });

  it("refuses a request without a file", async () => {
    expect((await callV1(w.admin, "POST", "/trade/register/import", {})).status).toBe(400);
    expect((await callV1(w.admin, "POST", "/trade/register/import", { contentBase64: "" })).status).toBe(400);
  });
});
