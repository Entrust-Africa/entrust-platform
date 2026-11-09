import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schema } from "@entrust/db";
import { staffRoleLabel } from "@entrust/roles";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// The Quality role (architecture spec section 17): reads programme reports and the audit trail across every cohort, changes nothing.

const w = {} as { quality: TestUser; admin: TestUser; assessor: TestUser; program: string; cohort: string };

beforeAll(async () => {
  await cleanup();
  const [quality, admin, assessor] = (await Promise.all(["q-quality", "q-admin", "q-assessor"].map(signUp))) as [TestUser, TestUser, TestUser];
  Object.assign(w, { quality, admin, assessor });
  process.env.ENTRUST_ORG_ID = await createOrganization("q-entrust", [[admin, "admin"], [quality, "quality"], [assessor, "reviewer"]], { smeProfile: false });
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}q-program` }).returning();
  w.program = program!.id;
  const [cohort] = await db.insert(schema.cohort).values({ programId: w.program, name: `${PREFIX}q-cohort`, country: "ET" }).returning();
  w.cohort = cohort!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("Entrust's names for the staff roles", () => {
  it("shows Super Admin, Cohort Manager, Assessor and Quality for the stored roles", () => {
    expect(["admin", "facilitator", "reviewer", "quality"].map(staffRoleLabel)).toEqual(["Super Admin", "Cohort Manager", "Assessor", "Quality"]);
    expect(staffRoleLabel("owner")).toBe("owner");
  });
});

describe("Quality", () => {
  it("is known to /me as neither staff nor a committee member", async () => {
    expect((await callV1(w.quality, "GET", "/me")).body).toMatchObject({ staffRole: null, summitCommittee: false, quality: true });
    expect((await callV1(w.assessor, "GET", "/me")).body).toMatchObject({ staffRole: "reviewer", quality: false });
  });

  it("reads programme and cohort reports for every cohort, without being assigned to any", async () => {
    expect((await callV1(w.quality, "GET", `/trade/reports/programs/${w.program}`)).status).toBe(200);
    expect((await callV1(w.quality, "GET", `/trade/reports/cohorts/${w.cohort}`)).status).toBe(200);
    // An assessor who isn't on the cohort sees nothing of it.
    expect((await callV1(w.assessor, "GET", `/trade/reports/cohorts/${w.cohort}`)).status).toBe(404);
  });

  it("reads the audit trail, but not the entries that hold tax numbers", async () => {
    await db.insert(schema.auditLog).values([
      { action: "trade.test", entityType: "assessment", entityId: "q-1", platform: "trade" },
      { action: "sme.updated", entityType: "sme_profile", entityId: "q-2", platform: "trade" },
    ]);
    const res = await callV1(w.quality, "GET", "/audit?platform=trade&limit=100");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const types = res.body.items.map((i: { entityType: string }) => i.entityType);
    expect(types).toContain("assessment");
    expect(types).not.toContain("sme_profile");
  });

  it("can't do any of the work staff do", async () => {
    for (const [method, path] of [["GET", "/trade/cohorts"], ["POST", "/trade/programs"], ["GET", "/trade/catalogue"], ["GET", "/trade/register"], ["POST", "/mfa/enrol"]] as const) {
      const res = await callV1(w.quality, method, path, method === "POST" ? { name: "Nope" } : undefined);
      expect([res.status, path], JSON.stringify(res.body).slice(0, 200)).toEqual([403, path]);
    }
    // Submissions list only what belongs to the caller's own organisations, which is nothing.
    expect((await callV1(w.quality, "GET", "/trade/module-submissions")).body.items).toEqual([]);
  });
});
