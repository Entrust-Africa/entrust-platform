import { and, eq, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findVersion } from "@entrust/trade-content";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// What a changed score does to a module, the programme and its certificate (audit #217, item 3 and "scoring an older
// submission"). Each business here has a plan of M01 alone, so finishing M01 finishes the programme.

const M01 = findVersion("M01", "learner")!;
const LESSONS = M01.lessons.map((l) => l.id);
const OUTPUTS = ["business-baseline", "capability-gap-register", "opportunity-register", "deal-qualification-scorecard", "deal-decision-record"].map((id) => `m01-${id}`);
const score = (points: number) => Object.fromEntries(M01.rubric.criteria.map((c) => [c.id, { points }]));

const w = {} as { admin: TestUser; reviewer: TestUser; cohort: string };
const get = (u: TestUser | null, path: string) => callV1(u, "GET", `/trade${path}`);
const post = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "POST", `/trade${path}`, body);
const patch = (u: TestUser | null, path: string, body?: unknown) => callV1(u, "PATCH", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};

/** A business enrolled with a plan of M01 only, its theory passed, its outputs submitted, and (optionally) its lessons done. */
async function business(name: string, { lessonsDone }: { lessonsDone: boolean }) {
  const learner = await signUp(`so-${name}`);
  const org = await createOrganization(`so-${name}`, [[learner, "owner"]], { platform: "trade" });
  const [enrollment] = await db.insert(schema.enrollment).values({ cohortId: w.cohort, organizationId: org, status: "active" }).returning();
  const [plan] = await db.insert(schema.learningPlan).values({ enrollmentId: enrollment!.id, rulesVersion: "2026.1", pathway: "A", status: "active", requiresHumanReview: false, acknowledgedAt: new Date() }).returning();
  await db.insert(schema.moduleAssignment).values({ planId: plan!.id, moduleId: "M01", status: "required", sequence: 1, reasonCodes: ["pathway_prescribed"], source: "engine" });
  await db.insert(schema.moduleProgress).values({
    enrollmentId: enrollment!.id,
    moduleId: "M01",
    contentVersion: M01.version,
    status: "in_progress",
    lessonProgress: { completedLessons: lessonsDone ? LESSONS : LESSONS.slice(0, -1) },
    theoryCompletedAt: new Date(),
    knowledgeCheckScore: "100",
  });
  await db.insert(schema.worksheetVersion).values(
    [...OUTPUTS, "m01-individual-learning-plan"].map((worksheetId) => ({
      enrollmentId: enrollment!.id,
      worksheetId,
      moduleId: "M01" as const,
      version: 1,
      status: "submitted" as const,
      values: {},
      result: {},
      confidence: "self_reported" as const,
      submittedByUserId: learner.id,
      submittedAt: new Date(),
    })),
  );
  return { learner, org, enrollment: enrollment!.id };
}

const submit = async (b: { learner: TestUser; enrollment: string }) => ok(await post(b.learner, "/module-submissions", { enrollmentId: b.enrollment, moduleId: "M01" })).id as string;
const firstScore = async (submissionId: string, points: number) => ok(await post(w.reviewer, `/module-submissions/${submissionId}/score`, { scores: score(points), confirmedCriticalFailures: [], feedback: "Scored" }));
const certificate = (b: { enrollment: string }) => db.select().from(schema.certificate).where(eq(schema.certificate.enrollmentId, b.enrollment));
const liveCertificate = async (b: { enrollment: string }) => (await db.select().from(schema.certificate).where(and(eq(schema.certificate.enrollmentId, b.enrollment), isNull(schema.certificate.revokedAt))))[0];
const enrollmentOf = async (b: { enrollment: string }) => (await db.select().from(schema.enrollment).where(eq(schema.enrollment.id, b.enrollment)))[0]!;
const progressOf = async (b: { enrollment: string }) => (await db.select().from(schema.moduleProgress).where(eq(schema.moduleProgress.enrollmentId, b.enrollment)))[0]!;

beforeAll(async () => {
  await cleanup();
  const [admin, reviewer] = await Promise.all([signUp("so-admin"), signUp("so-reviewer")]);
  Object.assign(w, { admin, reviewer });
  process.env.ENTRUST_ORG_ID = await createOrganization("so-entrust", [[admin!, "admin"], [reviewer!, "reviewer"]], { smeProfile: false });
  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}so-program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}so-cohort` }).returning();
  w.cohort = cohort!.id;
  await db.insert(schema.cohortStaff).values({ cohortId: w.cohort, userId: reviewer!.id });
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("changing a score after the programme finished", () => {
  it("takes the certificate back when an override confirms a critical failure on a module completed by override", async () => {
    // Scored 20 of 36, a fail, then completed by an administrator's override: that finishes the programme.
    const b = await business("cf-after-override", { lessonsDone: true });
    const submission = await submit(b);
    await firstScore(submission, 3);
    expect((await progressOf(b)).status).toBe("needs_revision");
    ok(await post(w.admin, "/admin/override-module-completion", { enrollmentId: b.enrollment, moduleId: "M01", reason: "Assessed in person at the live session" }));
    expect((await enrollmentOf(b)).status).toBe("completed");
    const cert = await liveCertificate(b);
    expect(cert).toBeDefined();

    // Then an override confirms a critical failure. The old score was already a fail, which is the case that was missed.
    ok(await patch(w.admin, `/module-submissions/${submission}/score`, { confirmedCriticalFailures: ["cf1"], overrideReason: "The buyer letters were fabricated" }));

    expect(await liveCertificate(b)).toBeUndefined();
    expect(ok(await get(null, `/certificates/${cert!.code}/public`))).toMatchObject({ isValid: false, isRevoked: true });
    expect(await enrollmentOf(b)).toMatchObject({ status: "active", completedAt: null });
    expect(await progressOf(b)).toMatchObject({ status: "needs_revision", adminOverrideAt: null });
  });

  it("clears the completion override on a pass-to-fail override, so the next lesson tick doesn't issue a new certificate", async () => {
    const b = await business("pass-to-fail", { lessonsDone: false });
    const submission = await submit(b);
    await firstScore(submission, 5);
    ok(await post(w.admin, "/admin/override-module-completion", { enrollmentId: b.enrollment, moduleId: "M01", reason: "Lessons covered in the workshop" }));
    expect(await liveCertificate(b)).toBeDefined();

    ok(await patch(w.admin, `/module-submissions/${submission}/score`, { scores: score(1), overrideReason: "Second look: the deal record is missing" }));
    expect(await liveCertificate(b)).toBeUndefined();
    expect((await progressOf(b)).adminOverrideAt).toBeNull();

    // The learner ticks the last lesson. The module still needs passing work, so nothing is issued.
    ok(await post(b.learner, "/module-progress", { enrollmentId: b.enrollment, moduleId: "M01", lessonId: LESSONS.at(-1), completed: true }));
    expect((await progressOf(b)).status).not.toBe("passed");
    expect(await liveCertificate(b)).toBeUndefined();
    expect((await certificate(b)).length).toBe(1);
  });

  it("leaves the module alone when an override fails an older submission and the newest one passed", async () => {
    const b = await business("older-submission", { lessonsDone: false });
    const first = await submit(b);
    await firstScore(first, 5);
    // Lessons aren't done, so the pass doesn't finish M01. The business improves its work and submits again.
    const second = await submit(b);
    await firstScore(second, 5);
    ok(await post(b.learner, "/module-progress", { enrollmentId: b.enrollment, moduleId: "M01", lessonId: LESSONS.at(-1), completed: true }));
    expect((await enrollmentOf(b)).status).toBe("completed");
    const cert = await liveCertificate(b);
    expect(cert).toBeDefined();

    // A correction to the first submission's record: it fails now. The second, newest one still stands.
    ok(await patch(w.admin, `/module-submissions/${first}/score`, { scores: score(1), overrideReason: "Correcting the first attempt's record" }));
    expect((await liveCertificate(b))?.id).toBe(cert!.id);
    expect((await enrollmentOf(b)).status).toBe("completed");
    expect((await progressOf(b)).status).toBe("passed");
    const [old] = await db.select().from(schema.moduleSubmission).where(eq(schema.moduleSubmission.id, first));
    expect(old!.status).toBe("revision_required");
  });

  it("keeps a programme finished before test-out offers counted when a score is re-checked", async () => {
    const b = await business("legacy-test-out", { lessonsDone: false });
    const submission = await submit(b);
    await firstScore(submission, 5);
    ok(await post(b.learner, "/module-progress", { enrollmentId: b.enrollment, moduleId: "M01", lessonId: LESSONS.at(-1), completed: true }));
    expect((await enrollmentOf(b)).status).toBe("completed");
    const cert = await liveCertificate(b);
    expect(cert).toBeDefined();

    // Before #218 a test-out offer didn't hold the programme back, so a plan could finish with one never taken.
    const [plan] = await db.select().from(schema.learningPlan).where(eq(schema.learningPlan.enrollmentId, b.enrollment));
    expect(plan!.status).toBe("completed");
    await db.insert(schema.moduleAssignment).values({ planId: plan!.id, moduleId: "M02", status: "optional", sequence: 2, reasonCodes: ["test_out_offered"], source: "engine" });

    // A correction that still passes re-checks completion. The finished programme and its certificate stand.
    ok(await patch(w.admin, `/module-submissions/${submission}/score`, { scores: score(5), overrideReason: "Correcting the feedback record" }));
    expect((await liveCertificate(b))?.id).toBe(cert!.id);
    expect((await enrollmentOf(b)).status).toBe("completed");
  });
});

describe("submitting while a submission waits", () => {
  it("takes one submission at a time", async () => {
    const b = await business("one-at-a-time", { lessonsDone: false });
    const first = await submit(b);
    const again = await post(b.learner, "/module-submissions", { enrollmentId: b.enrollment, moduleId: "M01" });
    expect(again.status).toBe(409);
    expect(again.body.error).toContain("still waiting");
    await firstScore(first, 2);
    // Once scored, the business can submit again.
    expect((await post(b.learner, "/module-submissions", { enrollmentId: b.enrollment, moduleId: "M01" })).status).toBe(200);
  });

  it("assesses the work on the learner's pinned version, not one the request names", async () => {
    const b = await business("named-version", { lessonsDone: false });
    const res = await post(b.learner, "/module-submissions", { enrollmentId: b.enrollment, moduleId: "M01", contentVersion: "0.1.0" });
    expect(res.status).toBe(422);
    const okRes = ok(await post(b.learner, "/module-submissions", { enrollmentId: b.enrollment, moduleId: "M01" }));
    expect(okRes.contentVersion).toBe(M01.version);
  });
});

