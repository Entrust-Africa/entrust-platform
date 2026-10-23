import { and, asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { syncOpenCases } from "../src/services/flags";
import {
  FACTS, call, cleanup, createOrganization, db, markCompleted, prerequisitesOf, signUp, type Json, type TestUser,
} from "./support";

// Failure rules through the API: flags are raised and resolved as a case changes, hold steps, and
// are waived by Entrust. Each rule's own conditions are tested in the GATE engine; here the point
// is what the API does with them.
const w = {} as { owner: TestUser; other: TestUser; admin: TestUser; facilitator: TestUser; reviewer: TestUser; org: string; org2: string; ownerB: TestUser };

const openCase = async (facts: object = FACTS) => {
  const res = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as Json;
};
const get = async (caseId: string, user = w.owner) => (await call(user, "GET", `/cases/${caseId}`)).body as Json;
const step = (detail: Json, id: string) => detail.workflow.steps.find((s: Json) => s.id === id);
const flagOf = (detail: Json, rule: string, status?: string) =>
  detail.flags.find((f: Json) => f.rule === rule && (status === undefined || f.status === status));
const transition = (user: TestUser, caseId: string, stepId: string, body: object) =>
  call(user, "POST", `/cases/${caseId}/steps/${stepId}/transition`, body);
const waive = (user: TestUser, caseId: string, flagId: string, reason: string) =>
  call(user, "POST", `/cases/${caseId}/flags/${flagId}/waive`, { reason });

const auditOf = (caseId: string, prefix = "flag.") =>
  db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, caseId)).orderBy(asc(schema.auditLog.occurredAt))
    .then((rows) => rows.filter((a) => a.action.startsWith(prefix)));

/** Facts that fire FL-02: an Incoterm for sea transport on air cargo. */
const CONFLICT = { ...FACTS, transportMode: "air", incoterm: "FOB" };

beforeAll(async () => {
  await cleanup();
  const [owner, other, admin, facilitator, reviewer, ownerB] = await Promise.all(["owner", "other", "admin", "facilitator", "reviewer", "owner-b"].map(signUp));
  Object.assign(w, { owner, other, admin, facilitator, reviewer, ownerB });
  w.org = await createOrganization("org", [[owner!, "owner"], [other!, "member"]]);
  w.org2 = await createOrganization("org-2", [[ownerB!, "owner"]]);
  const entrust = await createOrganization("entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = entrust;
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("raising and resolving flags", () => {
  it("raises nothing for a case with ordinary facts, including the pilot's advance and CAD", async () => {
    const created = await openCase({ ...FACTS, incoterm: "FOB", paymentTerms: ["advance_tt", "cad"] });
    expect(created.flags).toEqual([]);
    expect(created.openFlags).toBe(0);
  });

  it("raises a flag when a case opens in conflict, with the exception step it lists and the steps it holds", async () => {
    const created = await openCase(CONFLICT);
    expect(created.flags).toHaveLength(1);
    expect(created.flags[0]).toMatchObject({
      rule: "FL-02",
      name: "Commercial term conflict",
      severity: "critical",
      status: "open",
      blocks: ["STEP-033", "STEP-035"],
      raises: ["STEP-029"],
      waivedAt: null,
      resolvedAt: null,
    });
    expect(created.flags[0].message).toBe("The commercial terms conflict: FOB is an Incoterm for sea transport, but the cargo goes by air.");
    expect(created.openFlags).toBe(1);

    // The exception step is part of the case now, and the held steps say why.
    expect(step(created, "STEP-029")).toMatchObject({ applicability: "applicable", class: "exception" });
    expect(step(created, "STEP-033")).toMatchObject({ status: "blocked", heldBy: ["FL-02"] });
    expect(step(created, "STEP-033").reason).toMatch(/Held by FL-02: The commercial terms conflict/);
    expect(created.workflow.phases[1]).toMatchObject({ phase: 2, status: "open" });
    expect(created.workflow.phases[1].outstanding).toContainEqual({ stepId: "STEP-035", reason: expect.stringContaining("Held by FL-02") });
  });

  it("writes the raise to the audit log and the case history, as CLEAR and not a person", async () => {
    const created = await openCase(CONFLICT);
    const [audit] = await auditOf(created.id, "flag.raise");
    expect(audit).toMatchObject({
      action: "flag.raise", actorUserId: null, organizationId: w.org, platform: "clear", entityType: "export_case", before: null,
      after: { rule: "FL-02", severity: "critical", blocks: ["STEP-033", "STEP-035"], raises: ["STEP-029"] },
    });
    const events = await db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, created.id));
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["case_created", "flag_raised"]));
    const [raisedStep] = await db.select().from(schema.caseStep).where(and(eq(schema.caseStep.caseId, created.id), eq(schema.caseStep.stepId, "STEP-029")));
    expect(raisedStep?.raisedAt).toBeInstanceOf(Date);
  });

  it("shows the open flag count in the case list", async () => {
    const created = await openCase(CONFLICT);
    const list = await call(w.owner, "GET", "/cases?limit=100");
    expect(list.body.items.find((c: Json) => c.id === created.id).openFlags).toBe(1);
  });

  it("resolves the flag when the facts are fixed, releasing the steps but leaving the exception step raised", async () => {
    const created = await openCase(CONFLICT);
    const fixed = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { incoterm: "FCA" } });
    expect(fixed.status).toBe(200);
    expect(flagOf(fixed.body, "FL-02")).toMatchObject({ status: "resolved", resolvedAt: expect.any(String) });
    expect(fixed.body.openFlags).toBe(0);
    expect(step(fixed.body, "STEP-033").heldBy).toEqual([]);
    expect(step(fixed.body, "STEP-029").applicability).toBe("applicable"); // resolving it is work for a person

    const [audit] = await auditOf(created.id, "flag.resolve");
    expect(audit).toMatchObject({ actorUserId: null, before: { rule: "FL-02", status: "open" }, after: { rule: "FL-02", status: "resolved" } });
  });

  it("raises a new flag when the situation returns, and keeps the history of the first", async () => {
    const created = await openCase(CONFLICT);
    await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { incoterm: "FCA" } });
    const again = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { incoterm: "CIF" } });
    expect(again.body.flags.map((f: Json) => f.status)).toEqual(["open", "resolved"]); // newest first
    expect(again.body.flags[0].message).toMatch(/CIF is an Incoterm for sea transport/);
    expect(new Set(again.body.flags.map((f: Json) => f.id)).size).toBe(2);
  });

  it("leaves a flag alone while its rule keeps firing, and updates the words if they change", async () => {
    const created = await openCase({ ...CONFLICT, paymentTerms: ["lc", "cad"] });
    const before = flagOf(created, "FL-02");
    expect(before.message).toMatch(/letter of credit and cash against documents.*; FOB/);
    const touched = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { coldChain: "no" } });
    expect(touched.body.flags).toHaveLength(1);
    expect(flagOf(touched.body, "FL-02").id).toBe(before.id);

    const narrowed = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { paymentTerms: ["cad"] } });
    expect(narrowed.body.flags).toHaveLength(1);
    expect(flagOf(narrowed.body, "FL-02")).toMatchObject({ id: before.id, status: "open" });
    expect(flagOf(narrowed.body, "FL-02").message).toBe("The commercial terms conflict: FOB is an Incoterm for sea transport, but the cargo goes by air.");
    expect((await auditOf(created.id, "flag.update"))).toHaveLength(1);
  });
});

describe("waiving a flag", () => {
  it("lets an Entrust reviewer waive it with a reason, which releases the steps and stays on the flag", async () => {
    const created = await openCase(CONFLICT);
    const flag = flagOf(created, "FL-02");
    const waived = await waive(w.reviewer, created.id, flag.id, "  Buyer confirmed the cargo ships by sea in writing  ");
    expect(waived.status, JSON.stringify(waived.body)).toBe(200);
    expect(flagOf(waived.body, "FL-02")).toMatchObject({
      status: "waived",
      waivedByUserId: w.reviewer.id,
      waiveReason: "Buyer confirmed the cargo ships by sea in writing",
      waivedAt: expect.any(String),
    });
    expect(waived.body.openFlags).toBe(0);
    expect(step(waived.body, "STEP-033").heldBy).toEqual([]);

    const [audit] = await auditOf(created.id, "flag.waive");
    expect(audit).toMatchObject({
      actorUserId: w.reviewer.id, reason: "Buyer confirmed the cargo ships by sea in writing",
      before: { rule: "FL-02", status: "open" }, after: { rule: "FL-02", status: "waived" },
    });
  });

  it("stays waived while the situation holds, so the next change doesn't raise it again", async () => {
    const created = await openCase(CONFLICT);
    await waive(w.admin, created.id, flagOf(created, "FL-02").id, "Accepted");
    const touched = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { coldChain: "no" } });
    expect(touched.body.flags.map((f: Json) => f.status)).toEqual(["waived"]);
    expect(touched.body.openFlags).toBe(0);
  });

  it("resolves a waived flag when the situation clears, keeping the waiver on record", async () => {
    const created = await openCase(CONFLICT);
    await waive(w.admin, created.id, flagOf(created, "FL-02").id, "Accepted for now");
    const fixed = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { incoterm: "FCA" } });
    expect(flagOf(fixed.body, "FL-02")).toMatchObject({ status: "resolved", waiveReason: "Accepted for now", waivedByUserId: w.admin.id });
  });

  it("is for reviewers and admins only", async () => {
    const created = await openCase(CONFLICT);
    const id = flagOf(created, "FL-02").id;
    for (const user of [w.owner, w.other, w.facilitator]) {
      const res = await waive(user, created.id, id, "Because");
      expect([res.status, res.body.code]).toEqual([403, "forbidden"]);
    }
    expect((await get(created.id)).flags[0].status).toBe("open");
  });

  it("needs a reason, and only an open flag can be waived", async () => {
    const created = await openCase(CONFLICT);
    const id = flagOf(created, "FL-02").id;
    expect((await waive(w.reviewer, created.id, id, "")).status).toBe(400);
    expect(await waive(w.reviewer, created.id, id, "   ")).toMatchObject({ status: 422, body: { code: "precondition_failed" } });
    expect((await waive(w.reviewer, created.id, id, "Accepted")).status).toBe(200);
    expect(await waive(w.reviewer, created.id, id, "Accepted again")).toMatchObject({ status: 409, body: { code: "invalid_transition" } });
  });

  it("can't reach another organisation's case or another case's flag", async () => {
    const created = await openCase(CONFLICT);
    const other = await openCase(CONFLICT);
    const id = flagOf(created, "FL-02").id;
    expect(await waive(w.ownerB, created.id, id, "Hello")).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect(await waive(w.reviewer, other.id, id, "Wrong case")).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect((await waive(w.reviewer, created.id, "5d6c6a3e-1a39-4c3a-8d8a-2b0f6f9f3c11", "Nope")).status).toBe(404);
  });
});

describe("flags holding steps", () => {
  /** A case where dispatch can start: every step STEP-078 depends on is done, except the bank side. */
  async function caseAtDispatch() {
    const created = await openCase();
    await markCompleted(created.id, prerequisitesOf("STEP-078").filter((id) => id !== "STEP-015" && id !== "STEP-025"));
    return created.id as string;
  }

  it("raises FL-09 when dispatch starts without the bank side confirmed, and holds the dispatch step", async () => {
    const id = await caseAtDispatch();
    const started = await transition(w.owner, id, "STEP-078", { to: "in_progress" });
    expect(started.status, JSON.stringify(started.body)).toBe(200);
    expect(flagOf(started.body, "FL-09")).toMatchObject({ status: "open", severity: "critical", blocks: ["STEP-078", "STEP-104"] });
    expect(flagOf(started.body, "FL-09").message).toMatch(/bank account for FX \(STEP-015\), the payment instrument \(STEP-025\)/);
    // The step the SME just started is now held, whatever was recorded.
    expect(step(started.body, "STEP-078")).toMatchObject({ status: "blocked", heldBy: ["FL-09"], canComplete: false });

    const refused = await transition(w.owner, id, "STEP-078", { to: "completed" });
    expect(refused).toMatchObject({ status: 422, body: { code: "precondition_failed", error: "STEP-078 is held by FL-09." } });
  });

  it("releases the step when the bank side is confirmed", async () => {
    const id = await caseAtDispatch();
    await transition(w.owner, id, "STEP-078", { to: "in_progress" });
    await markCompleted(id, prerequisitesOf("STEP-015"));
    const evidence = await call(w.owner, "POST", `/cases/${id}/evidence`, { type: "bank_account_confirmation" });
    const evidenceId = evidence.body.evidence.find((e: Json) => e.type === "bank_account_confirmation").id;
    await call(w.reviewer, "POST", `/cases/${id}/evidence/${evidenceId}/review`, { to: "under_review" });
    await call(w.reviewer, "POST", `/cases/${id}/evidence/${evidenceId}/review`, { to: "approved" });

    expect(flagOf(await transition(w.owner, id, "STEP-015", { to: "completed" }).then((r) => r.body), "FL-09")?.status).toBe("open"); // STEP-025 still open
    const done = await transition(w.owner, id, "STEP-025", { to: "completed" });
    expect(flagOf(done.body, "FL-09")).toMatchObject({ status: "resolved" });
    expect(step(done.body, "STEP-078")).toMatchObject({ status: "in_progress", heldBy: [] });
  });

  it("raises FL-14 when a step that establishes a fact completes with the fact unknown, and clears when it is recorded", async () => {
    const created = await openCase();
    await markCompleted(created.id, prerequisitesOf("STEP-025"));
    const done = await transition(w.owner, created.id, "STEP-025", { to: "completed" });
    expect(flagOf(done.body, "FL-14")).toMatchObject({ status: "open", severity: "critical", blocks: ["STEP-035"] });
    expect(flagOf(done.body, "FL-14").message).toMatch(/Payment terms \(STEP-025\)/);
    expect(done.body.workflow.phases[1].status).toBe("open");

    const recorded = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { paymentTerms: ["cad"] } });
    expect(flagOf(recorded.body, "FL-14")?.status).toBe("resolved");
  });

  it("raises FL-07 from the planned haulage date, and raises the exception step it lists", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-10-23T09:00:00Z");
    const created = await openCase();
    const far = await call(w.owner, "POST", `/cases/${created.id}/clock-inputs`, { key: "plannedHaulage", value: "2026-11-20" });
    expect(far.body.flags).toEqual([]);

    const near = await call(w.owner, "POST", `/cases/${created.id}/clock-inputs`, { key: "plannedHaulage", value: "2026-10-28" });
    expect(flagOf(near.body, "FL-07")).toMatchObject({ status: "open", severity: "medium", blocks: ["STEP-078"], raises: ["STEP-090"] });
    expect(step(near.body, "STEP-090").applicability).toBe("applicable");

    const later = await call(w.owner, "POST", `/cases/${created.id}/clock-inputs`, { key: "plannedHaulage", value: "2026-12-01" });
    expect(flagOf(later.body, "FL-07")?.status).toBe("resolved");
  });
});

describe("rules that fire with time alone", () => {
  async function caseWithPermit(issued: string) {
    const created = await openCase({ ...FACTS, paymentTerms: ["cad"] });
    await markCompleted(created.id, prerequisitesOf("STEP-048"));
    const submitted = await call(w.owner, "POST", `/cases/${created.id}/evidence`, { type: "bank_export_permit", issuedOn: issued });
    const evidenceId = submitted.body.evidence.find((e: Json) => e.type === "bank_export_permit").id;
    await call(w.reviewer, "POST", `/cases/${created.id}/evidence/${evidenceId}/review`, { to: "under_review" });
    await call(w.reviewer, "POST", `/cases/${created.id}/evidence/${evidenceId}/review`, { to: "approved" });
    const done = await transition(w.owner, created.id, "STEP-048", { to: "completed", occurredAt: issued });
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    return created.id as string;
  }

  it("raises FL-08 when a scheduled check finds the 90 days gone, once, with the exception step and the closing step held", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime("2026-07-15T09:00:00Z");
    const id = await caseWithPermit("2026-07-01"); // 90 days later is 2026-09-29
    expect(flagOf(await get(id), "FL-08")).toBeUndefined();

    vi.setSystemTime("2026-09-29T20:00:00Z"); // still the last day in Addis Ababa
    expect((await syncOpenCases(db, new Date(), { only: [id] })).raised).toBe(0);

    vi.setSystemTime("2026-10-23T09:00:00Z");
    const result = await syncOpenCases(db, new Date(), { only: [id] });
    expect(result).toEqual({ checked: 1, raised: 1, resolved: 0, failed: [] });
    const detail = await get(id);
    expect(flagOf(detail, "FL-08")).toMatchObject({
      status: "open", severity: "critical", raises: ["STEP-122"], blocks: ["STEP-125"],
      message: "The proceeds were due by 2026-09-29 and have not been repatriated.",
    });
    expect(step(detail, "STEP-122").applicability).toBe("applicable");
    expect(step(detail, "STEP-125").heldBy).toEqual(["FL-08"]);
    expect((await auditOf(id, "flag.raise"))[0]).toMatchObject({ actorUserId: null });

    // Running it again changes nothing.
    expect(await syncOpenCases(db, new Date(), { only: [id] })).toEqual({ checked: 1, raised: 0, resolved: 0, failed: [] });
  });

  it("checks only open cases, and only the ones asked for", async () => {
    const closed = await openCase(CONFLICT);
    const open = await openCase();
    await db.update(schema.exportCase).set({ status: "closed" }).where(eq(schema.exportCase.id, closed.id));
    await db.delete(schema.caseFlag).where(eq(schema.caseFlag.caseId, closed.id));
    expect(await syncOpenCases(db, new Date(), { only: [closed.id, open.id] })).toMatchObject({ checked: 1 });
    expect((await db.select().from(schema.caseFlag).where(eq(schema.caseFlag.caseId, closed.id)))).toEqual([]);
  });
});
