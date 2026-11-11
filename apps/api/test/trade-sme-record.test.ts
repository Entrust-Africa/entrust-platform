import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// The SME record (#195): completed shipments with their evidence status, the pathway review the first one raises, products, and the profile with its history.

const w = {} as { owner: TestUser; stranger: TestUser; admin: TestUser; assessor: TestUser; outsider: TestUser; org: string; otherOrg: string; cohort: string; enrollment: string };

const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);
const post = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "POST", `/trade${path}`, body);
const patch = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "PATCH", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};
const transaction = async (product: string, isPractice = false) => ok(await post(w.owner, "/transactions", { organizationId: w.org, product, destination: "Kenya", isPractice }));

beforeAll(async () => {
  await cleanup();
  const [owner, stranger, admin, assessor, outsider] = (await Promise.all(["sr-owner", "sr-stranger", "sr-admin", "sr-assessor", "sr-outsider"].map(signUp))) as TestUser[] as [TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, stranger, admin, assessor, outsider });
  process.env.ENTRUST_ORG_ID = await createOrganization("sr-entrust", [[admin, "admin"], [assessor, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("sr-sme", [[owner, "owner"]], { platform: "trade" });
  w.otherOrg = await createOrganization("sr-other", [[stranger, "owner"]], { platform: "trade" });
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}sr-program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}sr-cohort`, country: "ET" }).returning();
  w.cohort = cohort!.id;
  const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: w.cohort, organizationId: w.org, status: "active" }).returning();
  w.enrollment = enrollment!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("completed shipments", () => {
  it("records nothing for an order that is only confirmed, or for a practice transaction", async () => {
    const confirmed = await transaction("Coffee");
    ok(await patch(w.owner, `/transactions/${confirmed.id}`, { stage: "order_confirmed" }));
    ok(await patch(w.owner, `/transactions/${confirmed.id}`, { stage: "shipped" }));
    const practice = await transaction("Practice coffee", true);
    ok(await patch(w.owner, `/transactions/${practice.id}`, { stage: "closed" }));
    expect((await get(w.owner, `/export-history?organizationId=${w.org}`)).body.items).toEqual([]);
    expect((await get(w.admin, "/pathway-reviews")).body.items).toEqual([]);
  });

  it("records nothing when a deal that never shipped is closed", async () => {
    const lost = await transaction("Lost coffee deal");
    ok(await patch(w.owner, `/transactions/${lost.id}`, { stage: "quoted" }));
    ok(await patch(w.owner, `/transactions/${lost.id}`, { stage: "closed" }));
    expect((await get(w.owner, `/export-history?organizationId=${w.org}`)).body.items).toEqual([]);
  });

  it("records a shipment, self-reported, when a real transaction is closed out, and only once", async () => {
    const tx = await transaction("Washed coffee");
    ok(await patch(w.owner, `/transactions/${tx.id}`, { stage: "shipped" }));
    ok(await patch(w.owner, `/transactions/${tx.id}`, { stage: "closed", buyerName: "Roaster GmbH" }));
    ok(await patch(w.owner, `/transactions/${tx.id}`, { stage: "closed", closeout: "Paid in full" }));
    const items = (await get(w.owner, `/export-history?organizationId=${w.org}`)).body.items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ transactionId: tx.id, product: "Washed coffee", destination: "Kenya", evidenceStatus: "self_reported" });
  });

  it("flags the enrolment for a pathway review at the first shipment, and leaves the pathway alone", async () => {
    const reviews = (await get(w.admin, `/pathway-reviews?cohortId=${w.cohort}`)).body.items;
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({ enrollmentId: w.enrollment, status: "open", shipment: { product: "Washed coffee", evidenceStatus: "self_reported" } });
    expect(await db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.enrollmentId, w.enrollment))).toEqual([]);
    // A second shipment raises no second review.
    ok(await post(w.owner, "/export-history", { organizationId: w.org, product: "Honey", shipmentDate: "2025-03-01" }));
    expect((await get(w.admin, "/pathway-reviews?status=open")).body.items).toHaveLength(1);
  });

  it("lets a business report an earlier shipment but not mark it as checked", async () => {
    const refused = await post(w.owner, "/export-history", { organizationId: w.org, product: "Spices", evidenceStatus: "independently_verified" });
    expect(refused.status).toBe(403);
    expect((await post(w.owner, "/export-history", { organizationId: w.org, product: "Spices", shipmentDate: "not a date" })).status).toBe(400);
  });

  it("lets staff set the evidence status, and then the business can no longer change that shipment", async () => {
    const [shipment] = (await get(w.owner, `/export-history?organizationId=${w.org}`)).body.items;
    expect((await patch(w.owner, `/export-history/${shipment.id}`, { evidenceStatus: "document_supported" })).status).toBe(403);
    // An assessor who isn't on the cohort can't see the business at all.
    expect((await patch(w.assessor, `/export-history/${shipment.id}`, { evidenceStatus: "document_supported" })).status).toBe(404);
    const checked = ok(await patch(w.admin, `/export-history/${shipment.id}`, { evidenceStatus: "document_supported", evidenceNote: "Bill of lading seen" }));
    expect(checked).toMatchObject({ evidenceStatus: "document_supported", evidenceNote: "Bill of lading seen" });
    expect((await patch(w.owner, `/export-history/${shipment.id}`, { product: "Something else" })).status).toBe(403);
  });

  it("keeps one business's shipments from another", async () => {
    expect((await get(w.stranger, `/export-history?organizationId=${w.org}`)).status).toBe(404);
    expect((await post(w.stranger, "/export-history", { organizationId: w.org, product: "X" })).status).toBe(404);
  });
});

describe("pathway reviews", () => {
  it("are for staff, and resolving one records the decision without changing the pathway", async () => {
    expect((await get(w.owner, "/pathway-reviews")).status).toBe(403);
    const [review] = (await get(w.admin, "/pathway-reviews?status=open")).body.items;
    expect((await post(w.assessor, `/pathway-reviews/${review.id}/resolve`, { resolution: "x" })).status).toBe(403);
    expect((await post(w.admin, `/pathway-reviews/${review.id}/resolve`, { resolution: "" })).status).toBe(400);
    const done = ok(await post(w.admin, `/pathway-reviews/${review.id}/resolve`, { resolution: "Confirmed Pathway B with the shipment documents" }));
    expect(done).toMatchObject({ status: "resolved", resolution: "Confirmed Pathway B with the shipment documents" });
    expect((await post(w.admin, `/pathway-reviews/${review.id}/resolve`, { resolution: "again" })).status).toBe(409);
    expect(await db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.enrollmentId, w.enrollment))).toEqual([]);
  });

  it("show an assessor only the cohorts they're on, and an assessor on the cohort can't write", async () => {
    expect((await get(w.assessor, "/pathway-reviews")).body.items).toEqual([]);
    await db.insert(schema.cohortStaff).values({ cohortId: w.cohort, userId: w.assessor.id });
    expect((await get(w.assessor, "/pathway-reviews")).body.items).toHaveLength(1);
    const [shipment] = (await get(w.admin, `/export-history?organizationId=${w.org}`)).body.items;
    expect((await patch(w.assessor, `/export-history/${shipment.id}`, { evidenceStatus: "independently_verified" })).status).toBe(403);
  });
});

describe("products", () => {
  it("lets a business hold several, change them, and archive one without losing it", async () => {
    const coffee = ok(await post(w.owner, "/products", { organizationId: w.org, name: "Washed Yirgacheffe", hsCode: "0901.11", category: "Coffee" }));
    ok(await post(w.owner, "/products", { organizationId: w.org, name: "Natural Sidamo" }));
    expect((await get(w.owner, `/products?organizationId=${w.org}`)).body.items.map((p: Json) => p.name)).toEqual(["Natural Sidamo", "Washed Yirgacheffe"]);
    ok(await patch(w.owner, `/products/${coffee.id}`, { description: "Grade 1" }));
    ok(await patch(w.owner, `/products/${coffee.id}`, { archived: true }));
    expect((await get(w.owner, `/products?organizationId=${w.org}`)).body.items.map((p: Json) => p.name)).toEqual(["Natural Sidamo"]);
    const all = (await get(w.owner, `/products?organizationId=${w.org}&includeArchived=true`)).body.items;
    expect(all.find((p: Json) => p.id === coffee.id)).toMatchObject({ archived: true, description: "Grade 1" });
    expect((await post(w.owner, "/products", { organizationId: w.org, name: "" })).status).toBe(400);
  });

  it("are private to the business and its staff, and staff reviewers can read them", async () => {
    expect((await get(w.stranger, `/products?organizationId=${w.org}`)).status).toBe(404);
    expect((await post(w.stranger, "/products", { organizationId: w.org, name: "X" })).status).toBe(404);
    expect((await post(w.assessor, "/products", { organizationId: w.org, name: "X" })).status).toBe(403);
  });
});

describe("the business profile", () => {
  it("lets the business correct its details and keeps who changed what, flagging the material ones", async () => {
    const before = ok(await get(w.owner, `/business-profile?organizationId=${w.org}`));
    expect(before.legalName).toBe("sr-sme");
    ok(await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { businessPhone: "+251911000000", website: "https://example.test" } }));
    ok(await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { legalName: "SR Exports PLC", tin: "0012345678" } }));
    const now = ok(await get(w.owner, `/business-profile?organizationId=${w.org}`));
    expect(now).toMatchObject({ legalName: "SR Exports PLC", tin: "0012345678", businessPhone: "+251911000000" });
    const history = ok(await get(w.owner, `/business-profile/history?organizationId=${w.org}`)).items;
    expect(history.map((h: Json) => [h.field, h.material])).toEqual(expect.arrayContaining([["legalName", true], ["tin", true], ["businessPhone", false], ["website", false]]));
    expect(history.find((h: Json) => h.field === "legalName")).toMatchObject({ oldValue: "sr-sme", newValue: "SR Exports PLC", label: "Legal name" });
  });

  it("records nothing when nothing changed, and refuses an empty legal name or a bad email", async () => {
    const count = async () => (await get(w.owner, `/business-profile/history?organizationId=${w.org}`)).body.items.length;
    const before = await count();
    ok(await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { legalName: "SR Exports PLC" } }));
    expect(await count()).toBe(before);
    expect((await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { legalName: "" } })).status).toBe(400);
    expect((await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { businessEmail: "nope" } })).status).toBe(400);
    expect((await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { smeId: "TAKEN" } })).status).toBe(400);
  });

  it("refuses a registration number another business holds", async () => {
    ok(await patch(w.stranger, "/business-profile", { organizationId: w.otherOrg, changes: { registrationNumber: "REG-1" } }));
    const clash = await patch(w.owner, "/business-profile", { organizationId: w.org, changes: { registrationNumber: "REG-1" } });
    expect(clash.status).toBe(409);
  });

  it("is private to the business, writable by admins and not by assessors", async () => {
    expect((await get(w.stranger, `/business-profile?organizationId=${w.org}`)).status).toBe(404);
    expect((await patch(w.stranger, "/business-profile", { organizationId: w.org, changes: { website: "x" } })).status).toBe(404);
    expect((await patch(w.assessor, "/business-profile", { organizationId: w.org, changes: { website: "x" } })).status).toBe(403);
    ok(await patch(w.admin, "/business-profile", { organizationId: w.org, changes: { premises: "Leased factory" } }));
  });
});
