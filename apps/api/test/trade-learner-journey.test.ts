import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { visibleQuestions, type FormDefinition } from "@entrust/forms";
import { findVersion } from "@entrust/trade-content";
import { placementAsForm } from "@entrust/trade-engine";
import { latestDiagnosticTemplate, latestTradeRules, type ModuleId } from "@entrust/trade-rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// One learner's whole journey through the API, the way the screens call it: enrolled by Entrust, onboarding diagnostic,
// placement assessment, learning plan, modules, exit assessment and certificate. Nothing is written to the database
// directly, so a step no route offers fails here. Every module has content, so nothing needs an administrator's override.

const w = {} as { learner: TestUser; admin: TestUser; reviewer: TestUser; org: string; enrollment: string; planId: string; modules: string[]; submissions: Record<string, string> };
const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const put = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PUT", `/trade${path}`, body);
const sampleAnswer = (field: Json): unknown => {
  if (field.kind === "number" || field.kind === "money" || field.kind === "percent") return 5;
  if (field.kind === "date") return "2026-11-01";
  if (field.kind === "choice") return field.options[0].value;
  if (field.kind === "checkbox") return true;
  return "Some words";
};
/** Fills in and submits one worksheet from its definition, as a learner would. */
async function submitWorksheet(id: string): Promise<void> {
  const definition = ok(await get(w.learner, `/worksheets/definitions/${id}`));
  const draft = ok(await post(w.learner, `/worksheets/${id}/draft`, { enrollmentId: w.enrollment }));
  const values: Record<string, unknown> = {};
  for (const field of definition.fields) if (!field.showWhen) values[field.id] = sampleAnswer(field);
  for (const table of definition.tables) {
    const row = Object.fromEntries(table.columns.map((c: Json) => [c.id, sampleAnswer(c)]));
    values[table.id] = Array.from({ length: table.minRows ?? 1 }, () => row);
  }
  ok(await put(w.learner, `/worksheet-versions/${draft.id}/values`, { values }));
  ok(await post(w.learner, `/worksheet-versions/${draft.id}/submit`));
}
/** The worksheets a learner submits for a module: all of them. */
const contentWorksheets = async (moduleId: string): Promise<string[]> => {
  return ok(await get(w.learner, `/worksheets?enrollmentId=${w.enrollment}`)).items.filter((i: Json) => i.module === moduleId).map((i: Json) => i.id);
};
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
  w.submissions = {};
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
    ok(await post(w.admin, `/cohorts/${cohort.id}/staff`, { userId: w.reviewer.id }));
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

  it("keeps staff's changes and the acknowledgement when confirming a pathway makes the plan again", async () => {
    ok(await post(w.admin, `/plans/${w.planId}/override`, { reason: "Needs this for an order", additions: [{ moduleId: "M10", status: "required" }] }));
    const added = ok(await get(w.learner, `/plans?enrollmentId=${w.enrollment}`)).items.find((p: Json) => p.status !== "superseded");
    ok(await post(w.learner, `/plans/${added.id}/acknowledge`));
    ok(await post(w.admin, `/enrollments/${w.enrollment}/pathway`, { pathway: "A", reason: "Checked with the business" }));
    const remade = ok(await get(w.learner, `/plans?enrollmentId=${w.enrollment}`)).items.find((p: Json) => p.status !== "superseded");
    expect(remade.id).not.toBe(added.id);
    expect(remade.modules.find((m: Json) => m.moduleId === "M10")).toMatchObject({ status: "required", source: "staff_override" });
    // The report reads every reason code, so a staff change has to be one it knows.
    const placement = ok(await get(w.admin, `/assessments?kind=placement&enrollmentId=${w.enrollment}`)).items[0];
    ok(await get(w.learner, `/assessments/${placement.id}/report`));
    if (remade.status !== "approved" && remade.status !== "active") ok(await post(w.admin, `/plans/${remade.id}/approve`, {}));
    w.planId = remade.id;
    w.modules = remade.modules.map((m: Json) => m.moduleId);
    const stored = ok(await get(w.learner, `/plans/${remade.id}`));
    if (stored.modules.length === added.modules.length) expect(stored.acknowledgedAt).not.toBeNull();
    else ok(await post(w.learner, `/plans/${remade.id}/acknowledge`));
  });

  it("passes every assigned module that has content, through lessons, knowledge check and assessor", async () => {
    for (const moduleId of w.modules) {
      const content = findVersion(moduleId as ModuleId, "learner");
      if (!content) continue;
      // Every lesson but the last, so the score can't be what finishes the module.
      const lastLesson = content.lessons.at(-1)!;
      for (const lesson of content.lessons.slice(0, -1)) {
        ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId, lessonId: lesson.id, completed: true, contentVersion: content.version }));
      }
      ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId, lessonId: "not-a-real-lesson", completed: true, contentVersion: content.version }));
      const answers = Object.fromEntries(content.knowledgeCheck!.questions.map((q) => [q.id, q.correct.length > 1 ? q.correct : q.correct[0]!]));
      const attempt = ok(await post(w.learner, `/modules/${moduleId}/knowledge-check/attempts`, { enrollmentId: w.enrollment, answers }));
      expect(attempt.passed).toBe(true);
      const worksheets = await contentWorksheets(moduleId);
      const learningPlan = worksheets.find((id) => id.endsWith("individual-learning-plan"));
      for (const id of worksheets) if (id !== learningPlan) await submitWorksheet(id);
      const submission = ok(await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId }));
      const scores = Object.fromEntries(content.rubric!.criteria.map((c) => [c.id, { points: c.maxPoints }]));
      const score = ok(await post(w.reviewer, `/module-submissions/${submission.id}/score`, { scores, feedback: "Good." }));
      expect(score.passed).toBe(true);
      w.submissions[moduleId] = submission.id;
      const scored = ok(await get(w.learner, `/module-progress?enrollmentId=${w.enrollment}&moduleId=${moduleId}`));
      expect(scored.items[0].status, `${moduleId} with a lesson left`).toBe("in_progress");
      if (learningPlan) await submitWorksheet(learningPlan);
      // Nothing is certified while any assigned module is unfinished.
      if (moduleId === w.modules.at(-1)) expect((await get(w.learner, `/enrollments/${w.enrollment}/certificate`)).status).toBe(404);
      const finished = ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId, lessonId: lastLesson.id, completed: true, contentVersion: content.version }));
      expect(finished.status, moduleId).toBe("passed");
      const progress = ok(await get(w.learner, `/module-progress?enrollmentId=${w.enrollment}&moduleId=${moduleId}`));
      expect(progress.items[0].status, moduleId).toBe("passed");
    }
  });

  it("finishes the programme and gets a certificate anyone can check", async () => {
    expect(w.modules).toEqual(expect.arrayContaining(["M11", "M12"]));
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

  it("takes back the certificate and reopens the programme when an override fails a module", async () => {
    const before = ok(await get(w.learner, `/enrollments/${w.enrollment}/certificate`));
    const moduleId = Object.keys(w.submissions)[0]!;
    const content = findVersion(moduleId as ModuleId, "learner")!;
    const scores = Object.fromEntries(content.rubric.criteria.map((c) => [c.id, { points: 0 }]));
    const res = await callV1(w.admin, "PATCH", `/trade/module-submissions/${w.submissions[moduleId]}/score`, { scores, overrideReason: "Evidence was fabricated" });
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(false);

    const publicCheck = ok(await get(null, `/certificates/${before.code}/public`));
    expect(publicCheck).toMatchObject({ isValid: false, isRevoked: true });
    // The admin's reason is internal: the public check says only that Entrust withdrew it. Staff still see why.
    expect(publicCheck.revocationReason).toBe("Entrust Africa withdrew this certificate.");
    expect(JSON.stringify(publicCheck)).not.toContain("fabricated");
    expect(ok(await get(w.admin, `/enrollments/${w.enrollment}/certificate`)).revocationReason).toContain("Evidence was fabricated");
    expect(ok(await get(w.learner, `/module-progress?enrollmentId=${w.enrollment}&moduleId=${moduleId}`)).items[0].status).toBe("needs_revision");
    expect(ok(await get(w.learner, `/plans/${w.planId}`)).status).toBe("active");
    const [enrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.id, w.enrollment));
    expect(enrollment).toMatchObject({ status: "active", completedAt: null });
  });
});
