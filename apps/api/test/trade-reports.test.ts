import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callFileV1, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Programme and cohort reports (#72).

const w = {} as {
  owner: TestUser;
  admin: TestUser;
  bankViewer: TestUser;
  otherBankViewer: TestUser;
  smes: string[];
  bank: string;
  program: string;
  bigCohort: string;
  smallCohort: string;
  enrollments: string[];
  smallEnrollment: string;
};

const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);

beforeAll(async () => {
  await cleanup();
  const [owner, admin, bankViewer, otherBankViewer] = (await Promise.all(["rp-owner", "rp-admin", "rp-bank", "rp-other"].map(signUp))) as [TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, admin, bankViewer, otherBankViewer });
  const entrust = await createOrganization("rp-entrust", [[admin, "admin"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = entrust;
  w.smes = await Promise.all(["a", "b", "c", "d", "e", "f"].map((n) => createOrganization(`rp-sme-${n}`, [[owner, "owner"]], { platform: "trade" })));
  const small = await createOrganization("rp-sme-small", [[owner, "owner"]], { platform: "trade" });

  w.bank = await createOrganization("rp-bank", [[bankViewer, "sponsor_viewer"]], { smeProfile: false });
  const otherBank = await createOrganization("rp-other-bank", [[otherBankViewer, "sponsor_viewer"]], { smeProfile: false });
  for (const id of [w.bank, otherBank]) {
    await db.update(schema.organization).set({ metadata: JSON.stringify({ kind: "sponsor" }) }).where(eq(schema.organization.id, id));
  }

  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}rp-program` }).returning();
  w.program = program!.id;
  const cohorts = await db
    .insert(schema.cohort)
    .values([
      { programId: w.program, name: `${PREFIX}rp-big`, country: "ET", sponsorOrganizationId: w.bank },
      { programId: w.program, name: `${PREFIX}rp-small`, country: "ET", sponsorOrganizationId: otherBank },
    ])
    .returning();
  w.bigCohort = cohorts[0]!.id;
  w.smallCohort = cohorts[1]!.id;

  const big = await db
    .insert(schema.enrollment)
    .values(w.smes.map((organizationId, i) => ({ cohortId: w.bigCohort, organizationId, status: i === 0 ? ("withdrawn" as const) : ("active" as const) })))
    .returning();
  w.enrollments = big.map((e) => e.id);
  const [smallEnrollment] = await db.insert(schema.enrollment).values({ cohortId: w.smallCohort, organizationId: small, status: "active" }).returning();
  w.smallEnrollment = smallEnrollment!.id;

  // Five SMEs have a financing record each: all approved, but only one disbursed, and one more in another currency.
  await db.insert(schema.outcome).values([
    ...w.smes.slice(0, 5).map((organizationId, i) => ({
      organizationId,
      enrollmentId: w.enrollments[i]!,
      kind: "financing" as const,
      status: i === 0 ? "disbursed" : "approved",
      currency: "USD",
      amountRequested: "1000",
      amountApproved: "800",
      amountDisbursed: i === 0 ? "800" : null,
    })),
    { organizationId: w.smes[5]!, enrollmentId: w.enrollments[5]!, kind: "financing" as const, status: "submitted", currency: "ETB", amountRequested: "50000" },
  ]);

  // One SME has a lead, so the pipeline figures cover one SME.
  await db.insert(schema.commercialOpportunity).values({ organizationId: w.smes[1]!, enrollmentId: w.enrollments[1]!, title: "Lead", stage: "firm_order_secured", verificationStatus: "qualified_opportunity" });
});

afterAll(async () => {
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}%`));
  await cleanup();
});

describe("who can open a report", () => {
  it("is not there for an SME, a stranger or the wrong sponsor", async () => {
    expect((await get(w.owner, `/reports/programs/${w.program}`)).status).toBe(404);
    expect((await get(w.owner, `/reports/cohorts/${w.bigCohort}`)).status).toBe(404);
    expect((await get(null, `/reports/programs/${w.program}`)).status).toBe(401);
    expect((await get(w.otherBankViewer, `/reports/cohorts/${w.bigCohort}`)).status).toBe(404);
    expect((await get(w.bankViewer, `/reports/cohorts/${w.smallCohort}`)).status).toBe(404);
  });

  it("shows a sponsor only its own cohorts of a programme", async () => {
    const res = await get(w.bankViewer, `/reports/programs/${w.program}`);
    expect(res.status).toBe(200);
    expect(res.body.scope.cohorts.map((c: Json) => c.id)).toEqual([w.bigCohort]);
    expect(res.body.reach.enrolled).toBe(6);
  });
});

describe("what Entrust staff see", () => {
  it("gets every figure and every SME", async () => {
    const res = await get(w.admin, `/reports/programs/${w.program}`);
    expect(res.status).toBe(200);
    expect(res.body.audience).toBe("staff");
    expect(res.body.reach.enrolled).toBe(7);
    expect(res.body.smes).toHaveLength(7);
    expect(res.body.pipeline).toMatchObject({ leads: 1, verifiedLeads: 1, qualifiedProspects: 1, rfqs: 1, firmOrders: 1 });
  });

  it("keeps approval and disbursement apart, and currencies apart", async () => {
    const res = await get(w.admin, `/reports/cohorts/${w.bigCohort}`);
    const rows = res.body.finance.byCurrency;
    expect(rows.map((r: Json) => r.currency)).toEqual(["ETB", "USD"]);
    const usd = rows.find((r: Json) => r.currency === "USD");
    expect(usd.requests).toEqual({ count: 5, amount: 5000 });
    expect(usd.approvals).toEqual({ count: 5, amount: 4000 });
    expect(usd.disbursements).toEqual({ count: 1, amount: 800 });
    expect(rows.find((r: Json) => r.currency === "ETB").requests).toEqual({ count: 1, amount: 50000 });
  });

  it("exports a CSV, which a sponsor can't", async () => {
    const res = await callFileV1(w.admin, `/trade/reports/cohorts/${w.bigCohort}/export.csv`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    expect(text.split("\r\n")[0]).toContain("Business,SME ID,Cohort");
    expect(text).toContain("rp-sme-a");
    expect((await callFileV1(w.bankViewer, `/trade/reports/cohorts/${w.bigCohort}/export.csv`)).status).toBe(403);
    expect((await callFileV1(w.bankViewer, `/trade/reports/programs/${w.program}/export.csv`)).status).toBe(403);
  });
});

describe("what a sponsor sees", () => {
  it("never gets a figure built from fewer than five SMEs", async () => {
    const res = await get(w.bankViewer, `/reports/cohorts/${w.bigCohort}`);
    expect(res.body.audience).toBe("sponsor");
    expect(res.body.reach.enrolled).toBe(6);
    // One withdrawn SME is hidden, and active goes with it: 6 minus 5 would give the withdrawn one back.
    const counts = Object.fromEntries(res.body.reach.byStatus.map((s: Json) => [s.status, s.count]));
    expect(counts).toMatchObject({ withdrawn: null, active: null, invited: 0 });
    expect(res.body.pipeline).toEqual({ leads: null, verifiedLeads: null, qualifiedProspects: null, rfqs: null, firmOrders: null });
    const usd = res.body.finance.byCurrency.find((r: Json) => r.currency === "USD");
    expect(usd.approvals).toEqual({ count: 5, amount: 4000 });
    expect(usd.disbursements).toEqual({ count: null, amount: null });
    // The one SME's birr request isn't there at all, not even as a row with nothing in it.
    expect(res.body.finance.byCurrency.map((r: Json) => r.currency)).toEqual(["USD"]);
    expect(res.body.smes).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain("rp-sme-");
  });

  it("gets the figure, and a named row, once every SME behind it agreed", async () => {
    const consent = { sponsorOrganizationId: w.bank, smeOrganizationId: w.smes[1]!, kind: "commercial_outcomes" as const, wordingVersion: "1.0.0", wording: "test" };
    const [row] = await db.insert(schema.sponsorConsent).values(consent).returning();
    const res = await get(w.bankViewer, `/reports/cohorts/${w.bigCohort}`);
    expect(res.body.pipeline.leads).toBe(1);
    expect(res.body.smes).toHaveLength(1);
    expect(res.body.smes[0]).toMatchObject({ organizationId: w.smes[1], leads: 1, firmOrders: 1, sharedKinds: ["commercial_outcomes"], pathway: null, modulesPassed: null });

    // Taking it back stops at once.
    await db.update(schema.sponsorConsent).set({ withdrawnAt: new Date() }).where(eq(schema.sponsorConsent.id, row!.id));
    const after = await get(w.bankViewer, `/reports/cohorts/${w.bigCohort}`);
    expect(after.body.pipeline.leads).toBeNull();
    expect(after.body.smes).toEqual([]);
  });
});
