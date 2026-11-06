import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema, type AttendanceStatus } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
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
  outsider: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  smeId: string;
  enrollmentId: string;
  cohortId: string;
  programId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, reviewer, smeOwner, smeMember, outsider] = await Promise.all([
    signUp("tr-ses-admin"),
    signUp("tr-ses-facil"),
    signUp("tr-ses-rev"),
    signUp("tr-ses-owner"),
    signUp("tr-ses-member"),
    signUp("tr-ses-outsider"),
  ]);
  Object.assign(w, { admin, facilitator, reviewer, smeOwner, smeMember, outsider });

  // 1. Setup Entrust organisation with staff roles
  w.entrustOrgId = await createOrganization(
    "entrust-staff-sessions",
    [
      [admin!, "admin"],
      [facilitator!, "facilitator"],
      [reviewer!, "reviewer"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. Setup SME organisation with owner & member
  const smeRes = await callV1(w.smeOwner, "POST", "/organizations", {
    name: `Live Session Agro ${randomUUID().slice(0, 6)}`,
    slug: `live-agro-${randomUUID().slice(0, 8)}`,
    legalName: `Live Session Agro ${randomUUID().slice(0, 6)} PLC`,
    country: "ET",
    platform: "trade",
  });
  expect(smeRes.status).toBe(201);
  w.smeOrgId = smeRes.body.id;
  w.smeId = smeRes.body.smeId;

  // Add SME member
  await db.insert(schema.member).values({
    id: randomUUID(),
    organizationId: w.smeOrgId,
    userId: w.smeMember.id,
    role: "member",
    createdAt: new Date(),
  });

  // 3. Setup program & cohort
  const progRes = await callV1(w.facilitator, "POST", "/trade/programs", {
    name: "Zemen Bank Export Readiness Program",
    description: "Hybrid track mixing online modules with live workshops.",
  });
  expect(progRes.status).toBe(201);
  w.programId = progRes.body.id;

  const cohRes = await callV1(w.facilitator, "POST", "/trade/cohorts", {
    programId: w.programId,
    name: "Cohort 2026-Live",
    deliveryMode: "hybrid",
    country: "ET",
  });
  expect(cohRes.status).toBe(201);
  w.cohortId = cohRes.body.id;

  // 4. Enrol SME in cohort
  const enrRes = await callV1(w.facilitator, "POST", "/trade/enrollments", {
    cohortId: w.cohortId,
    organizationId: w.smeOrgId,
  });
  expect(enrRes.status).toBe(201);
  w.enrollmentId = enrRes.body.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE: live sessions and attendance (#73)", () => {
  let sessionId: string;

  describe("Session creation and visibility", () => {
    it("refuses session creation for non-staff with 403", async () => {
      const res = await callV1(w.smeOwner, "POST", `/trade/cohorts/${w.cohortId}/sessions`, {
        title: "Workshop 1: Value Proposition",
        startTime: new Date(Date.now() + 86400000).toISOString(),
        endTime: new Date(Date.now() + 90000000).toISOString(),
      });
      expect(res.status).toBe(403);
    });

    it("allows Entrust facilitator to create a session with module codes and materials", async () => {
      const startTime = new Date(Date.now() + 86400000).toISOString();
      const endTime = new Date(Date.now() + 90000000).toISOString();

      const res = await callV1(w.facilitator, "POST", `/trade/cohorts/${w.cohortId}/sessions`, {
        title: "Workshop 1: Export Execution Foundations",
        description: "Hands-on workshop covering M01 export diagnostics and M02 market research.",
        moduleCodes: ["M01", "M02"],
        facilitatorUserId: w.facilitator.id,
        startTime,
        endTime,
        venue: "https://meet.google.com/abc-defg-hij",
        learnerMaterials: [{ title: "Participant Slides", url: "https://cdn.example.com/slides.pdf" }],
        facilitatorMaterials: [{ title: "Facilitator Preparation Notes", url: "https://cdn.example.com/facil-notes.pdf" }],
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe("Workshop 1: Export Execution Foundations");
      expect(res.body.cohortId).toBe(w.cohortId);
      expect(res.body.moduleCodes).toEqual(["M01", "M02"]);
      sessionId = res.body.id;
    });

    it("withholds facilitator materials from enrolled SME learners", async () => {
      // SME learner accesses session details
      const resSme = await callV1(w.smeMember, "GET", `/trade/sessions/${sessionId}`);
      expect(resSme.status).toBe(200);
      expect(resSme.body.learnerMaterials).toHaveLength(1);
      expect(resSme.body.facilitatorMaterials).toEqual([]); // Protected: omitted for SME learners!

      // Staff accesses session details
      const resStaff = await callV1(w.facilitator, "GET", `/trade/sessions/${sessionId}`);
      expect(resStaff.status).toBe(200);
      expect(resStaff.body.facilitatorMaterials).toHaveLength(1);
      expect(resStaff.body.facilitatorMaterials[0].title).toBe("Facilitator Preparation Notes");
    });

    it("forbids outsiders from viewing cohort sessions", async () => {
      const res = await callV1(w.outsider, "GET", `/trade/cohorts/${w.cohortId}/sessions`);
      expect(res.status).toBe(403);
    });
  });

  describe("Attendance recording and module independence", () => {
    it("records attendance for learners without altering module status", async () => {
      // Set initial module progress for M01
      await db.insert(schema.moduleProgress).values({
        enrollmentId: w.enrollmentId,
        moduleId: "M01",
        contentVersion: "1.0.0",
        status: "not_started",
      });

      // Staff records attendance: SME Owner is present, SME Member is late
      const res = await callV1(w.facilitator, "POST", `/trade/sessions/${sessionId}/attendance`, {
        records: [
          {
            userId: w.smeOwner.id,
            organizationId: w.smeOrgId,
            status: "present" as AttendanceStatus,
            notes: "Active participation in breakout",
          },
          {
            userId: w.smeMember.id,
            organizationId: w.smeOrgId,
            status: "late" as AttendanceStatus,
            notes: "Joined 20m late",
          },
        ],
      });

      expect(res.status).toBe(200);
      expect(res.body.recorded).toHaveLength(2);

      // Verify attendance stored in DB
      const attRows = await db
        .select()
        .from(schema.attendance)
        .where(eq(schema.attendance.sessionId, sessionId));
      expect(attRows).toHaveLength(2);

      // CRITICAL ACCEPTANCE CRITERION: Attendance must NOT change module status
      const [mod] = await db
        .select()
        .from(schema.moduleProgress)
        .where(
          and(
            eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
            eq(schema.moduleProgress.moduleId, "M01"),
          ),
        );
      expect(mod?.status).toBe("not_started"); // Untouched!
    });

    it("provides the facilitator preparation roster with module progress and attendance (M04 requirement)", async () => {
      const res = await callV1(w.facilitator, "GET", `/trade/sessions/${sessionId}/roster`);
      expect(res.status).toBe(200);
      expect(res.body.session.title).toBe("Workshop 1: Export Execution Foundations");
      expect(res.body.smes).toHaveLength(1);

      const sme = res.body.smes[0];
      expect(sme.organizationId).toBe(w.smeOrgId);
      expect(sme.modules.find((m: any) => m.moduleCode === "M01")).toBeDefined();

      const owner = sme.members.find((m: any) => m.userId === w.smeOwner.id);
      expect(owner?.attendance?.status).toBe("present");
    });

    it("refuses non-staff from accessing facilitator roster or recording attendance", async () => {
      const rosterRes = await callV1(w.smeOwner, "GET", `/trade/sessions/${sessionId}/roster`);
      expect(rosterRes.status).toBe(403);

      const attRes = await callV1(w.smeOwner, "POST", `/trade/sessions/${sessionId}/attendance`, {
        records: [
          {
            userId: w.smeOwner.id,
            organizationId: w.smeOrgId,
            status: "present",
          },
        ],
      });
      expect(attRes.status).toBe(403);
    });
  });

  describe("Reminder email dispatch and idempotency", () => {
    it("queues reminders and respects singletonKey idempotency", async () => {
      // First dispatch
      const res1 = await callV1(w.facilitator, "POST", `/trade/sessions/${sessionId}/reminders`);
      expect(res1.status).toBe(200);
      expect(res1.body.queued).toBeGreaterThan(0);

      // Second dispatch (running twice): pg-boss singleton key prevents redundant duplicates
      const res2 = await callV1(w.facilitator, "POST", `/trade/sessions/${sessionId}/reminders`);
      expect(res2.status).toBe(200);
    });
  });
});
