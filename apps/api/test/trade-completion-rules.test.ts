import { and, eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findVersion } from "@entrust/trade-content";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// What the second audit found: rules that held on one path and not another.

const w = {} as { learner: TestUser; admin: TestUser; reviewer: TestUser; other: TestUser; org: string; cohort: string; otherCohort: string; enrollment: string; plan: string; first: string };
const get = (user: TestUser, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 400)).toBeLessThan(300);
  return res.body;
};
const M05 = () => findVersion("M05", "learner")!;
const allMarks = () => Object.fromEntries(M05().rubric.criteria.map((c) => [c.id, { points: c.maxPoints }]));
const status = async () => ok(await get(w.learner, `/module-progress?enrollmentId=${w.enrollment}&moduleId=M05`)).items[0].status;
const sample = (f: Json): unknown => (["number", "money", "percent"].includes(f.kind) ? 5 : f.kind === "date" ? "2026-11-01" : f.kind === "choice" ? f.options[0].value : f.kind === "checkbox" ? true : "Some words");

async function submitWorksheet(id: string) {
  const definition = ok(await get(w.learner, `/worksheets/definitions/${id}`));
  const draft = ok(await post(w.learner, `/worksheets/${id}/draft`, { enrollmentId: w.enrollment }));
  const values: Record<string, unknown> = {};
  for (const f of definition.fields) if (!f.showWhen) values[f.id] = sample(f);
  for (const t of definition.tables) values[t.id] = Array.from({ length: t.minRows ?? 1 }, () => Object.fromEntries(t.columns.map((c: Json) => [c.id, sample(c)])));
  ok(await callV1(w.learner, "PUT", `/trade/worksheet-versions/${draft.id}/values`, { values }));
  ok(await post(w.learner, `/worksheet-versions/${draft.id}/submit`));
}

beforeAll(async () => {
  await cleanup();
  const [learner, admin, reviewer, other] = (await Promise.all(["cr-learner", "cr-admin", "cr-reviewer", "cr-other"].map(signUp))) as TestUser[];
  Object.assign(w, { learner, admin, reviewer, other });
  process.env.ENTRUST_ORG_ID = await createOrganization("cr-entrust", [[admin!, "admin"], [reviewer!, "reviewer"], [other!, "facilitator"]], { smeProfile: false });
  w.org = await createOrganization("cr-sme", [[learner!, "owner"]], { platform: null });
  const program = ok(await post(admin!, "/programs", { name: `${PREFIX}cr-program` }));
  w.cohort = ok(await post(admin!, "/cohorts", { programId: program.id, name: `${PREFIX}cr-cohort`, country: "ET" })).id;
  w.otherCohort = ok(await post(admin!, "/cohorts", { programId: program.id, name: `${PREFIX}cr-other-cohort`, country: "ET" })).id;
  w.enrollment = ok(await post(admin!, "/enrollments", { cohortId: w.cohort, organizationId: w.org })).id;
  ok(await post(admin!, `/cohorts/${w.cohort}/staff`, { userId: reviewer!.id }));
  ok(await post(admin!, `/cohorts/${w.otherCohort}/staff`, { userId: other!.id }));
  const [plan] = await db
    .insert(schema.learningPlan)
    .values({ enrollmentId: w.enrollment, rulesVersion: "0.2.0", pathway: "A", status: "generated", pathwayAssignmentId: null } as never)
    .returning();
  w.plan = plan!.id;
  await db.insert(schema.moduleAssignment).values([
    { planId: w.plan, moduleId: "M05", status: "required", sequence: 1, reasonCodes: [] },
    { planId: w.plan, moduleId: "M02", status: "optional", sequence: 2, reasonCodes: [] },
    { planId: w.plan, moduleId: "M01", status: "optional", sequence: 4, reasonCodes: [] },
    { planId: w.plan, moduleId: "M11", status: "required", sequence: 3, reasonCodes: [] },
  ] as never);
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}cr-%`));
});

describe("assignment limits on staff who aren't on the cohort", () => {
  it("keeps plans, progress, attempts and evidence from them", async () => {
    expect(ok(await get(w.other, `/plans?enrollmentId=${w.enrollment}`)).items).toEqual([]);
    expect((await get(w.other, `/plans/${w.plan}`)).status).toBe(404);
    expect((await get(w.other, `/module-progress?enrollmentId=${w.enrollment}`)).status).toBe(404);
    expect((await get(w.other, `/modules/M05/knowledge-check/attempts?enrollmentId=${w.enrollment}`)).status).toBe(404);
    expect((await get(w.other, `/cohorts/${w.cohort}/knowledge-check-stats`)).status).toBe(404);
    expect(ok(await get(w.other, `/evidence?organizationId=${w.org}`)).items).toEqual([]);
    expect((await get(w.reviewer, `/module-progress?enrollmentId=${w.enrollment}`)).status).toBe(200);
  });

  it("won't let them change a plan, a pathway or a session", async () => {
    expect((await post(w.other, `/plans/${w.plan}/approve`, {})).status).toBe(404);
    expect((await post(w.other, `/plans/${w.plan}/override`, { reason: "x", removals: ["M02"] })).status).toBe(404);
    expect((await post(w.other, `/enrollments/${w.enrollment}/pathway`, { pathway: "B", reason: "x" })).status).toBe(404);
    expect((await post(w.other, `/cohorts/${w.cohort}/sessions`, { title: "x", startTime: "2027-01-01T09:00:00Z", endTime: "2027-01-01T10:00:00Z" })).status).toBe(404);
  });

  it("won't let them review or request evidence, or read the trail or registry beyond their cohorts", async () => {
    const [record] = await db.insert(schema.evidenceRecord).values({ organizationId: w.org, title: "Export licence" } as never).returning();
    expect((await post(w.other, `/evidence/${record!.id}/review`, { status: "accepted", confidence: "verified" })).status).toBe(404);
    expect((await post(w.other, "/evidence/request", { organizationId: w.org, title: "x", prompt: "Send it" })).status).toBe(404);
    const [unchanged] = await db.select().from(schema.evidenceRecord).where(eq(schema.evidenceRecord.id, record!.id));
    expect(unchanged?.confidence).toBe("self_reported");

    await db.insert(schema.auditLog).values({ actorUserId: w.admin.id, organizationId: w.org, action: "sme.updated", entityType: "sme_profile", entityId: w.org, after: { tin: "0012345678" } });
    const trail = (user: TestUser) => callV1(user, "GET", `/audit?organizationId=${w.org}&entityType=sme_profile`);
    expect(ok(await trail(w.other)).items).toEqual([]);
    expect(ok(await trail(w.reviewer)).items.length).toBeGreaterThan(0);
    expect(ok(await trail(w.admin)).items.length).toBeGreaterThan(0);

    expect((await callV1(w.reviewer, "GET", "/smes/search?q=cr")).status).toBe(403);
    expect((await get(w.reviewer, "/enrollments/waiting")).status).toBe(403);
    expect((await callV1(w.other, "GET", "/smes/search?q=cr")).status).toBe(200);
  });

  it("won't let a reviewer override a plan, and no one drop a mandatory module", async () => {
    expect((await post(w.reviewer, `/plans/${w.plan}/override`, { reason: "x", removals: ["M02"] })).status).toBe(403);
    const dropped = await post(w.admin, `/plans/${w.plan}/override`, { reason: "x", removals: ["M11"] });
    expect(dropped.status).toBe(422);
    expect(dropped.body.error).toContain("M11");
    const softened = await post(w.admin, `/plans/${w.plan}/override`, { reason: "x", additions: [{ moduleId: "M12", status: "optional" }] });
    expect(softened.status).toBe(422);
    expect(softened.body.error).toContain("M12");
  });
});

describe("what counts towards a pass", () => {
  it("won't take an older module's submission until its worksheet is in", async () => {
    const content = findVersion("M01", "learner")!;
    ok(await post(w.learner, "/modules/M01/knowledge-check/attempts", { enrollmentId: w.enrollment, answers: Object.fromEntries(content.knowledgeCheck.questions.map((q) => [q.id, q.correct[0]!])) }));
    const res = await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M01" });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("worksheet first");
  });

  it("doesn't let an old pass stand when newer work has failed", async () => {
    const content = M05();
    ok(await post(w.learner, "/modules/M05/knowledge-check/attempts", { enrollmentId: w.enrollment, answers: Object.fromEntries(content.knowledgeCheck.questions.map((q) => [q.id, q.correct[0]!])) }));
    const worksheets = ok(await get(w.learner, `/worksheets?enrollmentId=${w.enrollment}`)).items.filter((i: Json) => i.module === "M05").map((i: Json) => i.id);
    for (const id of worksheets) await submitWorksheet(id);
    for (const lesson of content.lessons.slice(0, -1)) ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId: "M05", lessonId: lesson.id, completed: true, contentVersion: content.version }));

    const v1 = ok(await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M05" }));
    expect(ok(await post(w.reviewer, `/module-submissions/${v1.id}/score`, { scores: allMarks(), feedback: "Good." })).passed).toBe(true);
    const v2 = ok(await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M05" }));
    const failed = ok(await post(w.reviewer, `/module-submissions/${v2.id}/score`, { scores: allMarks(), confirmedCriticalFailures: [content.rubric.criticalFailures[0]!.id], feedback: "Fabricated." }));
    expect(failed.passed).toBe(false);
    w.first = v2.id;

    const last = content.lessons.at(-1)!;
    ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId: "M05", lessonId: last.id, completed: true, contentVersion: content.version }));
    expect(await status()).toBe("needs_revision");

    // An exemption can't be the way round it, or round a mandatory module.
    const [evidence] = await db.insert(schema.evidenceRecord).values({ organizationId: w.org, title: "Prior training" } as never).returning();
    const [exemption] = await db.insert(schema.moduleExemption).values({ enrollmentId: w.enrollment, moduleId: "M05", evidenceRecordId: evidence!.id, status: "pending", reason: "Did this before", requestedByUserId: w.learner.id } as never).returning();
    const approved = await post(w.admin, `/exemptions/${exemption!.id}/review`, { status: "approved" });
    expect(approved.status).toBe(422);
    expect(approved.body.error).toContain("critical failure");
    expect(await status()).toBe("needs_revision");
    await db.delete(schema.moduleExemption).where(eq(schema.moduleExemption.id, exemption!.id));
    const mandatory = await post(w.learner, "/exemptions", { enrollmentId: w.enrollment, moduleId: "M11", evidenceRecordId: evidence!.id, reason: "Did this before" });
    expect(mandatory.status).toBe(422);
  });

  it("passes once the newest work passes", async () => {
    const v3 = ok(await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M05" }));
    // Two assessors at once: one of them is the official first score, never both.
    const both = await Promise.all([w.reviewer, w.admin].map((user) => post(user, `/module-submissions/${v3.id}/score`, { scores: allMarks(), feedback: "Corrected." })));
    expect(both.map((r) => r.status)).toEqual([expect.any(Number), expect.any(Number)]);
    both.forEach((r) => ok(r));
    const scores = await db.select().from(schema.rubricAssessment).where(eq(schema.rubricAssessment.submissionId, v3.id));
    expect(scores).toHaveLength(2);
    expect(scores.filter((s) => s.isFirstScore)).toHaveLength(1);
    expect(await status()).toBe("passed");
  });

  it("works from a generated plan, and optional modules don't hold the programme back", async () => {
    ok(await callV1(w.admin, "POST", "/trade/admin/override-module-completion", { enrollmentId: w.enrollment, moduleId: "M11", reason: "Covering this rule" }));
    const certificate = ok(await get(w.learner, `/enrollments/${w.enrollment}/certificate`));
    expect(certificate.isValid).toBe(true);
    const [plan] = await db.select().from(schema.learningPlan).where(eq(schema.learningPlan.id, w.plan));
    expect(plan?.status).toBe("completed");
  });
});

describe("after the programme", () => {
  it("takes no new work once finished, and a withdrawn business doesn't graduate or carry on", async () => {
    const answers = Object.fromEntries(M05().knowledgeCheck.questions.map((q) => [q.id, q.correct[0]!]));
    expect((await post(w.learner, "/modules/M05/knowledge-check/attempts", { enrollmentId: w.enrollment, answers })).status).toBe(422);
    expect((await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M05" })).status).toBe(422);

    const owner = (await signUp("cr-withdrawn")) as TestUser;
    const org = await createOrganization("cr-withdrawn-sme", [[owner, "owner"]], { platform: null });
    const left = ok(await post(w.admin, "/enrollments", { cohortId: w.cohort, organizationId: org })).id;
    ok(await callV1(w.admin, "PATCH", `/trade/enrollments/${left}/status`, { status: "withdrawn", reason: "Closed the business" }));
    expect((await post(owner, "/modules/M05/knowledge-check/attempts", { enrollmentId: left, answers })).status).toBe(422);
    expect((await post(owner, "/module-submissions", { enrollmentId: left, moduleId: "M05" })).status).toBe(422);
    expect((await post(owner, "/module-progress", { enrollmentId: left, moduleId: "M05", lessonId: M05().lessons[0]!.id, completed: true })).status).toBe(422);
  });

  it("keeps an SME's worksheets, and lets it start a new version", async () => {
    const list = ok(await get(w.learner, `/worksheets?organizationId=${w.org}`));
    expect(list.enrollmentId).toBe(w.enrollment);
    expect(list.items.filter((i: Json) => i.module === "M05" && i.latest)).toHaveLength(8);
    const draft = ok(await post(w.learner, "/worksheets/m05-ideal-buyer-profile/draft", { organizationId: w.org }));
    expect(draft.version).toBe(2);
    await db.delete(schema.worksheetVersion).where(eq(schema.worksheetVersion.id, draft.id));
  });

  it("issues a new certificate when a revoked one is earned again", async () => {
    const before = ok(await get(w.learner, `/enrollments/${w.enrollment}/certificate`));
    const scores = Object.fromEntries(M05().rubric.criteria.map((c) => [c.id, { points: 0 }]));
    const [latest] = (ok(await get(w.admin, `/module-submissions?enrollmentId=${w.enrollment}&moduleId=M05`)).items as Json[]).slice(0, 1);
    ok(await callV1(w.admin, "PATCH", `/trade/module-submissions/${latest.id}/score`, { scores, overrideReason: "Reassessed" }));
    expect(ok(await get(w.learner, `/certificates/${before.code}/public`)).isValid).toBe(false);

    ok(await callV1(w.admin, "PATCH", `/trade/module-submissions/${latest.id}/score`, { scores: allMarks(), overrideReason: "Corrected after review" }));
    const after = ok(await get(w.learner, `/enrollments/${w.enrollment}/certificate`));
    expect(after.code).not.toBe(before.code);
    expect(after.isValid).toBe(true);
    const certs = await db.select().from(schema.certificate).where(and(eq(schema.certificate.enrollmentId, w.enrollment)));
    expect(certs).toHaveLength(2);
  });
});
