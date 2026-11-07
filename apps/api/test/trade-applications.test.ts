import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";
import { workbook, type Cell } from "./workbook";

// Applications to a programme, from a Google Form's responses. Only responses from Ethiopia are ever shown; the rest are kept.
// The businesses here are invented.

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; owner: TestUser; entrust: string };
const PROGRAM = `${PREFIX}agro-program`;
const email = (name: string) => `${PREFIX}${name}@firm.test`;

const get = (user: TestUser | null) => callV1(user, "GET", "/trade/applications");
const load = (user: TestUser | null, bytes: Uint8Array | string, extra: Record<string, unknown> = {}) =>
  callV1(user, "POST", "/trade/applications/import", {
    program: PROGRAM,
    fileName: "responses.xlsx",
    contentBase64: typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("base64"),
    ...extra,
  });

// Headings as Google Forms exports them.
const HEADINGS: Cell[] = [
  "Timestamp", "Email Address", "Business Name ", "Contact Person (Full Name)", "\nPhone Number (WhatsApp preferred) \n\n", "\nCity / Region \n\n",
  "\nWhat does your business produce? (Short answer) \n\n", "Which category best describes your business? (Multiple choice)", "Number of Employees",
  "Have you exported before", "Which bank do you use?", "Are you inerested in financing opportunities through Zemen bank?",
  "Any additional information you would like to share?",
];
const SERIAL = 46108.5; // 27 March 2026, noon

const response = (over: Record<number, Cell> = {}): Cell[] => {
  const row: Cell[] = [SERIAL, email("acme"), "Acme Foods PLC", "Abebe Kebede", "+251911105926", "Addis Ababa", "Dried fruit", "Food processing", 10, "No", "Awash", "Yes", "1. first\n2. second"];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
};
const sheet = (...rows: Cell[][]) => workbook({ "Form Responses 1": [HEADINGS, ...rows] });

/** Two responses from one Ethiopian business, one from another, and three from outside Ethiopia or saying nowhere. */
const RESPONSES = () => [
  response(),
  response({ 0: SERIAL + 8, 5: "Addis Ababa / Dukem" }),
  response({ 0: SERIAL - 1, 1: email("coffee"), 2: "Coffee Collective", 3: "Mekdes", 4: "0911246192", 5: "Bahir Dar", 9: "Yes", 11: "Yes" }),
  response({ 1: email("lagos"), 2: "Lagos Ventures Ltd", 3: "Chidi Okafor", 4: "07063479837", 5: "Lagos", 12: "Secret Lagos plans" }),
  response({ 1: email("dar"), 2: "Dar Trading Co", 3: "Neema Mushi", 4: "+255762489028", 5: "Dar es Salaam" }),
  // Says nowhere it could be.
  response({ 1: email("mystery"), 2: "Mystery Ltd", 3: "Kim Unknown", 4: "12345", 5: "Online" }),
];
const FOREIGN = ["Lagos Ventures", "Chidi Okafor", "07063479837", "Secret Lagos plans", "Dar Trading", "Neema Mushi", "+255762489028", "Mystery Ltd", "Kim Unknown", "lagos@firm", "dar@firm", "mystery@firm"];

const mine = (items: Json[]) => items.filter((i) => i.program === PROGRAM);
const rowsInDatabase = () => db.select().from(schema.programApplication).where(eq(schema.programApplication.program, PROGRAM));

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, owner] = (await Promise.all(["app-admin", "app-facilitator", "app-reviewer", "app-owner"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { admin, facilitator, reviewer, owner });
  await createOrganization("app-org", [[owner, "owner"]], { platform: "trade" });
  w.entrust = await createOrganization("app-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await db.delete(schema.programApplication).where(like(schema.programApplication.program, `${PREFIX}%`));
  await cleanup();
});

describe("who can use the applications", () => {
  it("is refused to anyone signed out", async () => {
    expect((await get(null)).status).toBe(401);
    expect((await load(null, "UEsDBA==")).status).toBe(401);
  });

  it("is staff only: an SME owner sees and loads nothing", async () => {
    expect(await get(w.owner)).toMatchObject({ status: 403, body: { code: "forbidden" } });
    expect(await load(w.owner, sheet(response()))).toMatchObject({ status: 403, body: { code: "forbidden" } });
  });

  it("lets admins, facilitators and reviewers read them, and only admins and facilitators load them", async () => {
    for (const user of [w.admin, w.facilitator, w.reviewer]) expect((await get(user)).status).toBe(200);
    expect(await load(w.reviewer, sheet(response()))).toMatchObject({ status: 403, body: { code: "forbidden" } });
    expect(mine((await get(w.admin)).body.items)).toEqual([]);
    expect(await rowsInDatabase()).toEqual([]);
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

describe("loading the responses", () => {
  it("keeps every response and says how many can be shown, without naming any that can't", async () => {
    const res = await load(w.facilitator, sheet(...RESPONSES()));
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ total: 6, created: 6, updated: 0, unchanged: 0, shown: 3, notShown: 3 });
    expect(res.body.warnings).toEqual([]);
    for (const secret of FOREIGN) expect(JSON.stringify(res.body)).not.toContain(secret);
  });

  it("saves the responses from elsewhere, in full, with the country worked out", async () => {
    const rows = await rowsInDatabase();
    expect(rows).toHaveLength(6);
    const by = (name: string) => rows.find((r) => r.businessName === name)!;
    expect(by("Lagos Ventures Ltd")).toMatchObject({ country: "NG", contactName: "Chidi Okafor", phone: "07063479837", location: "Lagos", email: email("lagos") });
    expect(by("Lagos Ventures Ltd").answers).toMatchObject({ additional: "Secret Lagos plans", bank: "Awash" });
    expect(by("Dar Trading Co")).toMatchObject({ country: "TZ", phone: "+255762489028" });
    expect(by("Mystery Ltd")).toMatchObject({ country: null });
    expect(by("Coffee Collective")).toMatchObject({ country: "ET", phone: "+251911246192" });
    expect(rows.filter((r) => r.businessName === "Acme Foods PLC")).toHaveLength(2);
  });

  it("lists only the responses from Ethiopia, newest first, with every answer", async () => {
    const res = await get(w.reviewer);
    expect(res.status).toBe(200);
    const items = mine(res.body.items);
    expect(items.map((i: Json) => [i.businessName, i.location])).toEqual([
      ["Acme Foods PLC", "Addis Ababa / Dukem"],
      ["Acme Foods PLC", "Addis Ababa"],
      ["Coffee Collective", "Bahir Dar"],
    ]);
    expect(items.every((i: Json) => i.country === "ET")).toBe(true);
    expect(items[1]).toMatchObject({
      submittedAt: "2026-03-27T12:00:00.000Z",
      email: email("acme"),
      contactName: "Abebe Kebede",
      phone: "+251911105926",
      answers: { produces: "Dried fruit", category: "Food processing", employees: "10", exportedBefore: "No", bank: "Awash", zemenInterest: "Yes", additional: "1. first\n2. second" },
    });
  });

  it("never lets a response from elsewhere into what the API says", async () => {
    const res = await get(w.admin);
    const body = JSON.stringify(res.body);
    for (const secret of FOREIGN) expect(body, secret).not.toContain(secret);
    // Only a number says they exist.
    expect(res.body.summary.notShown).toBeGreaterThanOrEqual(3);
  });

  it("counts how often a business applied, and what the Ethiopian ones said", async () => {
    const { items, summary } = (await get(w.admin)).body;
    expect(mine(items).map((i: Json) => [i.businessName, i.timesApplied])).toEqual([["Acme Foods PLC", 2], ["Acme Foods PLC", 2], ["Coffee Collective", 1]]);
    expect(summary).toMatchObject({ shown: items.length });
    expect(summary.repeatApplications).toBeGreaterThanOrEqual(2);
    expect(summary.exportedBefore).toBeGreaterThanOrEqual(1);
    expect(summary.interestedInZemen).toBeGreaterThanOrEqual(3);
  });

  it("records who loaded which file, naming nobody who applied", async () => {
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.actorUserId, w.facilitator.id));
    const entry = rows.find((r) => r.action === "program_application.import");
    expect(entry).toMatchObject({ platform: "trade", entityType: "program_application", after: { program: PROGRAM, fileName: "responses.xlsx", total: 6, created: 6, shown: 3, notShown: 3 } });
    for (const name of ["Acme", "Lagos", "Coffee", "Mystery"]) expect(JSON.stringify(entry)).not.toContain(name);
  });
});

describe("loading them again", () => {
  it("leaves alone what hasn't changed", async () => {
    expect((await load(w.admin, sheet(...RESPONSES()))).body).toMatchObject({ total: 6, created: 0, updated: 0, unchanged: 6, shown: 3, notShown: 3 });
  });

  it("adds new responses, updates changed ones and keeps those the file leaves out", async () => {
    const res = await load(w.admin, sheet(response({ 0: SERIAL - 1, 1: email("coffee"), 2: "Coffee Collective", 5: "Bahir Dar", 4: "0911246192", 3: "Mekdes G.", 9: "Yes", 11: "Yes" }), response({ 0: SERIAL + 20, 1: email("new"), 2: "New Foods", 5: "Hawassa" })));
    expect(res.body).toMatchObject({ total: 2, created: 1, updated: 1, unchanged: 0, shown: 2, notShown: 0 });
    const items = mine((await get(w.admin)).body.items);
    expect(items.map((i: Json) => i.businessName)).toEqual(["New Foods", "Acme Foods PLC", "Acme Foods PLC", "Coffee Collective"]);
    expect(items.find((i: Json) => i.businessName === "Coffee Collective").contactName).toBe("Mekdes G.");
    expect(await rowsInDatabase()).toHaveLength(7);
  });

  it("shows a response once its location says it is in Ethiopia", async () => {
    // Not shown: it said "Online".
    expect(mine((await get(w.admin)).body.items).map((i: Json) => i.businessName)).not.toContain("Mystery Ltd");
    const res = await load(w.admin, sheet(response({ 1: email("mystery"), 2: "Mystery Ltd", 3: "Kim Unknown", 4: "12345", 5: "Adiss ababa" })));
    expect(res.body).toMatchObject({ updated: 1, shown: 1, notShown: 0 });
    expect(mine((await get(w.admin)).body.items).map((i: Json) => i.businessName)).toContain("Mystery Ltd");
  });

  it("only names Ethiopian businesses when something in the sheet needs a look", async () => {
    const res = await load(
      w.admin,
      sheet(
        response({ 0: SERIAL + 30, 1: email("odd-et"), 2: "Odd Foods", 4: "+25920600006" }),
        response({ 0: SERIAL + 31, 1: "not-an-email", 2: "Lagos Odd", 5: "Lagos", 4: "bad" }),
        response({ 0: SERIAL + 32, 1: email("odd-dar"), 2: "Dar Odd", 5: "Dar es Salaam", 4: "n/a" }),
      ),
    );
    expect(res.body.warnings).toEqual([`Odd Foods: the phone number "+25920600006" doesn't look like an Ethiopian one.`]);
  });
});

describe("a file that isn't a form's responses", () => {
  const refused = async (bytes: Uint8Array | string, pattern: RegExp) => {
    const res = await load(w.admin, bytes);
    expect([res.status, res.body.code]).toEqual([422, "invalid"]);
    expect(res.body.error).toMatch(pattern);
  };

  it("is refused with the reason", async () => {
    await refused(workbook({ Sheet1: [["a", "b"]] }), /no sheet has "Timestamp" and "Business Name" \(or "Company Name"\) headings/);
    await refused(workbook({ "Form Responses 1": [HEADINGS] }), /no responses/);
    await refused("not a workbook", /isn't an Excel workbook|couldn't be read/);
  });

  it("says which tab a file belongs on when it goes in the wrong one", async () => {
    // A form's responses sent to the register's loader.
    const toRegister = await callV1(w.admin, "POST", "/trade/register/import", { contentBase64: Buffer.from(sheet(response())).toString("base64") });
    expect(toRegister).toMatchObject({ status: 422, body: { code: "invalid" } });
    expect(toRegister.body.error).toMatch(/form's responses, not the diagnostic workbook.*Applications tab/);
    // The diagnostic workbook sent to this one.
    await refused(workbook({ "Master SME Database": [["SME ID", "Company Name"], ["X", "Y"]] }), /diagnostic workbook, not a form's responses.*Register tab/);
  });

  it("refuses a request with no programme or file", async () => {
    expect((await callV1(w.admin, "POST", "/trade/applications/import", { contentBase64: "UEsDBA==" })).status).toBe(400);
    expect((await load(w.admin, "UEsDBA==", { program: "" })).status).toBe(400);
    expect((await load(w.admin, "", {})).status).toBe(400);
  });

  it("changes nothing when it is refused", async () => {
    expect(await rowsInDatabase()).toHaveLength(10);
  });
});

// The Export Growth Companies cohort's form words its questions its own way: "Company Name", an address and a region apart, "Mobile Number".
// The businesses here are invented.
describe("the Export Growth Companies form", () => {
  const GROWTH = `${PREFIX}export-growth-cohort`;
  const HEAD: Cell[] = [
    "Timestamp", "Email Address", "Company Name ", "Contact Person", "Position", "Mobile Number", "Email Address 2", "Company Address", "Region", "Website",
    "Social Media", "Business Profile", "Year Established", "Business Registration Number", "TIN", "Number of Employees", "What products and services do you offer?",
    "Wat are are your top 3 products?", "Current production capacity?", "Main customers?", "Which best describes your company?",
    "Which countries do you currently export to?", "Which countries are you targeting?", "Average annual export sales ", "Approximate annual turnover",
    "Do you have audited financial statements?", "Do you currently work with a bank?", "He you ever received business financing?",
    "Business needs-select your top priorities", "Is your business", "Can the owner or CEO attend all training sessions?", "Documents upload", "Final Declaration",
  ];
  const row = (over: Record<number, Cell> = {}): Cell[] => {
    const r: Cell[] = [
      SERIAL, email("growth-spice"), "Spice Garden PLC", "Selam Tesfaye", "Owner", "0911105926", email("growth-spice-2"), "Arada sub city, Wo 1", "Addis Ababa", null, null,
      "Agro-Processing, Honey & Spices", 2021, "AA/1/0001/2013", "0012345678", "11-25", "Spices", "Turmeric, ginger", "100kg/day", "Local", "Exported previously", "Canada",
      "Europe", null, "Under ETB 5 million", "Yes", "Yes", "No", "Export Readiness", "Women-owned", "Yes", "Business License", "I confirm that the information provided is accurate",
    ];
    for (const [i, v] of Object.entries(over)) r[Number(i)] = v;
    return r;
  };
  const file = (...rows: Cell[][]) => workbook({ "Form Responses 1": [HEAD, ...rows] });
  const loadGrowth = (bytes: Uint8Array) => load(w.admin, bytes, { program: GROWTH, fileName: "TRADE Export Growth Companies Cohort (Responses).xlsx" });
  const mineGrowth = (items: Json[]) => items.filter((i) => i.program === GROWTH);

  it("loads, and keeps address, region and every answer", async () => {
    const res = await loadGrowth(
      file(
        row(),
        row({ 0: SERIAL + 1, 1: email("growth-bag"), 2: "Bag Makers", 3: "Mekdes", 5: 944173254, 7: "Nefas Silk", 8: "Addisabeba", 12: "Oct 2015", 20: "Not yet exporting", 6: null }),
        row({ 0: SERIAL + 2, 1: email("growth-lagos"), 2: "Lagos Growth Ltd", 5: "07063479837", 7: "Ikeja", 8: "Lagos" }),
      ),
    );
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ total: 3, created: 3, moved: 0, shown: 2, notShown: 1, warnings: [], cohort: { number: 3, name: "Export growth companies" } });

    const items = mineGrowth((await get(w.reviewer)).body.items);
    expect(items.map((i: Json) => i.businessName)).toEqual(["Bag Makers", "Spice Garden PLC"]);
    expect(items.find((i: Json) => i.businessName === "Spice Garden PLC")).toMatchObject({
      contactName: "Selam Tesfaye",
      phone: "+251911105926",
      location: "Arada sub city, Wo 1, Addis Ababa",
      answers: {
        position: "Owner",
        contactEmail: email("growth-spice-2"),
        registrationNumber: "AA/1/0001/2013",
        tin: "0012345678",
        category: "Agro-Processing, Honey & Spices",
        mainProducts: "Turmeric, ginger",
        capacity: "100kg/day",
        exportStage: "Exported previously",
        exportMarkets: "Europe",
        supportNeeded: "Export Readiness",
        hasBankAccount: "Yes",
        hadLoan: "No",
        availability: "Yes",
        documentsUploaded: "Business License",
      },
    });
    // The phone number alone placed this one in Ethiopia.
    expect(items.find((i: Json) => i.businessName === "Bag Makers")).toMatchObject({ phone: "+251944173254", location: "Nefas Silk, Addisabeba", country: "ET" });
    expect(JSON.stringify((await get(w.admin)).body)).not.toContain("Lagos Growth");
  });

  it("counts the businesses that have exported from where they are with exporting", async () => {
    const { items, summary } = (await get(w.admin)).body;
    expect(mineGrowth(items)).toHaveLength(2);
    // Spice Garden has exported; Bag Makers hasn't. The count covers every programme loaded in this database.
    expect(summary.exportedBefore).toBeGreaterThanOrEqual(1);
    expect(items.filter((i: Json) => i.program === GROWTH && i.answers.exportStage === "Exported previously")).toHaveLength(1);
  });

  it("is sent back to the Applications tab by the register's loader, but a diagnostic workbook that also has a Company Name sheet is not", async () => {
    const toRegister = await callV1(w.admin, "POST", "/trade/register/import", { contentBase64: Buffer.from(file(row())).toString("base64") });
    expect(toRegister).toMatchObject({ status: 422, body: { code: "invalid" } });
    expect(toRegister.body.error).toMatch(/form's responses, not the diagnostic workbook.*Applications tab/);

    const diagnostic = workbook({ "Master SME Database": [["SME ID", "Company Name"]], Notes: [["Timestamp", "Company Name"], [SERIAL, "Anyone"]] });
    const res = await callV1(w.admin, "POST", "/trade/register/import", { contentBase64: Buffer.from(diagnostic).toString("base64") });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/no businesses in it/);
  });
});

// The programme's name decides the cohort, and a form loaded under the wrong name is put right by loading it again under the right one.
describe("the programme a form is loaded under", () => {
  const WRONG = `${PREFIX}agro-wrong-programme`;
  const RIGHT = `${PREFIX}export-growth-right-programme`;
  const NONE = `${PREFIX}coffee-no-cohort`;
  const loadAs = (program: string) => load(w.admin, workbook({ "Form Responses 1": [HEADINGS, response({ 0: SERIAL + 500, 1: email("moved"), 2: "Moved Foods PLC" })] }), { program });
  const rowsFor = () => db.select().from(schema.programApplication).where(eq(schema.programApplication.email, email("moved")));

  it("says which cohort the businesses are in", async () => {
    expect((await loadAs(WRONG)).body).toMatchObject({ created: 1, moved: 0, cohort: { number: 2, name: "Agro-processing" } });
  });

  it("moves a response to the programme it is loaded under next, instead of keeping it twice", async () => {
    const res = await loadAs(RIGHT);
    expect(res.body).toMatchObject({ total: 1, created: 0, updated: 1, moved: 1, unchanged: 0, cohort: { number: 3, name: "Export growth companies" } });
    expect((await rowsFor()).map((r) => r.program)).toEqual([RIGHT]);
  });

  it("then leaves it alone, and records the move in the audit log without naming the business", async () => {
    expect((await loadAs(RIGHT)).body).toMatchObject({ created: 0, updated: 0, moved: 0, unchanged: 1 });
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.actorUserId, w.admin.id));
    const entry = rows.find((r) => r.action === "program_application.import" && (r.after as Json).program === RIGHT && (r.after as Json).moved === 1);
    expect(entry).toBeDefined();
    expect(JSON.stringify(entry)).not.toContain("Moved Foods");
  });

  it("says when the programme's name puts the businesses in no cohort", async () => {
    expect((await loadAs(NONE)).body).toMatchObject({ moved: 1, cohort: null });
  });
});
