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
  smeLearner: TestUser;
  otherSme: TestUser;
  outsider: TestUser;
  entrustOrgId: string;
  smeOrgId: string;
  otherOrgId: string;
  cohortId: string;
  enrollmentId: string;
  otherEnrollmentId: string;
};

beforeAll(async () => {
  await cleanup();
  const [admin, smeLearner, otherSme, outsider] = await Promise.all([
    signUp("tr-kc-admin"),
    signUp("tr-kc-learner"),
    signUp("tr-kc-othersme"),
    signUp("tr-kc-outsider"),
  ]);
  Object.assign(w, { admin, smeLearner, otherSme, outsider });

  // 1. Entrust org
  w.entrustOrgId = await createOrganization(
    "entrust-staff-kc",
    [[admin!, "admin"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrustOrgId;

  // 2. SME orgs
  w.smeOrgId = await createOrganization(
    `kc-sme-${randomUUID().slice(0, 8)}`,
    [[smeLearner!, "owner"]],
    { platform: "trade" },
  );

  w.otherOrgId = await createOrganization(
    `kc-other-sme-${randomUUID().slice(0, 8)}`,
    [[otherSme!, "owner"]],
    { platform: "trade" },
  );

  // 3. Program & Cohort
  const [prog] = await db
    .insert(schema.program)
    .values({
      name: "Knowledge Checks Program",
      description: "Program for KC testing",
    })
    .returning();

  const [cohort] = await db
    .insert(schema.cohort)
    .values({
      programId: prog!.id,
      name: "KC Cohort 2026",
      deliveryMode: "hybrid",
    })
    .returning();
  w.cohortId = cohort!.id;

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
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("TRADE Knowledge Checks API (#63)", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await callV1(
      null,
      "POST",
      "/trade/modules/M01/knowledge-check/attempts",
      { enrollmentId: w.enrollmentId, answers: {} },
    );
    expect(res.status).toBe(401);

    const listRes = await callV1(
      null,
      "GET",
      `/trade/modules/M01/knowledge-check/attempts?enrollmentId=${w.enrollmentId}`,
    );
    expect(listRes.status).toBe(401);
  });

  it("forbids an SME from submitting attempts for another SME's enrollment", async () => {
    const res = await callV1(
      w.otherSme,
      "POST",
      "/trade/modules/M01/knowledge-check/attempts",
      {
        enrollmentId: w.enrollmentId,
        answers: { q1: ["b"] },
      },
    );
    expect(res.status).toBe(403);
  });

  it("forbids staff from submitting attempts (staff view is read-only)", async () => {
    const res = await callV1(
      w.admin,
      "POST",
      "/trade/modules/M01/knowledge-check/attempts",
      {
        enrollmentId: w.enrollmentId,
        answers: { q1: ["b"] },
      },
    );
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("read-only");
  });

  it("grades a failing attempt (< 80%), records attempt #1, but does not mark theory completed", async () => {
    // Only 3 of 10 correct (30%)
    const answers = {
      q1: ["b"], // correct
      q2: ["c"], // correct
      q3: ["a"], // correct
      q4: ["a"], // incorrect
      q5: ["a"], // incorrect
      q6: ["b"], // incorrect
      q7: ["a"], // incorrect
      q8: ["a"], // incorrect
      q9: ["a"], // incorrect
      q10: ["b"], // incorrect
    };

    const res = await callV1(
      w.smeLearner,
      "POST",
      "/trade/modules/M01/knowledge-check/attempts",
      {
        enrollmentId: w.enrollmentId,
        answers,
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(30);
    expect(res.body.passed).toBe(false);
    expect(res.body.attemptNumber).toBe(1);
    expect(res.body.totalQuestions).toBe(10);
    expect(res.body.correctCount).toBe(3);
    expect(res.body.theoryCompletedAt).toBeNull();

    // Results feedback check
    expect(res.body.results).toHaveLength(10);
    // A failed attempt says the score and nothing per question: with unlimited retakes, the key or even which answers were
    // right would let the next attempt pass by changing only the wrong ones.
    for (const r of res.body.results as Array<Record<string, unknown>>) {
      expect(r.correctAnswers).toEqual([]);
      expect(r).not.toHaveProperty("isCorrect");
      expect(r).not.toHaveProperty("lessonId");
      expect(r).not.toHaveProperty("explanation");
    }

    // Check module progress in DB
    const [progress] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01"),
        ),
      );

    expect(progress).toBeDefined();
    expect(progress!.status).toBe("in_progress");
    expect(progress!.theoryCompletedAt).toBeNull();
    expect(Number(progress!.knowledgeCheckScore)).toBe(30);
  });

  it("grades a passing retake (>= 80%), increments to attempt #2, sets theoryCompletedAt", async () => {
    // 10 of 10 correct (100%)
    const answers = { q1: ["b"], q2: ["c"], q3: ["a"], q4: ["d"], q5: ["b"], q6: ["a"], q7: ["c"], q8: ["d"], q9: ["b"], q10: ["a"] };

    const res = await callV1(
      w.smeLearner,
      "POST",
      "/trade/modules/M01/knowledge-check/attempts",
      {
        enrollmentId: w.enrollmentId,
        answers,
      },
    );

    expect(res.status).toBe(200);
    expect(res.body.score).toBe(100);
    expect(res.body.passed).toBe(true);
    expect(res.body.attemptNumber).toBe(2);
    expect(res.body.correctCount).toBe(10);
    expect(res.body.theoryCompletedAt).toBeTruthy();

    // Verify DB progress updated
    const [progress] = await db
      .select()
      .from(schema.moduleProgress)
      .where(
        and(
          eq(schema.moduleProgress.enrollmentId, w.enrollmentId),
          eq(schema.moduleProgress.moduleId, "M01"),
        ),
      );

    expect(progress!.theoryCompletedAt).not.toBeNull();
    expect(Number(progress!.knowledgeCheckScore)).toBe(100);
  });

  it("lists past attempts with history, best score, and passed status", async () => {
    const res = await callV1(
      w.smeLearner,
      "GET",
      `/trade/modules/M01/knowledge-check/attempts?enrollmentId=${w.enrollmentId}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.bestScore).toBe(100);
    expect(res.body.hasPassed).toBe(true);
    expect(res.body.items[0].attemptNumber).toBe(2);
    expect(res.body.items[1].attemptNumber).toBe(1);

    // Staff can also view learner's attempts read-only
    const staffRes = await callV1(
      w.admin,
      "GET",
      `/trade/modules/M01/knowledge-check/attempts?enrollmentId=${w.enrollmentId}`,
    );
    expect(staffRes.status).toBe(200);
    expect(staffRes.body.items).toHaveLength(2);
  });

  it("provides cohort knowledge check statistics for staff", async () => {
    // Non-staff gets 403
    const forbiddenRes = await callV1(
      w.smeLearner,
      "GET",
      `/trade/cohorts/${w.cohortId}/knowledge-check-stats`,
    );
    expect(forbiddenRes.status).toBe(403);

    // Staff gets 200 with aggregated stats
    const res = await callV1(
      w.admin,
      "GET",
      `/trade/cohorts/${w.cohortId}/knowledge-check-stats`,
    );

    expect(res.status).toBe(200);
    expect(res.body.cohortId).toBe(w.cohortId);
    expect(res.body.modules).toHaveLength(12);

    const m01Stat = res.body.modules.find((m: { moduleId: string }) => m.moduleId === "M01");
    expect(m01Stat).toBeDefined();
    expect(m01Stat.attemptsCount).toBe(2);
    expect(m01Stat.learnersPassed).toBe(1);
    expect(m01Stat.totalLearners).toBe(2);
    expect(m01Stat.passRate).toBe(50); // 1 passed out of 2 total learners in cohort
  });
});
