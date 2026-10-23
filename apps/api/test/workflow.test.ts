import { and, asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  FACTS, call, cleanup, createOrganization, db, lockPhase, markCompleted, prerequisitesOf, signUp, type Json, type TestUser,
} from "./support";

// Changing a case: facts, steps, evidence and clock inputs, with the audit trail each leaves.
const w = {} as { owner: TestUser; other: TestUser; admin: TestUser; facilitator: TestUser; reviewer: TestUser; org: string; entrust: string };

const openCase = async (facts: object = FACTS) => {
  const res = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.id as string;
};
const step = (detail: Json, id: string) => detail.workflow.steps.find((s: Json) => s.id === id);
const clock = (detail: Json, id: string) => detail.deadlines.find((c: Json) => c.id === id);

const transition = (user: TestUser, caseId: string, stepId: string, body: object) =>
  call(user, "POST", `/cases/${caseId}/steps/${stepId}/transition`, body);
const submit = (user: TestUser, caseId: string, type: string, issuedOn?: string) =>
  call(user, "POST", `/cases/${caseId}/evidence`, { type, ...(issuedOn ? { issuedOn } : {}) });
const review = (user: TestUser, caseId: string, evidenceId: string, body: object) =>
  call(user, "POST", `/cases/${caseId}/evidence/${evidenceId}/review`, body);
const latestOf = (detail: Json, type: string) => detail.evidence.findLast((e: Json) => e.type === type);

/** Submit, start review and approve one evidence type. */
async function approveEvidence(caseId: string, type: string, issuedOn?: string) {
  const submitted = await submit(w.owner, caseId, type, issuedOn);
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
  const id = latestOf(submitted.body, type).id;
  expect((await review(w.reviewer, caseId, id, { to: "under_review" })).status).toBe(200);
  const approved = await review(w.reviewer, caseId, id, { to: "approved" });
  expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  return approved.body;
}

const auditOf = (caseId: string) =>
  db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, caseId)).orderBy(asc(schema.auditLog.occurredAt));
const eventsOf = (caseId: string) =>
  db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, caseId)).orderBy(asc(schema.caseEvent.recordedAt));

beforeAll(async () => {
  await cleanup();
  const [owner, other, admin, facilitator, reviewer] = await Promise.all(["owner", "other", "admin", "facilitator", "reviewer"].map(signUp));
  Object.assign(w, { owner, other, admin, facilitator, reviewer });
  w.org = await createOrganization("org", [[owner!, "owner"], [other!, "member"]]);
  w.entrust = await createOrganization("entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("facts", () => {
  it("sets and clears facts, and the engine re-works which steps apply", async () => {
    const id = await openCase();
    expect(step((await call(w.owner, "GET", `/cases/${id}`)).body, "STEP-097").applicability).toBe("applicable");

    const air = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { transportMode: "air", paymentTerms: ["lc"] } });
    expect(air.status).toBe(200);
    expect(air.body.facts).toEqual({ ...FACTS, transportMode: "air", paymentTerms: ["lc"] });
    expect(step(air.body, "STEP-097").applicability).toBe("not_applicable"); // ISF is for sea cargo
    expect(step(air.body, "STEP-112").applicability).toBe("applicable"); // LC presentation clock

    const cleared = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { transportMode: null } });
    expect(cleared.body.facts).toEqual({ ...FACTS, paymentTerms: ["lc"], transportMode: undefined });
    expect(step(cleared.body, "STEP-097").applicability).toBe("undetermined");
  });

  it("changes the product and destination the list filters on", async () => {
    const id = await openCase();
    const res = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { destinationCountry: "de" } });
    expect(res.body).toMatchObject({ destinationCountry: "DE", facts: { destinationCountry: "DE" } });
  });

  it("refuses values the facts don't allow, and clearing the product or destination", async () => {
    const id = await openCase();
    for (const [facts, pattern] of [
      [{ transportMode: "rail" }, /Allowed/],
      [{ nonsense: "x" }, /not a case fact/],
      [{ product: null }, /can't be cleared/],
      [{ destinationCountry: "" }, /needs a value/],
    ] as const) {
      const res = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts });
      expect([JSON.stringify(facts), res.status]).toEqual([JSON.stringify(facts), 422]);
      expect(res.body.error).toMatch(pattern);
    }
    expect((await call(w.owner, "PATCH", `/cases/${id}/facts`, {})).status).toBe(400);
  });

  it("lets owners, members, admins and facilitators change facts, but not reviewers", async () => {
    const id = await openCase();
    for (const user of [w.other, w.admin, w.facilitator]) {
      expect((await call(user, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "no" } })).status).toBe(200);
    }
    const res = await call(w.reviewer, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "yes" } });
    expect(res).toMatchObject({ status: 403, body: { code: "forbidden" } });
  });

  it("writes before and after to the audit log and a facts_updated event, and nothing when nothing changed", async () => {
    const id = await openCase();
    await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "no" } });
    await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "no" } }); // no change
    const audit = (await auditOf(id)).filter((a) => a.action === "case.facts_updated");
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorUserId: w.owner.id, organizationId: w.org, platform: "clear", entityType: "export_case",
      before: FACTS, after: { ...FACTS, coldChain: "no" },
    });
    expect((await eventsOf(id)).map((e) => e.type)).toEqual(["case_created", "facts_updated"]);
  });

  it("locks recorded facts once a phase is signed off, but still takes new ones", async () => {
    const id = await openCase();
    await lockPhase(id, 1);
    const touch = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "no" } });
    expect(touch.status).toBe(200);
    expect(touch.body.workflow.phases[0].status).toBe("locked");
    expect(touch.body.currentPhase).toBe(2); // brought up to date from the engine's gates

    const change = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { transportMode: "air" } });
    expect(change).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    expect(change.body.error).toMatch(/Phase 1 is signed off.*amendment/);
    const clear = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: null } });
    expect(clear.status).toBe(422);
    const same = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { transportMode: "sea" } });
    expect(same.status).toBe(200); // not a change
    expect((await call(w.owner, "GET", `/cases?phase=2`)).body.items.map((c: Json) => c.id)).toContain(id);
  });
});

describe("steps", () => {
  it("walks a step through its statuses, moves the next action on, and records each change", async () => {
    const id = await openCase();
    const started = await transition(w.owner, id, "STEP-001", { to: "in_progress" });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    expect(step(started.body, "STEP-001")).toMatchObject({ status: "in_progress", derived: false });

    const done = await transition(w.owner, id, "STEP-001", { to: "completed" });
    expect(step(done.body, "STEP-001").status).toBe("completed");
    expect(done.body.workflow.nextAction).toMatchObject({ stepId: "STEP-002", kind: "provide_evidence", owner: "entrust" });

    const audit = (await auditOf(id)).filter((a) => a.action.startsWith("step."));
    expect(audit.map((a) => [a.action, a.actorUserId])).toEqual([["step.update", w.owner.id], ["step.complete", w.owner.id]]);
    expect(audit[1]).toMatchObject({ before: { stepId: "STEP-001", status: "in_progress" }, after: { stepId: "STEP-001", status: "completed", reason: null } });

    const events = (await eventsOf(id)).filter((e) => e.stepId === "STEP-001");
    expect(events.map((e) => e.type)).toEqual(["step_status_changed", "step_completed"]);
  });

  it("keeps a step blocked until its prerequisites are done", async () => {
    const id = await openCase();
    const res = await transition(w.facilitator, id, "STEP-002", { to: "in_progress" });
    expect(res).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    expect(res.body.error).toMatch(/waiting on STEP-001/);
  });

  it("refuses to complete a step until its evidence is approved, then lets it through", async () => {
    const id = await openCase();
    await transition(w.owner, id, "STEP-001", { to: "completed" });
    const early = await transition(w.facilitator, id, "STEP-002", { to: "completed" });
    expect(early).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    expect(early.body.error).toMatch(/needs approved, in-date evidence first: business_registration/);

    await approveEvidence(id, "business_registration");
    const done = await transition(w.facilitator, id, "STEP-002", { to: "completed" });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(step(done.body, "STEP-002").status).toBe("completed");
  });

  it("applies the roles the engine sets", async () => {
    const id = await openCase();
    // An Entrust step is not for the SME, nor an SME step for a reviewer.
    await transition(w.owner, id, "STEP-001", { to: "completed" });
    expect((await transition(w.owner, id, "STEP-002", { to: "in_progress" })).status).toBe(403);
    expect((await transition(w.reviewer, id, "STEP-005", { to: "in_progress" })).status).toBe(403);
    // Only Entrust admins and facilitators decide that a step doesn't apply, and with a reason.
    expect((await transition(w.owner, id, "STEP-005", { to: "not_applicable", reason: "Skip" })).status).toBe(403);
    const noReason = await transition(w.facilitator, id, "STEP-005", { to: "not_applicable" });
    expect(noReason).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    const marked = await transition(w.facilitator, id, "STEP-005", { to: "not_applicable", reason: "Sample product, no spec sheet" });
    expect(step(marked.body, "STEP-005")).toMatchObject({ status: "not_applicable", reason: "Sample product, no spec sheet" });
    expect((await auditOf(id)).find((a) => a.action === "step.mark_not_applicable")?.reason).toBe("Sample product, no spec sheet");
  });

  it("refuses a change the status table doesn't allow", async () => {
    const id = await openCase();
    const same = await transition(w.owner, id, "STEP-001", { to: "not_started" });
    expect(same).toMatchObject({ status: 409, body: { code: "invalid_transition" } });
    await transition(w.owner, id, "STEP-001", { to: "completed" });
    const again = await transition(w.owner, id, "STEP-001", { to: "completed" });
    expect(again).toMatchObject({ status: 409, body: { code: "invalid_transition" } });
    // Reopening is allowed, but not for the SME.
    const back = await transition(w.owner, id, "STEP-001", { to: "in_progress", reason: "Typo" });
    expect(back).toMatchObject({ status: 403, body: { code: "forbidden" } });
  });

  it("lets an Entrust facilitator reopen a completed step, with a reason", async () => {
    const id = await openCase();
    await transition(w.owner, id, "STEP-001", { to: "completed" });
    expect((await transition(w.owner, id, "STEP-001", { to: "in_progress", reason: "oops" })).status).toBe(403);
    expect((await transition(w.facilitator, id, "STEP-001", { to: "in_progress" })).status).toBe(422);
    const reopened = await transition(w.facilitator, id, "STEP-001", { to: "in_progress", reason: "Registration number was wrong" });
    expect(step(reopened.body, "STEP-001")).toMatchObject({ status: "in_progress", reason: "Registration number was wrong" });
  });

  it("answers 404 for a step that doesn't exist and 400 for one that isn't a step id", async () => {
    const id = await openCase();
    expect(await transition(w.owner, id, "STEP-999", { to: "in_progress" })).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect((await transition(w.owner, id, "step-1", { to: "in_progress" })).status).toBe(400);
    expect((await transition(w.owner, id, "STEP-001", { to: "finished" })).status).toBe(400);
  });

  it("takes occurredAt only when completing, never from the future", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const id = await openCase();
    expect(await transition(w.owner, id, "STEP-001", { to: "in_progress", occurredAt: "2026-10-01" })).toMatchObject({ status: 422, body: { code: "invalid" } });
    expect(await transition(w.owner, id, "STEP-001", { to: "completed", occurredAt: "2026-10-24" })).toMatchObject({ status: 422, body: { code: "invalid" } });
    expect((await transition(w.owner, id, "STEP-001", { to: "completed", occurredAt: "last tuesday" })).status).toBe(422);
    const ok = await transition(w.owner, id, "STEP-001", { to: "completed", occurredAt: "2026-10-20T10:00:00+03:00" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const [event] = (await eventsOf(id)).filter((e) => e.type === "step_completed");
    expect(event?.occurredAt.toISOString()).toBe("2026-10-20T07:00:00.000Z");
  });

  it("brings the current phase up to date as gates lock", async () => {
    const id = await openCase();
    await lockPhase(id, 1);
    await lockPhase(id, 2);
    const touch = await call(w.owner, "PATCH", `/cases/${id}/facts`, { facts: { coldChain: "no" } });
    expect(touch.body.currentPhase).toBe(3);
  });
});

describe("evidence", () => {
  it("takes a submission, a review and an approval that sets the expiry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const id = await openCase();

    const submitted = await submit(w.owner, id, "bank_export_permit", "2026-10-01");
    expect(submitted.status).toBe(201);
    expect(latestOf(submitted.body, "bank_export_permit")).toMatchObject({
      status: "submitted", issuedOn: "2026-10-01", validUntil: null, latest: true, submittedByUserId: w.owner.id,
    });
    const evidenceId = latestOf(submitted.body, "bank_export_permit").id;

    expect((await review(w.reviewer, id, evidenceId, { to: "approved" })).status).toBe(409); // not reviewed yet
    const underReview = await review(w.reviewer, id, evidenceId, { to: "under_review" });
    expect(latestOf(underReview.body, "bank_export_permit")).toMatchObject({ status: "under_review", reviewerUserId: w.reviewer.id });

    const approved = await review(w.reviewer, id, evidenceId, { to: "approved", note: "Stamp and signature match" });
    expect(latestOf(approved.body, "bank_export_permit")).toMatchObject({
      status: "approved", validUntil: "2026-10-31", reviewNote: "Stamp and signature match",
    });
    expect(approved.body.workflow.steps.find((s: Json) => s.id === "STEP-048").evidence[0]).toMatchObject({ type: "bank_export_permit", satisfied: true });
  });

  it("reports approved evidence as expired once its last valid day has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const id = await openCase();
    const submitted = await submit(w.owner, id, "bank_export_permit", "2026-10-01");
    const evidenceId = latestOf(submitted.body, "bank_export_permit").id;
    await review(w.reviewer, id, evidenceId, { to: "under_review" });
    await review(w.reviewer, id, evidenceId, { to: "approved" });

    vi.setSystemTime("2026-10-31T20:59:00Z"); // 23:59 on 31 October in UTC+3, still the last valid day in UTC
    expect(latestOf((await call(w.owner, "GET", `/cases/${id}`)).body, "bank_export_permit").status).toBe("approved");
    vi.setSystemTime("2026-11-01T00:00:00Z");
    expect(latestOf((await call(w.owner, "GET", `/cases/${id}`)).body, "bank_export_permit").status).toBe("expired");
    // An expired document can be submitted again.
    expect((await submit(w.owner, id, "bank_export_permit", "2026-10-30")).status).toBe(201);
  });

  it("needs the issue date to approve evidence that expires", async () => {
    const id = await openCase();
    const submitted = await submit(w.owner, id, "bank_export_permit");
    const evidenceId = latestOf(submitted.body, "bank_export_permit").id;
    await review(w.reviewer, id, evidenceId, { to: "under_review" });
    const refused = await review(w.reviewer, id, evidenceId, { to: "approved" });
    expect(refused).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    expect(refused.body.error).toMatch(/Record the issue date/);
    const fixed = await review(w.reviewer, id, evidenceId, { to: "approved", issuedOn: "2026-10-20" });
    expect(fixed.status, JSON.stringify(fixed.body)).toBe(200);
  });

  it("needs a note to request changes or reject, and lets the SME resubmit afterwards", async () => {
    const id = await openCase();
    const submitted = await submit(w.owner, id, "business_registration");
    const evidenceId = latestOf(submitted.body, "business_registration").id;
    await review(w.reviewer, id, evidenceId, { to: "under_review" });

    const noNote = await review(w.reviewer, id, evidenceId, { to: "changes_required" });
    expect(noNote).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    const asked = await review(w.reviewer, id, evidenceId, { to: "changes_required", note: "TIN is cut off" });
    expect(latestOf(asked.body, "business_registration")).toMatchObject({ status: "changes_required", reviewNote: "TIN is cut off" });

    const again = await submit(w.owner, id, "business_registration");
    expect(again.status).toBe(201);
    const items = again.body.evidence.filter((e: Json) => e.type === "business_registration");
    expect(items.map((e: Json) => [e.status, e.latest])).toEqual([["changes_required", false], ["submitted", true]]);
  });

  it("only reviews the latest submission of a type, and never submits through a review", async () => {
    const id = await openCase();
    const first = latestOf((await submit(w.owner, id, "business_registration")).body, "business_registration").id;
    await review(w.reviewer, id, first, { to: "under_review" });
    await review(w.reviewer, id, first, { to: "rejected", note: "Not a registration" });
    await submit(w.owner, id, "business_registration");

    const stale = await review(w.reviewer, id, first, { to: "under_review" });
    expect(stale).toMatchObject({ status: 409, body: { code: "invalid_transition" } });
    expect(stale.body.error).toMatch(/newer submission/);
    const latest = latestOf((await call(w.owner, "GET", `/cases/${id}`)).body, "business_registration").id;
    const viaReview = await review(w.reviewer, id, latest, { to: "submitted" });
    expect(viaReview.status).toBe(409);
  });

  it("applies the roles the engine sets", async () => {
    const id = await openCase();
    expect((await submit(w.reviewer, id, "business_registration")).status).toBe(403); // reviewers review
    const evidenceId = latestOf((await submit(w.owner, id, "business_registration")).body, "business_registration").id;
    expect((await review(w.owner, id, evidenceId, { to: "under_review" })).status).toBe(403); // the SME doesn't review its own
    expect((await review(w.facilitator, id, evidenceId, { to: "under_review" })).status).toBe(403);
    expect((await review(w.admin, id, evidenceId, { to: "under_review" })).status).toBe(200);
    expect((await submit(w.facilitator, id, "tax_clearance")).status).toBe(201); // Entrust can submit on the SME's behalf
  });

  it("answers for evidence that doesn't exist or isn't a type", async () => {
    const id = await openCase();
    expect(await submit(w.owner, id, "napkin_sketch")).toMatchObject({ status: 422, body: { code: "invalid" } });
    const missing = await review(w.reviewer, id, "5d6c6a3e-1a39-4c3a-8d8a-2b0f6f9f3c11", { to: "under_review" });
    expect(missing).toMatchObject({ status: 404, body: { code: "not_found" } });
    // Evidence on another case isn't reachable through this one.
    const other = await openCase();
    const evidenceId = latestOf((await submit(w.owner, other, "business_registration")).body, "business_registration").id;
    expect((await review(w.reviewer, id, evidenceId, { to: "under_review" })).status).toBe(404);
  });

  it("serialises concurrent submissions of the same type", async () => {
    const id = await openCase();
    const results = await Promise.all(Array.from({ length: 4 }, () => submit(w.owner, id, "business_registration")));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
    const rows = await db.select().from(schema.evidence).where(and(eq(schema.evidence.caseId, id), eq(schema.evidence.type, "business_registration")));
    expect(rows).toHaveLength(1);
  });

  it("audits submissions and reviews", async () => {
    const id = await openCase();
    const evidenceId = latestOf((await submit(w.owner, id, "business_registration")).body, "business_registration").id;
    await review(w.reviewer, id, evidenceId, { to: "under_review" });
    await review(w.reviewer, id, evidenceId, { to: "rejected", note: "Wrong company" });
    const audit = (await auditOf(id)).filter((a) => a.action.startsWith("evidence."));
    expect(audit.map((a) => a.action)).toEqual(["evidence.submit", "evidence.start_review", "evidence.reject"]);
    expect(audit[2]).toMatchObject({
      actorUserId: w.reviewer.id, reason: "Wrong company",
      before: { evidenceId, type: "business_registration", status: "under_review" },
      after: { evidenceId, type: "business_registration", status: "rejected" },
    });
    const events = (await eventsOf(id)).filter((e) => e.evidenceId === evidenceId);
    expect(events.map((e) => e.type)).toEqual(["evidence_submitted", "evidence_reviewed", "evidence_reviewed"]);
  });
});

describe("deadline clocks", () => {
  /** A case whose bank permit step can be completed: its prerequisites are done. */
  async function caseReadyForPermit() {
    const id = await openCase({ ...FACTS, paymentTerms: ["cad"] });
    await markCompleted(id, prerequisitesOf("STEP-048"));
    return id;
  }

  it("starts the permit and FX clocks from the permit's issue date, which completing STEP-048 must give", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const id = await caseReadyForPermit();
    await approveEvidence(id, "bank_export_permit", "2026-10-01");

    const without = await transition(w.owner, id, "STEP-048", { to: "completed" });
    expect(without).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    expect(without.body.error).toMatch(/Give the date this happened \(occurredAt\).*deadline clock/);

    const before = (await call(w.owner, "GET", `/cases/${id}`)).body;
    expect(clock(before, "permit_validity").state).toBe("waiting");

    const done = await transition(w.owner, id, "STEP-048", { to: "completed", occurredAt: "2026-10-01" });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(clock(done.body, "permit_validity")).toMatchObject({ state: "running", due: { day: "2026-10-31" }, clause: "Art. 7.1.6" });
    expect(clock(done.body, "fx_repatriation")).toMatchObject({ state: "running", due: { day: "2026-12-30" } });
    expect(clock(done.body, "fx_repatriation").alerts.map((a: Json) => a.key)).toEqual(["warn-30d", "warn-15d", "overdue"]);
  });

  it("shows a clock as overdue once its day has passed, and stops it when the closing step is done", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const id = await caseReadyForPermit();
    await approveEvidence(id, "bank_export_permit", "2026-10-01");
    await transition(w.owner, id, "STEP-048", { to: "completed", occurredAt: "2026-10-01" });

    vi.setSystemTime("2026-10-31T20:59:59Z");
    expect(clock((await call(w.owner, "GET", `/cases/${id}`)).body, "permit_validity").state).toBe("running");
    vi.setSystemTime("2026-10-31T21:00:00Z"); // midnight into 1 November in Addis Ababa
    expect(clock((await call(w.owner, "GET", `/cases/${id}`)).body, "permit_validity").state).toBe("overdue");
  });

  it("stops counting from a step that is reopened", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const id = await caseReadyForPermit();
    await approveEvidence(id, "bank_export_permit", "2026-10-01");
    await transition(w.owner, id, "STEP-048", { to: "completed", occurredAt: "2026-10-01" });

    const reopened = await transition(w.admin, id, "STEP-048", { to: "in_progress", reason: "Permit number was mistyped" });
    expect(clock(reopened.body, "permit_validity")).toMatchObject({ state: "waiting", due: null });
    // Completing it again with the right date starts the clock again.
    const again = await transition(w.owner, id, "STEP-048", { to: "completed", occurredAt: "2026-10-02" });
    expect(clock(again.body, "permit_validity").due).toEqual({ day: "2026-11-01" });
  });

  it("takes the dates the clocks need, and the latest value wins", async () => {
    const id = await openCase();
    const noDate = clock((await call(w.owner, "GET", `/cases/${id}`)).body, "isf_filing");
    expect(noDate.state).toBe("waiting");

    const set = await call(w.owner, "POST", `/cases/${id}/clock-inputs`, { key: "plannedLoading", value: "2026-11-10T09:00:00+03:00" });
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    expect(clock(set.body, "isf_filing")).toMatchObject({ state: expect.stringMatching(/running|overdue/), due: { at: "2026-11-09T06:00:00.000Z" } });

    const moved = await call(w.other, "POST", `/cases/${id}/clock-inputs`, { key: "plannedLoading", value: "2026-11-12T15:00:00+03:00" });
    expect(clock(moved.body, "isf_filing").due).toEqual({ at: "2026-11-11T12:00:00.000Z" });

    const arrival = await call(w.owner, "POST", `/cases/${id}/clock-inputs`, { key: "estimatedArrival", value: "2026-11-20T12:00:00Z" });
    await call(w.owner, "POST", `/cases/${id}/clock-inputs`, { key: "priorNoticeSystem", value: "ACE" });
    expect(clock(arrival.body, "prior_notice").due).toEqual({ at: "2026-11-20T04:00:00.000Z" });

    const audit = (await auditOf(id)).filter((a) => a.action === "case.clock_input_set");
    expect(audit).toHaveLength(4);
    expect(audit[1]).toMatchObject({
      before: { key: "plannedLoading", value: "2026-11-10T09:00:00+03:00" },
      after: { key: "plannedLoading", value: "2026-11-12T15:00:00+03:00" },
    });
  });

  it("refuses values the clocks can't read, unknown keys, and reviewers", async () => {
    const id = await openCase();
    for (const [key, value] of [["plannedLoading", "next week"], ["lcExpiry", "2026-02-30"], ["priorNoticeSystem", "email"]]) {
      expect((await call(w.owner, "POST", `/cases/${id}/clock-inputs`, { key, value })).status, `${key} ${value}`).toBe(422);
    }
    expect((await call(w.owner, "POST", `/cases/${id}/clock-inputs`, { key: "weather", value: "rain" })).status).toBe(400);
    expect((await call(w.reviewer, "POST", `/cases/${id}/clock-inputs`, { key: "lcExpiry", value: "2026-12-31" })).status).toBe(403);
  });

  it("leaves out the clocks that don't apply to the case", async () => {
    const id = await openCase({ product: "green_coffee", destinationCountry: "DE", transportMode: "air" });
    const states = Object.fromEntries((await call(w.owner, "GET", `/cases/${id}`)).body.deadlines.map((c: Json) => [c.id, c.state]));
    expect(states).toEqual({
      permit_validity: "waiting",
      fx_repatriation: "waiting",
      lc_presentation: "undetermined", // payment terms not recorded
      isf_filing: "not_applicable", // not bound for the US by sea
      prior_notice: "not_applicable",
    });
  });
});
