import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Eight modules carry their worksheets in their content. M08 is treated as a draft here, to show what a draft module's
// worksheets do. Everything runs through the routes, the way the screens call them.
vi.mock("@entrust/trade-content", async (original) => {
  const actual = await original<typeof import("@entrust/trade-content")>();
  const content = actual.MODULE_CONTENT.map((c) => {
    if (c.module !== "M08") return c;
    const { approval: _approval, ...rest } = c;
    return { ...rest, status: "draft" as const };
  });
  return {
    ...actual,
    MODULE_CONTENT: content,
    findVersion: (module: never, audience: never, version?: string) => actual.findVersion(module, audience, version, content),
    visibleVersions: (module: never, audience: never) => actual.visibleVersions(module, audience, content),
    listModules: (audience: never) => actual.listModules(audience, content),
    newerVersion: (module: never, audience: never, version: string) => actual.newerVersion(module, audience, version, content),
  };
});

const w = {} as { learner: TestUser; admin: TestUser; reviewer: TestUser; org: string; enrollment: string; submission: string };
const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const ok = (res: { status: number; body: Json }) => {
  expect(res.status, JSON.stringify(res.body).slice(0, 500)).toBeLessThan(300);
  return res.body;
};

const sample = (field: Json): unknown => {
  if (field.kind === "number" || field.kind === "money" || field.kind === "percent") return 5;
  if (field.kind === "date") return "2026-11-01";
  if (field.kind === "choice") return field.options[0].value;
  if (field.kind === "checkbox") return true;
  return "Some words";
};

/** Fills in and submits one worksheet from its definition, as a learner would. */
async function submitWorksheet(id: string): Promise<Json> {
  const definition = ok(await get(w.learner, `/worksheets/definitions/${id}`));
  const draft = ok(await post(w.learner, `/worksheets/${id}/draft`, { enrollmentId: w.enrollment }));
  const values: Record<string, unknown> = {};
  for (const field of definition.fields) values[field.id] = sample(field);
  for (const table of definition.tables) {
    const row = Object.fromEntries(table.columns.map((c: Json) => [c.id, sample(c)]));
    values[table.id] = Array.from({ length: table.minRows ?? 1 }, () => row);
  }
  ok(await callV1(w.learner, "PUT", `/trade/worksheet-versions/${draft.id}/values`, { values }));
  return ok(await post(w.learner, `/worksheet-versions/${draft.id}/submit`));
}

const m05 = (name: string) => `m05-${name}`;
const OUTPUTS = ["ideal-buyer-profile", "buyer-research-sheet", "buyer-qualification", "buyer-introduction-package", "buyer-meeting-record", "quotation-and-negotiation", "qualified-buyer-pipeline"].map(m05);
const PLAN = m05("individual-learning-plan");

beforeAll(async () => {
  await cleanup();
  const [learner, admin, reviewer] = await Promise.all([signUp("mw-learner"), signUp("mw-admin"), signUp("mw-reviewer")]);
  Object.assign(w, { learner, admin, reviewer });
  process.env.ENTRUST_ORG_ID = await createOrganization("mw-staff", [[admin!, "admin"], [reviewer!, "reviewer"]], { smeProfile: false });
  w.org = await createOrganization("mw-org", [[learner!, "owner"]], { platform: null });
  const program = ok(await post(w.admin, "/programs", { name: `${PREFIX}mw-program` }));
  const cohort = ok(await post(w.admin, "/cohorts", { programId: program.id, name: `${PREFIX}mw-cohort`, country: "ET" }));
  w.enrollment = ok(await post(w.admin, "/enrollments", { cohortId: cohort.id, organizationId: w.org })).id;
});

afterAll(async () => {
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}mw-%`));
});

describe("worksheets carried by a module's content", () => {
  it("shows a learner an approved module's worksheets, and keeps a draft module's with staff", async () => {
    const list = ok(await get(w.learner, `/worksheets?enrollmentId=${w.enrollment}`));
    const modules = new Set(list.items.map((i: Json) => i.module));
    expect(list.items.filter((i: Json) => i.module === "M05")).toHaveLength(8);
    expect(modules.has("M08")).toBe(false);
    expect(list.items.some((i: Json) => i.id === "m01-export-opportunity-brief")).toBe(true);

    expect((await get(w.learner, "/worksheets/definitions/m08-export-order-review")).status).toBe(404);
    expect((await post(w.learner, "/worksheets/m08-export-order-review/draft", { enrollmentId: w.enrollment })).status).toBe(404);
    expect(ok(await get(w.learner, "/worksheets/definitions")).items.some((d: Json) => d.module === "M08")).toBe(false);
    expect(ok(await get(w.admin, "/worksheets/definitions")).items.some((d: Json) => d.id === "m08-export-order-review")).toBe(true);
  });

  it("saves as a learner types, wants the required answers, and keeps each submitted version", async () => {
    const draft = ok(await post(w.learner, `/worksheets/${OUTPUTS[1]}/draft`, { enrollmentId: w.enrollment }));
    expect(draft).toMatchObject({ module: "M05", title: "Buyer Research Sheet", status: "draft", canEdit: true });
    const row = { company_name: "Acme", country: "KE" };
    const saved = ok(await callV1(w.learner, "PUT", `/trade/worksheet-versions/${draft.id}/values`, { values: { buyers: [row] } }));
    expect(saved.values.buyers).toEqual([row]);
    const refused = await post(w.learner, `/worksheet-versions/${draft.id}/submit`);
    expect(refused.status).toBeGreaterThanOrEqual(400);
    expect(refused.body.error).toContain("at least 5 rows");

    expect((await callV1(w.learner, "PUT", `/trade/worksheet-versions/${draft.id}/values`, { values: { not_a_field: "x" } })).status).toBeGreaterThanOrEqual(400);
    const first = await submitWorksheet(OUTPUTS[1]!);
    expect(first).toMatchObject({ status: "submitted", version: 1 });
    const next = await submitWorksheet(OUTPUTS[1]!);
    expect(next.version).toBe(2);
    expect(ok(await get(w.learner, `/worksheets/${OUTPUTS[1]}/versions?enrollmentId=${w.enrollment}`)).items.map((v: Json) => v.version)).toEqual([2, 1]);
  });

  it("won't take the practical until every required output is submitted", async () => {
    const content = ok(await get(w.admin, "/modules/M05")).content;
    const answers = Object.fromEntries(content.knowledgeCheck.questions.map((q: Json) => [q.id, q.correct[0]]));
    expect(ok(await post(w.learner, "/modules/M05/knowledge-check/attempts", { enrollmentId: w.enrollment, answers })).passed).toBe(true);

    const early = await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M05" });
    expect(early.status).toBeGreaterThanOrEqual(400);
    expect(early.body.error).toContain("Ideal Buyer Profile");
    expect(early.body.error).not.toContain("Individual Learning Plan");

    for (const id of OUTPUTS.filter((o) => o !== OUTPUTS[1])) await submitWorksheet(id);
    const submission = ok(await post(w.learner, "/module-submissions", { enrollmentId: w.enrollment, moduleId: "M05" }));
    w.submission = submission.id;
    expect(submission.worksheetSnapshot.worksheets.map((s: Json) => s.worksheetId)).toEqual(OUTPUTS);
    // The newest version of each output: the research sheet was submitted twice.
    expect(submission.worksheetSnapshot.worksheets[1].version).toBe(2);
  });

  it("finishes the module only once its lessons and the individual learning plan are in", async () => {
    const content = ok(await get(w.admin, "/modules/M05")).content;
    const scores = Object.fromEntries(content.rubric.criteria.map((c: Json) => [c.id, { points: 4 }]));
    const score = ok(await post(w.reviewer, `/module-submissions/${w.submission}/score`, { scores, feedback: "Good." }));
    expect(score).toMatchObject({ totalPoints: 24, maxPoints: 36, passed: true });
    const status = async () => ok(await get(w.learner, `/module-progress?enrollmentId=${w.enrollment}&moduleId=M05`)).items[0].status;
    expect(await status()).toBe("in_progress");

    for (const lesson of content.lessons) {
      ok(await post(w.learner, "/module-progress", { enrollmentId: w.enrollment, moduleId: "M05", lessonId: lesson.id, completed: true, contentVersion: content.version }));
    }
    expect(await status()).toBe("in_progress");

    await submitWorksheet(PLAN);
    expect(await status()).toBe("passed");
    const [progress] = await db.select().from(schema.moduleProgress).where(eq(schema.moduleProgress.enrollmentId, w.enrollment));
    expect(progress?.completedAt).not.toBeNull();
  });
});
