import { and, eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { visibleQuestions, type FormDefinition } from "@entrust/forms";
import { monthsBefore, placementAsForm } from "@entrust/trade-engine";
import { latestDiagnosticTemplate, latestTradeRules } from "@entrust/trade-rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PREFIX, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// The onboarding diagnostic (#78) and the placement assessment (#57): one set of routes, chosen by `kind`.

interface World {
  owner: TestUser;
  member: TestUser;
  rival: TestUser;
  noTrade: TestUser;
  admin: TestUser;
  facilitator: TestUser;
  reviewer: TestUser;
  org: string;
  rivalOrg: string;
  noTradeOrg: string;
  entrust: string;
  enrollment: string;
  rivalEnrollment: string;
}
const w = {} as World;

const today = () => new Date().toISOString().slice(0, 10);
const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);
const post = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "POST", `/trade${path}`, body);
const put = (user: TestUser | null, path: string, body?: unknown) => callV1(user, "PUT", `/trade${path}`, body);

beforeAll(async () => {
  await cleanup();
  const users = await Promise.all(["owner", "member", "rival", "no-trade", "admin", "facilitator", "reviewer"].map(signUp));
  const [owner, member, rival, noTrade, admin, facilitator, reviewer] = users as [TestUser, TestUser, TestUser, TestUser, TestUser, TestUser, TestUser];
  Object.assign(w, { owner, member, rival, noTrade, admin, facilitator, reviewer });
  w.org = await createOrganization("tr-org", [[owner, "owner"], [member, "member"]], { platform: "trade" });
  w.rivalOrg = await createOrganization("tr-rival", [[rival, "owner"]], { platform: "trade" });
  w.noTradeOrg = await createOrganization("tr-clear", [[noTrade, "owner"]], { platform: "clear" });
  w.entrust = await createOrganization("tr-entrust", [[admin, "admin"], [facilitator, "facilitator"], [reviewer, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;

  const [program] = await db.insert(schema.program).values({ name: `${PREFIX}program` }).returning();
  const [cohort] = await db.insert(schema.cohort).values({ programId: program!.id, name: `${PREFIX}cohort`, country: "ET" }).returning();
  const [mine, theirs] = await db
    .insert(schema.enrollment)
    .values([
      { cohortId: cohort!.id, organizationId: w.org, status: "active" },
      { cohortId: cohort!.id, organizationId: w.rivalOrg, status: "active" },
    ])
    .returning();
  w.enrollment = mine!.id;
  w.rivalEnrollment = theirs!.id;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
  await db.delete(schema.program).where(like(schema.program.name, `${PREFIX}%`));
});

// ---- Answers that pass a form ----

type Wire = unknown;

/** Answers every visible question of a form, in order, until nothing new shows up. `overrides` win. */
function fillIn(form: FormDefinition, overrides: Record<string, Wire> = {}): Record<string, Wire> {
  const answers: Record<string, Wire> = {};
  for (let round = 0; round < 12; round++) {
    let added = false;
    for (const q of visibleQuestions(form, answers as never)) {
      if (q.id in answers) continue;
      added = true;
      if (q.id in overrides) {
        answers[q.id] = overrides[q.id];
        continue;
      }
      switch (q.type) {
        case "yes_no":
          answers[q.id] = q.mustBe ?? "no";
          break;
        case "single_choice":
          answers[q.id] = q.options![0]!.value;
          break;
        case "multiple_choice":
          answers[q.id] = [q.options!.find((o) => !o.exclusive)!.value];
          break;
        case "short_text":
        case "long_text":
          answers[q.id] = "Some words";
          break;
        case "number":
          answers[q.id] = q.min ?? 1;
          break;
        case "money":
          answers[q.id] = { amount: 1000, currency: "USD" };
          break;
        case "date":
          answers[q.id] = "2020-01-01";
          break;
        case "list":
          answers[q.id] = ["One"];
          break;
      }
    }
    if (!added) break;
  }
  // An override for a question the walk didn't reach (it shows only after another override).
  for (const [id, value] of Object.entries(overrides)) answers[id] ??= value;
  return answers;
}

const diagnostic = latestDiagnosticTemplate() as FormDefinition;
const placement = placementAsForm(latestTradeRules());

async function start(user: TestUser | null, kind: "diagnostic" | "placement", extra: Record<string, unknown> = {}) {
  return post(user, "/assessments", { kind, ...extra });
}

async function startFor(user: TestUser, kind: "diagnostic" | "placement", enrollmentId: string) {
  const res = await start(user, kind, { enrollmentId });
  expect([200, 201]).toContain(res.status);
  return res.body as Json;
}

/** A fresh enrolment of its own, so a test can submit without touching the others. */
async function freshEnrollment(): Promise<string> {
  const [cohort] = await db.select().from(schema.cohort).where(like(schema.cohort.name, `${PREFIX}%`)).limit(1);
  const org = await createOrganization(`tr-fresh-${Math.random().toString(36).slice(2, 8)}`, [[w.owner, "owner"]], { platform: "trade" });
  const [row] = await db.insert(schema.enrollment).values({ cohortId: cohort!.id, organizationId: org, status: "active" }).returning();
  return row!.id;
}

async function submittedDiagnostic(overrides: Record<string, Wire>): Promise<Json> {
  const enrollmentId = await freshEnrollment();
  const draft = await startFor(w.owner, "diagnostic", enrollmentId);
  const saved = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: fillIn(diagnostic, overrides) });
  expect(saved.status).toBe(200);
  const submitted = await post(w.owner, `/assessments/${draft.id}/submit`);
  expect(submitted.status).toBe(200);
  return submitted.body;
}

// ---- Forms ----

describe("the forms", () => {
  it("needs a signed-in user", async () => {
    expect((await get(null, "/assessments/template?kind=diagnostic")).status).toBe(401);
    expect((await get(null, "/assessments")).status).toBe(401);
    expect((await start(null, "diagnostic")).status).toBe(401);
  });

  it("serves the diagnostic and the placement assessment in one shape", async () => {
    const d = await get(w.owner, "/assessments/template?kind=diagnostic");
    expect(d.status).toBe(200);
    expect(d.body).toMatchObject({ kind: "diagnostic", version: diagnostic.version });
    expect(d.body.form.questions.length).toBe(diagnostic.questions.length);
    expect(d.body.form.variables).toContain("country");

    const p = await get(w.owner, "/assessments/template?kind=placement");
    expect(p.status).toBe(200);
    const b2 = p.body.form.questions.find((q: Json) => q.id === "B2");
    expect(b2).toMatchObject({ type: "single_choice", allowNotApplicable: true });
    expect(b2.options.map((o: Json) => o.value)).toEqual(["0", "1", "2", "3"]);
    const a4a = p.body.form.questions.find((q: Json) => q.id === "A4a");
    expect(a4a.showIf).toEqual({ fact: "A4", in: ["product_only", "both_not_validated", "both_validated"] });
  });

  it("refuses a kind or a version it doesn't have", async () => {
    expect((await get(w.owner, "/assessments/template?kind=exit")).status).toBe(400);
    expect((await get(w.owner, "/assessments/template?kind=diagnostic&version=9.9.9")).status).toBe(404);
  });
});

// ---- Who can use them ----

describe("who may start one", () => {
  it("needs an enrolment", async () => {
    const res = await start(w.noTrade, "diagnostic", { organizationId: w.noTradeOrg });
    expect(res.status).toBe(404);
    const lone = await createOrganization("tr-lone", [[w.rival, "member"]], { platform: "trade" });
    const none = await start(w.rival, "diagnostic", { organizationId: lone });
    expect(none.status).toBe(422);
    expect(none.body.error).toContain("isn't enrolled");
  });

  it("lets a member of the enrolled organisation start, and returns the same draft the second time", async () => {
    const first = await start(w.member, "diagnostic", { organizationId: w.org });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ kind: "diagnostic", status: "draft", enrollmentId: w.enrollment, canEdit: true, filledInByStaff: null });
    expect(first.body.variables).toEqual({ country: "Ethiopia" });
    const second = await start(w.owner, "diagnostic", { enrollmentId: w.enrollment });
    expect(second.body.id).toBe(first.body.id);
  });

  it("keeps another organisation's assessment out of sight", async () => {
    const mine = await startFor(w.owner, "diagnostic", w.enrollment);
    for (const user of [w.rival, w.noTrade]) {
      expect((await get(user, `/assessments/${mine.id}`)).status).toBe(404);
      expect((await put(user, `/assessments/${mine.id}/responses`, { answers: { Q1: "x" } })).status).toBe(404);
      expect((await post(user, `/assessments/${mine.id}/submit`)).status).toBe(404);
    }
    expect((await start(w.rival, "diagnostic", { enrollmentId: w.enrollment })).status).toBe(404);
  });

  it("asks which organisation when the caller has more than one", async () => {
    const second = await createOrganization("tr-second", [[w.rival, "member"]], { platform: "trade" });
    expect(second).toBeTruthy();
    const res = await start(w.rival, "diagnostic");
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("organisation");
  });
});

// ---- Save and resume ----

describe("save and resume", () => {
  it("keeps every answer and opens where the person stopped", async () => {
    const draft = await startFor(w.owner, "diagnostic", w.enrollment);
    const answers = fillIn(diagnostic);
    const some = Object.fromEntries(Object.entries(answers).slice(0, 12));
    const saved = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: some });
    expect(saved.status).toBe(200);
    expect(saved.body.progress.answered).toBeGreaterThan(0);
    expect(saved.body.progress.percent).toBeLessThan(100);

    const resumed = await get(w.member, `/assessments/${draft.id}`);
    expect(resumed.body.answers).toEqual(some);
    const more = Object.fromEntries(Object.entries(answers).slice(12, 24));
    const next = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: more });
    expect(Object.keys(next.body.answers).sort()).toEqual(Object.keys({ ...some, ...more }).sort());
  });

  it("clears an answer with null", async () => {
    const draft = await startFor(w.owner, "diagnostic", w.enrollment);
    const [first] = Object.entries(fillIn(diagnostic));
    await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { [first![0]]: first![1] } });
    const cleared = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { [first![0]]: null } });
    expect(cleared.body.answers[first![0]]).toBeUndefined();
  });

  it("refuses an answer the question can't take, and a question that isn't there", async () => {
    const draft = await startFor(w.owner, "diagnostic", w.enrollment);
    const number = diagnostic.questions.find((q) => q.type === "number")!;
    const bad = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { [number.id]: "lots" } });
    expect(bad.status).toBe(422);
    expect(bad.body.error).toContain(number.id);
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { Q9999: "x" } })).status).toBe(422);
  });

  it("accepts \"I don't know\" as an answer to any question", async () => {
    const draft = await startFor(w.owner, "diagnostic", w.enrollment);
    const q = diagnostic.questions.find((x) => x.type === "number")!;
    const saved = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { [q.id]: { notKnown: true } } });
    expect(saved.status).toBe(200);
    expect(saved.body.answers[q.id]).toEqual({ notKnown: true });
  });
});

// ---- The diagnostic ----

describe("submitting the diagnostic", () => {
  it("refuses while a visible question is unanswered", async () => {
    const enrollmentId = await freshEnrollment();
    const draft = await startFor(w.owner, "diagnostic", enrollmentId);
    const answers = fillIn(diagnostic);
    delete answers.Q3;
    await put(w.owner, `/assessments/${draft.id}/responses`, { answers });
    const res = await post(w.owner, `/assessments/${draft.id}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Q3");
    expect((await get(w.owner, `/assessments/${draft.id}`)).body.status).toBe("draft");
  });

  it("is not blocked by a hidden question", async () => {
    const hidden = diagnostic.questions.find((q) => q.id === "Q129")!;
    expect(hidden.showIf).toBeDefined();
    const done = await submittedDiagnostic({ Q128: "no" });
    expect(done.status).toBe("submitted");
    expect(done.answers.Q129).toBeUndefined();
  });

  it("needs the declaration's confirmations", async () => {
    const enrollmentId = await freshEnrollment();
    const draft = await startFor(w.owner, "diagnostic", enrollmentId);
    await put(w.owner, `/assessments/${draft.id}/responses`, { answers: fillIn(diagnostic, { Q165: "no" }) });
    const res = await post(w.owner, `/assessments/${draft.id}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Q165");
  });

  it("puts a first-time exporter on Pathway A", async () => {
    const done = await submittedDiagnostic({ Q135: "no" });
    expect(done.pathway).toMatchObject({ pathway: "A", status: "confirmed", liveOrder: false });
    expect(done.pathway.reasons[0]).toContain("Pathway A");
  });

  it("puts a recent exporter on a provisional Pathway B until staff accept a shipment record", async () => {
    const done = await submittedDiagnostic({ Q135: "yes", Q137: monthsBefore(today(), 3) });
    expect(done.pathway).toMatchObject({ pathway: "B", status: "provisional" });
    expect(done.pathway.reasons.join(" ")).toContain("record of your shipment");
    expect((await get(w.owner, `/enrollments/${done.enrollmentId}/pathway`)).body.pathway.pathway).toBe("B");
  });

  it("holds the line at 24 months: exactly on it is B, a day earlier is A", async () => {
    const exactly = await submittedDiagnostic({ Q135: "yes", Q137: monthsBefore(today(), 24) });
    expect(exactly.pathway.pathway).toBe("B");
    const dayEarlier = new Date(`${monthsBefore(today(), 24)}T00:00:00Z`);
    dayEarlier.setUTCDate(dayEarlier.getUTCDate() - 1);
    const late = await submittedDiagnostic({ Q135: "yes", Q137: dayEarlier.toISOString().slice(0, 10) });
    expect(late.pathway.pathway).toBe("A");
  });

  it("ignores an old shipment date once Q135 says no", async () => {
    const done = await submittedDiagnostic({ Q135: "no", Q137: monthsBefore(today(), 1) });
    expect(done.pathway.pathway).toBe("A");
  });

  it("flags a confirmed order without moving a first-time exporter off Pathway A", async () => {
    const done = await submittedDiagnostic({ Q135: "no", Q132: "yes" });
    expect(done.pathway).toMatchObject({ pathway: "A", liveOrder: true });
    expect(done.pathway.reasons.join(" ")).toContain("first order");
  });

  it("stores the declaration's consents with who, when, the version and the signature", async () => {
    const done = await submittedDiagnostic({ Q135: "no", D1: "Abebe Bekele", D2: "Owner", D3: today(), Q169: "no" });
    const rows = await db.select().from(schema.assessmentConsent).where(eq(schema.assessmentConsent.assessmentId, done.id));
    expect(rows.map((r) => r.questionId).sort()).toEqual(["Q165", "Q166", "Q167", "Q168", "Q169"]);
    expect(rows.find((r) => r.questionId === "Q165")).toMatchObject({
      accepted: true,
      userId: w.owner.id,
      termsVersion: diagnostic.version,
      signedName: "Abebe Bekele",
      signedPosition: "Owner",
      signedDate: today(),
    });
    expect(rows.find((r) => r.questionId === "Q169")?.accepted).toBe(false);
  });

  it("locks the answers once submitted", async () => {
    const done = await submittedDiagnostic({ Q135: "no" });
    const res = await put(w.owner, `/assessments/${done.id}/responses`, { answers: { Q135: "yes" } });
    expect(res.status).toBe(409);
    expect((await post(w.owner, `/assessments/${done.id}/submit`)).status).toBe(409);
    expect((await get(w.owner, `/assessments/${done.id}`)).body).toMatchObject({ status: "submitted", canEdit: false });
  });

  it("writes the audit log", async () => {
    const done = await submittedDiagnostic({ Q135: "no" });
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.organizationId, done.organizationId));
    const actions = rows.filter((r) => r.platform === "trade").map((r) => r.action).sort();
    expect(actions).toEqual(["trade.assessment.started", "trade.assessment.submitted", "trade.pathway.assigned"]);
  });
});

// ---- Retake ----

describe("a retake", () => {
  it("supersedes the old assessment, keeps its answers and puts the new answers' avenue in place", async () => {
    const first = await submittedDiagnostic({ Q135: "no" });
    const refused = await start(w.owner, "diagnostic", { enrollmentId: first.enrollmentId });
    expect(refused.body.id).toBe(first.id);

    const retake = await start(w.owner, "diagnostic", { enrollmentId: first.enrollmentId, retake: true });
    expect(retake.status).toBe(201);
    expect(retake.body.id).not.toBe(first.id);
    expect(retake.body.status).toBe("draft");

    const [old] = await db.select().from(schema.tradeAssessment).where(eq(schema.tradeAssessment.id, first.id));
    expect(old).toMatchObject({ status: "superseded", supersededById: retake.body.id });
    const kept = await db.select().from(schema.assessmentResponse).where(eq(schema.assessmentResponse.assessmentId, first.id));
    expect(kept.length).toBeGreaterThan(50);

    await put(w.owner, `/assessments/${retake.body.id}/responses`, { answers: fillIn(diagnostic, { Q135: "yes", Q137: monthsBefore(today(), 2) }) });
    const submitted = await post(w.owner, `/assessments/${retake.body.id}/submit`);
    expect(submitted.body.pathway.pathway).toBe("B");
    const live = await db
      .select()
      .from(schema.pathwayAssignment)
      .where(and(eq(schema.pathwayAssignment.enrollmentId, first.enrollmentId)));
    expect(live.map((p) => `${p.pathway}:${p.status}`).sort()).toEqual(["A:superseded", "B:provisional"]);
  });

  it("needs something to retake, and refuses while a draft is open", async () => {
    const enrollmentId = await freshEnrollment();
    expect((await start(w.owner, "diagnostic", { enrollmentId, retake: true })).status).toBe(409);
    await startFor(w.owner, "diagnostic", enrollmentId);
    expect((await start(w.owner, "diagnostic", { enrollmentId, retake: true })).status).toBe(409);
  });
});

// ---- Staff ----

describe("staff", () => {
  it("fill in for an SME and are recorded as the assessor", async () => {
    const enrollmentId = await freshEnrollment();
    const draft = await startFor(w.facilitator, "diagnostic", enrollmentId);
    expect(draft.filledInByStaff).toMatchObject({ name: expect.any(String) });
    await put(w.facilitator, `/assessments/${draft.id}/responses`, { answers: fillIn(diagnostic, { Q135: "no" }) });
    const done = await post(w.facilitator, `/assessments/${draft.id}/submit`);
    expect(done.status).toBe(200);
    const [row] = await db.select().from(schema.tradeAssessment).where(eq(schema.tradeAssessment.id, draft.id));
    expect(row?.assessedByUserId).toBe(w.facilitator.id);
    // The SME sees who filled it in.
    expect((await get(w.owner, `/assessments/${draft.id}`)).body.filledInByStaff).toBeTruthy();
  });

  it("can read as a reviewer but not write", async () => {
    const draft = await startFor(w.owner, "diagnostic", w.enrollment);
    expect((await get(w.reviewer, `/assessments/${draft.id}`)).status).toBe(200);
    expect((await put(w.reviewer, `/assessments/${draft.id}/responses`, { answers: { Q1: "x" } })).status).toBe(403);
    expect((await post(w.reviewer, `/assessments/${draft.id}/submit`)).status).toBe(403);
    expect((await start(w.reviewer, "placement", { enrollmentId: w.enrollment })).status).toBe(403);
  });

  it("confirm a provisional avenue, or change it with a reason", async () => {
    const done = await submittedDiagnostic({ Q135: "yes", Q137: monthsBefore(today(), 4) });
    const path = `/enrollments/${done.enrollmentId}/pathway`;
    expect((await post(w.owner, path, { pathway: "B", reason: "Trust me." })).status).toBe(403);
    expect((await post(w.reviewer, path, { pathway: "B", reason: "Looks fine." })).status).toBe(403);
    expect((await post(w.admin, path, { pathway: "B", reason: "" })).status).toBe(400);

    const confirmed = await post(w.admin, path, { pathway: "B", reason: "The bill of lading was accepted." });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.pathway).toMatchObject({ pathway: "B", status: "confirmed", decidedByStaff: true, decisionReason: "The bill of lading was accepted." });

    const overridden = await post(w.admin, path, { pathway: "A", reason: "The record turned out to be from 2019." });
    expect(overridden.body.pathway).toMatchObject({ pathway: "A", status: "confirmed" });
    expect(overridden.body.pathway.reasons.join(" ")).toContain("staff member changed");

    const rows = await db.select().from(schema.pathwayAssignment).where(eq(schema.pathwayAssignment.enrollmentId, done.enrollmentId));
    expect(rows.filter((r) => r.status !== "superseded")).toHaveLength(1);
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.organizationId, done.organizationId));
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["trade.pathway.confirmed", "trade.pathway.overridden"]));
    expect(audit.find((a) => a.action === "trade.pathway.overridden")?.reason).toBe("The record turned out to be from 2019.");
  });

  it("show no avenue before the diagnostic is submitted", async () => {
    const enrollmentId = await freshEnrollment();
    expect((await get(w.owner, `/enrollments/${enrollmentId}/pathway`)).body).toEqual({ enrollmentId, pathway: null });
    expect((await get(w.rival, `/enrollments/${enrollmentId}/pathway`)).status).toBe(404);
  });
});

// ---- Lists ----

describe("the list", () => {
  it("shows an organisation its own, and Entrust staff everyone's, with the avenue", async () => {
    const done = await submittedDiagnostic({ Q135: "no" });
    const mine = await get(w.owner, "/assessments?kind=diagnostic");
    expect(mine.status).toBe(200);
    expect(mine.body.items.find((i: Json) => i.id === done.id)).toMatchObject({ status: "submitted", pathway: "A", pathwayStatus: "confirmed", cohortName: `${PREFIX}cohort` });

    const rival = await get(w.rival, "/assessments");
    expect(rival.body.items.every((i: Json) => i.organizationId === w.rivalOrg)).toBe(true);
    const all = await get(w.admin, `/assessments?organizationId=${done.organizationId}`);
    expect(all.body.items.some((i: Json) => i.id === done.id)).toBe(true);
    expect((await get(w.noTrade, "/assessments")).body.items).toEqual([]);
  });
});

// ---- The placement assessment ----

const rules = latestTradeRules();

const placementAnswers = (overrides: Record<string, Wire> = {}) => fillIn(placement, overrides);

async function placementDraft(): Promise<Json> {
  return startFor(w.owner, "placement", await freshEnrollment());
}

describe("the placement assessment", () => {
  it("saves partial answers, converts scores and resumes", async () => {
    const draft = await placementDraft();
    const saved = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { A1: "never", B1: "2", B2: { notKnown: true } } });
    expect(saved.status).toBe(200);
    expect(saved.body.answers).toEqual({ A1: "never", B1: "2", B2: { notKnown: true } });
    const [b1] = await db.select().from(schema.assessmentResponse).where(and(eq(schema.assessmentResponse.assessmentId, draft.id), eq(schema.assessmentResponse.questionId, "B1")));
    expect(b1?.answer).toEqual({ v: 2 });
    expect(saved.body.progress.total).toBeGreaterThan(30);
  });

  it("refuses answers the question can't take", async () => {
    const draft = await placementDraft();
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { A1: "sometimes" } })).status).toBe(422);
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { B1: "7" } })).status).toBe(422);
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { A1: { notKnown: true } } })).status).toBe(422);
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { A1: { notApplicable: true, reason: "Because." } } })).status).toBe(422);
  });

  it("needs a reason for \"does not apply\"", async () => {
    const draft = await placementDraft();
    const without = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { B1: { notApplicable: true, reason: "  " } } });
    expect(without.status).toBe(422);
    expect(without.body.error).toContain("why");
    const ok = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { B1: { notApplicable: true, reason: "We sell only at home." } } });
    expect(ok.body.answers.B1).toEqual({ notApplicable: true, reason: "We sell only at home." });
    expect(ok.body.notApplicableApproved).toEqual({ B1: false });
  });

  it("remembers which questions have documents", async () => {
    const draft = await placementDraft();
    const evidence = placement.questions.find((q) => q.evidenceBased)!;
    const saved = await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { [evidence.id]: evidence.type === "multiple_choice" ? [evidence.options![0]!.value] : evidence.options![0]!.value }, documents: { [evidence.id]: true } });
    expect(saved.body.documents).toEqual({ [evidence.id]: true });
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { documents: { A3: true } })).status).toBe(422);
  });

  it("submits a complete assessment, and locks it", async () => {
    const draft = await placementDraft();
    await put(w.owner, `/assessments/${draft.id}/responses`, { answers: placementAnswers({ A1: "never", A2: "none", A5: ["not_available"] }) });
    const early = await post(w.owner, `/assessments/${draft.id}/submit`);
    expect(early.status).toBe(200);
    expect(early.body.status).toBe("submitted");
    expect((await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { A1: "regular_exports" } })).status).toBe(409);
  });

  it("goes to staff review when answers disagree, but still submits", async () => {
    const draft = await placementDraft();
    await put(w.owner, `/assessments/${draft.id}/responses`, { answers: placementAnswers({ A1: "never", A2: "none", A5: ["shipment_record"] }) });
    const submitted = await post(w.owner, `/assessments/${draft.id}/submit`);
    expect(submitted.status).toBe(200);
    expect(submitted.body.status).toBe("review_required");
    expect(submitted.body.conflicts[0].code).toBe("shipment_evidence_contradicts_history");
    expect(submitted.body.reviewReasons.join(" ")).toContain("A5");
  });

  it("refuses to submit with questions unanswered", async () => {
    const draft = await placementDraft();
    await put(w.owner, `/assessments/${draft.id}/responses`, { answers: { A1: "never" } });
    const res = await post(w.owner, `/assessments/${draft.id}/submit`);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("answer this question");
  });

  it("waits for staff to approve a \"does not apply\", and nobody else can", async () => {
    const draft = await placementDraft();
    await put(w.owner, `/assessments/${draft.id}/responses`, {
      answers: placementAnswers({ A1: "never", A2: "none", A5: ["not_available"], B1: { notApplicable: true, reason: "We sell only at home." } }),
    });
    const submitted = await post(w.owner, `/assessments/${draft.id}/submit`);
    expect(submitted.body.status).toBe("review_required");
    expect(submitted.body.reviewReasons.join(" ")).toContain("B1");

    const path = `/assessments/${draft.id}/responses/B1/approve`;
    expect((await post(w.owner, path)).status).toBe(403);
    expect((await post(w.reviewer, path)).status).toBe(403);
    expect((await post(w.admin, `/assessments/${draft.id}/responses/B2/approve`)).status).toBe(404);

    const approved = await post(w.admin, path);
    expect(approved.status).toBe(200);
    expect(approved.body).toMatchObject({ status: "submitted", notApplicableApproved: { B1: true } });
    const [row] = await db.select().from(schema.assessmentResponse).where(and(eq(schema.assessmentResponse.assessmentId, draft.id), eq(schema.assessmentResponse.questionId, "B1")));
    expect(row).toMatchObject({ approvedByUserId: w.admin.id, unscoredReason: "We sell only at home." });
  });

  it("keeps the placement assessment and the diagnostic apart for one enrolment", async () => {
    const enrollmentId = await freshEnrollment();
    const d = await startFor(w.owner, "diagnostic", enrollmentId);
    const p = await startFor(w.owner, "placement", enrollmentId);
    expect(d.id).not.toBe(p.id);
    expect(p.templateVersion).toBe(rules.version);
  });
});
