import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callV1, cleanup, createOrganization, db, PREFIX, signUp, type Json, type TestUser } from "./support";

// The ADTIS commercial catalogue: what the public site is shown, and the administrators' editing of editions and products.

const w = {} as { admin: TestUser; facilitator: TestUser; reviewer: TestUser; owner: TestUser; entrust: string };
let previouslyCurrent: string | undefined;

const RUN = Date.now();
let n = 0;
const slugFor = (label: string) => `${PREFIX}${label}-${RUN}-${++n}`;

const catalogue = () => callV1(null, "GET", "/summit/commerce/catalogue");
const createEdition = (user: TestUser | null, body: Record<string, unknown> = {}) =>
  callV1(user, "POST", "/summit/commerce/editions", { name: "Test summit", slug: slugFor("ed"), ...body });
const makeCurrent = (id: string) => callV1(w.admin, "PATCH", `/summit/commerce/editions/${id}`, { isCurrent: true });
const productsOf = (edition: Json, kind: string): Json[] => edition.products.filter((p: Json) => p.kind === kind);

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, owner] = await Promise.all(["com-admin", "com-facilitator", "com-reviewer", "com-owner"].map(signUp));
  Object.assign(w, { admin, facilitator, reviewer, owner });
  w.entrust = await createOrganization("com-entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"], [owner!, "owner"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
  [{ id: previouslyCurrent } = { id: undefined }] = await db.select({ id: schema.commerceEdition.id }).from(schema.commerceEdition).where(eq(schema.commerceEdition.isCurrent, true));
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
  // The tests took over "current"; hand it back to the edition that had it.
  if (previouslyCurrent) await db.update(schema.commerceEdition).set({ isCurrent: true }).where(eq(schema.commerceEdition.id, previouslyCurrent));
});

describe("who can reach the catalogue admin", () => {
  it("refuses a signed-out caller and anyone who isn't an administrator or facilitator", async () => {
    expect((await callV1(null, "GET", "/summit/commerce/editions")).status).toBe(401);
    expect((await callV1(w.reviewer, "GET", "/summit/commerce/editions")).status).toBe(403);
    expect((await callV1(w.owner, "GET", "/summit/commerce/editions")).status).toBe(403);
    expect((await createEdition(w.reviewer)).status).toBe(403);
    expect((await createEdition(null)).status).toBe(401);
  });

  it("lets a facilitator look, but only an administrator change anything", async () => {
    const created = await createEdition(w.admin);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const id = created.body.id;
    expect((await callV1(w.facilitator, "GET", "/summit/commerce/editions")).status).toBe(200);
    expect((await callV1(w.facilitator, "GET", `/summit/commerce/editions/${id}`)).status).toBe(200);
    expect((await createEdition(w.facilitator)).status).toBe(403);
    expect((await callV1(w.facilitator, "PATCH", `/summit/commerce/editions/${id}`, { venue: "Elsewhere" })).status).toBe(403);
    const product = created.body.products[0];
    expect((await callV1(w.facilitator, "PATCH", `/summit/commerce/products/${product.id}`, { priceCents: 1 })).status).toBe(403);
    expect((await callV1(w.facilitator, "POST", `/summit/commerce/editions/${id}/products`, { kind: "opportunity", slug: "x", name: "X", priceCents: 100 })).status).toBe(403);
  });
});

describe("creating an edition from the standard catalogue", () => {
  it("holds the packages, levels, categories and opportunities at the specified prices", async () => {
    const { status, body } = await createEdition(w.admin);
    expect(status).toBe(201);
    expect(productsOf(body, "exhibition_package").map((p) => [p.name, p.priceCents])).toEqual(
      expect.arrayContaining([["Standard SME Booth", 50000], ["Premium SME Booth", 90000], ["Corporate / Institutional Booth", 160000], ["International Exhibitor Booth", 150000], ["SME Table-top Exhibition", 25000]]),
    );
    expect(productsOf(body, "sponsorship_level").map((p) => p.priceCents).sort((a, b) => b - a)).toEqual([5000000, 2500000, 2000000, 1500000, 1000000, 500000]);
    expect(productsOf(body, "delegate_category").map((p) => p.priceCents).sort((a, b) => a - b)).toEqual([0, 6500, 15000, 16000, 25000]);
    expect(productsOf(body, "opportunity")).toHaveLength(7);
    expect(body.products.every((p: Json) => p.status === "published" && p.capacity === null && p.taken === 0)).toBe(true);
    // Currency, the tax question and the dates are as the instructions leave them.
    expect(body).toMatchObject({ currency: "USD", pricesIncludeTax: null, expectedAttendance: 300, selectedSmes: 100, days: 3, etbPerUsd: 160, paymentMethods: [], productCount: 23 });
    expect(body.datesNote).toMatch(/January 2027/);
    expect(JSON.stringify(body)).not.toMatch(/October/);
  });

  it("refuses an address that is taken, or one that isn't an address", async () => {
    const slug = slugFor("dup");
    expect((await createEdition(w.admin, { slug })).status).toBe(201);
    const again = await createEdition(w.admin, { slug });
    expect(again.status).toBe(422);
    expect(again.body.error).toMatch(/already an edition/);
    expect((await createEdition(w.admin, { slug: "Not A Slug" })).status).toBe(400);
  });

  it("records who created it in the audit log", async () => {
    const { body } = await createEdition(w.admin);
    const [row] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, body.id), eq(schema.auditLog.action, "summit.commerce.edition.created")));
    expect(row).toMatchObject({ actorUserId: w.admin.id, platform: "summit", entityType: "commerce_edition" });
    expect(row?.after).toMatchObject({ from: "standard", products: 23 });
  });
});

describe("the public catalogue", () => {
  it("needs no sign-in and shows the current edition's published products with prices in USD", async () => {
    const created = await createEdition(w.admin, { name: "Public test summit" });
    expect((await makeCurrent(created.body.id)).status).toBe(200);
    const { status, body } = await catalogue();
    expect(status).toBe(200);
    expect(body.edition).toMatchObject({ name: "Public test summit", currency: "USD", pricesIncludeTax: null });
    expect(body.edition.taxNote).toMatch(/VAT/);
    expect(body.exhibition.map((p: Json) => p.price)).toEqual(["$500", "$900", "$1,600", "$1,500", "$250"]);
    expect(body.sponsorship.map((p: Json) => p.price)).toEqual(["$50,000 and above", "$25,000 to $40,000", "$20,000 to $30,000", "$15,000 to $25,000", "$10,000 to $25,000, or in-kind", "$5,000 to $10,000"]);
    expect(body.delegates.map((p: Json) => p.price)).toEqual(["Complimentary", "$65", "$160", "$150", "$250"]);
    expect(body.delegates[0]).toMatchObject({ complimentary: true });
    expect(body.opportunities.map((p: Json) => p.price)).toEqual(["$4,700", "$3,125", "$1,875", "$1,560", "$313", "$625", "$3,125"]);
    expect(body.benefitAreas).toHaveLength(9);
    expect(body.comparisonRows.map((r: Json) => r.id)).toContain("boothSize");
  });

  it("lists a sponsorship level's own benefits when it has them, and leaves out an area it doesn't include", async () => {
    const created = await createEdition(w.admin);
    await makeCurrent(created.body.id);
    const level = created.body.products.find((p: Json) => p.slug === "banking-finance-partner");
    const set = await callV1(w.admin, "PATCH", `/summit/commerce/products/${level.id}`, { benefits: { logo: "Logo on the website.", b2b: "Access to B2B matchmaking." } });
    expect(set.status).toBe(200);
    const { body } = await catalogue();
    const banking = body.sponsorship.find((p: Json) => p.slug === "banking-finance-partner");
    const presenting = body.sponsorship.find((p: Json) => p.slug === "mission-presenting-partner");
    expect(banking.benefits.map((b: Json) => b.area)).toEqual(["logo", "b2b"]);
    expect(banking.price).toBe("$25,000 to $40,000");
    expect(banking.priceCents).toBe(2500000);
    expect(presenting.benefits).toEqual([]);
  });

  it("holds no payment instructions, drafts or archived products", async () => {
    const created = await createEdition(w.admin);
    await makeCurrent(created.body.id);
    await callV1(w.admin, "PATCH", `/summit/commerce/editions/${created.body.id}`, {
      paymentMethods: [{ id: "bank", label: "Bank transfer", instructions: "Account 000-SECRET-111" }],
    });
    const gold = created.body.products.find((p: Json) => p.slug === "banking-finance-partner");
    const silver = created.body.products.find((p: Json) => p.slug === "logistics-supply-chain-partner");
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${gold.id}`, { status: "draft" });
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${silver.id}`, { status: "archived" });
    const { body } = await catalogue();
    expect(body.sponsorship.map((p: Json) => p.slug)).not.toContain("banking-finance-partner");
    expect(body.sponsorship.map((p: Json) => p.slug)).not.toContain("logistics-supply-chain-partner");
    expect(JSON.stringify(body)).not.toMatch(/SECRET|paymentMethods|instructions/);
  });

  it("shows a package as sold out when an administrator marks it, or its capacity is zero", async () => {
    const created = await createEdition(w.admin);
    await makeCurrent(created.body.id);
    const [standard, premium, table] = ["standard-sme-booth", "premium-sme-booth", "sme-table-top"].map((s) => created.body.products.find((p: Json) => p.slug === s));
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${standard.id}`, { markedSoldOut: true });
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${premium.id}`, { capacity: 0 });
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${table.id}`, { capacity: 12 });
    const { body } = await catalogue();
    const by = (slug: string) => body.exhibition.find((p: Json) => p.slug === slug).availability;
    expect(by("standard-sme-booth")).toEqual({ remaining: null, soldOut: true });
    expect(by("premium-sme-booth")).toEqual({ remaining: 0, soldOut: true });
    expect(by("sme-table-top")).toEqual({ remaining: 12, soldOut: false });
    expect(by("corporate-institutional-booth")).toEqual({ remaining: null, soldOut: false });
    // The public sees how many are left, not who has them.
    expect(JSON.stringify(body)).not.toMatch(/"taken"|"capacity"/);
  });

  it("is exactly one current edition at a time", async () => {
    const a = await createEdition(w.admin);
    const b = await createEdition(w.admin);
    await makeCurrent(a.body.id);
    await makeCurrent(b.body.id);
    const list = await callV1(w.admin, "GET", "/summit/commerce/editions");
    const ours = list.body.items.filter((e: Json) => e.slug.startsWith(PREFIX));
    expect(ours.filter((e: Json) => e.isCurrent).map((e: Json) => e.id)).toEqual([b.body.id]);
  });
});

describe("changing a product", () => {
  it("changes its price, benefits and capacity and writes what changed to the audit log", async () => {
    const created = await createEdition(w.admin);
    const title = created.body.products.find((p: Json) => p.slug === "mission-presenting-partner");
    const res = await callV1(w.admin, "PATCH", `/summit/commerce/products/${title.id}`, {
      priceCents: 3500000,
      capacity: 1,
      benefits: { ...title.benefits, speaking: "Closing keynote" },
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ priceCents: 3500000, capacity: 1 });
    expect(res.body.benefits.speaking).toBe("Closing keynote");
    const [row] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, title.id), eq(schema.auditLog.action, "summit.commerce.product.updated")));
    expect(row?.before).toMatchObject({ priceCents: 5000000, capacity: null });
    expect(row?.after).toMatchObject({ priceCents: 3500000, capacity: 1 });
  });

  it("leaves every field the patch doesn't name as it was", async () => {
    const created = await createEdition(w.admin);
    const gold = created.body.products.find((p: Json) => p.slug === "banking-finance-partner");
    const res = await callV1(w.admin, "PATCH", `/summit/commerce/products/${gold.id}`, { capacity: 5 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ capacity: 5, status: "published", summary: gold.summary, sortOrder: gold.sortOrder, priceCents: gold.priceCents });
    expect(res.body.benefits).toEqual(gold.benefits);
    expect(res.body.features).toEqual(gold.features);
  });

  it("writes nothing to the audit log when nothing changed", async () => {
    const created = await createEdition(w.admin);
    const gold = created.body.products.find((p: Json) => p.slug === "banking-finance-partner");
    expect((await callV1(w.admin, "PATCH", `/summit/commerce/products/${gold.id}`, { priceCents: gold.priceCents })).status).toBe(200);
    const rows = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, gold.id), eq(schema.auditLog.action, "summit.commerce.product.updated")));
    expect(rows).toHaveLength(0);
  });

  it("refuses a negative price, an enormous one, and benefits by area on a delegate category", async () => {
    const created = await createEdition(w.admin);
    const delegate = created.body.products.find((p: Json) => p.kind === "delegate_category");
    expect((await callV1(w.admin, "PATCH", `/summit/commerce/products/${delegate.id}`, { priceCents: -5 })).status).toBe(400);
    expect((await callV1(w.admin, "PATCH", `/summit/commerce/products/${delegate.id}`, { priceCents: 2_000_000_00 })).status).toBe(400);
    const res = await callV1(w.admin, "PATCH", `/summit/commerce/products/${delegate.id}`, { benefits: { logo: "Big" } });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/only sponsorship levels/);
    expect((await callV1(w.admin, "PATCH", `/summit/commerce/products/${delegate.id}`, { benefits: { nonsense: "x" } })).status).toBe(400);
  });

  it("answers 404 for a product that doesn't exist", async () => {
    const res = await callV1(w.admin, "PATCH", "/summit/commerce/products/00000000-0000-4000-8000-000000000000", { priceCents: 1 });
    expect(res.status).toBe(404);
  });

  it("adds a product, as a draft unless told otherwise, and refuses a second one at the same address", async () => {
    const created = await createEdition(w.admin);
    const body = { kind: "opportunity", slug: "gala-dinner", name: "Gala Dinner Sponsorship", summary: "Host the dinner.", priceCents: 500000 };
    const added = await callV1(w.admin, "POST", `/summit/commerce/editions/${created.body.id}/products`, body);
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body).toMatchObject({ status: "draft", capacity: null, features: [] });
    const again = await callV1(w.admin, "POST", `/summit/commerce/editions/${created.body.id}/products`, body);
    expect(again.status).toBe(422);
    expect(again.body.error).toMatch(/already has a product/);
    // An exhibition package must give a value for each row of the comparison, even an empty one.
    const booth = await callV1(w.admin, "POST", `/summit/commerce/editions/${created.body.id}/products`, { ...body, kind: "exhibition_package", slug: "stand" });
    expect(booth.status).toBe(422);
  });
});

describe("an edition's settings", () => {
  it("saves payment methods, the tax answer and the assessment period, and shows them to staff only", async () => {
    const created = await createEdition(w.admin);
    const [period] = await db
      .insert(schema.applicationPeriod)
      .values({ name: `${PREFIX}period-${RUN}`, opensAt: new Date("2026-12-01"), closesAt: new Date("2026-12-31"), countries: ["ET"], templateVersion: "0.1.0", rulesVersion: "1.0.0" })
      .returning({ id: schema.applicationPeriod.id });
    const res = await callV1(w.admin, "PATCH", `/summit/commerce/editions/${created.body.id}`, {
      pricesIncludeTax: false,
      taxNote: "Prices exclude 15% VAT.",
      paymentMethods: [{ id: "bank-transfer", label: "Bank transfer", instructions: "Pay to the account in your approval email." }],
      applicationPeriodId: period!.id,
      datesNote: "January 2027 (exact dates to be announced)",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ pricesIncludeTax: false, taxNote: "Prices exclude 15% VAT.", applicationPeriodId: period!.id });
    expect(res.body.paymentMethods).toHaveLength(1);
    const staff = await callV1(w.facilitator, "GET", `/summit/commerce/editions/${created.body.id}`);
    expect(staff.body.paymentMethods[0].label).toBe("Bank transfer");
    // Cleaned up by the tests' own sweep of their periods.
    await db.update(schema.commerceEdition).set({ applicationPeriodId: null }).where(eq(schema.commerceEdition.id, created.body.id));
  });

  it("refuses an application period that doesn't exist", async () => {
    const created = await createEdition(w.admin);
    const res = await callV1(w.admin, "PATCH", `/summit/commerce/editions/${created.body.id}`, { applicationPeriodId: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(422);
  });
});

describe("copying an edition", () => {
  it("copies the settings and the products that aren't archived, and none of the bookings or the period link", async () => {
    const source = await createEdition(w.admin, { name: "Source" });
    await callV1(w.admin, "PATCH", `/summit/commerce/editions/${source.body.id}`, {
      paymentMethods: [{ id: "bank", label: "Bank", instructions: "Details." }],
      pricesIncludeTax: true,
    });
    const gold = source.body.products.find((p: Json) => p.slug === "banking-finance-partner");
    const silver = source.body.products.find((p: Json) => p.slug === "logistics-supply-chain-partner");
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${gold.id}`, { priceCents: 700000, capacity: 3 });
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${silver.id}`, { status: "archived", markedSoldOut: true });

    const copy = await createEdition(w.admin, { name: "Next year", from: source.body.id });
    expect(copy.status, JSON.stringify(copy.body)).toBe(201);
    expect(copy.body).toMatchObject({ pricesIncludeTax: true, isCurrent: false, applicationPeriodId: null, productCount: 22 });
    expect(copy.body.paymentMethods[0].label).toBe("Bank");
    const copiedGold = copy.body.products.find((p: Json) => p.slug === "banking-finance-partner");
    expect(copiedGold).toMatchObject({ priceCents: 700000, capacity: 3, markedSoldOut: false });
    expect(copy.body.products.map((p: Json) => p.slug)).not.toContain("logistics-supply-chain-partner");
    // The copy is its own: editing it leaves the source alone.
    await callV1(w.admin, "PATCH", `/summit/commerce/products/${copiedGold.id}`, { priceCents: 1 });
    const after = await callV1(w.admin, "GET", `/summit/commerce/editions/${source.body.id}`);
    expect(after.body.products.find((p: Json) => p.slug === "banking-finance-partner").priceCents).toBe(700000);
  });

  it("answers 404 when the edition to copy doesn't exist", async () => {
    const res = await createEdition(w.admin, { from: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(404);
  });
});
