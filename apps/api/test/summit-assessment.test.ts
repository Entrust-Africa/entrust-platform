import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findSummitRules, scoreApplication, type SummitRules } from "@entrust/summit-engine";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { callV1, cleanup, COUNTRY, createOrganization, db, makeFile, PREFIX, signUp, type Json, type TestUser } from "./support";
import { completeAnswers } from "./summit-form";

// The officer's workspace (#79): scoring against the approved scorecard, adjustments, category notes, claim
// classification, internal comments, requests for more information, the recommendation. The application itself
// (periods, answering, eligibility, assignment) is in summit.test.ts.
// The factory runs before the imports above are ready, so it loads the helper itself.
vi.mock("../src/services/summit-forms", async (importOriginal) => (await import("./summit-form")).withPublishedForm(await importOriginal()));

// The emails go to the background worker; here the queue is a list.
const queue = vi.hoisted(() => ({ jobs: [] as { name: string; data: any }[], failNext: false }));
vi.mock("@entrust/jobs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@entrust/jobs")>()),
  enqueue: vi.fn(async (name: string, data: unknown) => {
    if (queue.failNext) {
      queue.failNext = false;
      throw new Error("The queue is down");
    }
    queue.jobs.push({ name, data });
    return "job-1";
  }),
}));

const w = {} as {
  ownerA: TestUser; ownerB: TestUser; ownerC: TestUser; outsider: TestUser;
  admin: TestUser; facilitator: TestUser; reviewer: TestUser; reviewer2: TestUser; strayOwner: TestUser;
  orgA: string; orgB: string; orgC: string; entrust: string;
  periodId: string; appA: string; appB: string; appC: string;
};

const S = "/summit";
const call = (user: TestUser | null, method: string, path: string, body?: unknown) => callV1(user, method, `${S}${path}`, body);
const rules = findSummitRules("1.0.0") as SummitRules;

let form: Json;

/** The assessment workspace, as `user`. */
const workspace = async (user: TestUser, id: string) => {
  const res = await call(user, "GET", `/applications/${id}/assessment`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
};
const criteriaOf = (view: Json): Json[] => view.categories.flatMap((c: Json) => c.criteria);
const criterion = (view: Json, id: string): Json => criteriaOf(view).find((c) => c.id === id);
const internalStatus = async (id: string) => (await call(w.admin, "GET", `/applications/${id}`)).body.status as string;

/** Points that add up to `earned` over the criteria the workspace shows, filling each to its maximum in turn. */
function scoresFor(view: Json, earned: number): Record<string, number> {
  const scores: Record<string, number> = {};
  let left = earned;
  for (const c of criteriaOf(view)) {
    scores[c.id] = Math.min(c.maxPoints, left);
    left -= scores[c.id]!;
  }
  expect(left).toBe(0);
  return scores;
}

/** Every applicable category's justification and evidence, so the assessment can be completed. */
async function writeNotes(id: string) {
  const view = await workspace(w.reviewer, id);
  for (const c of view.categories.filter((c: Json) => c.applicable)) {
    const res = await call(w.reviewer, "PUT", `/applications/${id}/assessment/notes/${c.id}`, {
      justification: `Category ${c.id} is scored from the application.`,
      evidence: ["Registration certificate", "Answer S2.2"],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
}

/** An application submitted, eligible and assigned to `officer`. */
async function eligibleApplication(owner: TestUser, organizationId: string, officer: TestUser, overrides: Record<string, string> = {}) {
  const created = await call(owner, "POST", "/applications", { organizationId });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const id = created.body.id as string;
  const saved = await call(owner, "PATCH", `/applications/${id}/answers`, { answers: completeAnswers(form, { ...created.body.answers, ...overrides }) });
  expect(saved.status, JSON.stringify(saved.body)).toBe(200);
  for (const [name, kind] of [["certificate.pdf", "registration_certificate"], ["catalogue.pdf", "product_information"]] as const) {
    const attached = await call(owner, "POST", `/applications/${id}/documents`, { fileId: await makeFile(organizationId, owner.id, name), kind });
    expect(attached.status).toBe(201);
  }
  const submitted = await call(owner, "POST", `/applications/${id}/submit`);
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
  const assigned = await call(w.facilitator, "PUT", `/applications/${id}/officer`, { officerUserId: officer.id });
  expect(assigned.status, JSON.stringify(assigned.body)).toBe(200);
  return id;
}

beforeAll(async () => {
  await cleanup();
  const names = ["owner-a", "owner-b", "owner-c", "outsider", "admin", "facilitator", "reviewer", "reviewer2", "stray-owner"];
  const [ownerA, ownerB, ownerC, outsider, admin, facilitator, reviewer, reviewer2, strayOwner] = await Promise.all(names.map(signUp));
  Object.assign(w, { ownerA, ownerB, ownerC, outsider, admin, facilitator, reviewer, reviewer2, strayOwner });
  w.orgA = await createOrganization("org-a", [[ownerA!, "owner"]]);
  w.orgB = await createOrganization("org-b", [[ownerB!, "owner"]]);
  w.orgC = await createOrganization("org-c", [[ownerC!, "owner"]]);
  w.entrust = await createOrganization(
    "entrust",
    [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"], [reviewer2!, "reviewer"], [strayOwner!, "owner"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrust;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime("2030-01-15T10:00:00Z");

  const period = await call(w.admin, "POST", "/periods", {
    name: `${PREFIX}summit-assessment`,
    opensAt: "2030-01-01T00:00:00Z",
    closesAt: "2030-02-01T00:00:00Z",
    countries: [COUNTRY],
  });
  expect(period.status, JSON.stringify(period.body)).toBe(201);
  w.periodId = period.body.id;
  form = (await call(w.ownerA, "GET", "/forms/0.1.0")).body;

  // A seeks investment as well as trade, so every category is scored. B is trade only, so category D is left out.
  w.appA = await eligibleApplication(ownerA!, w.orgA, reviewer!, { "S4.1": "yes" });
  w.appB = await eligibleApplication(ownerB!, w.orgB, reviewer!, { "S4.1": "no" });
  w.appC = (await call(ownerC!, "POST", "/applications", { organizationId: w.orgC })).body.id;
});

afterAll(async () => {
  vi.useRealTimers();
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("signed out", () => {
  it("is refused everywhere, before the request is even read", async () => {
    const id = randomUUID();
    for (const [method, path, body] of [
      ["GET", `/applications/${id}/assessment`],
      ["POST", `/applications/${id}/assessment/scores`, {}],
      ["POST", `/applications/${id}/assessment/adjustments`, {}],
      ["PUT", `/applications/${id}/assessment/notes/A`, {}],
      ["POST", `/applications/${id}/assessment/complete`],
      ["PUT", `/applications/${id}/verification/annual_revenue`, {}],
      ["POST", `/applications/${id}/comments`, {}],
      ["POST", `/applications/${id}/stage`, {}],
      ["POST", `/applications/${id}/clarifications`, {}],
      ["POST", `/applications/${id}/clarifications/${id}/respond`, {}],
      ["POST", `/applications/${id}/recommendation`, {}],
    ] as const) {
      const res = await call(null, method, path, body);
      expect([method, path, res.status, res.body.code]).toEqual([method, path, 401, "unauthenticated"]);
    }
  });
});

describe("opening the workspace", () => {
  it("shows the approved scorecard, not started, to the assigned officer, an administrator and a facilitator", async () => {
    for (const user of [w.reviewer, w.admin, w.facilitator]) {
      const view = await workspace(user, w.appA);
      expect(view).toMatchObject({
        applicationId: w.appA,
        status: "under_assessment",
        rulesVersion: "1.0.0",
        approved: true,
        state: "not_started",
        pathway: "trade_and_market_access",
        seekingInvestment: true,
        recommendation: null,
        completedAt: null,
        score: { complete: false, points: null, possible: 100, total: null, normalized: false, notApplicable: [] },
      });
      expect(view.categories.map((c: Json) => [c.id, c.maxPoints])).toEqual([["A", 10], ["B", 15], ["C", 20], ["D", 20], ["E", 15], ["F", 10], ["G", 10]]);
      expect(criterion(view, "A1")).toMatchObject({ points: null, original: null, adjusted: false });
      expect(criterion(view, "A1").guidance.length).toBeGreaterThan(0);
    }
  });

  it("is not for an applicant, a stranger, or an officer it isn't assigned to", async () => {
    expect((await call(w.ownerA, "GET", `/applications/${w.appA}/assessment`)).status).toBe(403);
    for (const user of [w.reviewer2, w.ownerB, w.outsider, w.strayOwner]) {
      expect((await call(user, "GET", `/applications/${w.appA}/assessment`)).status).toBe(404);
    }
  });

  it("has nothing to show before the application is submitted", async () => {
    expect((await call(w.admin, "GET", `/applications/${w.appC}/assessment`)).status).toBe(409);
  });

  it("leaves category D out for an applicant that isn't seeking investment", async () => {
    const view = await workspace(w.reviewer, w.appB);
    expect(view.seekingInvestment).toBe(false);
    expect(view.score).toMatchObject({ possible: 80, normalized: true, notApplicable: ["D"] });
    const d = view.categories.find((c: Json) => c.id === "D");
    expect(d).toMatchObject({ applicable: false, criteria: [], points: null });
  });
});

describe("recording scores", () => {
  it("is for the assigned officer alone", async () => {
    const body = { scores: { A1: 2 } };
    for (const user of [w.admin, w.facilitator, w.ownerA]) expect((await call(user, "POST", `/applications/${w.appA}/assessment/scores`, body)).status).toBe(403);
    expect((await call(w.reviewer2, "POST", `/applications/${w.appA}/assessment/scores`, body)).status).toBe(404);
    expect((await call(w.reviewer, "POST", `/applications/${w.appC}/assessment/scores`, body)).status).toBe(404);
  });

  it("starts the assessment with the first score and remembers who gave it", async () => {
    const res = await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores: { A1: 2, A2: 1 } });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.state).toBe("in_progress");
    expect(criterion(res.body, "A1")).toMatchObject({ points: 2, adjusted: false, original: { points: 2, by: { name: "reviewer" } } });
    expect(criterion(res.body, "A2").points).toBe(1);
    expect(res.body.categories.find((c: Json) => c.id === "A").points).toBeNull();

    const [assessment] = await db.select().from(schema.assessment).where(eq(schema.assessment.applicationId, w.appA));
    expect(assessment).toMatchObject({ rulesVersion: "1.0.0", pathway: "trade_and_market_access", seekingInvestment: true });
  });

  it("never overwrites a recorded score", async () => {
    const again = await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores: { A1: 3, A3: 1 } });
    expect(again.status).toBe(409);
    expect(again.body.error).toContain("A1 is already scored");
    // The refused request recorded nothing, not even the new criterion in it.
    const view = await workspace(w.reviewer, w.appA);
    expect(criterion(view, "A1").points).toBe(2);
    expect(criterion(view, "A3").points).toBeNull();
  });

  it("refuses points that are out of range, not whole, or for a criterion that doesn't exist", async () => {
    const record = (scores: Record<string, number>) => call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores });
    const high = await record({ A3: 99 });
    expect(high.status).toBe(422);
    expect(high.body.error).toContain("A3");
    expect((await record({ A3: 1.5 })).status).toBe(422);
    expect((await record({ A3: -1 })).status).toBe(422);
    expect((await record({ Z9: 1 })).status).toBe(422);
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores: {} })).status).toBe(400);
    // Category D isn't scored for B, so one of its criteria can't be.
    const dOfA = criterion(await workspace(w.reviewer, w.appA), "D1");
    expect((await call(w.reviewer, "POST", `/applications/${w.appB}/assessment/scores`, { scores: { [dOfA.id]: 1 } })).status).toBe(422);
  });

  it("hands the assessment to another officer without losing the scores", async () => {
    const moved = await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.reviewer2.id });
    expect(moved.status).toBe(200);
    expect((await call(w.reviewer, "GET", `/applications/${w.appA}/assessment`)).status).toBe(404);
    const view = await workspace(w.reviewer2, w.appA);
    expect(view.state).toBe("in_progress");
    expect(criterion(view, "A1")).toMatchObject({ points: 2, original: { by: { name: "reviewer" } } });
    const more = await call(w.reviewer2, "POST", `/applications/${w.appA}/assessment/scores`, { scores: { A3: 3 } });
    expect(criterion(more.body, "A3").original.by.name).toBe("reviewer2");
    await call(w.facilitator, "PUT", `/applications/${w.appA}/officer`, { officerUserId: w.reviewer.id });
  });

  it("gives the same score for the same answers and rubric as the engine does", async () => {
    const view = await workspace(w.reviewer, w.appB);
    const scores = scoresFor(view, 64);
    const res = await call(w.reviewer, "POST", `/applications/${w.appB}/assessment/scores`, { scores });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    // The scorecard's worked example: 64 of 80 is 80 out of 100.
    expect(res.body.score).toMatchObject({ complete: true, points: 64, possible: 80, total: 80, normalized: true, notApplicable: ["D"] });
    const expected = scoreApplication(rules, { pathway: "trade_and_market_access", seekingInvestment: false, scores });
    expect(res.body.score.total).toBe(expected.total);
    expect(res.body.categories.map((c: Json) => c.points)).toEqual(expected.categories.map((c) => c.points ?? null));
    expect((await workspace(w.admin, w.appB)).score).toEqual(res.body.score);
  });
});

describe("adjusting a score", () => {
  const adjust = (user: TestUser, id: string, body: object) => call(user, "POST", `/applications/${id}/assessment/adjustments`, body);

  it("keeps the original and records the previous score, the new one, the reason, who and when", async () => {
    const res = await adjust(w.reviewer, w.appA, { criterion: "A1", points: 3, reason: "The certificate shows a second licence." });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(criterion(res.body, "A1")).toMatchObject({ points: 3, adjusted: true, original: { points: 2 } });
    expect(res.body.adjustments).toMatchObject([
      { criterion: "A1", previousPoints: 2, newPoints: 3, reason: "The certificate shows a second licence.", by: { name: "reviewer" } },
    ]);
    expect(Date.parse(res.body.adjustments[0].at)).not.toBeNaN();

    const [assessment] = await db.select().from(schema.assessment).where(eq(schema.assessment.applicationId, w.appA));
    const original = await db.select().from(schema.criterionScore).where(eq(schema.criterionScore.assessmentId, assessment!.id));
    expect(original.find((s) => s.criterionId === "A1")?.points).toBe(2);
  });

  it("chains: the next adjustment's previous score is the last one's new score", async () => {
    const res = await adjust(w.reviewer, w.appA, { criterion: "A1", points: 1, reason: "On reflection, the licence has lapsed." });
    expect(res.body.adjustments.map((a: Json) => [a.previousPoints, a.newPoints])).toEqual([[2, 3], [3, 1]]);
    expect(criterion(res.body, "A1")).toMatchObject({ points: 1, original: { points: 2 } });
  });

  it("refuses a change that isn't one", async () => {
    expect((await adjust(w.reviewer, w.appA, { criterion: "A1", points: 1, reason: "Same" })).status).toBe(422);
    expect((await adjust(w.reviewer, w.appA, { criterion: "A1", points: 99, reason: "Too many" })).status).toBe(422);
    expect((await adjust(w.reviewer, w.appA, { criterion: "A1", points: 1.5, reason: "Half" })).status).toBe(422);
    expect((await adjust(w.reviewer, w.appA, { criterion: "B1", points: 1, reason: "Not scored yet" })).status).toBe(422);
    expect((await adjust(w.reviewer, w.appA, { criterion: "A1", points: 2, reason: " " })).status).toBe(400);
    expect((await adjust(w.reviewer, w.appC, { criterion: "A1", points: 2, reason: "x" })).status).toBe(404);
  });

  it("is for the officer and the administrators, not the applicant or an officer without the application", async () => {
    expect((await adjust(w.ownerA, w.appA, { criterion: "A1", points: 2, reason: "x" })).status).toBe(403);
    expect((await adjust(w.reviewer2, w.appA, { criterion: "A1", points: 2, reason: "x" })).status).toBe(404);
    const byFacilitator = await adjust(w.facilitator, w.appA, { criterion: "A2", points: 2, reason: "Moderated against the sample." });
    expect(byFacilitator.status, JSON.stringify(byFacilitator.body)).toBe(201);
    expect(byFacilitator.body.adjustments.at(-1)).toMatchObject({ previousPoints: 1, newPoints: 2, by: { name: "facilitator" } });
  });

  it("writes the audit log", async () => {
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.appA)).orderBy(asc(schema.auditLog.occurredAt));
    const adjusted = audit.filter((a) => a.action === "summit.assessment.adjusted");
    expect(adjusted).toHaveLength(3);
    expect(adjusted[0]).toMatchObject({ platform: "summit", before: { criterion: "A1", points: 2 }, after: { criterion: "A1", points: 3 }, reason: "The certificate shows a second licence." });
    expect(audit.map((a) => a.action)).toContain("summit.assessment.scored");
  });
});

describe("claims", () => {
  const classify = (user: TestUser, claim: string, body: object, id = w.appA) => call(user, "PUT", `/applications/${id}/verification/${claim}`, body);
  let documentId: string;

  beforeAll(async () => {
    documentId = (await call(w.ownerA, "GET", `/applications/${w.appA}`)).body.documents[0].id;
  });

  it("never lets an uploaded document alone make a claim independently verified", async () => {
    const res = await classify(w.reviewer, "business_registration", { class: "independently_verified", documents: [documentId] });
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("independently verified");
    const ok = await classify(w.reviewer, "business_registration", {
      class: "independently_verified",
      documents: [documentId],
      independentCheck: "Looked up the licence number in the national registry.",
    });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.verification).toMatchObject([
      {
        claim: "business_registration",
        label: "Business registration",
        class: "independently_verified",
        independentCheck: "Looked up the licence number in the national registry.",
        by: { name: "reviewer" },
      },
    ]);
    expect(ok.body.verification[0].documents).toMatchObject([{ id: documentId, kind: "registration_certificate" }]);
  });

  it("checks the classification and the documents it names", async () => {
    expect((await classify(w.reviewer, "annual_revenue", { class: "document_supported" })).status).toBe(422);
    expect((await classify(w.reviewer, "annual_revenue", { class: "self_reported", independentCheck: "Called the bank." })).status).toBe(422);
    expect((await classify(w.reviewer, "annual_revenue", { class: "not_applicable", documents: [documentId] })).status).toBe(422);
    expect((await classify(w.reviewer, "annual_revenue", { class: "document_supported", documents: [randomUUID()] })).status).toBe(422);
    expect((await classify(w.reviewer, "annual_revenue", { class: "nonsense" })).status).toBe(400);
    // A document of another application isn't this one's.
    const other = (await call(w.ownerB, "GET", `/applications/${w.appB}`)).body.documents[0].id;
    expect((await classify(w.reviewer, "annual_revenue", { class: "document_supported", documents: [other] })).status).toBe(422);
  });

  it("classifies any other claim, and a second classification replaces the first and leaves the old one in the audit log", async () => {
    await classify(w.reviewer, "buyer_reference_letter", { class: "self_reported" });
    const again = await classify(w.reviewer, "buyer_reference_letter", { class: "document_supported", documents: [documentId] });
    expect(again.status).toBe(200);
    const claim = again.body.verification.filter((v: Json) => v.claim === "buyer_reference_letter");
    expect(claim).toMatchObject([{ label: null, class: "document_supported" }]);

    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.appA));
    const replaced = audit.find((a) => a.action === "summit.verification.recorded" && (a.before as Json | null)?.claim === "buyer_reference_letter");
    expect(replaced?.before).toMatchObject({ class: "self_reported" });
  });

  it("is for the assigned officer alone", async () => {
    expect((await classify(w.admin, "annual_revenue", { class: "self_reported" })).status).toBe(403);
    expect((await classify(w.facilitator, "annual_revenue", { class: "self_reported" })).status).toBe(403);
    expect((await classify(w.ownerA, "annual_revenue", { class: "self_reported" })).status).toBe(403);
    expect((await classify(w.reviewer2, "annual_revenue", { class: "self_reported" })).status).toBe(404);
  });

  it("lists the claims the specification gives as examples", async () => {
    const view = await workspace(w.reviewer, w.appA);
    expect(view.claims.map((c: Json) => c.id)).toEqual([
      "business_registration", "annual_revenue", "export_history", "buyer_relationship", "production_capacity", "investment_requirement", "product_quality",
    ]);
  });
});

describe("stage and internal comments", () => {
  it("moves an application between assessment and verification", async () => {
    const to = (user: TestUser, stage: string) => call(user, "POST", `/applications/${w.appA}/stage`, { to: stage });
    expect((await to(w.facilitator, "under_verification")).status).toBe(403);
    const moved = await to(w.reviewer, "under_verification");
    expect(moved.status, JSON.stringify(moved.body)).toBe(200);
    expect(moved.body.status).toBe("under_verification");
    expect((await to(w.reviewer, "under_verification")).status).toBe(409);
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/stage`, { to: "selected" })).status).toBe(400);
    // Scoring carries on in verification.
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores: { B1: 1 } })).status).toBe(201);
    expect((await to(w.reviewer, "under_assessment")).body.status).toBe("under_assessment");
  });

  it("keeps comments between staff, in order, and out of the applicant's sight", async () => {
    const note = (user: TestUser, body: string) => call(user, "POST", `/applications/${w.appA}/comments`, { body });
    expect((await note(w.reviewer, "Strong buyer evidence; check the licence date.")).status).toBe(201);
    const second = await note(w.facilitator, "Agreed. Second look after the clarification.");
    expect(second.body.comments.map((c: Json) => [c.by.name, c.body])).toEqual([
      ["reviewer", "Strong buyer evidence; check the licence date."],
      ["facilitator", "Agreed. Second look after the clarification."],
    ]);
    expect((await note(w.ownerA, "I should not be able to say this")).status).toBe(403);
    expect((await note(w.reviewer2, "Not mine")).status).toBe(404);
    expect((await note(w.reviewer, " ")).status).toBe(400);

    const applicantView = JSON.stringify((await call(w.ownerA, "GET", `/applications/${w.appA}`)).body);
    expect(applicantView).not.toContain("Strong buyer evidence");
    expect(applicantView).not.toContain("licence date");
  });
});

describe("requests for more information", () => {
  const request = (user: TestUser, message: string, id = w.appA) => call(user, "POST", `/applications/${id}/clarifications`, { message });

  it("holds the application, tells the applicant, and shows them the request and nothing else of the assessment", async () => {
    queue.jobs.length = 0;
    const res = await request(w.reviewer, "Please send your export licence for 2029.");
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.status).toBe("awaiting_additional_information");
    expect(res.body.clarifications).toMatchObject([
      { message: "Please send your export licence for 2029.", open: true, response: null, requestedBy: { name: "reviewer" } },
    ]);
    expect(res.body.clarifications[0].notifiedAt).not.toBeNull();

    // The email went to the person who applied, once.
    expect(queue.jobs).toHaveLength(1);
    const [applicant] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, w.ownerA.id));
    const email = applicant?.email;
    expect(queue.jobs[0]).toMatchObject({
      name: "send-email",
      data: {
        to: [email],
        template: "summit-clarification",
        props: { organizationName: "org-a", message: "Please send your export licence for 2029." },
      },
    });
    expect(queue.jobs[0]!.data.subject).toContain(res.body.number);

    // The applicant sees the request and can attach documents, but the answers stay as scored.
    const seen = (await call(w.ownerA, "GET", `/applications/${w.appA}`)).body;
    expect(seen).toMatchObject({ status: "action_required", editable: false, canSubmit: false, canEditDocuments: true });
    expect(seen.clarifications).toMatchObject([{ message: "Please send your export licence for 2029.", open: true, requestedBy: null, notifiedAt: null }]);
    const text = JSON.stringify(seen);
    expect(text).not.toContain("Strong buyer evidence");
    expect(seen.staff).toBeUndefined();
    expect((await call(w.ownerA, "GET", `/applications/${w.appA}/assessment`)).status).toBe(403);
  });

  it("waits for one request at a time, and only while the application is in assessment", async () => {
    expect((await request(w.reviewer, "A second question")).status).toBe(409);
    expect((await request(w.admin, "A second question")).status).toBe(409);
    expect((await request(w.reviewer2, "Not mine")).status).toBe(404);
    expect((await request(w.ownerA, "Not allowed")).status).toBe(403);
    expect((await request(w.reviewer, "", w.appA)).status).toBe(400);
    expect((await request(w.admin, "Too early", w.appC)).status).toBe(409);
  });

  it("lets the applicant add documents while the request is open, but not change answers or submit again", async () => {
    const licence = await makeFile(w.orgA, w.ownerA.id, "export-licence.pdf");
    const added = await call(w.ownerA, "POST", `/applications/${w.appA}/documents`, { fileId: licence, kind: "export_records" });
    expect(added.status, JSON.stringify(added.body)).toBe(201);
    expect(added.body.documents.map((d: Json) => d.kind)).toContain("export_records");
    expect((await call(w.ownerA, "PATCH", `/applications/${w.appA}/answers`, { answers: { "S1.2": "Changed" } })).status).toBe(409);
    expect((await call(w.ownerA, "POST", `/applications/${w.appA}/submit`)).status).toBe(409);
    const removed = await call(w.ownerA, "DELETE", `/applications/${w.appA}/documents/${added.body.documents.find((d: Json) => d.kind === "export_records").id}`);
    expect(removed.status).toBe(409);
  });

  it("returns the application to where it was when the applicant answers", async () => {
    const open = (await call(w.ownerA, "GET", `/applications/${w.appA}`)).body.clarifications[0];
    const answer = (user: TestUser, id: string, response = "The licence is attached.") =>
      call(user, "POST", `/applications/${w.appA}/clarifications/${id}/respond`, { response });
    expect((await answer(w.reviewer, open.id)).status).toBe(403);
    expect((await answer(w.facilitator, open.id)).status).toBe(403);
    expect((await answer(w.ownerB, open.id)).status).toBe(404);
    expect((await answer(w.ownerA, randomUUID())).status).toBe(404);
    expect((await answer(w.ownerA, open.id, " ")).status).toBe(400);

    const res = await answer(w.ownerA, open.id);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ status: "in_review", canEditDocuments: false });
    expect(res.body.clarifications).toMatchObject([{ open: false, response: "The licence is attached.", respondedAt: expect.any(String) }]);
    expect(await internalStatus(w.appA)).toBe("under_assessment");
    expect((await answer(w.ownerA, open.id)).status).toBe(409);
  });

  it("returns to verification when that is where the request came from", async () => {
    await call(w.reviewer, "POST", `/applications/${w.appA}/stage`, { to: "under_verification" });
    const asked = await request(w.facilitator, "Which bank holds the account?");
    expect(asked.status, JSON.stringify(asked.body)).toBe(201);
    expect(asked.body.clarifications.at(-1).requestedBy.name).toBe("facilitator");
    const id = asked.body.clarifications.at(-1).id;
    await call(w.ownerA, "POST", `/applications/${w.appA}/clarifications/${id}/respond`, { response: "Commercial Bank of Ethiopia." });
    expect(await internalStatus(w.appA)).toBe("under_verification");
    await call(w.reviewer, "POST", `/applications/${w.appA}/stage`, { to: "under_assessment" });
    expect(queue.jobs).toHaveLength(2);
  });

  it("keeps the request when the email can't be queued, and says the applicant wasn't told", async () => {
    queue.failNext = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await request(w.reviewer, "One more thing: the tax clearance.");
    log.mockRestore();
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.clarifications.at(-1)).toMatchObject({ open: true, notifiedAt: null });
    const open = (await call(w.ownerA, "GET", `/applications/${w.appA}`)).body.clarifications.at(-1);
    await call(w.ownerA, "POST", `/applications/${w.appA}/clarifications/${open.id}/respond`, { response: "Attached." });
    expect(await internalStatus(w.appA)).toBe("under_assessment");
  });

  it("is recorded in the audit log", async () => {
    const actions = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, w.appA))).map((a) => a.action);
    expect(actions.filter((a) => a === "summit.clarification.requested")).toHaveLength(3);
    expect(actions.filter((a) => a === "summit.clarification.answered")).toHaveLength(3);
  });
});

describe("completing the assessment", () => {
  const complete = (user: TestUser, id = w.appA) => call(user, "POST", `/applications/${id}/assessment/complete`);

  it("needs every applicable criterion scored", async () => {
    const res = await complete(w.reviewer);
    expect(res.status).toBe(422);
    expect(res.body.error).toContain("Still to score");
    expect(res.body.error).toContain("A4");
    expect(await internalStatus(w.appA)).toBe("under_assessment");
    expect((await complete(w.reviewer, w.appC)).status).toBe(404);
  });

  it("needs a justification for each category and the evidence the points rest on", async () => {
    const view = await workspace(w.reviewer, w.appA);
    const remaining = Object.fromEntries(criteriaOf(view).filter((c) => c.points === null).map((c) => [c.id, c.maxPoints]));
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores: remaining })).status).toBe(201);

    const unfinished = await complete(w.reviewer);
    expect(unfinished.status).toBe(422);
    expect(unfinished.body.error).toContain("record a short justification");
    // A justification with no evidence still leaves a category that earned points short.
    await call(w.reviewer, "PUT", `/applications/${w.appA}/assessment/notes/A`, { justification: "A solid registered business.", evidence: [] });
    const noEvidence = await complete(w.reviewer);
    expect(noEvidence.body.error).toContain("Category A: reference the evidence");
    const withNotes = await workspace(w.reviewer, w.appA);
    expect(withNotes.noteProblems.map((p: Json) => p.category)).toContain("A");
    expect(withNotes.noteProblems.map((p: Json) => p.category)).toContain("B");
  });

  it("completes it, and the applicant is told nothing but that it is in review", async () => {
    await writeNotes(w.appA);
    expect((await complete(w.admin)).status).toBe(403);
    expect((await complete(w.reviewer2)).status).toBe(404);

    const res = await complete(w.reviewer);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ state: "completed", status: "assessment_completed", completedBy: { name: "reviewer" }, noteProblems: [] });
    expect(res.body.score.complete).toBe(true);
    const sum = criteriaOf(res.body).reduce((total, c) => total + c.points, 0);
    expect(res.body.score).toMatchObject({ points: sum, possible: 100, total: sum, normalized: false });
    expect(await internalStatus(w.appA)).toBe("assessment_completed");
    expect((await call(w.ownerA, "GET", `/applications/${w.appA}`)).body.status).toBe("in_review");
  });

  it("closes scoring to the officer, but an administrator can still adjust", async () => {
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/scores`, { scores: { A1: 1 } })).status).toBe(409);
    expect((await call(w.reviewer, "PUT", `/applications/${w.appA}/assessment/notes/A`, { justification: "x", evidence: ["y"] })).status).toBe(409);
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/adjustments`, { criterion: "B1", points: 0, reason: "x" })).status).toBe(409);
    expect((await call(w.reviewer, "POST", `/applications/${w.appA}/assessment/complete`)).status).toBe(409);

    const before = (await workspace(w.admin, w.appA)).score;
    const adjusted = await call(w.admin, "POST", `/applications/${w.appA}/assessment/adjustments`, { criterion: "B1", points: 0, reason: "Second marker disagreed." });
    expect(adjusted.status, JSON.stringify(adjusted.body)).toBe(201);
    expect(adjusted.body.score.points).toBe(before.points - 1);
    expect(adjusted.body.adjustments.at(-1)).toMatchObject({ criterion: "B1", previousPoints: 1, newPoints: 0, by: { name: "admin" } });
  });
});

describe("the recommendation", () => {
  const recommend = (user: TestUser, id: string, body: object) => call(user, "POST", `/applications/${id}/recommendation`, body);
  const good = { recommendation: "recommend_selection", suitableOpportunity: "combined", rationale: "Strong buyers and a clear use of funds." };

  it("waits until the assessment is complete", async () => {
    expect((await recommend(w.reviewer, w.appB, good)).status).toBe(409);
  });

  it("is the assigned officer's, with a known recommendation and opportunity", async () => {
    expect((await recommend(w.admin, w.appA, good)).status).toBe(403);
    expect((await recommend(w.facilitator, w.appA, good)).status).toBe(403);
    expect((await recommend(w.ownerA, w.appA, good)).status).toBe(403);
    expect((await recommend(w.reviewer2, w.appA, good)).status).toBe(404);
    expect((await recommend(w.reviewer, w.appA, { ...good, recommendation: "approve" })).status).toBe(400);
    expect((await recommend(w.reviewer, w.appA, { ...good, suitableOpportunity: "everything" })).status).toBe(400);
    expect((await recommend(w.reviewer, w.appA, { ...good, rationale: " " })).status).toBe(400);
  });

  it("makes the application recommended, ready for the committee", async () => {
    const res = await recommend(w.reviewer, w.appA, good);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.status).toBe("recommended");
    expect(res.body.recommendation).toMatchObject({
      recommendation: "recommend_selection",
      label: "Recommend for Summit selection",
      suitableOpportunity: "combined",
      rationale: "Strong buyers and a clear use of funds.",
      by: { name: "reviewer" },
    });
    expect(await internalStatus(w.appA)).toBe("recommended");
    expect((await call(w.ownerA, "GET", `/applications/${w.appA}`)).body.status).toBe("in_review");
    expect((await recommend(w.reviewer, w.appA, good)).status).toBe(409);
    // An administrator can still correct a score until the committee starts.
    expect((await call(w.facilitator, "POST", `/applications/${w.appA}/assessment/adjustments`, { criterion: "C1", points: 1, reason: "Late correction." })).status).toBe(201);
  });

  it("is never shown to the applicant", async () => {
    const text = JSON.stringify((await call(w.ownerA, "GET", `/applications/${w.appA}`)).body);
    for (const secret of ["Strong buyers", "recommend_selection", "Second marker", "Late correction", "independent"]) expect(text).not.toContain(secret);
  });
});
