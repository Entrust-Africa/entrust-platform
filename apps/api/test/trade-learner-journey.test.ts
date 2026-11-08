import { like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { visibleQuestions, type FormDefinition } from "@entrust/forms";
import { findVersion } from "@entrust/trade-content";
import { placementAsForm } from "@entrust/trade-engine";
import { latestDiagnosticTemplate, latestTradeRules, type ModuleId } from "@entrust/trade-rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// One learner's whole journey through the API, the way the screens call it: enrolled by Entrust, onboarding diagnostic,
// placement assessment, learning plan, modules, exit assessment and certificate. Nothing is written to the database
// directly, so a step no route offers fails here. Modules with no content yet are overridden by an administrator.

const w = {} as { learner: TestUser; admin: TestUser; reviewer: TestUser; org: string; enrollment: string; planId: string; modules: string[] };
const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const put = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PUT", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 600)).toBeLessThan(300);
  return res.body;
};

/** Answers every question a form shows, until no new one appears. */
function fillIn(form: FormDefinition): Record<string, unknown> {
  const answers: Record<string, unknown> = {};
  for (let round = 0; round < 12; round++) {
    let added = false;
    for (const q of visibleQuestions(form, answers as never)) {
      if (q.id in answers) continue;
      added = true;
      if (q.type === "yes_no") answers[q.id] = q.mustBe ?? "no";
      else if (q.type === "single_choice") answers[q.id] = q.options![0]!.value;
      else if (q.type === "multiple_choice") answers[q.id] = [q.options!.find((o) => !o.exclusive)!.value];
      else if (q.type === "short_text" || q.type === "long_text") answers[q.id] = "Some words";
      else if (q.type === "number") answers[q.id] = q.min ?? 1;
      else if (q.type === "money") answers[q.id] = { amount: 1000, currency: "USD" };
      else if (q.type === "date") answers[q.id] = "2020-01-01";
      else if (q.type === "list") answers[q.id] = ["One"];
    }
    if (!added) break;
  }
  return answers;
}

async function takeAssessment(kind: "diagnostic" | "placement" | "exit", form: FormDefinition) {
  const draft = ok(await post(w.learner, "/assessments", { kind, enrollmentId: w.enrollment }));
  ok(await put(w.learner, `/assessments/${draft.id}/responses`, { answers: fillIn(form) }));
  return ok(await post(w.learner, `/assessments/${draft.id}/submit`));
}

beforeAll(async () => {
  await cleanup();
  const [learner, admin, reviewer] = (await Promise.all(["lj-learner", "lj-admin", "lj-reviewer"].map(signUp))) as [TestUser, TestUser, TestUser];
  Object.assign(w, { learner, admin, reviewer });
  process.env.ENTRUST_ORG_ID = await createOrganization("lj-entrust", [[admin, "admin"], [reviewer, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("lj-sme", [[learner, "owner"]], { platform: null });
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}%`));
});

describe("a learner's journey from enrolment to certificate", () => {
  it("is enrolled by Entrust, which opens TRADE for the business", async () => {
    const program = ok(await post(w.admin, "/programs", { name: `${PREFIX}lj-program` }));
    const cohort = ok(await post(w.admin, "/cohorts", { programId: program.id, name: `${PREFIX}lj-cohort`, country: "ET" }));
    const enrollment = ok(await post(w.admin, "/enrollments", { cohortId: cohort.id, organizationId: w.org }));
    w.enrollment = enrollment.id;
    ok(await get(w.learner, "/modules"));
  });

  it("takes the diagnostic, which gives a pathway", async () => {
    await takeAssessment("diagnostic", latestDiagnosticTemplate() as FormDefinition);
    expect(ok(await get(w.learner, `/enrollments/${w.enrollment}/pathway`)).pathway.pathway).toBe("A");
  });

  it("takes the placement assessment, which builds a learning plan", async () => {
    const placement = await takeAssessment("placement", placementAsForm(latestTradeRules()));
    const results = ok(await get(w.learner, `/assessments/${placement.id}/results`));
    expect(results.domains?.length ?? results.scores?.length).toBeGreaterThan(0);
    ok(await get(w.learner, `/assessments/${placement.id}/report`));
    const plans = ok(await get(w.learner, `/plans?enrollmentId=${w.enrollment}`));
    const plan = plans.items.find((p: Json) => p.status !== "superseded");
    expect(plan).toBeTruthy();
    w.planId = plan.id;
    w.modules = plan.modules.map((m: Json) => m.moduleId);
    expect(w.modules).toEqual(expect.arrayContaining(["M01", "M11", "M12"]));
    if (plan.status !== "approved" && plan.status !== "active") ok(await post(w.admin, `/plans/${plan.id}/approve`, {}));
  });

  it("acknowledges the plan", async () => {
    expect((await post(w.admin, `/plans/${w.planId}/acknowledge`)).status).toBe(403);
    const res = ok(await post(w.learner, `/plans/${w.planId}/acknowledge`));
    expect(res.acknowledgedAt).not.toBeNull();
    // A second time keeps the first date.
    expect(ok(await post(w.learner, `/plans/${w.planId}/acknowledge`)).acknowledgedAt).toBe(res.acknowledgedAt);
  });

  it("passes every assigned module that has content, through lessons, knowledge check and assessor", async () => {
    for (const moduleId of w.modules) {
      const content = findVersion(moduleId as ModuleId, "staff");
      if (!content) continue;
      for (const lesson of content.lessons) {
        ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId, lessonId: lesson.id, completed: true, contentVersion: content.version }));
      }
      const answers = Object.fromEntries(content.knowledgeCheck!.questions.map((q) => [q.id, q.correct.length > 1 ? q.correct : q.correct[0]!]));
      const attempt = ok(await post(w.learner, `/modules/${moduleId}/knowledge-check/attempts`, { enrollmentId: w.enrollment, answers }));
      expect(attempt.passed).toBe(true);
      const submission = ok(await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId }));
      const scores = Object.fromEntries(content.rubric!.criteria.map((c) => [c.id, { points: c.maxPoints }]));
      const score = ok(await post(w.reviewer, `/module-submissions/${submission.id}/score`, { scores, feedback: "Good." }));
      expect(score.passed).toBe(true);
      const progress = ok(await get(w.learner, `/module-progress?enrollmentId=${w.enrollment}&moduleId=${moduleId}`));
      expect(progress.items[0].status, moduleId).toBe("passed");
    }
  });

  it("has no certificate while modules with no content are left, and can't open them", async () => {
    const left = w.modules.filter((m) => !findVersion(m as ModuleId, "staff"));
    expect(left).toEqual(expect.arrayContaining(["M11", "M12"]));
    expect((await get(w.learner, "/modules/M11")).body.content).toBeNull();
    expect((await get(w.learner, `/enrollments/${w.enrollment}/certificate`)).status).toBe(404);
  });

  it("finishes the programme and gets a certificate anyone can check, once the rest are overridden", async () => {
    for (const moduleId of w.modules.filter((m) => !findVersion(m as ModuleId, "staff"))) {
      ok(await post(w.admin, "/admin/override-module-completion", { enrollmentId: w.enrollment, moduleId, reason: "No content yet" }));
    }
    const certificate = ok(await get(w.learner, `/enrollments/${w.enrollment}/certificate`));
    expect(certificate.isValid).toBe(true);
    expect(ok(await get(null, `/certificates/${certificate.code}/public`)).isValid).toBe(true);
  });

  it("takes the exit assessment, which compares with placement and leaves the plan alone", async () => {
    const form = placementAsForm(latestTradeRules());
    const exit = ok(await post(w.learner, "/assessments", { kind: "exit", enrollmentId: w.enrollment }));
    const fromQuestions = fillIn({ ...form, questions: form.questions.filter((q) => /^[B-G]/.test(q.id)) } as FormDefinition);
    ok(await put(w.learner, `/assessments/${exit.id}/responses`, { answers: fromQuestions }));
    ok(await post(w.learner, `/assessments/${exit.id}/submit`));
    const plan = ok(await get(w.learner, `/plans/${w.planId}`));
    expect(plan.status).toBe("completed");
  });
});
