import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, createOrganization, db, PREFIX, signUp, type Json, type TestUser } from "./support";

// The SME directory: draft profiles made from selected applications, the business's approval, publication, the public pages
// and what they must never show, and the B2B enquiry.

const queue = vi.hoisted(() => ({ jobs: [] as { name: string; data: any }[] }));
vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: vi.fn(async (name: string, data: unknown) => {
    queue.jobs.push({ name, data });
    return "job-1";
  }),
}));

const w = {} as {
  admin: TestUser;
  facilitator: TestUser;
  reviewer: TestUser;
  entrust: string;
  edition: Json;
  previous?: string;
  periodId: string;
  zebu: { org: string; owner: TestUser; email: string; application: string; applicationId: string };
  leather: { org: string; application: string; applicationId: string };
  waitlisted: { application: string; applicationId: string };
};

const RUN = Date.now();
let n = 0;
const emailFor = (label: string) => `${PREFIX}dir-${RUN}-${label}-${++n}@example.test`;
const to = (email: string) => queue.jobs.filter((j) => j.name === "send-email" && j.data.to === email).map((j) => j.data);
const admin = (method: string, path: string, body?: unknown, user: TestUser | null = w.admin) => callV1(user, method, `/summit/commerce/directory${path}`, body);
const pub = (path: string) => callV1(null, "GET", `/summit/commerce${path}`);
const profileOf = async (applicationId: string) => (await db.select().from(schema.smePublicProfile).where(eq(schema.smePublicProfile.applicationId, applicationId)))[0]!;

const ZEBU_ANSWERS = {
  "S2.1": "Coffee",
  "S2.2": "We grow, wash and export specialty green coffee from Sidama smallholders, with full traceability.",
  "S2.3": ["Green coffee", "Roasted coffee"],
  "S2.6": "40 tonnes a month in season",
  "S3.1": "yes",
  "S3.2": ["Germany", "United Arab Emirates"],
  "S3.4": ["Germany", "Japan"],
  "S3.9": "Fairtrade, Organic",
  "S2.12": "trade_and_market_access",
  "S4.1": "yes",
  "S4.2": { amount: 250000, currency: "USD" },
  "S4.3": "Buying a second washing station",
  "S1.10": "Amina Bekele",
  "S1.11": "Export manager",
  "S1.12": "amina-private@zebu.example",
  "S1.13": "+251 911 000 000",
};
const LEATHER_ANSWERS = {
  "S2.1": "Leather and leather products",
  "S2.2": "Finished leather shoes and bags made in Addis Ababa for export to Europe and the Gulf.",
  "S2.3": ["Leather shoes", "Leather bags"],
  "S3.1": "no",
  "S3.4": ["Italy", "Kenya"],
  "S2.12": "trade_and_market_access",
};

async function selectedSme(label: string, country: string, answers: Record<string, unknown>, status: "selected" | "waitlisted" = "selected") {
  const owner = await signUp(`dir-${label}-owner`);
  const org = await createOrganization(`dir-${label}`, [[owner, "owner"]]);
  await db.update(schema.smeProfile).set({ country }).where(eq(schema.smeProfile.organizationId, org));
  const [app] = await db
    .insert(schema.application)
    .values({ organizationId: org, periodId: w.periodId, status, templateVersion: "0.1.0", answers: answers as never })
    .returning({ id: schema.application.id, number: schema.application.number });
  const [user] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, owner.id));
  return { org, owner, email: user!.email, application: app!.number, applicationId: app!.id };
}

beforeAll(async () => {
  await cleanup();
  const [admin_, facilitator, reviewer] = await Promise.all(["dir-admin", "dir-facilitator", "dir-reviewer"].map(signUp));
  Object.assign(w, { admin: admin_, facilitator, reviewer });
  w.entrust = await createOrganization("dir-entrust", [[admin_!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
  [{ id: w.previous } = { id: undefined }] = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));

  const [period] = await db
    .insert(schema.applicationPeriod)
    .values({ name: `${PREFIX}period-${RUN}`, opensAt: new Date("2026-12-01"), closesAt: new Date("2026-12-31"), countries: ["ET", "KE"], templateVersion: "0.1.0", rulesVersion: "1.0.0" })
    .returning({ id: schema.applicationPeriod.id });
  w.periodId = period!.id;
  w.zebu = await selectedSme("zebu", "ET", ZEBU_ANSWERS);
  w.leather = await selectedSme("leather", "ET", LEATHER_ANSWERS);
  w.waitlisted = await selectedSme("waiting", "KE", LEATHER_ANSWERS, "waitlisted");
  await db.update(schema.organization).set({ name: "ZEBU Coffee" }).where(eq(schema.organization.id, w.zebu.org));
  await db.update(schema.organization).set({ name: "Addis Leather" }).where(eq(schema.organization.id, w.leather.org));

  const created = await callV1(admin_!, "POST", "/summit/commerce/editions", { name: "Directory test summit", slug: `${PREFIX}dir-${RUN}` });
  w.edition = created.body;
  await callV1(admin_!, "PATCH", `/summit/commerce/editions/${created.body.id}`, { isCurrent: true, applicationPeriodId: w.periodId });
});

beforeEach(() => {
  queue.jobs.length = 0;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
  if (w.previous) await db.update(schema.commerceEdition).set({ isCurrent: true }).where(eq(schema.commerceEdition.id, w.previous));
});

describe("making draft profiles", () => {
  it("is refused until the committee's final list is approved", async () => {
    const res = await admin("POST", "/profiles/prefill", {});
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/final list/);
    await db.insert(schema.finalList).values({ periodId: w.periodId, selected: 2, waitlisted: 1, notSelected: 0 });
  });

  it("is for administrators and facilitators", async () => {
    expect((await admin("POST", "/profiles/prefill", {}, w.reviewer)).status).toBe(403);
    expect((await admin("POST", "/profiles/prefill", {}, null)).status).toBe(401);
    expect((await admin("GET", "/profiles", undefined, w.reviewer)).status).toBe(403);
    expect((await admin("GET", "/enquiries", undefined, null)).status).toBe(401);
  });

  it("makes a draft for each selected SME and none for a waitlisted one, and a second run changes nothing", async () => {
    const res = await admin("POST", "/profiles/prefill", {});
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ created: 2, existing: 0, skipped: [] });
    expect(await db.select().from(schema.smePublicProfile).where(eq(schema.smePublicProfile.applicationId, w.waitlisted.applicationId))).toHaveLength(0);
    expect((await admin("POST", "/profiles/prefill", {})).body).toMatchObject({ created: 0, existing: 2 });
    const list = await admin("GET", "/profiles");
    expect(list.body).toMatchObject({ total: 2, byStatus: { draft: 2, published: 0 }, selectedWithoutProfile: 0 });
    expect(list.body.items.map((i: Json) => i.displayName)).toEqual(["Addis Leather", "ZEBU Coffee"]);
  });

  it("takes only the public-facing answers, and keeps the private contact details and the assessment out", async () => {
    const row = await profileOf(w.zebu.applicationId);
    const res = await admin("GET", `/profiles/${row.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      slug: "zebu-coffee",
      status: "draft",
      displayName: "ZEBU Coffee",
      country: "ET",
      sector: "Coffee",
      productsServices: ["Green coffee", "Roasted coffee"],
      productionCapacity: "40 tonnes a month in season",
      targetMarkets: ["Germany", "Japan"],
      seeksInvestment: true,
      investmentRequirements: "Seeking USD 250,000 for buying a second washing station.",
      verification: "pending",
      contactName: "Amina Bekele",
      contactEmail: null,
      contactPhone: null,
      businessApprovedAt: null,
    });
    expect(res.body.exportReadiness).toBe("Has exported to Germany, United Arab Emirates. Certifications and standards: Fairtrade, Organic.");
    expect(res.body.application.number).toBe(w.zebu.application);
    expect(JSON.stringify(res.body).replace(w.zebu.application, "")).not.toMatch(/amina-private|911 000/);
  });

  it("makes a profile for one application, and refuses one that isn't selected", async () => {
    const waiting = await admin("POST", "/profiles/prefill", { applicationId: w.waitlisted.applicationId });
    expect(waiting.status).toBe(422);
    expect(waiting.body.error).toMatch(/isn't a selected SME/);
  });

  it("gives two businesses with the same name different addresses", async () => {
    const twin = await selectedSme("twin", "ET", LEATHER_ANSWERS);
    await db.update(schema.organization).set({ name: "ZEBU Coffee" }).where(eq(schema.organization.id, twin.org));
    expect((await admin("POST", "/profiles/prefill", {})).body.created).toBe(1);
    expect((await profileOf(twin.applicationId)).slug).toBe("zebu-coffee-2");
    expect((await admin("GET", "/profiles")).body.selectedWithoutProfile).toBe(0);
  });
});

describe("approval and publication", () => {
  it("keeps a draft off the public site", async () => {
    const row = await profileOf(w.zebu.applicationId);
    expect((await pub("/smes")).body).toMatchObject({ total: 0, items: [], facets: { all: 0 } });
    expect((await pub(`/smes/${row.slug}`)).status).toBe(404);
  });

  it("will not publish before the business has approved the profile", async () => {
    const row = await profileOf(w.zebu.applicationId);
    const res = await admin("POST", `/profiles/${row.id}/publish`);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/hasn't approved/);
  });

  it("will not record an approval for an incomplete profile", async () => {
    const row = await profileOf(w.leather.applicationId);
    // The leather business has no description of investment, and gets a short summary, so make it incomplete on purpose.
    await admin("PATCH", `/profiles/${row.id}`, { productsServices: [] });
    const res = await admin("PATCH", `/profiles/${row.id}`, { businessApproved: true });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/at least one product/);
    await admin("PATCH", `/profiles/${row.id}`, { productsServices: ["Leather shoes", "Leather bags"] });
  });

  it("records the approval, then publishes, and the profile appears with its fields and a QR address", async () => {
    const row = await profileOf(w.zebu.applicationId);
    await admin("PATCH", `/profiles/${row.id}`, { website: "https://zebu.example", verification: "verified", investmentRequirements: "Seeking USD 250,000 for a second washing station." });
    const approved = await admin("PATCH", `/profiles/${row.id}`, { businessApproved: true, approvalNote: "Approved by Amina by email on 12 January" });
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body).toMatchObject({ approvalNote: "Approved by Amina by email on 12 January", status: "draft" });
    expect(approved.body.businessApprovedBy.name).toBe("dir-admin");
    const published = await admin("POST", `/profiles/${row.id}/publish`);
    expect(published.status, JSON.stringify(published.body)).toBe(200);
    expect(published.body).toMatchObject({ status: "published", problems: [] });

    const list = await pub("/smes");
    expect(list.body.items.map((i: Json) => i.name)).toEqual(["ZEBU Coffee"]);
    const detail = await pub("/smes/zebu-coffee");
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      name: "ZEBU Coffee",
      country: "ET",
      countryName: "Ethiopia",
      sector: "Coffee",
      productionCapacity: "40 tonnes a month in season",
      seeksInvestment: true,
      verification: "verified",
      verificationLabel: "Business registration verified",
      website: "https://zebu.example",
      url: "http://localhost:3002/smes/zebu-coffee",
    });
    expect(detail.body.edition.datesNote).toMatch(/January 2027/);
    expect(detail.body.contact).toEqual({ name: "Amina Bekele", position: "Export manager", email: null, phone: null });
  });

  it("shows nothing from the assessment, or any private detail, on the public pages", async () => {
    const detail = await pub("/smes/zebu-coffee");
    const text = JSON.stringify(detail.body);
    expect(text).not.toMatch(/SUM-\d|amina-private|911 000|score|finding|committee|revenue|financial|ET-SME|test-api/i);
    expect(Object.keys(detail.body).sort()).toEqual(
      [
        "contact", "city", "country", "countryName", "edition", "exportReadiness", "investmentRequirements", "name", "productionCapacity", "productsServices", "sector",
        "seeksInvestment", "slug", "summary", "targetMarkets", "url", "verification", "verificationLabel", "website",
      ].sort(),
    );
    const list = JSON.stringify((await pub("/smes")).body);
    expect(list).not.toMatch(/SUM-\d|amina-private|911 000|uuid/i);
  });

  it("shows a contact email only after someone fills it in", async () => {
    const row = await profileOf(w.zebu.applicationId);
    await admin("PATCH", `/profiles/${row.id}`, { contactEmail: "sales@zebu.example", minorCorrection: true });
    expect((await pub("/smes/zebu-coffee")).body.contact.email).toBe("sales@zebu.example");
    await admin("PATCH", `/profiles/${row.id}`, { contactEmail: null, minorCorrection: true });
    expect((await pub("/smes/zebu-coffee")).body.contact.email).toBeNull();
  });

  it("takes a profile off the site when its text changes, unless the change is marked as a small correction", async () => {
    const row = await profileOf(w.zebu.applicationId);
    const small = await admin("PATCH", `/profiles/${row.id}`, { summary: `${row.summary} Traceable to the farm.`, minorCorrection: true });
    expect(small.body).toMatchObject({ status: "published" });
    expect(small.body.businessApprovedAt).not.toBeNull();
    expect((await pub("/smes/zebu-coffee")).status).toBe(200);

    const changed = await admin("PATCH", `/profiles/${row.id}`, { productionCapacity: "60 tonnes a month" });
    expect(changed.body).toMatchObject({ status: "draft", businessApprovedAt: null, businessApprovedBy: null, publishedAt: null });
    expect((await pub("/smes/zebu-coffee")).status).toBe(404);
    expect((await admin("POST", `/profiles/${row.id}/publish`)).status).toBe(422);

    await admin("PATCH", `/profiles/${row.id}`, { businessApproved: true, approvalNote: "Approved again" });
    expect((await admin("POST", `/profiles/${row.id}/publish`)).status).toBe(200);
    const audit = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, row.id))).filter((a) => a.action === "summit.directory.profile.updated");
    expect(audit.some((a) => (a.before as Json)?.productionCapacity === "40 tonnes a month in season")).toBe(true);
  });

  it("withdraws a profile when the business's approval is withdrawn, and when it is unpublished", async () => {
    const row = await profileOf(w.zebu.applicationId);
    expect((await admin("PATCH", `/profiles/${row.id}`, { businessApproved: false })).body).toMatchObject({ status: "draft", businessApprovedAt: null });
    expect((await pub("/smes/zebu-coffee")).status).toBe(404);
    await admin("PATCH", `/profiles/${row.id}`, { businessApproved: true });
    await admin("POST", `/profiles/${row.id}/publish`);
    expect((await admin("POST", `/profiles/${row.id}/publish`)).status).toBe(409);
    const down = await admin("POST", `/profiles/${row.id}/unpublish`);
    expect(down.body).toMatchObject({ status: "draft" });
    expect(down.body.businessApprovedAt).not.toBeNull();
    expect((await admin("POST", `/profiles/${row.id}/unpublish`)).status).toBe(409);
    expect((await admin("POST", `/profiles/${row.id}/publish`)).status).toBe(200);
  });

  it("refuses a website that isn't a web address", async () => {
    const row = await profileOf(w.zebu.applicationId);
    const res = await admin("PATCH", `/profiles/${row.id}`, { website: "javascript:alert(1)", businessApproved: true });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/website/);
    expect((await admin("PATCH", `/profiles/${row.id}`, { contactEmail: "not-an-email" })).status).toBe(400);
  });
});

describe("finding businesses", () => {
  beforeAll(async () => {
    const row = await profileOf(w.leather.applicationId);
    await admin("PATCH", `/profiles/${row.id}`, { businessApproved: true });
    expect((await admin("POST", `/profiles/${row.id}/publish`)).status).toBe(200);
  });

  it("filters by country, industry, target market, product and investment, and lists what there is to filter by", async () => {
    const all = await pub("/smes");
    expect(all.body.total).toBe(2);
    expect(all.body.facets).toMatchObject({ all: 2, investment: 1 });
    expect(all.body.facets.countries).toEqual([{ code: "ET", name: "Ethiopia", count: 2 }]);
    expect(all.body.facets.sectors).toEqual([{ value: "Coffee", count: 1 }, { value: "Leather and leather products", count: 1 }]);
    expect(all.body.facets.markets.map((m: Json) => m.value).sort()).toEqual(["Germany", "Italy", "Japan", "Kenya"]);

    const names = async (query: string) => (await pub(`/smes?${query}`)).body.items.map((i: Json) => i.name);
    expect(await names("country=ET")).toEqual(["Addis Leather", "ZEBU Coffee"]);
    expect(await names("country=KE")).toEqual([]);
    expect(await names("sector=Coffee")).toEqual(["ZEBU Coffee"]);
    expect(await names("sector=leather%20and%20leather%20products")).toEqual(["Addis Leather"]);
    expect(await names("market=Japan")).toEqual(["ZEBU Coffee"]);
    expect(await names("market=italy")).toEqual(["Addis Leather"]);
    expect(await names("q=shoes")).toEqual(["Addis Leather"]);
    expect(await names("q=traceab")).toEqual(["ZEBU Coffee"]);
    expect(await names("investment=true")).toEqual(["ZEBU Coffee"]);
    expect(await names("country=ET&market=Germany&investment=true")).toEqual(["ZEBU Coffee"]);
    expect((await pub("/smes?limit=1&offset=1")).body).toMatchObject({ total: 2, items: [{ name: "ZEBU Coffee" }] });
    expect((await pub("/smes?country=Ethiopia")).status).toBe(400);
    expect((await pub("/smes?investment=false")).status).toBe(400);
  });
});

describe("a B2B enquiry", () => {
  const enquire = (slug: string, overrides: Record<string, unknown> = {}) =>
    callV1(null, "POST", `/summit/commerce/smes/${slug}/enquiries`, {
      interest: "buyer",
      name: "Hans Becker",
      email: emailFor("buyer"),
      organisation: "Becker Importers",
      role: "Purchasing",
      message: "We import specialty coffee and would like a sample and a price list.",
      consent: true,
      ...overrides,
    });

  it("is passed to the business's owners and acknowledged to the sender, and recorded for the organisers", async () => {
    const email = emailFor("sender");
    const res = await enquire("zebu-coffee", { email, phone: "+49 30 1234567" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ businessName: "ZEBU Coffee" });
    expect(res.body.number).toMatch(/^B2B-\d{4,}$/);

    const toOwner = to(w.zebu.email);
    expect(toOwner).toHaveLength(1);
    expect(toOwner[0].subject).toMatch(/connect with ZEBU Coffee/);
    expect(JSON.stringify(toOwner[0].props)).toContain("specialty coffee and would like a sample");
    expect(toOwner[0].props.details).toContainEqual({ label: "Email", value: email });
    const receipt = to(email);
    expect(receipt).toHaveLength(1);
    expect(receipt[0].subject).toMatch(/passed your enquiry to ZEBU Coffee/);
    // The sender never learns the owner's private address.
    expect(JSON.stringify(receipt)).not.toContain(w.zebu.email);

    const list = await admin("GET", "/enquiries", undefined, w.facilitator);
    const ours = list.body.items.find((i: Json) => i.fromEmail === email);
    expect(ours).toMatchObject({ number: res.body.number, status: "new", interest: "buyer", businessName: "ZEBU Coffee", forwarded: true, fromOrganisation: "Becker Importers" });
  });

  it("is limited to a few a day to one business, and refuses a hidden or unknown business", async () => {
    const email = emailFor("spammer");
    for (let i = 0; i < 3; i++) expect((await enquire("addis-leather", { email })).status).toBe(201);
    const fourth = await enquire("addis-leather", { email });
    expect(fourth.status).toBe(422);
    expect(fourth.body.error).toMatch(/several enquiries/);
    expect((await enquire("addis-leather", { email: emailFor("other") })).status).toBe(201);
    expect((await enquire("no-such-business")).status).toBe(404);
    const row = await profileOf(w.zebu.applicationId);
    await admin("POST", `/profiles/${row.id}/unpublish`);
    expect((await enquire("zebu-coffee")).status).toBe(404);
    await admin("POST", `/profiles/${row.id}/publish`);
  });

  it("is refused without consent, a real message or a valid address, and a filled trap field is stored nowhere", async () => {
    expect((await enquire("zebu-coffee", { consent: false })).status).toBe(400);
    expect((await enquire("zebu-coffee", { message: "hi" })).status).toBe(400);
    expect((await enquire("zebu-coffee", { email: "nope" })).status).toBe(400);
    expect((await enquire("zebu-coffee", { interest: "spy" })).status).toBe(400);
    const email = emailFor("bot");
    expect((await enquire("zebu-coffee", { email, nickname: "robot" })).status).toBe(201);
    expect(await db.select().from(schema.b2bEnquiry).where(eq(schema.b2bEnquiry.fromEmail, email))).toHaveLength(0);
    expect(to(email)).toHaveLength(0);
  });

  it("is followed up by the organisers, once", async () => {
    const email = emailFor("follow");
    const made = await enquire("zebu-coffee", { email });
    const item = (await admin("GET", `/enquiries?q=${made.body.number}`)).body.items[0];
    const done = await admin("POST", `/enquiries/${item.id}/handled`, { note: "Introduced them by phone" });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: "handled", handlingNote: "Introduced them by phone" });
    expect(done.body.handledBy.name).toBe("dir-admin");
    expect((await admin("POST", `/enquiries/${item.id}/handled`, {})).status).toBe(409);
    expect((await admin("POST", `/enquiries/${item.id}/handled`, {}, w.reviewer)).status).toBe(403);
    const handledOnly = await admin("GET", "/enquiries?status=handled");
    expect(handledOnly.body.items.every((i: Json) => i.status === "handled")).toBe(true);
    expect(handledOnly.body.byStatus.handled).toBeGreaterThan(0);
  });
});

describe("a profile follows the selection", () => {
  it("can't be published once its application is no longer selected", async () => {
    const row = await profileOf(w.leather.applicationId);
    await admin("POST", `/profiles/${row.id}/unpublish`);
    await db.update(schema.application).set({ status: "not_selected" }).where(eq(schema.application.id, w.leather.applicationId));
    const res = await admin("POST", `/profiles/${row.id}/publish`);
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/Only a selected SME/);
    await db.update(schema.application).set({ status: "selected" }).where(eq(schema.application.id, w.leather.applicationId));
  });
});

describe("before any edition exists", () => {
  it("lists nothing, not a 404, so the staff screens can say there is no edition yet", async () => {
    await db.update(schema.commerceEdition).set({ isCurrent: false }).where(eq(schema.commerceEdition.id, w.edition.id));
    try {
      const profiles = await admin("GET", "/profiles");
      expect(profiles.status, JSON.stringify(profiles.body)).toBe(200);
      expect(profiles.body).toMatchObject({ items: [], total: 0, byStatus: { draft: 0, published: 0 }, selectedWithoutProfile: 0 });
      const enquiries = await admin("GET", "/enquiries");
      expect(enquiries.status, JSON.stringify(enquiries.body)).toBe(200);
      expect(enquiries.body).toMatchObject({ items: [], total: 0, byStatus: { new: 0, handled: 0 } });
      // An edition that was asked for by name and isn't there is still a 404.
      expect((await admin("GET", "/profiles?editionId=00000000-0000-4000-8000-000000000000")).status).toBe(404);
    } finally {
      await db.update(schema.commerceEdition).set({ isCurrent: true }).where(eq(schema.commerceEdition.id, w.edition.id));
    }
  });
});
