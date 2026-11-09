import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
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
  smeLearner: TestUser;
  otherSme: TestUser;
  outsider: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  otherOrgId: string;
  enrollmentId: string;
  otherEnrollmentId: string;
  planId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, facilitator, smeLearner, otherSme, outsider] = await Promise.all([
    signUp("tr-prog-admin"),
    signUp("tr-prog-facil"),
    signUp("tr-prog-learner"),
    signUp("tr-prog-othersme"),
    signUp("tr-prog-outsider"),
  ]);
  Object.assign(w, { admin, facilitator, smeLearner, otherSme, outsider });

  // 1. Entrust org
  w.entrustOrgId = await createOrganization(
    "entrust-staff-prog",
    [
      [admin!, "admin"],
      [facilitator!, "facilitator"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. SME org
  w.smeOrgId = await createOrganization(
    `learner-sme-${randomUUID().slice(0, 8)}`,
    [[smeLearner!, "owner"]],
    { platform: "trade" },
  );

  w.otherOrgId = await createOrganization(
    `other-sme-${randomUUID().slice(0, 8)}`,
    [[otherSme!, "owner"]],
    { platform: "trade" },
  );

  // 3. Program & Cohort
  const [prog] = await db
    .insert(schema.program)
    .values({
      name: "Learner Progress Program",
      description: "Program for module progress testing",
    })
    .returning();

  const [cohort] = await db
    .insert(schema.cohort)
    .values({
      programId: prog!.id,
      name: "Learner Progress Cohort",
    })
    .returning();
  await db.insert(schema.cohortStaff).values([facilitator!].map((staff) => ({ cohortId: cohort!.id, userId: staff.id })));

  // 4. Enrollments
  const [enr1] = await db
    .insert(schema.enrollment)
    .values({
      organizationId: w.smeOrgId,
      cohortId: cohort!.id,
      status: "active",
    })
    .returning();
  w.enrollmentId = enr1!.id;

  const [enr2] = await db
    .insert(schema.enrollment)
    .values({
      organizationId: w.otherOrgId,
      cohortId: cohort!.id,
      status: "active",
    })
    .returning();
  w.otherEnrollmentId = enr2!.id;

  // 5. Active learning plan with assigned modules M01 and M02
  const [plan] = await db
    .insert(schema.learningPlan)
    .values({
      enrollmentId: w.enrollmentId,
      rulesVersion: "2026.1",
      pathway: "A",
      status: "active",
      requiresHumanReview: false,
    })
    .returning();
  w.planId = plan!.id;

  await db.insert(schema.moduleAssignment).values([
    {
      planId: plan!.id,
      moduleId: "M01",
      status: "required",
      sequence: 1,
      reasonCodes: ["pathway_prescribed"],
      source: "engine",
    },
    {
      planId: plan!.id,
      moduleId: "M02",
      status: "required",
      sequence: 2,
      reasonCodes: ["pathway_prescribed"],
      source: "engine",
    },
  ]);
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE learner module progress & save-and-resume", () => {
  it("rejects unauthenticated requests", async () => {
    const listRes = await callV1(null, "GET", `/trade/module-progress?enrollmentId=${w.enrollmentId}`);
    expect(listRes.status).toBe(401);

    const postRes = await callV1(null, "POST", "/trade/module-progress", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      lessonId: "lesson-1",
      completed: true,
    });
    expect(postRes.status).toBe(401);
  });

  it("blocks SME from accessing another organization's progress", async () => {
    const res = await callV1(w.smeLearner, "GET", `/trade/module-progress?enrollmentId=${w.otherEnrollmentId}`);
    expect(res.status).toBe(403);
  });

  it("allows staff to view any learner's progress (read-only)", async () => {
    const res = await callV1(w.facilitator, "GET", `/trade/module-progress?enrollmentId=${w.enrollmentId}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("prevents staff from recording or mutating learner progress (staff read-only)", async () => {
    const res = await callV1(w.facilitator, "POST", "/trade/module-progress", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      lessonId: "lesson-1",
      completed: true,
    });
    expect(res.status).toBe(403);
  });

  it("records lesson completion and auto-advances status to in_progress", async () => {
    const res = await callV1(w.smeLearner, "POST", "/trade/module-progress", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      lessonId: "lesson-1",
      completed: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.moduleId).toBe("M01");
    expect(res.body.status).toBe("in_progress");
    expect(res.body.startedAt).not.toBeNull();
    expect(res.body.lessonProgress).toMatchObject({
      lastLessonId: "lesson-1",
      completedLessons: ["lesson-1"],
    });
  });

  it("saves progress across sessions (survives switching device / sign out)", async () => {
    // Record another lesson
    const res1 = await callV1(w.smeLearner, "POST", "/trade/module-progress", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      lessonId: "lesson-2",
      completed: true,
    });
    expect(res1.status).toBe(200);
    expect(res1.body.lessonProgress).toMatchObject({
      lastLessonId: "lesson-2",
      completedLessons: ["lesson-1", "lesson-2"],
    });

    // Query progress later
    const queryRes = await callV1(w.smeLearner, "GET", `/trade/module-progress?enrollmentId=${w.enrollmentId}&moduleId=M01`);
    expect(queryRes.status).toBe(200);
    expect(queryRes.body.items).toHaveLength(1);
    const item = queryRes.body.items[0];
    expect(item.status).toBe("in_progress");
    expect(item.lessonProgress.lastLessonId).toBe("lesson-2");
    expect(item.lessonProgress.completedLessons).toEqual(["lesson-1", "lesson-2"]);
  });

  it("takes saves that arrive together, on a first save, without losing any", async () => {
    const saves = await Promise.all(
      ["a", "b", "c", "d"].map((lessonId) => callV1(w.smeLearner, "POST", "/trade/module-progress", { enrollmentId: w.enrollmentId, moduleId: "M04", lessonId, completed: true })),
    );
    expect(saves.map((s) => s.status)).toEqual([200, 200, 200, 200]);
    const after = await callV1(w.smeLearner, "GET", `/trade/module-progress?enrollmentId=${w.enrollmentId}&moduleId=M04`);
    expect(after.body.items).toHaveLength(1);
    expect([...after.body.items[0].lessonProgress.completedLessons].sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("won't let a learner give a module a result", async () => {
    for (const status of ["passed", "exempted", "needs_revision"]) {
      const res = await callV1(w.smeLearner, "POST", "/trade/module-progress", { enrollmentId: w.enrollmentId, moduleId: "M01", status });
      expect(res.status, status).toBe(403);
    }
    const after = await callV1(w.smeLearner, "GET", `/trade/module-progress?enrollmentId=${w.enrollmentId}&moduleId=M01`);
    expect(after.body.items[0].status).toBe("in_progress");
  });

  it("won't let a learner's request change a result the module already has", async () => {
    await db
      .insert(schema.moduleProgress)
      .values({ enrollmentId: w.enrollmentId, moduleId: "M02", contentVersion: "0.1.0", status: "passed", lessonProgress: {} });
    const res = await callV1(w.smeLearner, "POST", "/trade/module-progress", { enrollmentId: w.enrollmentId, moduleId: "M02", status: "in_progress" });
    expect(res.status).toBe(409);
    // Opening a lesson of a passed module still works and leaves the result alone.
    const lesson = await callV1(w.smeLearner, "POST", "/trade/module-progress", { enrollmentId: w.enrollmentId, moduleId: "M02", lessonId: "lesson-1" });
    expect(lesson.status).toBe(200);
    expect(lesson.body.status).toBe("passed");
  });

  it("refuses submission of a module outside the learner's active plan", async () => {
    // M05 is NOT in the active learning plan assignments (plan only has M01, M02)
    const res = await callV1(w.smeLearner, "POST", "/trade/module-progress", {
      enrollmentId: w.enrollmentId,
      moduleId: "M05",
      status: "submitted",
    });

    expect(res.status).toBe(422);
    expect(res.body.message || res.body.detail || res.body.error).toMatch(/module outside the plan cannot be submitted/i);
  });

  it("allows submission of an assigned module in the active plan", async () => {
    const res = await callV1(w.smeLearner, "POST", "/trade/module-progress", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      status: "submitted",
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("submitted");
    expect(res.body.completedAt).not.toBeNull();
  });
});
