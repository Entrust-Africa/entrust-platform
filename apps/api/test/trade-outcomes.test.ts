import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

describe("TRADE financing and export outcomes API (#69)", () => {
  let owner: TestUser;
  let rival: TestUser;
  let admin: TestUser;
  let org: string;
  let rivalOrg: string;
  let entrust: string;
  let enrollmentId: string;
  let opportunityId: string;

  const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
  const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
  const patch = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PATCH", `/trade${path}`, body);

  beforeAll(async () => {
    await cleanup();
    const users = await Promise.all(["out-owner", "out-rival", "out-admin"].map(signUp));
    [owner, rival, admin] = users as [TestUser, TestUser, TestUser];

    org = await createOrganization("out-org", [[owner, "owner"]], { platform: "trade" });
    rivalOrg = await createOrganization("out-rival-org", [[rival, "owner"]], { platform: "trade" });
    entrust = await createOrganization("out-entrust", [[admin, "admin"]], { smeProfile: false });
    process.env.ENTRUST_ORG_ID = entrust;

    const [program] = await db.insert(schema.program).values({ name: `${PREFIX}out-prog` }).returning();
    const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}out-cohort`, country: "ET" }).returning();
    const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: org, status: "active" }).returning();
    enrollmentId = enrollment!.id;

    // Create an opportunity to link export outcomes
    const oppRes = await post(owner, "/pipeline", {
      organizationId: org,
      enrollmentId,
      title: "Hamburg Coffee Roasters Batch 1",
      companyName: "Hamburg Roasters GmbH",
      country: "DE",
      estimatedValue: 60000,
    });
    opportunityId = oppRes.body.id;
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await cleanup();
  });

  it("lists empty outcomes initially", async () => {
    const res = await get(owner, `/outcomes?organizationId=${org}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it("creates a financing application outcome", async () => {
    const res = await post(owner, "/outcomes/financing", {
      organizationId: org,
      enrollmentId,
      lenderName: "Equity Bank Kenya",
      financingType: "working_capital",
      amountRequested: 100000,
      currency: "USD",
      status: "application_prepared",
      notes: "Pre-export working capital facility application.",
      evidenceTier: "self_reported",
    });

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("financing");
    expect(res.body.lenderName).toBe("Equity Bank Kenya");
    expect(res.body.amountRequested).toBe(100000);
    expect(res.body.amountApproved).toBeNull();
    expect(res.body.amountDisbursed).toBeNull();
    expect(res.body.status).toBe("application_prepared");
    expect(res.body.events).toHaveLength(1);
  });

  it("keeps financing approval without disbursement separate", async () => {
    const listRes = await get(owner, `/outcomes?organizationId=${org}&kind=financing`);
    const financingId = listRes.body.items[0].id;

    const update = {
      status: "approved",
      amountApproved: 85000,
      approvalDate: new Date().toISOString(),
      evidenceTier: "formal_bank_decision",
      notes: "Credit committee sanction letter received.",
    };
    // A business can't confirm its own bank decision. Entrust staff can, and the business can still update it after.
    expect((await patch(owner, `/outcomes/financing/${financingId}/status`, update)).status).toBe(403);
    const res = await patch(admin, `/outcomes/financing/${financingId}/status`, update);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.amountApproved).toBe(85000);
    expect(res.body.amountDisbursed).toBeNull(); // Crucial: separate approval from disbursement
    expect(res.body.evidenceTier).toBe("formal_bank_decision");
  });

  it("updates financing status to disbursed once funds clear", async () => {
    const listRes = await get(owner, `/outcomes?organizationId=${org}&kind=financing`);
    const financingId = listRes.body.items[0].id;

    const res = await patch(owner, `/outcomes/financing/${financingId}/status`, {
      status: "disbursed",
      amountDisbursed: 85000,
      disbursementDate: new Date().toISOString(),
      notes: "Funds credited to operational account.",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("disbursed");
    expect(res.body.amountDisbursed).toBe(85000);

    const eventsRes = await get(owner, `/outcomes/${financingId}/events`);
    expect(eventsRes.status).toBe(200);
    expect(eventsRes.body.items.length).toBeGreaterThanOrEqual(3);
  });

  it("creates an export outcome linked to an opportunity", async () => {
    const res = await post(owner, "/outcomes/export", {
      organizationId: org,
      enrollmentId,
      opportunityId,
      buyerName: "Hamburg Roasters GmbH",
      destinationCountry: "DE",
      productDescription: "Grade 1 Washed Yirgacheffe Coffee Beans (1 Container)",
      valuePlanned: 60000,
      currency: "USD",
      status: "planned",
      notes: "Scheduled for export via Djibouti port.",
    });

    expect(res.status).toBe(201);
    expect(res.body.kind).toBe("export");
    expect(res.body.buyerName).toBe("Hamburg Roasters GmbH");
    expect(res.body.valuePlanned).toBe(60000);
    expect(res.body.valueShipped).toBeNull();
    expect(res.body.valuePaid).toBeNull();
  });

  it("keeps shipment without payment separate and advances journey to Stage 8", async () => {
    const listRes = await get(owner, `/outcomes?organizationId=${org}&kind=export`);
    const exportId = listRes.body.items[0].id;

    const res = await patch(owner, `/outcomes/export/${exportId}/status`, {
      status: "shipped",
      valueShipped: 60000,
      shipmentDate: new Date().toISOString(),
      evidenceTier: "documented",
      notes: "Bill of Lading issued, cargo loaded on vessel.",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("shipped");
    expect(res.body.valueShipped).toBe(60000);
    expect(res.body.valuePaid).toBeNull(); // Crucial: separate shipment from payment

    // Check export journey is now mapped to Stage 8: Production & Shipment
    const journeyRes = await get(owner, `/pipeline/journey?organizationId=${org}`);
    expect(journeyRes.status).toBe(200);
    expect(journeyRes.body.stageNumber).toBe(8);
    expect(journeyRes.body.title).toBe("Production & Shipment");
  });

  it("advances journey to Stage 9 on delivery", async () => {
    const listRes = await get(owner, `/outcomes?organizationId=${org}&kind=export`);
    const exportId = listRes.body.items[0].id;

    const res = await patch(owner, `/outcomes/export/${exportId}/status`, {
      status: "delivered",
      deliveryDate: new Date().toISOString(),
      notes: "Cargo reached Hamburg terminal and cleared customs.",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("delivered");

    const journeyRes = await get(owner, `/pipeline/journey?organizationId=${org}`);
    expect(journeyRes.status).toBe(200);
    expect(journeyRes.body.stageNumber).toBe(9);
    expect(journeyRes.body.title).toBe("Delivery Confirmed");
  });

  it("advances journey to Stage 10 on payment received", async () => {
    const listRes = await get(owner, `/outcomes?organizationId=${org}&kind=export`);
    const exportId = listRes.body.items[0].id;

    const res = await patch(owner, `/outcomes/export/${exportId}/status`, {
      status: "paid",
      valuePaid: 60000,
      paymentDate: new Date().toISOString(),
      evidenceTier: "documented",
      notes: "Swift MT103 export proceeds receipt confirmed by commercial bank.",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("paid");
    expect(res.body.valuePaid).toBe(60000);

    const journeyRes = await get(owner, `/pipeline/journey?organizationId=${org}`);
    expect(journeyRes.status).toBe(200);
    expect(journeyRes.body.stageNumber).toBe(10);
    expect(journeyRes.body.title).toBe("Payment Received & Scale");
  });

  it("denies access to rival organisation", async () => {
    const listRes = await get(owner, `/outcomes?organizationId=${org}`);
    const outcomeId = listRes.body.items[0].id;

    const res = await patch(rival, `/outcomes/export/${outcomeId}/status`, {
      status: "disputed",
    });

    expect(res.status).toBe(404);
  });

  it("won't record a shipment without what shipped and when", async () => {
    const planned = await post(owner, "/outcomes/export", { organizationId: org, enrollmentId, buyerName: "Nairobi Foods", destinationCountry: "KE", productDescription: "Lentils", valuePlanned: 20000 });
    expect(planned.status).toBe(201);
    // Moving it to shipped on the planned value alone, with no date, is refused.
    const bare = await patch(owner, `/outcomes/export/${planned.body.id}/status`, { status: "shipped" });
    expect(bare.status).toBe(422);
    const noDate = await patch(owner, `/outcomes/export/${planned.body.id}/status`, { status: "shipped", valueShipped: 18000 });
    expect(noDate.status).toBe(422);
    const shipped = await patch(owner, `/outcomes/export/${planned.body.id}/status`, { status: "shipped", valueShipped: 18000, shipmentDate: "2026-11-05T07:00:00.000Z" });
    expect(shipped.status).toBe(200);
    expect(shipped.body).toMatchObject({ valueShipped: 18000, shipmentDate: "2026-11-05T07:00:00.000Z" });
  });

  it("drops a bank decision staff confirmed back to self-reported when the business changes its figures", async () => {
    const created = await post(owner, "/outcomes/financing", { organizationId: org, enrollmentId, lenderName: "Zemen Bank", financingType: "working_capital", amountRequested: 50000 });
    expect(created.status).toBe(201);
    const id = created.body.id;
    // Staff confirm the bank's decision.
    const confirmed = await patch(admin, `/outcomes/financing/${id}/status`, { status: "approved", amountApproved: 40000, approvalDate: "2026-11-01T00:00:00.000Z", evidenceTier: "formal_bank_decision" });
    expect(confirmed.body.evidenceTier).toBe("formal_bank_decision");

    // The business adds a note: the confirmation stands.
    const noted = await patch(owner, `/outcomes/financing/${id}/status`, { status: "approved", notes: "Signed the facility letter" });
    expect(noted.body.evidenceTier).toBe("formal_bank_decision");
    expect(noted.body.amountApproved).toBe(40000);

    // The business swaps the evidence: staff confirmed the old document, not this one.
    const swapped = await patch(owner, `/outcomes/financing/${id}/status`, { status: "approved", evidenceUrl: "https://example.test/another-letter.pdf" });
    expect(swapped.status).toBe(200);
    expect(swapped.body.evidenceTier).toBe("self_reported");
    // Staff confirm it again, then the next change.
    expect((await patch(admin, `/outcomes/financing/${id}/status`, { status: "approved", evidenceTier: "formal_bank_decision" })).body.evidenceTier).toBe("formal_bank_decision");

    // The business raises the approved amount: it's what the business reports now, not what staff confirmed.
    const raised = await patch(owner, `/outcomes/financing/${id}/status`, { status: "approved", amountApproved: 90000, evidenceTier: "formal_bank_decision" });
    expect(raised.status).toBe(200);
    expect(raised.body).toMatchObject({ amountApproved: 90000, evidenceTier: "self_reported" });
    expect(raised.body.events[0].notes).toContain("self-reported until staff confirm it again");
  });
});
