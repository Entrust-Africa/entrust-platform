import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
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
  reviewer1: TestUser;
  reviewer2: TestUser;
  reviewer3: TestUser;
  smeLearner: TestUser;
  otherSme: TestUser;
  outsider: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  otherOrgId: string;
  cohortId: string;
  enrollmentId: string;
  otherEnrollmentId: string;
  planId: string;
  worksheetVersionId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, reviewer1, reviewer2, reviewer3, smeLearner, otherSme, outsider] = await Promise.all([
    signUp("tr-score-admin"),
    signUp("tr-score-rev1"),
    signUp("tr-score-rev2"),
    signUp("tr-score-rev3"),
    signUp("tr-score-learner"),
    signUp("tr-score-othersme"),
    signUp("tr-score-outsider"),
  ]);
  Object.assign(w, { admin, reviewer1, reviewer2, reviewer3, smeLearner, otherSme, outsider });

  // 1. Entrust org with admin and reviewers
  w.entrustOrgId = await createOrganization(
    "entrust-staff-scoring",
    [
      [admin!, "admin"],
      [reviewer1!, "reviewer"],
      [reviewer2!, "reviewer"],
      [reviewer3!, "reviewer"],
    ],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. SME orgs
  w.smeOrgId = await createOrganization(
    `scoring-sme-${randomUUID().slice(0, 8)}`,
    [[smeLearner!, "owner"]],
    { platform: "trade" },
  );

  w.otherOrgId = await createOrganization(
    `scoring-other-sme-${randomUUID().slice(0, 8)}`,
    [[otherSme!, "owner"]],
    { platform: "trade" },
  );

  // 3. Program & Cohort
  const [prog] = await db
    .insert(schema.program)
    .values({
      name: "Assessor Scoring Program",
      description: "Testing rubric scoring and review queue",
    })
    .returning();

  const [cohort] = await db
    .insert(schema.cohort)
    .values({
      programId: prog!.id,
      name: "Assessor Scoring Cohort 2026",
      deliveryMode: "hybrid",
    })
    .returning();
  w.cohortId = cohort!.id;
  await db.insert(schema.cohortStaff).values([reviewer1!, reviewer2!].map((staff) => ({ cohortId: cohort!.id, userId: staff.id })));

  // 4. Enrollments
  const [enr1] = await db
    .insert(schema.enrollment)
    .values({
      cohortId: cohort!.id,
      organizationId: w.smeOrgId,
      status: "active",
    })
    .returning();
  w.enrollmentId = enr1!.id;

  const [enr2] = await db
    .insert(schema.enrollment)
    .values({
      cohortId: cohort!.id,
      organizationId: w.otherOrgId,
      status: "active",
    })
    .returning();
  w.otherEnrollmentId = enr2!.id;

  // 5. Learning Plan assigning M01
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

  await db.insert(schema.moduleAssignment).values({
    planId: plan!.id,
    moduleId: "M01",
    status: "required",
    sequence: 1,
    reasonCodes: ["pathway_prescribed"],
    source: "engine",
  });

  // 6. Worksheet Version for M01
  const [ws] = await db
    .insert(schema.worksheetVersion)
    .values({
      enrollmentId: w.enrollmentId,
      worksheetId: "export-brief",
      moduleId: "M01",
      version: 1,
      status: "submitted",
      values: { targetMarket: "Kenya", product: "Apparel", value: 50000 },
      result: { totalValue: 50000 },
      confidence: "self_reported",
      submittedByUserId: smeLearner!.id,
      submittedAt: new Date(),
    })
    .returning();
  w.worksheetVersionId = ws!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE Submissions & Rubric Scoring (#67)", () => {
  it("rejects submission if theory knowledge check is not yet passed", async () => {
    // Progress exists but theoryCompletedAt is null
    await db.insert(schema.moduleProgress).values({
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      contentVersion: "0.1.0",
      status: "in_progress",
      lessonProgress: {},
    });

    const res = await callV1(
      w.smeLearner,
      "POST",
      "/trade/module-submissions",
      {
        enrollmentId: w.enrollmentId,
        moduleId: "M01",
        worksheetVersionId: w.worksheetVersionId,
      },
    );

    expect(res.status).toBe(422);
    expect(res.body.error).toContain("knowledge check must be passed");
  });

  it("refuses evidence that isn't this business's own on a submission", async () => {
    await db
      .update(schema.moduleProgress)
      .set({ theoryCompletedAt: new Date() })
      .where(and(eq(schema.moduleProgress.enrollmentId, w.enrollmentId), eq(schema.moduleProgress.moduleId, "M01")));
    const res = await callV1(w.smeLearner, "POST", "/trade/module-submissions", {
      enrollmentId: w.enrollmentId,
      moduleId: "M01",
      evidenceRecordIds: [randomUUID()],
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toContain("Evidence");
  });

  it("submits practical deliverable once theory is completed", async () => {
    // Complete theory
    await db
      .update(schema.moduleProgress)
      .set({
        theoryCompletedAt: new Date(),
        knowledgeCheckScore: "100.00",
      })
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01"),
        ),
      );

    const res = await callV1(
      w.smeLearner,
      "POST",
      "/trade/module-submissions",
      {
        enrollmentId: w.enrollmentId,
        moduleId: "M01",
        worksheetVersionId: w.worksheetVersionId,
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.moduleId).toBe("M01");
    expect(res.body.version).toBe(1);
    expect(res.body.status).toBe("submitted");
    expect(res.body.worksheetSnapshot).toBeDefined();
    expect(res.body.worksheetSnapshot.id).toBe(w.worksheetVersionId);

    // Verify module progress moved to submitted
    const [progress] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01"),
        ),
      );
    expect(progress!.status).toBe("submitted");
  });

  it("lists submissions in assessor queue sorted by waiting time", async () => {
    const queueRes = await callV1(
      w.reviewer1,
      "GET",
      `/trade/module-submissions?status=submitted&cohortId=${w.cohortId}`,
    );

    expect(queueRes.status).toBe(200);
    expect(queueRes.body.items).toHaveLength(1);
    expect(queueRes.body.items[0].moduleId).toBe("M01");
    expect(queueRes.body.items[0].status).toBe("submitted");
    expect(typeof queueRes.body.items[0].waitingTimeHours).toBe("number");

    // SME only sees own organization's submissions
    const smeRes = await callV1(
      w.otherSme,
      "GET",
      `/trade/module-submissions`,
    );
    expect(smeRes.status).toBe(200);
    expect(smeRes.body.items).toHaveLength(0);
  });

  let submissionId: string;

  it("scores submission failing on confirmed critical failure despite high points", async () => {
    const [sub] = await db
      .select({ id: schema.moduleSubmission.id })
      .from(schema.moduleSubmission)
      .where(
        and(
          eq(schema.moduleSubmission.enrollmentId, w.enrollmentId),
          eq(schema.moduleSubmission.moduleId, "M01"),
        ),
      )
      .limit(1);
    submissionId = sub!.id;

    // Assessor 1 scores: 4 on all criteria (12/12 points), but confirms critical failure "no-export-license"
    const scoreRes = await callV1(
      w.reviewer1,
      "POST",
      `/trade/module-submissions/${submissionId}/score`,
      {
        scores: {
          market: { points: 4, comment: "Excellent target market research" },
          buyer: { points: 4, comment: "Strong buyer profile" },
          compliance: { points: 4, comment: "Complete checklist" },
        },
        confirmedCriticalFailures: ["no-export-license"],
        feedback: "Deliverable is thorough but missing mandatory export trade license.",
      },
    );

    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body.totalPoints).toBe(12);
    expect(scoreRes.body.maxPoints).toBe(12);
    expect(scoreRes.body.percentage).toBe(100);
    expect(scoreRes.body.passed).toBe(false);
    expect(scoreRes.body.outcome).toBe("revision_required");
    expect(scoreRes.body.isFirstScore).toBe(true);
    expect(scoreRes.body.confirmedCriticalFailures).toEqual(["no-export-license"]);

    // Verify submission status moved to revision_required
    const [updatedSub] = await db
      .select()
      .from(schema.moduleSubmission)
      .where(eq(schema.moduleSubmission.id, submissionId));
    expect(updatedSub!.status).toBe("revision_required");

    // Verify progress moved to needs_revision
    const [progress] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01"),
        ),
      );
    expect(progress!.status).toBe("needs_revision");
    expect(progress!.completedAt).toBeNull();
  });

  it("allows a second assessor to blind-score for inter-rater reliability, keeping first score official", async () => {
    // Reviewer 2 scores the same submission without seeing Reviewer 1's score
    const scoreRes = await callV1(
      w.reviewer2,
      "POST",
      `/trade/module-submissions/${submissionId}/score`,
      {
        scores: {
          market: { points: 3 },
          buyer: { points: 3 },
          compliance: { points: 3 },
        },
        confirmedCriticalFailures: [],
        feedback: "Good work overall.",
      },
    );

    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body.isFirstScore).toBe(false);
    expect(scoreRes.body.totalPoints).toBe(9);
    expect(scoreRes.body.passed).toBe(true);

    // Submission and progress remain based on official first score (revision_required)
    const [sub] = await db
      .select()
      .from(schema.moduleSubmission)
      .where(eq(schema.moduleSubmission.id, submissionId));
    expect(sub!.status).toBe("revision_required");

    // SME user viewing scores sees ONLY the official score (isFirstScore: true)
    const smeScoresRes = await callV1(
      w.smeLearner,
      "GET",
      `/trade/module-submissions/${submissionId}/scores`,
    );
    expect(smeScoresRes.status).toBe(200);
    expect(smeScoresRes.body.items).toHaveLength(1);
    expect(smeScoresRes.body.items[0].isFirstScore).toBe(true);
    expect(smeScoresRes.body.items[0].assessorUserId).toBe(w.reviewer1.id);

    // Staff assessor viewing scores sees BOTH scores
    const staffScoresRes = await callV1(
      w.admin,
      "GET",
      `/trade/module-submissions/${submissionId}/scores`,
    );
    expect(staffScoresRes.status).toBe(200);
    expect(staffScoresRes.body.items).toHaveLength(2);
  });

  it("allows an admin to override the official score with a reason and records audit log", async () => {
    // Non-admin reviewer cannot override
    const forbiddenRes = await callV1(
      w.reviewer1,
      "PATCH",
      `/trade/module-submissions/${submissionId}/score`,
      {
        confirmedCriticalFailures: [],
        overrideReason: "License verified manually by admin",
      },
    );
    expect(forbiddenRes.status).toBe(403);

    // Admin overrides by dismissing the critical failure
    const overrideRes = await callV1(
      w.admin,
      "PATCH",
      `/trade/module-submissions/${submissionId}/score`,
      {
        confirmedCriticalFailures: [],
        overrideReason: "Ministry registration document verified off-platform; critical failure dismissed.",
      },
    );

    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.passed).toBe(true);
    expect(overrideRes.body.outcome).toBe("passed");
    expect(overrideRes.body.confirmedCriticalFailures).toEqual([]);
    expect(overrideRes.body.overriddenByUserId).toBe(w.admin.id);
    expect(overrideRes.body.overrideReason).toContain("Ministry registration document verified");

    // Module submission and progress are updated to passed
    const [sub] = await db
      .select()
      .from(schema.moduleSubmission)
      .where(eq(schema.moduleSubmission.id, submissionId));
    expect(sub!.status).toBe("passed");

    const [progress] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01"),
        ),
      );
    // The practical passes, but this module's lessons aren't done, so the module isn't passed yet.
    expect(progress!.status).toBe("in_progress");
    expect(progress!.completedAt).toBeNull();

    // Verify audit log
    const [log] = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.action, "trade.rubric_assessment.overridden"),
          eq(schema.auditLog.entityId, overrideRes.body.id),
        ),
      )
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(1);

    expect(log).toBeDefined();
    expect(log!.actorUserId).toBe(w.admin.id);
    // The reason has its own column, and the change shows what the failures and marks were before and after.
    expect(log!.reason).toBeTruthy();
    expect(log!.before).toHaveProperty("confirmedCriticalFailures");
    expect(log!.before).toHaveProperty("scores");
    expect(log!.after).toHaveProperty("confirmedCriticalFailures");
  });

  it("keeps a reviewer who isn't on the cohort out, until an administrator adds them", async () => {
    const [sub] = await db.select().from(schema.moduleSubmission).where(eq(schema.moduleSubmission.enrollmentId, w.enrollmentId)).limit(1);
    const scores = { any: { points: 1 } };
    const queue = () => callV1(w.reviewer3, "GET", `/trade/module-submissions?enrollmentId=${w.enrollmentId}`);

    expect((await queue()).body.items).toEqual([]);
    expect((await callV1(w.reviewer3, "GET", `/trade/module-submissions/${sub!.id}`)).status).toBe(404);
    expect((await callV1(w.reviewer3, "POST", `/trade/module-submissions/${sub!.id}/score`, { scores, feedback: "x" })).status).toBe(404);
    expect((await callV1(w.reviewer3, "GET", `/trade/reports/cohorts/${w.cohortId}`)).status).toBe(404);
    expect((await callV1(w.reviewer3, "GET", `/trade/worksheets?enrollmentId=${w.enrollmentId}`)).status).toBe(404);
    expect((await callV1(w.reviewer3, "GET", "/trade/assessments")).body.items).toEqual([]);

    expect((await callV1(w.admin, "POST", `/trade/cohorts/${w.cohortId}/staff`, { userId: w.reviewer3.id })).status).toBe(201);
    expect((await queue()).body.items.map((i: { id: string }) => i.id)).toContain(sub!.id);
    expect((await callV1(w.reviewer3, "GET", `/trade/module-submissions/${sub!.id}`)).status).toBe(200);
    expect((await callV1(w.reviewer3, "GET", `/trade/worksheets?enrollmentId=${w.enrollmentId}`)).status).toBe(200);

    // The change is on the record, and an administrator still reaches everything.
    const [log] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, "trade.cohort_staff.assigned"), eq(schema.auditLog.entityId, w.cohortId)));
    expect(log?.actorUserId).toBe(w.admin.id);

    expect((await callV1(w.admin, "DELETE", `/trade/cohorts/${w.cohortId}/staff/${w.reviewer3.id}`)).status).toBe(200);
    expect((await queue()).body.items).toEqual([]);
    expect((await callV1(w.admin, "GET", `/trade/module-submissions/${sub!.id}`)).status).toBe(200);
  });
});
