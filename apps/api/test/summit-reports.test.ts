import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { strFromU8, unzipSync, unzlibSync } from "fflate";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { schema } from "@entrust/db";
import { REPORTS } from "@entrust/summit-engine";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { callFileV1, callV1, cleanup, COUNTRY, createOrganization, db, makeFile, PREFIX, signUp, type Json, type TestUser } from "./support";
import { completeAnswers } from "./summit-form";

// The twelve reports of the specification's section 11 (#80): what each holds, who may export which, the three file
// formats, and the audit entry every export leaves. The pure column rules are in the engine's reports.test.ts.
vi.mock("../src/services/summit-forms", async (importOriginal) => (await import("./summit-form")).withPublishedForm(await importOriginal()));
vi.mock("@entrust/jobs", async (importOriginal) => ({ ...(await importOriginal<typeof import("@entrust/jobs")>()), enqueue: vi.fn(async () => "job-1") }));

const w = {} as {
  owners: TestUser[]; outsider: TestUser;
  admin: TestUser; facilitator: TestUser; reviewer: TestUser; reviewer2: TestUser; committee: TestUser;
  orgs: string[]; entrust: string; periodId: string;
  /** A and B go through the committee and are decided; C waits with it; D is recommended but not yet reviewed; E is with a second officer; F is a draft. */
  a: string; b: string; c: string; d: string; e: string; f: string;
};

const S = "/summit";
const call = (user: TestUser | null, method: string, path: string, body?: unknown) => callV1(user, method, `${S}${path}`, body);

const criteriaOf = (view: Json): Json[] => view.categories.flatMap((c: Json) => c.criteria);
const workspace = async (user: TestUser, id: string) => (await call(user, "GET", `/applications/${id}/assessment`)).body;
function scoresFor(view: Json, earned: number): Record<string, number> {
  const scores: Record<string, number> = {};
  let left = earned;
  for (const c of criteriaOf(view)) {
    scores[c.id] = Math.min(c.maxPoints, left);
    left -= scores[c.id]!;
  }
  return scores;
}

async function eligibleApplication(owner: TestUser, organizationId: string, overrides: Record<string, unknown>, form: Json, submit = true) {
  const created = await call(owner, "POST", "/applications", { organizationId });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = created.body.id as string;
  const saved = await call(owner, "PATCH", `/applications/${id}/answers`, { answers: completeAnswers(form, { ...created.body.answers, ...overrides } as never) });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  if (!submit) return id;
  for (const [name, kind] of [["certificate.pdf", "registration_certificate"], ["catalogue.pdf", "product_information"]] as const) {
    expect((await call(owner, "POST", `/applications/${id}/documents`, { fileId: await makeFile(organizationId, owner.id, name), kind })).status).toBe(201);
  }
  // A financial statement can no longer be uploaded; these tests still need one on file, as an applicant could have added before.
  await db.insert(schema.applicationDocument).values({
    applicationId: id,
    fileId: await makeFile(organizationId, owner.id, "accounts.pdf"),
    kind: "financial_statements",
    addedBy: owner.id,
  });
  expect((await call(owner, "POST", `/applications/${id}/submit`)).status).toBe(200);
  expect((await call(w.facilitator, "PUT", `/applications/${id}/officer`, { officerUserId: w.reviewer.id })).status).toBe(200);
  return id;
}

async function recommended(id: string, earned: number, suitableOpportunity = "trade", beforeCompleting?: () => Promise<void>) {
  const view = await workspace(w.reviewer, id);
  expect((await call(w.reviewer, "POST", `/applications/${id}/assessment/scores`, { scores: scoresFor(view, earned) })).status).toBe(201);
  for (const c of view.categories.filter((c: Json) => c.applicable)) {
    const note = await call(w.reviewer, "PUT", `/applications/${id}/assessment/notes/${c.id}`, { justification: `Category ${c.id} is scored.`, evidence: ["Registration certificate", "Answer S2.2"] });
    expect(note.status, JSON.stringify(note.body)).toBe(200);
  }
  await beforeCompleting?.();
  expect((await call(w.reviewer, "POST", `/applications/${id}/assessment/complete`)).status).toBe(200);
  const res = await call(w.reviewer, "POST", `/applications/${id}/recommendation`, { recommendation: "recommend_selection", suitableOpportunity, rationale: `Marked ${earned}.` });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
}

const approve = (id: string) => call(w.admin, "POST", `/applications/${id}/review`, { decision: "approve" });
const decide = (id: string, decision: string, reason: string) => call(w.committee, "POST", `/applications/${id}/decision`, { decision, reason });

// ---- Reading what comes back ----

const query = (parameters: Record<string, string | undefined> = {}): string => {
  const entries = Object.entries({ periodId: w.periodId, ...parameters }).filter((e): e is [string, string] => e[1] !== undefined);
  return `?${new URLSearchParams(entries).toString()}`;
};
const exportJson = async (user: TestUser, report: string, parameters: Record<string, string | undefined> = {}) => {
  const res = await call(user, "GET", `/reports/${report}${query({ format: "json", ...parameters })}`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};
/** The rows of a JSON report as objects by column label. */
const rowsOf = (view: Json): Record<string, string | number | null>[] =>
  view.rows.map((row: Json[]) => Object.fromEntries(view.columns.map((c: Json, i: number) => [c.label, row[i]])));
const records = async (user: TestUser, report: string, parameters: Record<string, string | undefined> = {}) => rowsOf(await exportJson(user, report, parameters));
const idsIn = (rows: Record<string, unknown>[], key = "Application ID"): string[] => rows.map((r) => r[key] as string).sort();

const file = async (user: TestUser, report: string, format: string, parameters: Record<string, string | undefined> = {}) => {
  const res = await callFileV1(user, `${S}/reports/${report}${query({ format, ...parameters })}`);
  expect(res.status).toBe(200);
  return { response: res, bytes: new Uint8Array(await res.arrayBuffer()) };
};

/** The cells of a workbook's first sheet, by row. */
function sheetRows(bytes: Uint8Array, sheet = 1): (string | number | null)[][] {
  const xml = strFromU8(unzipSync(bytes)[`xl/worksheets/sheet${sheet}.xml`] as Uint8Array);
  const unescape = (t: string) => t.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
  return [...xml.matchAll(/<row r="(\d+)">(.*?)<\/row>/gs)].map(([, , cells]) => {
    const row: (string | number | null)[] = [];
    for (const [, reference, attributes, inner] of cells!.matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs)) {
      const column = [...reference!].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const text = inner?.match(/<t[^>]*>(.*?)<\/t>/s)?.[1];
      const number = inner?.match(/<v>(.*?)<\/v>/s)?.[1];
      row[column] = attributes!.includes("inlineStr") && text !== undefined ? unescape(text) : number !== undefined ? Number(number) : null;
    }
    return Array.from(row, (c) => c ?? null);
  });
}

/** The text a PDF draws. pdf-lib writes it as hex strings in compressed content streams. */
async function pdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  const lines: string[] = [];
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    let data: Uint8Array;
    try {
      data = unzlibSync(object.contents);
    } catch {
      continue;
    }
    for (const [, hex] of new TextDecoder("latin1").decode(data).matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      lines.push(String.fromCharCode(...hex!.match(/../g)!.map((h) => parseInt(h, 16))));
    }
  }
  return lines.join("\n");
}

/** A date as the reports write it. The database stamps decisions and approvals with its own clock, not the test's. */
const dayOf = (date: Date | null | undefined): string => (date as Date).toISOString().slice(0, 10);
const decidedOn = async (id: string) =>
  dayOf((await db.select().from(schema.committeeDecision).where(eq(schema.committeeDecision.applicationId, id)))[0]?.decidedAt);

const auditOf = (userId: string) =>
  db.select().from(schema.auditLog).where(and(eq(schema.auditLog.actorUserId, userId), eq(schema.auditLog.action, "summit.report.exported")));

beforeAll(async () => {
  await cleanup();
  const names = ["owner-a", "owner-b", "owner-c", "owner-d", "owner-e", "owner-f", "outsider", "admin", "facilitator", "reviewer", "reviewer2", "committee"];
  const users = (await Promise.all(names.map(signUp))) as TestUser[];
  const [ownerA, ownerB, ownerC, ownerD, ownerE, ownerF, outsider, admin, facilitator, reviewer, reviewer2, committee] = users;
  Object.assign(w, { owners: [ownerA, ownerB, ownerC, ownerD, ownerE, ownerF], outsider, admin, facilitator, reviewer, reviewer2, committee });
  w.orgs = await Promise.all(["a", "b", "c", "d", "e", "f"].map((n, i) => createOrganization(`org-${n}`, [[w.owners[i]!, "owner"]])));
  w.entrust = await createOrganization(
    "entrust",
    [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"], [reviewer2!, "reviewer"], [committee!, "committee"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrust;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-01-15T10:00:00Z");

  const period = await call(w.admin, "POST", "/periods", {
    name: `${PREFIX}summit-reports`,
    opensAt: "2030-01-01T00:00:00Z",
    closesAt: "2030-02-01T00:00:00Z",
    countries: [COUNTRY],
  });
  expect(period.status, JSON.stringify(period.body)).toBe(201);
  w.periodId = period.body.id;
  const form = (await call(w.owners[0]!, "GET", "/forms/0.1.0")).body;

  // A and C also seek investment. B is trade only and from another country. D chooses a strategic partnership.
  const answers = (sector: string, extra: Record<string, unknown> = {}) => ({ "S2.1": sector, "S1.10": "Contact", "S7.3": "Seeking buyers", ...extra });
  w.a = await eligibleApplication(ownerA!, w.orgs[0]!, answers("Coffee", { "S4.1": "yes", "S4.2": { amount: 250000, currency: "USD" }, "S1.8": "yes" }), form);
  w.b = await eligibleApplication(ownerB!, w.orgs[1]!, answers("Textiles and apparel", { "S4.1": "no" }), form);
  w.c = await eligibleApplication(ownerC!, w.orgs[2]!, answers("Coffee processing", { "S4.1": "yes" }), form);
  w.d = await eligibleApplication(ownerD!, w.orgs[3]!, answers("Leather goods", { "S2.12": "strategic_partnership", "S4.1": "no" }), form);
  w.e = await eligibleApplication(ownerE!, w.orgs[4]!, answers("Honey", { "S4.1": "no" }), form);
  w.f = await eligibleApplication(ownerF!, w.orgs[5]!, answers("Spices"), form, false);
  expect((await call(w.facilitator, "PUT", `/applications/${w.e}/officer`, { officerUserId: w.reviewer2.id })).status).toBe(200);
  await db.update(schema.smeProfile).set({ country: "QY" }).where(eq(schema.smeProfile.organizationId, w.orgs[1]!));

  // One document supports the claim about A's revenue.
  await recommended(w.a, 90, "investment", async () => {
    const docs = (await call(w.owners[0]!, "GET", `/applications/${w.a}`)).body.documents as Json[];
    const accounts = docs.find((d) => d.kind === "financial_statements");
    const claim = await call(w.reviewer, "PUT", `/applications/${w.a}/verification/annual_revenue`, { class: "document_supported", documents: [accounts?.id] });
    expect(claim.status, JSON.stringify(claim.body)).toBe(200);
  });
  await recommended(w.b, 64);
  await recommended(w.c, 70, "combined");
  await recommended(w.d, 55);
  for (const id of [w.a, w.b, w.c]) expect((await approve(id)).status).toBe(200);
  expect((await decide(w.a, "selected", "Strong buyers and a clear plan.")).status).toBe(201);
  expect((await decide(w.b, "waitlisted", "Good, but the country is full.")).status).toBe(201);

  // The committee member and an administrator each write a note on B.
  expect((await call(w.committee, "POST", `/applications/${w.b}/comments`, { body: "Revisit if a place opens." })).status).toBe(201);
  expect((await call(w.admin, "POST", `/applications/${w.b}/comments`, { body: "An officer's private note." })).status).toBe(201);
});

afterAll(async () => {
  vi.useRealTimers();
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("signed out and not staff", () => {
  it("is refused the reports without signing in", async () => {
    for (const path of ["/reports", "/reports/application-register"]) {
      const res = await call(null, "GET", path);
      expect([path, res.status, res.body.code]).toEqual([path, 401, "unauthenticated"]);
    }
  });

  it("refuses an applicant, and anyone else outside the committee and Entrust's staff, every report in every format", async () => {
    for (const user of [w.owners[0]!, w.outsider]) {
      expect((await call(user, "GET", "/reports")).status).toBe(403);
      for (const format of ["json", "csv", "xlsx", "pdf"]) {
        const res = await callFileV1(user, `${S}/reports/application-register${query({ format })}`);
        expect([format, res.status]).toEqual([format, 403]);
      }
    }
  });

  it("writes no audit entry for a refused export", async () => {
    expect(await auditOf(w.owners[0]!.id)).toEqual([]);
    expect(await auditOf(w.outsider.id)).toEqual([]);
  });
});

describe("the catalogue", () => {
  it("lists the twelve reports with their columns, classification and what the caller's export holds", async () => {
    const res = await call(w.admin, "GET", "/reports");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.items).toHaveLength(12);
    expect(res.body.items.map((r: Json) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(res.body.items.map((r: Json) => r.columns.length)).toEqual(REPORTS.map((r) => r.columns.length));
    expect(res.body.items.every((r: Json) => r.scope === "all")).toBe(true);
    expect(res.body.items.find((r: Json) => r.id === "assessment-scores").classification).toBe("confidential");
  });

  it("tells each role what its export would hold", async () => {
    const scopes = async (user: TestUser) => Object.fromEntries((await call(user, "GET", "/reports")).body.items.map((r: Json) => [r.id, r.scope]));
    expect(await scopes(w.facilitator)).toMatchObject({ "application-register": "all", "b2b-matching": "all" });
    expect(await scopes(w.reviewer)).toMatchObject({ "application-register": "assigned", "verification": "assigned", "country-distribution": "aggregate", "sector-distribution": "aggregate" });
    expect(await scopes(w.committee)).toMatchObject({ "application-register": "committee", "committee-decisions": "committee", "country-distribution": "aggregate" });
  });
});

describe("the application register", () => {
  it("lists every application of the period to an administrator, drafts included, with the specified columns", async () => {
    const view = await exportJson(w.admin, "application-register");
    expect(view.report).toMatchObject({ id: "application-register", number: 1, classification: "internal" });
    expect(view.columns.map((c: Json) => c.label)).toEqual(REPORTS[0]!.columns.map((c) => c.label));
    expect(view.records).toBe(6);
    expect(view.generatedBy).toBe("admin");
    const rows = rowsOf(view);
    const byId = Object.fromEntries(rows.map((r) => [r["Application ID"], r]));
    const [a, f] = [rows.find((r) => r["Industry"] === "Coffee")!, rows.find((r) => r["Industry"] === "Spices")!];
    expect(a).toMatchObject({
      "Business name": "org-a",
      Country: COUNTRY,
      "Applicant name": "Contact",
      "Primary applicant pathway": "Trade and market access",
      "Application status": "Selected",
      "Assigned assessment officer": "reviewer",
      "Eligibility outcome": "Eligible",
      "Document completeness status": "Complete",
    });
    expect(f).toMatchObject({ "Application status": "Draft", "Date submitted": null, "Eligibility outcome": "Not screened" });
    expect(Object.keys(byId)).toHaveLength(6);
  });

  it("reflects a change of status in every report at once", async () => {
    // D is recommended; once an administrator approves it, the register, the scores and the country report all show it with the committee.
    const before = (await records(w.admin, "application-register")).find((r) => r["Industry"] === "Leather goods");
    expect(before!["Application status"]).toBe("Recommended");
    expect((await approve(w.d)).status).toBe(200);
    const after = (await records(w.admin, "application-register")).find((r) => r["Industry"] === "Leather goods");
    expect(after!["Application status"]).toBe("Committee review");
    expect((await records(w.admin, "committee-decisions")).map((r) => r["Business name"])).not.toContain("org-d");
    // Put it back for the tests that follow.
    await db.update(schema.application).set({ status: "recommended" }).where(eq(schema.application.id, w.d));
  });
});

describe("the three formats", () => {
  it("gives a CSV that opens in Excel, starts with the details every export carries, and holds the records", async () => {
    const { response, bytes } = await file(w.admin, "application-register", "csv", { country: COUNTRY });
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="summit-application-register-test-api-summit-reports-20300115\.csv"$/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    // UTF-8 with a byte order mark.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder().decode(bytes).replace(/^﻿/, "").trimEnd().split("\r\n");
    expect(lines.slice(0, 8)).toEqual([
      "Summit,Africa Diaspora Trade and Investment Summit",
      "Report,Application Register",
      "Reporting period,test-api-summit-reports",
      expect.stringMatching(/^Generated,2030-01-15 10:00:00 UTC$/),
      "Generated by,admin",
      `Filters applied,Country: ${COUNTRY}`,
      "Total records,5",
      "Classification,Internal",
    ]);
    expect(lines[8]).toBe("");
    expect(lines[9]).toBe(REPORTS[0]!.columns.map((c) => c.label).join(","));
    // Five applications are from QZ (B moved to QY), and the header and the record lines make up the rest.
    expect(lines).toHaveLength(10 + 5);
  });

  it("protects a CSV against formula injection", async () => {
    await db.update(schema.organization).set({ name: '=HYPERLINK("http://evil.example","Click")' }).where(eq(schema.organization.id, w.orgs[2]!));
    await db.update(schema.organization).set({ name: "@SUM(1+1)" }).where(eq(schema.organization.id, w.orgs[3]!));
    const { bytes } = await file(w.admin, "application-register", "csv");
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain(`"'=HYPERLINK(""http://evil.example"",""Click"")"`);
    expect(text).toContain("'@SUM(1+1)");
    expect(text).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(text).not.toMatch(/(^|,)@SUM/m);
    await db.update(schema.organization).set({ name: "org-c" }).where(eq(schema.organization.id, w.orgs[2]!));
    await db.update(schema.organization).set({ name: "org-d" }).where(eq(schema.organization.id, w.orgs[3]!));
  });

  it("gives an Excel workbook with the records on one sheet, ready to filter, and the details of the export on another", async () => {
    const { response, bytes } = await file(w.admin, "application-register", "xlsx");
    expect(response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toMatch(/filename="summit-application-register-.*\.xlsx"/);
    const package_ = unzipSync(bytes);
    expect(Object.keys(package_).sort()).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml", "xl/worksheets/sheet2.xml"]);
    expect(strFromU8(package_["xl/worksheets/sheet1.xml"]!)).toContain("<autoFilter ref=\"A1:S7\"/>");

    const records_ = sheetRows(bytes);
    expect(records_).toHaveLength(7);
    expect(records_[0]).toEqual(REPORTS[0]!.columns.map((c) => c.label));
    expect(records_[1]![1]).toMatch(/^org-/);
    const details = sheetRows(bytes, 2);
    expect(details.map((r) => r[0])).toEqual(["Summit", "Report", "Reporting period", "Generated", "Generated by", "Filters applied", "Total records", "Classification"]);
    expect(details.find((r) => r[0] === "Total records")![1]).toBe("6");
  });

  it("keeps figures as numbers in the workbook and text as text, whatever it starts with", async () => {
    const { bytes } = await file(w.admin, "assessment-scores", "xlsx");
    const [header, first] = sheetRows(bytes);
    const column = header!.indexOf("Normalized score");
    expect(typeof first![column]).toBe("number");
    expect(typeof first![0]).toBe("string");
  });

  it("gives a PDF with the Summit's name, the report title, the date and the classification", async () => {
    const { response, bytes } = await file(w.admin, "application-register", "pdf");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Application Register");
    expect(pdf.getAuthor()).toBe("admin");
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(2);
    const text = await pdfText(bytes);
    expect(text).toContain("Africa Diaspora Trade and Investment Summit");
    expect(text).toContain("Application Register");
    expect(text).toContain("INTERNAL");
    expect(text).toContain("2030-01-15 10:00 UTC");
    expect(text).toContain("Page 1 of");
    expect(text).toContain("org-a");
    expect(text).toContain("SUM-");
  });

  it("gives every report in every format", async () => {
    for (const report of REPORTS) {
      for (const format of ["csv", "xlsx", "pdf"]) {
        const { bytes } = await file(w.admin, report.id, format);
        expect(bytes.byteLength, `${report.id} ${format}`).toBeGreaterThan(100);
      }
      expect((await exportJson(w.admin, report.id)).columns.length, report.id).toBe(report.columns.length);
    }
  });

  it("draws a business named in a script the PDF fonts lack as question marks, and keeps it in the other formats", async () => {
    await db.update(schema.organization).set({ name: "ቡና Coffee" }).where(eq(schema.organization.id, w.orgs[4]!));
    try {
      expect(await pdfText((await file(w.admin, "application-register", "pdf")).bytes)).toContain("?? Coffee");
      expect(new TextDecoder().decode((await file(w.admin, "application-register", "csv")).bytes)).toContain("ቡና Coffee");
      expect(JSON.stringify(sheetRows((await file(w.admin, "application-register", "xlsx")).bytes))).toContain("ቡና Coffee");
    } finally {
      await db.update(schema.organization).set({ name: "org-e" }).where(eq(schema.organization.id, w.orgs[4]!));
    }
  });
});

describe("who sees which applications", () => {
  it("shows an assessment officer only the applications assigned to them, and a filter can't widen that", async () => {
    expect((await records(w.reviewer, "application-register")).map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-b", "org-c", "org-d"]);
    // The second officer holds E alone. Asking for E's status or country gives the first officer nothing.
    expect(await records(w.reviewer, "application-register", { status: "under_assessment" })).toEqual([]);
    const second = await records(w.reviewer2, "application-register");
    expect(second.map((r) => r["Business name"])).toEqual(["org-e"]);
  });

  it("gives the committee only the applications it can open, from committee review on", async () => {
    const rows = await records(w.committee, "application-register");
    expect(rows.map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-b", "org-c"]);
    expect((await records(w.committee, "application-register", { status: "recommended" }))).toEqual([]);
    expect((await records(w.committee, "assessment-scores")).map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-b", "org-c"]);
  });

  it("gives an officer and the committee the figures of the whole period in the two distribution reports", async () => {
    const admin = await records(w.admin, "country-distribution");
    for (const user of [w.reviewer, w.reviewer2, w.committee, w.facilitator]) expect(await records(user, "country-distribution")).toEqual(admin);
    const sectors = await records(w.admin, "sector-distribution");
    for (const user of [w.reviewer2, w.committee]) expect(await records(user, "sector-distribution")).toEqual(sectors);
    // No applicant's name or contact is in them.
    expect(JSON.stringify(admin) + JSON.stringify(sectors)).not.toContain("org-");
  });

  it("applies the scope before the filters, whichever format asks", async () => {
    for (const format of ["csv", "xlsx"]) {
      const { bytes } = await file(w.reviewer2, "application-register", format);
      const text = format === "csv" ? new TextDecoder().decode(bytes) : JSON.stringify(sheetRows(bytes));
      expect(text).toContain("org-e");
      expect(text).not.toContain("org-a");
    }
  });

  it("names a supporting document only to those who may open it", async () => {
    const names = async (user: TestUser) => (await records(user, "verification")).map((r) => r["Document name"]);
    expect(await names(w.admin)).toEqual(["accounts.pdf"]);
    expect(await names(w.reviewer)).toEqual(["accounts.pdf"]);
    // Financial statements are restricted: a facilitator can't open them, and the committee reads the findings, not the files.
    expect(await names(w.facilitator)).toEqual([null]);
    expect(await names(w.committee)).toEqual([null]);
  });
});

describe("filters", () => {
  it("narrow the report by country, status, pathway and industry, and say so in the details", async () => {
    expect(idsIn(await records(w.admin, "application-register", { country: "qy" }))).toHaveLength(1);
    expect((await records(w.admin, "application-register", { status: "selected" })).map((r) => r["Business name"])).toEqual(["org-a"]);
    expect((await records(w.admin, "application-register", { pathway: "strategic_partnership" })).map((r) => r["Business name"])).toEqual(["org-d"]);
    expect((await records(w.admin, "application-register", { sector: "COFFEE" })).map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-c"]);
    const view = await exportJson(w.admin, "application-register", { country: "qy", status: "waitlisted" });
    expect(view.filters).toEqual({ country: "QY", status: "waitlisted" });
    expect(view.records).toBe(1);
    const { bytes } = await file(w.admin, "application-register", "xlsx", { country: "qy" });
    expect(sheetRows(bytes, 2).find((r) => r[0] === "Filters applied")![1]).toBe("Country: QY");
  });

  it("lists only the countries that remain in the country report", async () => {
    expect((await records(w.admin, "country-distribution")).map((r) => r.Country)).toEqual([COUNTRY, "QY"]);
    expect((await records(w.admin, "country-distribution", { country: "QY" })).map((r) => r.Country)).toEqual(["QY"]);
  });

  it("refuses a filter it doesn't know, and a period that doesn't exist", async () => {
    expect((await call(w.admin, "GET", `/reports/application-register${query({ status: "nonsense" })}`)).status).toBe(400);
    expect((await call(w.admin, "GET", `/reports/application-register${query({ country: "KEN" })}`)).status).toBe(400);
    expect((await call(w.admin, "GET", `/reports/application-register${query({ format: "docx" })}`)).status).toBe(400);
    expect((await call(w.admin, "GET", `/reports/nonsense${query()}`)).status).toBe(400);
    expect((await call(w.admin, "GET", `/reports/application-register${query({ periodId: randomUUID() })}`)).status).toBe(404);
  });
});

describe("the audit log", () => {
  it("records every export: who, which report, the format, the filters and how many records", async () => {
    const newest = (rows: Awaited<ReturnType<typeof auditOf>>) => rows.sort((x, y) => x.occurredAt.getTime() - y.occurredAt.getTime());
    const before = (await auditOf(w.facilitator.id)).length;
    await file(w.facilitator, "waitlist", "pdf", { country: "QY" });
    await file(w.facilitator, "waitlist", "csv");
    await exportJson(w.facilitator, "waitlist");
    const entries = newest(await auditOf(w.facilitator.id)).slice(before);
    expect(entries.map((e) => (e.after as Json).format)).toEqual(["pdf", "csv", "json"]);
    expect(entries[0]).toMatchObject({ platform: "summit", entityType: "summit_period", entityId: w.periodId, actorUserId: w.facilitator.id });
    expect(entries[0]!.after).toMatchObject({
      report: "waitlist",
      title: "Waitlist Report",
      format: "pdf",
      filters: { country: "QY" },
      records: 1,
      scope: "all",
      classification: "confidential",
      exportedAt: "2030-01-15T10:00:00.000Z",
    });
    expect(entries[1]!.after).toMatchObject({ filters: {}, records: 1 });
  });

  it("records an export for a user with narrower access at the size of what they received", async () => {
    await file(w.reviewer2, "application-register", "csv");
    const entry = (await auditOf(w.reviewer2.id)).sort((x, y) => x.occurredAt.getTime() - y.occurredAt.getTime()).at(-1)!;
    expect(entry.after).toMatchObject({ report: "application-register", scope: "assigned", records: 1 });
  });
});

describe("the other reports", () => {
  it("scores the assessed applications across the seven categories", async () => {
    const rows = await records(w.admin, "assessment-scores");
    expect(rows.map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-b", "org-c", "org-d"]);
    const a = rows.find((r) => r["Business name"] === "org-a")!;
    expect(a).toMatchObject({ "Normalized score": 90, "Raw score": 90, "Applicable maximum score": 100, "Investment category status": "Applicable", "Assessment review status": "Approved" });
    const sum = ["Business legitimacy", "Commercial offering", "Trade opportunity", "Investment opportunity", "Financial and operational readiness", "Diaspora partnership", "Summit readiness"].reduce(
      (total, name) => total + (a[`${name} score`] as number),
      0,
    );
    expect(sum).toBe(90);
    // B is a trade applicant, so category D is left out and the score is scaled to 100.
    const b = rows.find((r) => r["Business name"] === "org-b")!;
    expect(b).toMatchObject({ "Investment category status": "N/A", "Investment opportunity score": null, "Applicable maximum score": 80, "Raw score": 64, "Normalized score": 80 });
  });

  it("agrees with the dashboard on the country figures", async () => {
    const dashboard = (await call(w.admin, "GET", `/dashboard?periodId=${w.periodId}`)).body;
    const country = (code: string) => (dashboard.byCountry as Json[]).find((c) => c.country === code);
    const report = Object.fromEntries((await records(w.admin, "country-distribution")).map((r) => [r.Country, r]));
    for (const code of [COUNTRY, "QY"]) {
      expect(report[code]).toMatchObject({
        "Submitted applications": country(code).applications,
        "Eligible applicants": country(code).eligible,
        "Applications under assessment": country(code).underAssessment,
        "Completed assessments": country(code).assessed,
        "Selected SMEs": country(code).selected,
        "Waitlisted SMEs": country(code).waitlisted,
        "Average normalized score": country(code).averageScore,
      });
    }
    expect(report[COUNTRY]).toMatchObject({ "Draft applications": 1, "Total applications": 5 });
  });

  it("lists the sectors, and the money asked for in each currency", async () => {
    const rows = await records(w.admin, "sector-distribution");
    const coffee = rows.filter((r) => String(r.Industry).startsWith("Coffee"));
    expect(coffee.map((r) => r.Industry).sort()).toEqual(["Coffee", "Coffee processing"]);
    expect(coffee.find((r) => r.Industry === "Coffee")!["Total stated investment requested"]).toBe("USD 250,000");
    expect(rows.find((r) => r.Industry === "Spices")).toMatchObject({ "Total applications": 1, "Completed assessments": 0 });
  });

  it("lists those seeking investment, and the trade applicants", async () => {
    const investors = await records(w.admin, "investment-opportunities");
    expect(investors.map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-c"]);
    expect(investors.find((r) => r["Business name"] === "org-a")).toMatchObject({
      "Investment amount requested": 250000,
      Currency: "USD",
      "Verification status": "1 document-supported",
      "Selection status": "Selected",
      "Investment readiness score": expect.any(Number),
    });
    const trade = await records(w.admin, "trade-opportunities");
    expect(trade.map((r) => r["Business name"])).toEqual(["org-a", "org-b", "org-c", "org-e"]);
  });

  it("registers the selected SMEs and prepares them for matching, once, with the same number in both", async () => {
    const register = await records(w.admin, "selected-smes");
    expect(register).toHaveLength(1);
    expect(register[0]).toMatchObject({
      "Selection number": "SEL-001",
      "Business name": "org-a",
      "Opportunity classification": "Investment opportunity",
      "Committee approval status": "Awaiting final list approval",
      "Selection decision date": await decidedOn(w.a),
    });
    const matching = await records(w.admin, "b2b-matching");
    expect(matching).toHaveLength(1);
    expect(matching[0]).toMatchObject({ "SME selection number": "SEL-001", "Specific commercial ask": "Seeking buyers", "Primary opportunity classification": "Investment opportunity", "Post-Summit outcome": null });
    expect(matching[0]!["Buyer or partner type sought"]).toEqual(expect.any(String));
  });

  it("lists the waitlist with the reason, and only the committee's comments", async () => {
    const waitlist = await records(w.admin, "waitlist");
    expect(waitlist).toHaveLength(1);
    expect(waitlist[0]).toMatchObject({
      "Waitlist position": 1,
      "Business name": "org-b",
      "Reason for waitlisting": "Good, but the country is full.",
      "Selection committee comments": "Revisit if a place opens.",
      "Date added to waitlist": (await db.select().from(schema.applicationStatusChange).where(and(eq(schema.applicationStatusChange.applicationId, w.b), eq(schema.applicationStatusChange.toStatus, "waitlisted"))))
        .map((c) => dayOf(c.changedAt))
        .at(-1),
      "Current status": "Waitlisted",
    });
  });

  it("records the committee's decisions, and says the final list isn't approved yet", async () => {
    const rows = await records(w.admin, "committee-decisions");
    expect(rows.map((r) => r["Business name"]).sort()).toEqual(["org-a", "org-b"]);
    expect(rows.find((r) => r["Business name"] === "org-a")).toMatchObject({
      "Assessment officer recommendation": "Recommend for Summit selection",
      "Committee decision": "Selected",
      "Committee justification": "Strong buyers and a clear plan.",
      "Committee member or authorized decision-maker": "committee",
      "Approval status": "Awaiting final list approval",
      "Final selection status": "Not yet published",
    });
  });

  it("reports the verification of each classified claim", async () => {
    const rows = await records(w.admin, "verification");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      "Business name": "org-a",
      "Claim or information being verified": "Annual revenue",
      "Evidence classification": "Document-supported",
      "Verification outcome": "Supported by documents",
      "Outstanding verification requirements": "An independent check",
      "Assigned verification officer": "reviewer",
    });
  });
});

describe("the profile of a selected SME", () => {
  const profile = (user: TestUser | null, id: string) => callFileV1(user, `${S}/applications/${id}/profile`);
  const profileText = async (user: TestUser, id: string) => {
    const res = await profile(user, id);
    expect(res.status).toBe(200);
    return { res, text: await pdfText(new Uint8Array(await res.arrayBuffer())) };
  };
  const generated = (id: string) =>
    db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, id), eq(schema.auditLog.action, "summit.profile.generated")));

  it("is a PDF of what the business told us, with no score, reason or recommendation in it", async () => {
    const { res, text } = await profileText(w.admin, w.a);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="summit-profile-sel-001-org-a.pdf"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    for (const expected of ["org-a", "SEL-001", "SME OPPORTUNITY PROFILE", "INTERNAL", "Coffee", "Seeking buyers", "Investment opportunity", "Selection pending the committee's final list approval"]) {
      expect(text, expected).toContain(expected);
    }
    for (const secret of ["Strong buyers and a clear plan.", "Recommend", "Marked 90", "document-supported", "Document-supported"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("is made for the committee, a facilitator and the officer it is assigned to, and for no one else", async () => {
    for (const user of [w.committee, w.facilitator, w.reviewer]) expect((await profile(user, w.a)).status, user.id).toBe(200);
    // Another officer can't open the application at all, and an applicant's profile is Entrust's, not theirs.
    expect((await profile(w.reviewer2, w.a)).status).toBe(404);
    expect((await profile(w.outsider, w.a)).status).toBe(404);
    expect((await profile(w.owners[0]!, w.a)).status).toBe(403);
    expect((await call(null, "GET", `/applications/${w.a}/profile`)).status).toBe(401);
  });

  it("is made only for an SME the committee has selected", async () => {
    for (const id of [w.b, w.c, w.d, w.e]) {
      const res = await profile(w.admin, id);
      expect([id, res.status]).toEqual([id, 409]);
    }
    // The committee can't open one it hasn't reached, so for it the answer is the same as for no application.
    expect((await profile(w.committee, w.d)).status).toBe(404);
  });

  it("is written to the audit log with who made it, and a refused one leaves no entry", async () => {
    const before = (await generated(w.a)).length;
    await profile(w.admin, w.a);
    await profile(w.owners[0]!, w.a);
    await profile(w.admin, w.b);
    const entries = await generated(w.a);
    expect(entries).toHaveLength(before + 1);
    const latest = entries.sort((x, y) => x.occurredAt.getTime() - y.occurredAt.getTime()).at(-1)!;
    expect(latest).toMatchObject({ platform: "summit", entityType: "summit_application", actorUserId: w.admin.id, organizationId: w.orgs[0] });
    expect(latest.after).toMatchObject({ format: "pdf", classification: "internal", selectionNumber: 1 });
    expect(await generated(w.b)).toEqual([]);
  });
});

describe("sharing the profile outside Entrust", () => {
  const sharing = (user: TestUser | null, id: string) => call(user, "GET", `/applications/${id}/sharing`);
  const share = (user: TestUser | null, id: string, value: boolean) => call(user, "PUT", `/applications/${id}/sharing`, { share: value });
  const external = (user: TestUser | null, id: string) => callFileV1(user, `${S}/applications/${id}/profile?copy=external`);
  const audit = (id: string, action: string) => db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, id), eq(schema.auditLog.action, action)));
  const owner = () => w.owners[0]!;

  it("makes no external copy until the owner agrees, though the internal copy is made", async () => {
    const before = await sharing(owner(), w.a);
    expect(before.body).toMatchObject({ shared: false, canChange: true, grantedAt: null, wordingVersion: "1.0.0" });
    expect(before.body.wording).toContain("Entrust can share");
    const refused = await external(w.admin, w.a);
    expect(refused.status).toBe(403);
    expect((await refused.json()).error).toContain("hasn't agreed");
    expect((await callFileV1(w.admin, `${S}/applications/${w.a}/profile`)).status).toBe(200);
  });

  it("lets only the owner of a selected business decide", async () => {
    expect((await share(null, w.a, true)).status).toBe(401);
    expect((await share(w.outsider, w.a, true)).status).toBe(404);
    for (const staff of [w.admin, w.facilitator, w.committee, w.reviewer]) expect((await share(staff, w.a, true)).status, staff.id).toBe(403);
    // A business the committee hasn't selected has no profile to share.
    expect((await share(w.owners[1]!, w.b, true)).status).toBe(409);
    expect((await sharing(w.admin, w.a)).body).toMatchObject({ shared: false, canChange: false });
    expect((await sharing(w.outsider, w.a)).status).toBe(404);
  });

  it("keeps the agreement with the words agreed to, and audits it", async () => {
    const res = await share(owner(), w.a, true);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ shared: true, canChange: true });
    expect(res.body.grantedAt).toEqual(expect.any(String));

    const [consent] = await db
      .select()
      .from(schema.sponsorConsent)
      .where(and(eq(schema.sponsorConsent.smeOrganizationId, w.orgs[0]!), eq(schema.sponsorConsent.kind, "summit_profile")));
    expect(consent).toMatchObject({ sponsorOrganizationId: w.entrust, wordingVersion: "1.0.0", grantedByUserId: owner().id, withdrawnAt: null });
    expect(consent?.wording).toBe(res.body.wording);
    expect((await audit(w.a, "summit.sharing.granted")).at(-1)).toMatchObject({ platform: "summit", actorUserId: owner().id, organizationId: w.orgs[0] });

    // Agreeing again changes nothing.
    expect((await share(owner(), w.a, true)).status).toBe(200);
    const rows = await db.select().from(schema.sponsorConsent).where(and(eq(schema.sponsorConsent.smeOrganizationId, w.orgs[0]!), eq(schema.sponsorConsent.kind, "summit_profile")));
    expect(rows).toHaveLength(1);
    expect((await sharing(w.admin, w.a)).body).toMatchObject({ shared: true, canChange: false });
  });

  it("makes an external copy for an administrator or a facilitator, marked as shared with consent", async () => {
    const res = await external(w.admin, w.a);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="summit-profile-sel-001-org-a-external.pdf"');
    const text = await pdfText(new Uint8Array(await res.arrayBuffer()));
    expect(text).toContain("EXTERNAL, SHARED WITH THE BUSINESS'S CONSENT");
    for (const secret of ["Strong buyers and a clear plan.", "Recommend", "Marked 90", "ocument-supported"]) expect(text, secret).not.toContain(secret);
    expect((await external(w.facilitator, w.a)).status).toBe(200);

    // The committee and the officer read the internal copy; only the people who introduce the business make an external one.
    for (const user of [w.committee, w.reviewer]) expect((await external(user, w.a)).status, user.id).toBe(403);
    expect((await external(w.owners[0]!, w.a)).status).toBe(403);
    expect((await external(w.outsider, w.a)).status).toBe(404);

    const copies = (await audit(w.a, "summit.profile.generated")).filter((e) => (e.after as { classification?: string }).classification === "external");
    expect(copies.length).toBeGreaterThanOrEqual(2);
    expect(copies[0]?.after).toMatchObject({ classification: "external", consentId: expect.any(String), consentGrantedAt: expect.any(String) });
  });

  it("stops at once when the owner takes the agreement back", async () => {
    const res = await share(owner(), w.a, false);
    expect(res.body).toMatchObject({ shared: false, grantedAt: null });
    const refused = await external(w.admin, w.a);
    expect(refused.status).toBe(403);
    expect((await refused.json()).error).toContain("taken its agreement back");
    expect((await audit(w.a, "summit.sharing.withdrawn")).at(-1)).toMatchObject({ actorUserId: owner().id });
    const [consent] = await db.select().from(schema.sponsorConsent).where(and(eq(schema.sponsorConsent.smeOrganizationId, w.orgs[0]!), eq(schema.sponsorConsent.kind, "summit_profile")));
    expect(consent?.withdrawnAt).not.toBeNull();
    // The internal copy is still Entrust's own.
    expect((await callFileV1(w.admin, `${S}/applications/${w.a}/profile`)).status).toBe(200);
    // And the owner can agree again later.
    expect((await share(owner(), w.a, true)).body.shared).toBe(true);
    expect((await external(w.admin, w.a)).status).toBe(200);
    expect((await share(owner(), w.a, false)).body.shared).toBe(false);
  });
});

describe("after the final list is approved", () => {
  it("shows the approval and the published results in the reports", async () => {
    expect((await decide(w.c, "not_selected", "Not ready this round.")).status).toBe(201);
    const approved = await call(w.committee, "POST", `/periods/${w.periodId}/final-list`, {});
    expect(approved.status, JSON.stringify(approved.body)).toBe(201);

    const register = await records(w.admin, "selected-smes");
    const [list] = await db.select().from(schema.finalList).where(eq(schema.finalList.periodId, w.periodId));
    expect(register[0]!["Committee approval status"]).toBe(`Approved ${dayOf(list?.approvedAt)}`);
    const decisions = await records(w.admin, "committee-decisions");
    expect(Object.fromEntries(decisions.map((r) => [r["Business name"], r["Final selection status"]]))).toEqual({ "org-a": "Selected", "org-b": "Waitlisted", "org-c": "Not selected" });
    expect(decisions.every((r) => r["Approval status"] === "Approved")).toBe(true);
    expect((await records(w.admin, "country-distribution")).find((r) => r.Country === COUNTRY)).toMatchObject({ "Selected SMEs": 1, "Not-selected SMEs": 1 });
    // The committee's view of the same reports agrees.
    expect(await records(w.committee, "selected-smes")).toEqual(register);
  });

  it("makes the profile say the selection is confirmed", async () => {
    const res = await callFileV1(w.committee, `${S}/applications/${w.a}/profile`);
    expect(res.status).toBe(200);
    const [list] = await db.select().from(schema.finalList).where(eq(schema.finalList.periodId, w.periodId));
    expect(await pdfText(new Uint8Array(await res.arrayBuffer()))).toContain(`Selection confirmed ${dayOf(list?.approvedAt)}`);
  });
});
