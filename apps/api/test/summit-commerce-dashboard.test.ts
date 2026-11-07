import { and, eq } from "drizzle-orm";
import { strFromU8, unzipSync } from "fflate";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { callFileV1, callV1, cleanup, createOrganization, db, PREFIX, signUp, type Json, type TestUser } from "./support";

// The commercial dashboard and the six exports: the figures must be the ones the records add up to, and "received" must
// count only payments somebody verified.

vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: vi.fn(async () => "job-1"),
}));

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; entrust: string; edition: Json; empty: Json; previous?: string };

const RUN = Date.now();
let n = 0;
const emailFor = (label: string) => `${PREFIX}dash-${RUN}-${label}-${++n}@example.test`;
const product = (slug: string): Json => w.edition.products.find((p: Json) => p.slug === slug);
const patch = (path: string, body: unknown) => callV1(w.admin, "PATCH", `/summit/commerce${path}`, body);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/summit/commerce${path}`, body);

const delegate = async (categorySlug: string, country: string, sector: string, extra: Record<string, unknown> = {}) => {
  const res = await post(null, "/delegates", {
    categorySlug, fullName: "Test Delegate", email: emailFor("d"), organisation: "Org", jobTitle: "Role", country, sector, consent: true, ...extra,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const [row] = await db.select().from(schema.delegateRegistration).where(eq(schema.delegateRegistration.number, res.body.number));
  return row!;
};
const paymentOf = async (type: string, id: string) => (await db.select().from(schema.commercePayment).where(and(eq(schema.commercePayment.subjectType, type as never), eq(schema.commercePayment.subjectId, id))))[0]!;
const verify = async (type: string, id: string, cents: number) => {
  const payment = await paymentOf(type, id);
  await patch(`/payments/${payment.id}`, { reference: "REF", amountReceivedCents: cents });
  expect((await patch(`/payments/${payment.id}`, { status: "confirmed" })).status).toBe(200);
};
const booking = async (companyName: string) => {
  const res = await post(null, "/exhibitor-applications", {
    packageSlug: "standard-sme-booth", companyName, country: "ET", registrationDetails: "Licence 1", contactName: "Contact Person", position: "Owner",
    email: emailFor("b"), phone: "+251 911 000 000", sector: "Leather and leather products", productsServices: "Shoes", consent: true,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const [row] = await db.select().from(schema.exhibitorBooking).where(eq(schema.exhibitorBooking.number, res.body.number));
  return row!;
};
const enquiry = async (productSlug: string, organisationName: string) => {
  const res = await post(null, "/sponsor-enquiries", {
    productSlug, organisationName, country: "KE", contactName: "Contact Person", position: "Director", email: emailFor("s"), phone: "+254 700 000 000",
    sector: "Professional and business services", objectives: "Reach more customers", consent: true,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const [row] = await db.select().from(schema.sponsorEnquiry).where(eq(schema.sponsorEnquiry.number, res.body.number));
  return row!;
};
const dashboard = (user: TestUser | null, editionId = w.edition.id) => callV1(user, "GET", `/summit/commerce/dashboard?editionId=${editionId}`);

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer] = await Promise.all(["ds-admin", "ds-facilitator", "ds-reviewer"].map(signUp));
  Object.assign(w, { admin, facilitator, reviewer });
  w.entrust = await createOrganization("ds-entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
  [{ id: w.previous } = { id: undefined }] = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));
  // An edition with no activity, made first so it is not the current one when the other is.
  w.empty = (await callV1(admin!, "POST", "/summit/commerce/editions", { name: "Empty summit", slug: `${PREFIX}ds-empty-${RUN}` })).body;
  w.edition = (await callV1(admin!, "POST", "/summit/commerce/editions", { name: "Dashboard summit", slug: `${PREFIX}ds-${RUN}` })).body;
  await patch(`/editions/${w.edition.id}`, { isCurrent: true });
  await patch(`/products/${product("standard-sme-booth").id}`, { capacity: 3 });
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
  if (w.previous) await db.update(schema.commerceEdition).set({ isCurrent: true }).where(eq(schema.commerceEdition.id, w.previous));
});

describe("the dashboard", () => {
  it("is for administrators and facilitators", async () => {
    expect((await dashboard(null)).status).toBe(401);
    expect((await dashboard(w.reviewer)).status).toBe(403);
    expect((await dashboard(w.facilitator)).status).toBe(200);
    expect((await dashboard(w.admin, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it("is all zeros for an edition with no activity, and says no capacity is set", async () => {
    const { body } = await dashboard(w.admin, w.empty.id);
    expect(body.registrations).toMatchObject({ total: 0, confirmed: 0, pending: 0, cancelled: 0, checkedIn: 0, byCountry: [], bySector: [] });
    expect(body.registrations.byCategory).toHaveLength(5);
    expect(body.exhibition).toMatchObject({ capacitySet: false, totalBooths: null, available: null, submitted: 0, reserved: 0, confirmed: 0 });
    expect(body.sponsorship).toMatchObject({ enquiries: 0, confirmed: 0, valueCents: 0, pipelineCount: 0 });
    expect(body.revenue).toMatchObject({ expectedCents: 0, receivedCents: 0, outstandingCents: 0, refundedCents: 0, potentialCents: 0 });
  });

  it("adds up registrations, booths, sponsorship and revenue from the records, counting only verified payments as received", async () => {
    // Delegates: one paid and checked in, one awaiting payment, one cancelled.
    const d1 = await delegate("general-business", "KE", "Technology and digital services");
    const d2 = await delegate("premium", "GH", "Technology and digital services");
    const d3 = await delegate("general-business", "KE", "Other");
    await verify("delegate", d1.id, 6500);
    expect((await post(w.admin, `/delegates/${d1.id}/check-in`)).status).toBe(200);
    expect((await post(w.admin, `/delegates/${d3.id}/cancel`, { reason: "Test" })).status).toBe(200);

    // Bookings of the Standard SME Booth (capacity 3): one waiting, one approved, one confirmed.
    await booking("Waiting Co");
    const b2 = await booking("Approved Co");
    const b3 = await booking("Confirmed Co");
    expect((await post(w.admin, `/exhibitor-bookings/${b2.id}/approve`, {})).status).toBe(200);
    expect((await post(w.admin, `/exhibitor-bookings/${b3.id}/approve`, { boothNumber: "A-01" })).status).toBe(200);
    await verify("exhibitor_booking", b3.id, 50000);
    expect((await post(w.admin, `/exhibitor-bookings/${b3.id}/confirm`)).status).toBe(200);

    // Sponsorship: Banking & Finance is still an enquiry; Logistics is confirmed and paid; the directory advertisement is confirmed, not paid.
    await enquiry("banking-finance-partner", "Banking Hopeful");
    const s2 = await enquiry("logistics-supply-chain-partner", "Logistics Sponsor");
    const s3 = await enquiry("directory-advertisement", "Advert Buyer");
    expect((await post(w.admin, `/sponsor-enquiries/${s2.id}/status`, { status: "confirmed" })).status).toBe(200);
    expect((await post(w.admin, `/sponsor-enquiries/${s3.id}/status`, { status: "confirmed" })).status).toBe(200);
    await verify("sponsorship", s2.id, 2000000);

    const { status, body } = await dashboard(w.facilitator);
    expect(status).toBe(200);
    expect(body.edition.name).toBe("Dashboard summit");

    const r = body.registrations;
    expect(r).toMatchObject({ total: 2, confirmed: 1, pending: 1, cancelled: 1, checkedIn: 1 });
    expect(r.byCountry).toEqual([{ country: "GH", name: "Ghana", count: 1 }, { country: "KE", name: "Kenya", count: 1 }]);
    expect(r.bySector).toEqual([{ sector: "Technology and digital services", count: 2 }]);
    expect(r.byCategory.find((c: Json) => c.name === "General Business Delegate")).toMatchObject({ registered: 1, confirmed: 1, pending: 0 });
    expect(r.byCategory.find((c: Json) => c.name === "Premium Delegate")).toMatchObject({ registered: 1, confirmed: 0, pending: 1 });
    void d2;

    const x = body.exhibition;
    expect(x).toMatchObject({ capacitySet: false, totalBooths: 3, available: 1, submitted: 1, reserved: 1, confirmed: 1 });
    expect(x.byPackage.find((p: Json) => p.name === "Standard SME Booth")).toMatchObject({ capacity: 3, submitted: 1, reserved: 1, confirmed: 1, available: 1, soldOut: false });
    expect(x.byPackage.find((p: Json) => p.name === "Premium SME Booth")).toMatchObject({ capacity: null, available: null });

    const s = body.sponsorship;
    expect(s).toMatchObject({ enquiries: 3, confirmed: 2, valueCents: 2000000 + 31300, pipelineCount: 1, pipelineValueCents: 2500000 });
    expect(s.byStatus).toMatchObject({ new: 1, confirmed: 2, declined: 0 });
    expect(s.byProduct.find((p: Json) => p.name === "Banking & Finance Partner")).toMatchObject({ enquiries: 1, confirmed: 0, openValueCents: 2500000 });
    expect(s.byProduct.find((p: Json) => p.name === "Logistics & Supply Chain Partner")).toMatchObject({ enquiries: 1, confirmed: 1, confirmedValueCents: 2000000 });

    // Delegates: 6,500 paid + 16,000 owed (the cancelled one counts for nothing). Exhibition: 50,000 paid + 50,000 owed.
    // Sponsorship: 2,000,000 paid + 31,300 owed. A waiting application (50,000) and an open enquiry (2,500,000) are only potential.
    const v = body.revenue;
    expect(v).toMatchObject({ expectedCents: 2153800, receivedCents: 2056500, outstandingCents: 97300, refundedCents: 0, potentialCents: 2550000 });
    expect(v.byStream).toEqual([
      { stream: "delegates", label: "Delegate registrations", expectedCents: 22500, receivedCents: 6500, outstandingCents: 16000, refundedCents: 0 },
      { stream: "exhibition", label: "Exhibition", expectedCents: 100000, receivedCents: 50000, outstandingCents: 50000, refundedCents: 0 },
      { stream: "sponsorship", label: "Sponsorship", expectedCents: 2031300, receivedCents: 2000000, outstandingCents: 31300, refundedCents: 0 },
    ]);
    expect(v.byProduct.find((p: Json) => p.name === "Logistics & Supply Chain Partner")).toMatchObject({ stream: "sponsorship", kind: "sponsorship_level", expectedCents: 2000000, receivedCents: 2000000, count: 1 });
    expect(v.byProduct.find((p: Json) => p.name === "Standard SME Booth")).toMatchObject({ stream: "exhibition", count: 2, expectedCents: 100000, receivedCents: 50000 });
    expect(v.byProduct.find((p: Json) => p.name === "Premium Delegate")).toMatchObject({ stream: "delegates", expectedCents: 16000, receivedCents: 0, outstandingCents: 16000 });
  });

  it("shows a refund on its own and takes it out of what is expected", async () => {
    const d = await delegate("investor-buyer", "FR", "Professional and business services");
    await verify("delegate", d.id, 25000);
    const before = (await dashboard(w.admin)).body.revenue;
    const payment = await paymentOf("delegate", d.id);
    expect((await patch(`/payments/${payment.id}`, { status: "refunded" })).status).toBe(200);
    const after = (await dashboard(w.admin)).body.revenue;
    expect(after.refundedCents).toBe(before.refundedCents + 25000);
    expect(after.receivedCents).toBe(before.receivedCents - 25000);
    expect(after.expectedCents).toBe(before.expectedCents - 25000);
  });

  it("counts a package as sold out when its approved bookings fill it", async () => {
    const { body } = await dashboard(w.admin);
    const before = body.exhibition.byPackage.find((p: Json) => p.name === "Standard SME Booth");
    const extra = await booking("Last Booth Co");
    expect((await post(w.admin, `/exhibitor-bookings/${extra.id}/approve`, {})).status).toBe(200);
    const after = (await dashboard(w.admin)).body.exhibition.byPackage.find((p: Json) => p.name === "Standard SME Booth");
    expect(before.available).toBe(1);
    expect(after).toMatchObject({ available: 0, soldOut: true, reserved: 2 });
  });
});

describe("the reports", () => {
  const url = (report: string, format: string, editionId = w.edition.id) => `/summit/commerce/reports/${report}?format=${format}&editionId=${editionId}`;
  const file = async (user: TestUser | null, report: string, format: string) => {
    const response = await callFileV1(user, url(report, format));
    return { response, bytes: new Uint8Array(await response.arrayBuffer()) };
  };
  const csvOf = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/^﻿/, "");

  it("lists the six reports for administrators and facilitators only", async () => {
    const res = await callV1(w.facilitator, "GET", "/summit/commerce/reports");
    expect(res.body.items.map((i: Json) => i.id)).toEqual(["delegates", "exhibitors", "sponsorship", "payments", "revenue", "country_sector"]);
    expect(res.body.items.every((i: Json) => i.classification === "Confidential")).toBe(true);
    expect((await callV1(w.reviewer, "GET", "/summit/commerce/reports")).status).toBe(403);
    expect((await callV1(null, "GET", "/summit/commerce/reports")).status).toBe(401);
  });

  it("gives every report as Excel, CSV and PDF", async () => {
    for (const report of ["delegates", "exhibitors", "sponsorship", "payments", "revenue", "country_sector"]) {
      const csv = await file(w.admin, report, "csv");
      expect(csv.response.status, report).toBe(200);
      expect(csv.response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
      expect(csv.response.headers.get("content-disposition")).toMatch(new RegExp(`filename="adtis-${report.replaceAll("_", "-")}-.*\\.csv"`));
      expect(csv.response.headers.get("cache-control")).toBe("private, no-store");
      expect(csvOf(csv.bytes)).toMatch(/^Summit,Africa Diaspora Trade and Investment Summit/);

      const xlsx = await file(w.admin, report, "xlsx");
      expect(xlsx.response.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      expect(Object.keys(unzipSync(xlsx.bytes))).toContain("xl/worksheets/sheet1.xml");

      const pdf = await file(w.admin, report, "pdf");
      expect(pdf.response.headers.get("content-type")).toBe("application/pdf");
      expect(new TextDecoder("latin1").decode(pdf.bytes.slice(0, 5))).toBe("%PDF-");
    }
  });

  it("puts the delegates in the CSV with their category, payment and check-in, and protects against formulas", async () => {
    await delegate("general-business", "KE", "Technology and digital services", { fullName: "=HYPERLINK(\"http://evil.example\")", organisation: "Formula Org" });
    const { bytes } = await file(w.facilitator, "delegates", "csv");
    const text = csvOf(bytes);
    expect(text).toContain("Reference,Name,Email,Phone,Organisation,Job title,Country,Sector,Category,Amount due (USD)");
    expect(text).toMatch(/General Business Delegate,65,Confirmed,No,Registered,\d{4}-\d\d-\d\d \d\d:\d\d UTC,/);
    expect(text).toContain("Kenya");
    expect(text).toContain("\"'=HYPERLINK(");
    expect(text).not.toMatch(/,=HYPERLINK/);
  });

  it("gives the exhibitors, sponsorship and payments with the amounts in dollars", async () => {
    const exhibitors = csvOf((await file(w.admin, "exhibitors", "csv")).bytes);
    expect(exhibitors).toMatch(/Confirmed Co,Ethiopia,.*Standard SME Booth,Confirmed,A-01,,500,Confirmed/);
    const sponsors = csvOf((await file(w.admin, "sponsorship", "csv")).bytes);
    expect(sponsors).toMatch(/Logistics Sponsor,Kenya,.*Logistics & Supply Chain Partner,Sponsorship level,Confirmed,20000,Confirmed/);
    expect(sponsors).toMatch(/Banking Hopeful,Kenya,.*Banking & Finance Partner,Sponsorship level,New enquiry,25000,/);
    const payments = csvOf((await file(w.admin, "payments", "csv")).bytes);
    expect(payments).toContain("Reference,Payer,Email,Type,Item,Status,Amount due (USD),Amount received (USD)");
    expect(payments).toMatch(/Logistics Sponsor,.*Sponsor,Logistics & Supply Chain Partner,Confirmed,20000,20000,,REF,ds-admin/);
  });

  it("totals the revenue by stream and for everything, matching the dashboard", async () => {
    const res = await callV1(w.admin, "GET", url("revenue", "json"));
    expect(res.status).toBe(200);
    const total = res.body.rows.find((r: Json[]) => r[0] === "All streams");
    const { body } = await dashboard(w.admin);
    expect(total.slice(3, 7)).toEqual([body.revenue.expectedCents / 100, body.revenue.receivedCents / 100, body.revenue.outstandingCents / 100, body.revenue.refundedCents / 100]);
    expect(res.body.rows.filter((r: Json[]) => r[1] === "Total").map((r: Json[]) => r[0])).toEqual(["Delegate registrations", "Exhibition", "Sponsorship", "All streams"]);
    expect(res.body.report).toMatchObject({ id: "revenue", classification: "Confidential" });
  });

  it("counts delegates, exhibitors and sponsors by country and by sector", async () => {
    const res = await callV1(w.admin, "GET", url("country_sector", "json"));
    const rows: Json[][] = res.body.rows;
    expect(res.body.columns.map((c: Json) => c.label)).toEqual(["Grouped by", "Country or sector", "Delegates", "Exhibitor applications", "Sponsorship enquiries", "Total"]);
    expect(rows.find((r) => r[0] === "Country" && r[1] === "Ethiopia")).toEqual(["Country", "Ethiopia", 0, 4, 0, 4]);
    expect(rows.find((r) => r[0] === "Sector" && r[1] === "Leather and leather products")![3]).toBe(4);
    for (const r of rows) expect(r[5]).toBe((r[2] as number) + (r[3] as number) + (r[4] as number));
  });

  it("writes every export, JSON included, to the audit log, and refuses everyone else", async () => {
    const before = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "summit.commerce.report.exported"))).length;
    await file(w.admin, "payments", "xlsx");
    await callV1(w.facilitator, "GET", url("exhibitors", "json"));
    const rows = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, w.edition.id), eq(schema.auditLog.action, "summit.commerce.report.exported")));
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.map((r) => (r.after as Json).format)).toEqual(expect.arrayContaining(["xlsx", "json"]));
    expect(rows.find((r) => (r.after as Json).format === "xlsx" && (r.after as Json).report === "payments")?.after).toMatchObject({ classification: "Confidential", records: expect.any(Number) });
    void before;
    expect((await file(w.reviewer, "payments", "csv")).response.status).toBe(403);
    expect((await file(null, "payments", "csv")).response.status).toBe(401);
    expect((await callFileV1(w.admin, "/summit/commerce/reports/nonsense?format=csv")).status).toBe(400);
  });
});
