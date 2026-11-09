import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  call,
  callV1,
  cleanup,
  createOrganization,
  db,
  signUp,
  type TestUser,
} from "./support";

const w = {} as {
  admin: TestUser;
  facilitator: TestUser;
  reviewer: TestUser;
  smeOwner: TestUser;
  smeMember: TestUser;
  otherSmeOwner: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  smeId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, smeOwner, smeMember, otherSmeOwner] = await Promise.all([
    signUp("tr-admin"),
    signUp("tr-facil"),
    signUp("tr-rev"),
    signUp("tr-sme-owner"),
    signUp("tr-sme-member"),
    signUp("tr-other-owner"),
  ]);
  Object.assign(w, { admin, facilitator, reviewer, smeOwner, smeMember, otherSmeOwner });

  // Create Entrust organisation with staff roles
  w.entrustOrgId = await createOrganization(
    "entrust-staff-cohorts",
    [
      [admin!, "admin"],
      [facilitator!, "facilitator"],
      [reviewer!, "reviewer"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // Create an SME organisation on CLEAR first (to verify CLEAR SME stays intact when enrolled)
  const smeRes = await callV1(w.smeOwner, "POST", "/organizations", {
    name: `Coffee Exporters ${randomUUID().slice(0, 6)}`,
    slug: `coffee-exp-${randomUUID().slice(0, 8)}`,
    legalName: `Coffee Exporters ${randomUUID().slice(0, 6)} PLC`,
    country: "ET",
    platform: "clear",
  });
  expect(smeRes.status).toBe(201);
  w.smeOrgId = smeRes.body.id;
  w.smeId = smeRes.body.smeId;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE Programs API", () => {
  let programId: string;

  it("refuses program creation for non-staff callers with 403", async () => {
    const res = await callV1(w.smeOwner, "POST", "/trade/programs", {
      name: "TRADE Pilot 2026",
    });
    expect(res.status).toBe(403);
  });

  it("allows Entrust facilitator to create a program", async () => {
    const res = await callV1(w.facilitator, "POST", "/trade/programs", {
      name: "TRADE Ethiopia, Zemen Bank Pilot",
      description: "Foundational export capability pilot sponsored by Zemen Bank.",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("TRADE Ethiopia, Zemen Bank Pilot");
    programId = res.body.id;
  });

  it("allows Entrust staff to list and get program details", async () => {
    const listRes = await callV1(w.reviewer, "GET", "/trade/programs");
    expect(listRes.status).toBe(200);
    expect(listRes.body.programs.length).toBeGreaterThanOrEqual(1);

    const getRes = await callV1(w.admin, "GET", `/trade/programs/${programId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(programId);
    expect(getRes.body.name).toBe("TRADE Ethiopia, Zemen Bank Pilot");
  });
});

describe("TRADE Cohorts API", () => {
  let programId: string;
  let cohortId: string;

  beforeAll(async () => {
    const prog = await callV1(w.admin, "POST", "/trade/programs", {
      name: `Program For Cohorts ${randomUUID().slice(0, 6)}`,
    });
    programId = prog.body.id;
  });

  it("refuses cohort creation for non-staff with 403", async () => {
    const res = await callV1(w.smeOwner, "POST", "/trade/cohorts", {
      programId,
      name: "Cohort 1 - Addis Ababa",
    });
    expect(res.status).toBe(403);
  });

  it("allows Entrust staff to create a cohort", async () => {
    const res = await callV1(w.facilitator, "POST", "/trade/cohorts", {
      programId,
      name: "Cohort 1 - Addis Ababa (Hybrid)",
      deliveryMode: "hybrid",
      country: "ET",
      language: "en",
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.deliveryMode).toBe("hybrid");
    cohortId = res.body.id;
  });

  it("allows Entrust staff to list cohorts and view cohort details", async () => {
    // A reviewer sees the cohorts they're on, and the facilitator who created this one is on it.
    const before = await callV1(w.reviewer, "GET", `/trade/cohorts?programId=${programId}`);
    expect(before.status).toBe(200);
    expect(before.body.cohorts).toEqual([]);
    expect((await callV1(w.reviewer, "GET", `/trade/cohorts/${cohortId}`)).status).toBe(404);
    expect((await callV1(w.facilitator, "GET", `/trade/cohorts/${cohortId}`)).status).toBe(200);

    // Only an administrator assigns.
    expect((await callV1(w.facilitator, "POST", `/trade/cohorts/${cohortId}/staff`, { userId: w.reviewer.id })).status).toBe(403);
    const assigned = await callV1(w.admin, "POST", `/trade/cohorts/${cohortId}/staff`, { userId: w.reviewer.id });
    expect(assigned.status).toBe(201);
    expect(assigned.body.assigned.map((a: { userId: string }) => a.userId)).toEqual(expect.arrayContaining([w.reviewer.id, w.facilitator.id]));
    expect((await callV1(w.admin, "POST", `/trade/cohorts/${cohortId}/staff`, { userId: w.smeOwner.id })).status).toBe(422);

    const listRes = await callV1(w.reviewer, "GET", `/trade/cohorts?programId=${programId}`);
    expect(listRes.body.cohorts.length).toBeGreaterThanOrEqual(1);
    expect((await callV1(w.reviewer, "GET", `/trade/cohorts/${cohortId}`)).status).toBe(200);

    const removed = await callV1(w.admin, "DELETE", `/trade/cohorts/${cohortId}/staff/${w.reviewer.id}`);
    expect(removed.status).toBe(200);
    expect((await callV1(w.reviewer, "GET", `/trade/cohorts/${cohortId}`)).status).toBe(404);

    const getRes = await callV1(w.admin, "GET", `/trade/cohorts/${cohortId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(cohortId);
    expect(getRes.body.enrolments).toBeDefined();
  });
});

describe("TRADE Enrolment API", () => {
  let programId: string;
  let cohort1Id: string;
  let cohort2Id: string;
  let enrollment1Id: string;

  beforeAll(async () => {
    const prog = await callV1(w.admin, "POST", "/trade/programs", {
      name: `Enrolment Program ${randomUUID().slice(0, 6)}`,
    });
    programId = prog.body.id;

    const c1 = await callV1(w.admin, "POST", "/trade/cohorts", {
      programId,
      name: "Cohort Alpha",
      deliveryMode: "self_paced",
    });
    cohort1Id = c1.body.id;

    const c2 = await callV1(w.admin, "POST", "/trade/cohorts", {
      programId,
      name: "Cohort Beta",
      deliveryMode: "live",
    });
    cohort2Id = c2.body.id;
    for (const id of [cohort1Id, cohort2Id]) {
      await callV1(w.admin, "POST", `/trade/cohorts/${id}/staff`, { userId: w.facilitator.id });
    }
  });

  it("enrolling an SME that already uses CLEAR keeps organisation and SME ID, and grants trade access", async () => {
    // 1. Verify before enrolment: SME only has clear platform access
    const [accessBefore] = await db
      .select()
      .from(schema.platformAccess)
      .where(
        and(
          eq(schema.platformAccess.organizationId, w.smeOrgId),
          eq(schema.platformAccess.platform, "trade"),
        ),
      );
    expect(accessBefore).toBeUndefined();

    // 2. Staff enrols the SME into Cohort 1
    const enrolRes = await callV1(w.facilitator, "POST", "/trade/enrollments", {
      cohortId: cohort1Id,
      organizationId: w.smeOrgId,
    });

    expect(enrolRes.status).toBe(201);
    expect(enrolRes.body.id).toBeDefined();
    expect(enrolRes.body.cohortId).toBe(cohort1Id);
    expect(enrolRes.body.organizationId).toBe(w.smeOrgId);
    expect(enrolRes.body.status).toBe("registered"); // Organisation already has accepted owner
    enrollment1Id = enrolRes.body.id;

    // 3. Verify organisation now has trade platform access, and clear platform access is unchanged
    const grants = await db
      .select({ platform: schema.platformAccess.platform })
      .from(schema.platformAccess)
      .where(eq(schema.platformAccess.organizationId, w.smeOrgId));
    const platforms = grants.map((g) => g.platform);
    expect(platforms).toContain("clear");
    expect(platforms).toContain("trade");

    // 4. Verify audit log was written
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, enrollment1Id),
          eq(schema.auditLog.action, "trade.enrolled"),
        ),
      );
    expect(audit).toBeDefined();
    expect((audit?.after as any)?.smeId).toBe(w.smeId);
  });

  it("an SME enrolled in two cohorts has two enrolments and one SME ID (pilot criterion 2)", async () => {
    // Enrol into Cohort Beta
    const enrol2Res = await callV1(w.admin, "POST", "/trade/enrollments", {
      cohortId: cohort2Id,
      organizationId: w.smeOrgId,
    });
    expect(enrol2Res.status).toBe(201);
    expect(enrol2Res.body.id).not.toBe(enrollment1Id);

    // Query enrolments for this organisation
    const listRes = await callV1(w.smeOwner, "GET", `/trade/enrollments?organizationId=${w.smeOrgId}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.enrollments.length).toBe(2);

    // Both enrolments share the exact same SME ID
    for (const enr of listRes.body.enrollments) {
      expect(enr.smeId).toBe(w.smeId);
      expect(enr.organizationId).toBe(w.smeOrgId);
    }
  });

  it("refuses enrolling the same SME in the same cohort twice with 409 conflict", async () => {
    const dupRes = await callV1(w.admin, "POST", "/trade/enrollments", {
      cohortId: cohort1Id,
      organizationId: w.smeOrgId,
    });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error).toContain("already enrolled in this cohort");
  });

  it("allows staff to pause an enrolment with a reason", async () => {
    const pauseRes = await callV1(w.facilitator, "PATCH", `/trade/enrollments/${enrollment1Id}/status`, {
      status: "paused",
      reason: "Owner requested temporary deferral for seasonal harvest.",
    });

    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.status).toBe("paused");

    // Verify audit log
    const audits = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityId, enrollment1Id),
          eq(schema.auditLog.action, "enrollment.status_updated"),
        ),
      );
    const pauseAudit = audits.find((a) => (a.after as any)?.status === "paused");
    expect(pauseAudit).toBeDefined();
    expect(pauseAudit?.reason).toBe("Owner requested temporary deferral for seasonal harvest.");
  });

  it("refuses pausing or withdrawing without a reason with 422", async () => {
    const noReasonRes = await callV1(w.admin, "PATCH", `/trade/enrollments/${enrollment1Id}/status`, {
      status: "withdrawn",
    });
    expect(noReasonRes.status).toBe(422);
    expect(noReasonRes.body.error).toContain("A reason is required");
  });

  it("allows staff to complete an enrolment", async () => {
    const completeRes = await callV1(w.admin, "PATCH", `/trade/enrollments/${enrollment1Id}/status`, {
      status: "completed",
    });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.status).toBe("completed");

    const [enrRow] = await db
      .select()
      .from(schema.enrollment)
      .where(eq(schema.enrollment.id, enrollment1Id));
    expect(enrRow?.completedAt).toBeDefined();
  });
});

describe("Owner invitations by Entrust staff", () => {
  let newOrgId: string;

  beforeAll(async () => {
    const createRes = await callV1(w.admin, "POST", "/organizations", {
      name: `Staff Created Org ${randomUUID().slice(0, 6)}`,
      slug: `staff-org-${randomUUID().slice(0, 8)}`,
      legalName: `Staff Created Org ${randomUUID().slice(0, 6)} PLC`,
      country: "ET",
    });
    newOrgId = createRes.body.id;
  });

  it("allows Entrust staff to send an owner invitation", async () => {
    const inviteRes = await callV1(w.admin, "POST", `/organizations/${newOrgId}/invitations`, {
      email: `invited-owner-${randomUUID().slice(0, 6)}@example.test`,
      role: "owner",
      platform: "trade",
    });
    expect(inviteRes.status).toBe(201);
  });

  it("refuses owner invitation when attempted by standard member", async () => {
    const nonStaffRes = await callV1(w.smeOwner, "POST", `/organizations/${w.smeOrgId}/invitations`, {
      email: `invited-member-${randomUUID().slice(0, 6)}@example.test`,
      role: "owner",
    });
    expect(nonStaffRes.status).toBe(422);
    expect(nonStaffRes.body.error).toContain("Only Entrust staff can invite organisation owners");
  });
});

describe("Businesses waiting to be enrolled", () => {
  let cohortId: string;
  let waitingOrgId: string;
  let sponsorOrgId: string;

  beforeAll(async () => {
    const prog = await callV1(w.admin, "POST", "/trade/programs", { name: `Waiting Program ${randomUUID().slice(0, 6)}` });
    const cohort = await callV1(w.admin, "POST", "/trade/cohorts", { programId: prog.body.id, name: `Waiting Cohort ${randomUUID().slice(0, 6)}` });
    cohortId = cohort.body.id;

    const created = await callV1(w.otherSmeOwner, "POST", "/organizations", {
      name: `Waiting Traders ${randomUUID().slice(0, 6)}`,
      slug: `waiting-${randomUUID().slice(0, 8)}`,
      legalName: `Waiting Traders ${randomUUID().slice(0, 6)} Share Company`,
      country: "ET",
      platform: "trade",
    });
    expect(created.status).toBe(201);
    waitingOrgId = created.body.id;

    const sponsor = await callV1(w.admin, "POST", "/organizations", {
      name: `Waiting Sponsor ${randomUUID().slice(0, 6)}`,
      slug: `waiting-sponsor-${randomUUID().slice(0, 8)}`,
      legalName: `Waiting Sponsor ${randomUUID().slice(0, 6)} Bank`,
      country: "ET",
      platform: "trade",
      kind: "sponsor",
    });
    expect(sponsor.status).toBe(201);
    sponsorOrgId = sponsor.body.id;
  });

  it("lists a business that signed up to TRADE and is in no cohort, with its owner's email", async () => {
    const res = await callV1(w.facilitator, "GET", "/trade/enrollments/waiting");
    expect(res.status).toBe(200);
    const row = res.body.smes.find((s: { organizationId: string }) => s.organizationId === waitingOrgId);
    expect(row).toBeDefined();
    const [owner] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, w.otherSmeOwner.id));
    expect(row.ownerEmail).toBe(owner!.email);
    expect(row.smeId).toMatch(/^ET-SME-/);
  });

  it("leaves out sponsors", async () => {
    const res = await callV1(w.admin, "GET", "/trade/enrollments/waiting");
    expect(res.body.smes.some((s: { organizationId: string }) => s.organizationId === sponsorOrgId)).toBe(false);
  });

  it("is for staff only", async () => {
    const res = await callV1(w.otherSmeOwner, "GET", "/trade/enrollments/waiting");
    expect(res.status).toBe(403);
  });

  it("refuses to enrol a sponsor", async () => {
    const res = await callV1(w.admin, "POST", "/trade/enrollments", { cohortId, organizationId: sponsorOrgId });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Only an SME can be enrolled");
  });

  it("drops a business from the list once it is enrolled", async () => {
    const enrol = await callV1(w.admin, "POST", "/trade/enrollments", { cohortId, organizationId: waitingOrgId });
    expect(enrol.status).toBe(201);
    expect(enrol.body.status).toBe("registered");
    const res = await callV1(w.admin, "GET", "/trade/enrollments/waiting");
    expect(res.body.smes.some((s: { organizationId: string }) => s.organizationId === waitingOrgId)).toBe(false);
  });
});
