import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

describe("TRADE buyer pipeline API (#68)", () => {
  let owner: TestUser;
  let rival: TestUser;
  let admin: TestUser;
  let org: string;
  let rivalOrg: string;
  let entrust: string;
  let enrollmentId: string;

  const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
  const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
  const patch = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PATCH", `/trade${path}`, body);

  beforeAll(async () => {
    await cleanup();
    const users = await Promise.all(["pipe-owner", "pipe-rival", "pipe-admin"].map(signUp));
    [owner, rival, admin] = users as [TestUser, TestUser, TestUser];

    org = await createOrganization("pipe-org", [[owner, "owner"]], { platform: "trade" });
    rivalOrg = await createOrganization("pipe-rival-org", [[rival, "owner"]], { platform: "trade" });
    entrust = await createOrganization("pipe-entrust", [[admin, "admin"]], { smeProfile: false });
    process.env.ENTRUST_ORG_ID = entrust;

    const [program] = await db.insert(schema.program).values({ name: `${PREFIX}pipe-prog` }).returning();
    const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}pipe-cohort`, country: "ET" }).returning();
    const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: org, status: "active" }).returning();
    enrollmentId = enrollment!.id;
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await cleanup();
  });

  it("lists empty pipeline initially", async () => {
    const res = await get(owner, `/pipeline?organizationId=${org}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it("creates an opportunity with company details and source links", async () => {
    const res = await post(owner, "/pipeline", {
      organizationId: org,
      enrollmentId,
      title: "German Specialty Retailer Order",
      companyName: "Kaffee Welt GmbH",
      country: "DE",
      buyerName: "Hans Gruber",
      website: "https://kaffeewelt.example.de",
      sourceLinks: ["https://kaffeewelt.example.de/sourcing", "https://linkedin.com/in/hansgruber"],
      decisionMakerRole: "Head of Procurement",
      notes: "Met during Frankfurt coffee week prep.",
      estimatedValue: 45000,
      currency: "EUR",
    });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe("German Specialty Retailer Order");
    expect(res.body.companyName).toBe("Kaffee Welt GmbH");
    expect(res.body.country).toBe("DE");
    expect(res.body.verificationStatus).toBe("unverified");
    expect(res.body.stage).toBe("lead_discovered");
    expect(res.body.activityCount).toBe(0);
    expect(res.body.sourceLinks).toHaveLength(2);
  });

  it("rejects invalid URLs in source links", async () => {
    const res = await post(owner, "/pipeline", {
      organizationId: org,
      title: "Bad Link Lead",
      companyName: "Invalid Co",
      country: "KE",
      sourceLinks: ["not-a-url"],
    });

    expect(res.status).toBe(400);
  });

  it("refuses stage transition when no commercial activity exists", async () => {
    const listRes = await get(owner, `/pipeline?organizationId=${org}`);
    const oppId = listRes.body.items[0].id;

    const res = await patch(owner, `/pipeline/${oppId}/stage`, {
      stage: "quote_submitted",
    });

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("at least one recorded commercial activity");
  });

  it("records a commercial activity and advances verification ladder", async () => {
    const listRes = await get(owner, `/pipeline?organizationId=${org}`);
    const oppId = listRes.body.items[0].id;

    const actRes = await post(owner, `/pipeline/${oppId}/activities`, {
      type: "email",
      summary: "Sent introductory catalogue and pricing brief to Hans Gruber.",
      occurredAt: new Date().toISOString(),
      followUpDate: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
    });

    expect(actRes.status).toBe(201);
    expect(actRes.body.summary).toContain("introductory catalogue");
    expect(actRes.body.type).toBe("email");

    const getActs = await get(owner, `/pipeline/${oppId}/activities`);
    expect(getActs.status).toBe(200);
    expect(getActs.body.items).toHaveLength(1);

    const oppRes = await get(owner, `/pipeline?organizationId=${org}`);
    expect(oppRes.body.items[0].verificationStatus).toBe("identity_checked");
    expect(oppRes.body.items[0].activityCount).toBe(1);
    expect(oppRes.body.items[0].latestActivity).not.toBeNull();
  });

  it("allows stage transition once activity is recorded", async () => {
    const listRes = await get(owner, `/pipeline?organizationId=${org}`);
    const oppId = listRes.body.items[0].id;

    const res = await patch(owner, `/pipeline/${oppId}/stage`, {
      stage: "quote_submitted",
    });

    expect(res.status).toBe(200);
    expect(res.body.stage).toBe("quote_submitted");
  });

  it("evaluates and stores qualification scorecard", async () => {
    const listRes = await get(owner, `/pipeline?organizationId=${org}`);
    const oppId = listRes.body.items[0].id;

    const res = await post(owner, `/pipeline/${oppId}/scorecard`, {
      productFit: 4,
      purchasingPowerOrVolume: 5,
      paymentTerms: 4,
      accessToDecisionMaker: 3,
      importExperience: 4,
      timeline: 4,
    });

    expect(res.status).toBe(200);
    expect(res.body.scorecardTotal).toBe(24);
    expect(res.body.scorecardBand).toBe("high");
  });

  it("maps export journey stage from furthest active pipeline stage", async () => {
    const res = await get(owner, `/pipeline/journey?organizationId=${org}`);
    expect(res.status).toBe(200);
    expect(res.body.stageNumber).toBe(4); // quote_submitted -> stage 4
    expect(res.body.title).toBe("Inquiry & Quotation");
    expect(res.body.m05DeliverableStatus.isEligible).toBe(false); // need 5 verified leads
    expect(res.body.m05DeliverableStatus.missingCount).toBe(4); // 1 verified, 4 missing
  });

  it("denies access to rival organisation", async () => {
    const listRes = await get(owner, `/pipeline?organizationId=${org}`);
    const oppId = listRes.body.items[0].id;

    const res = await patch(rival, `/pipeline/${oppId}/stage`, {
      stage: "disqualified",
    });

    expect(res.status).toBe(404);
  });
});
