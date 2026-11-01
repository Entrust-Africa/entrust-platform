import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { STEPS } from "@entrust/rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// TRADE's practice endpoints (#74): the learner runs the ZEBU Coffee scenario through /v1/trade/practice-cases
// with TRADE access and no CLEAR access. The rules of a case are tested with CLEAR's own endpoints; here the
// point is that the whole workflow can be worked from this side, by one person taking each party's turn.
const w = {} as { learner: TestUser; colleague: TestUser; stranger: TestUser; org: string; plain: string };

const PRACTICE = "/trade/practice-cases";
const asQuery = (as?: string) => (as ? `?as=${as}` : "");
const get = (user: TestUser | null, id: string, as?: string) => callV1(user, "GET", `${PRACTICE}/${id}${asQuery(as)}`);
const transition = (id: string, stepId: string, to: string, as?: string) =>
  callV1(w.learner, "POST", `${PRACTICE}/${id}/steps/${stepId}/transition${asQuery(as)}`, { to });
const submit = (id: string, type: string) => callV1(w.learner, "POST", `${PRACTICE}/${id}/evidence`, { type, issuedOn: "2026-10-01" });
const review = (id: string, evidenceId: string, to: string) =>
  callV1(w.learner, "POST", `${PRACTICE}/${id}/evidence/${evidenceId}/review?as=reviewer`, { to });

beforeAll(async () => {
  await cleanup();
  const [learner, colleague, stranger] = await Promise.all(["learner", "colleague", "stranger"].map(signUp));
  Object.assign(w, { learner, colleague, stranger });
  w.org = await createOrganization("org", [[learner!, "owner"], [colleague!, "member"]]);
  w.plain = await createOrganization("plain", [[stranger!, "owner"]]);
  await db.insert(schema.platformAccess).values({ organizationId: w.org, platform: "trade" });
});
afterAll(cleanup);

describe("the scenarios and who may start one", () => {
  it("lists the scenarios and the label every screen shows", async () => {
    const res = await callV1(w.learner, "GET", "/trade/practice-scenarios");
    expect(res.status).toBe(200);
    expect(res.body.label).toBe("Practice. Simulated, not a real export.");
    expect(res.body.scenarios.map((s: Json) => [s.id, s.ownFacts])).toEqual([["zebu-coffee", false], ["own-deal", true]]);
  });

  it("needs a signed-in user for every endpoint", async () => {
    expect((await callV1(null, "GET", "/trade/practice-scenarios")).status).toBe(401);
    expect((await callV1(null, "GET", PRACTICE)).status).toBe(401);
    expect((await callV1(null, "POST", PRACTICE, { scenario: "zebu-coffee" })).status).toBe(401);
  });

  it("refuses an organisation without TRADE access", async () => {
    const res = await callV1(w.stranger, "POST", PRACTICE, { organizationId: w.plain, scenario: "zebu-coffee" });
    expect(res.status).toBe(403);
    expect((await callV1(w.stranger, "GET", PRACTICE)).status).toBe(403);
  });

  it("starts ZEBU Coffee for a member of an organisation that has TRADE and no CLEAR", async () => {
    const res = await callV1(w.learner, "POST", PRACTICE, { organizationId: w.org, scenario: "zebu-coffee" });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ practiceScenario: "zebu-coffee", product: "green_coffee", destinationCountry: "US", currentPhase: 1 });
    expect((await callV1(w.learner, "POST", PRACTICE, { organizationId: w.org, scenario: "zebu-coffee" })).status).toBe(409);
    expect((await callV1(w.learner, "POST", PRACTICE, { organizationId: w.org, scenario: "nope" })).status).toBe(404);

    const listed = await callV1(w.colleague, "GET", PRACTICE);
    expect(listed.body.items.map((i: Json) => i.id)).toEqual([res.body.id]);
  });
});

describe("working the ZEBU Coffee case alone", () => {
  let id: string;
  beforeAll(async () => {
    const [practice] = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    id = practice!.id;
  });

  it("shows the case in the role the learner practises in, and hides it from everyone else", async () => {
    expect((await get(w.learner, id)).body.yourRole).toBe("owner");
    expect((await get(w.colleague, id)).body.yourRole).toBe("member");
    expect((await get(w.learner, id, "reviewer")).body.yourRole).toBe("reviewer");
    expect((await get(w.stranger, id, "admin")).status).toBe(404);
    expect((await get(null, id)).status).toBe(401);
    expect((await callV1(w.learner, "GET", `/clear/cases/${id}`)).status).toBe(404);
    expect((await get(w.learner, id, "owner-of-everything")).status).toBe(400);
  });

  it("takes the learner through phase 1, taking the SME's, the reviewer's and Entrust's turns", async () => {
    let detail = (await get(w.learner, id)).body;
    const turns: string[] = [];
    for (let i = 0; i < 100 && detail.currentPhase === 1; i++) {
      const next = detail.workflow.nextAction;
      expect(next, `no next action in phase 1 after ${turns.join(", ")}`).not.toBeNull();
      const definition = STEPS.find((s) => s.id === next.stepId)!;
      const as = next.owner === "entrust" ? "reviewer" : next.owner === "system" ? "facilitator" : undefined;
      turns.push(`${next.kind}:${next.stepId}`);

      if (next.kind === "provide_evidence") {
        for (const { type } of definition.evidence) {
          if (detail.evidence.some((e: Json) => e.type === type)) continue;
          const res = await submit(id, type);
          expect(res.status, JSON.stringify(res.body)).toBe(201);
          detail = res.body;
        }
      } else if (next.kind === "review_evidence") {
        for (const e of detail.evidence.filter((e: Json) => definition.evidence.some((d) => d.type === e.type) && e.status !== "approved")) {
          if (e.status === "submitted") expect((await review(id, e.id, "under_review")).status).toBe(200);
          const res = await review(id, e.id, "approved");
          expect(res.status, JSON.stringify(res.body)).toBe(200);
        }
        detail = (await get(w.learner, id)).body;
      } else if (next.kind === "complete" || next.kind === "sign_off") {
        const res = await transition(id, next.stepId, "completed", next.kind === "sign_off" ? "reviewer" : as);
        expect(res.status, `${next.stepId}: ${JSON.stringify(res.body)}`).toBe(200);
        detail = res.body;
      } else {
        throw new Error(`Unexpected next action ${next.kind} on ${next.stepId}`);
      }
    }
    expect(detail.currentPhase, turns.join(", ")).toBe(2);
    expect(detail.workflow.phases.find((p: Json) => p.phase === 1).status).toBe("locked");
  });

  it("leaves every one of those changes out of CLEAR's audit view", async () => {
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
    expect(rows.length).toBeGreaterThan(20);
    expect(rows.every((r) => r.platform === "trade")).toBe(true);
  });

  it("refuses a step to a role that isn't the party's, and says so", async () => {
    const res = await transition(id, "STEP-019", "in_progress", "reviewer");
    expect(res.status).toBe(403);
  });

  it("resets to the start of the scenario", async () => {
    const res = await callV1(w.learner, "POST", `${PRACTICE}/${id}/reset`);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ practiceScenario: "zebu-coffee", currentPhase: 1, evidence: [] });
    expect(res.body.id).not.toBe(id);
    expect((await get(w.learner, id)).status).toBe(404);
    expect((await get(w.learner, res.body.id)).status).toBe(200);
  });
});

describe("the scripted events", () => {
  let id: string;
  const events = (caseId: string) => callV1(w.learner, "GET", `${PRACTICE}/${caseId}/events`);
  const play = (caseId: string, event: string, as?: string) => callV1(w.learner, "POST", `${PRACTICE}/${caseId}/events/${event}${asQuery(as)}`);
  const flagOf = (detail: Json, rule: string) => detail.flags.find((f: Json) => f.rule === rule);
  const plannedLoading = async (caseId: string) => {
    const rows = await db.select().from(schema.caseEvent).where(and(eq(schema.caseEvent.caseId, caseId), eq(schema.caseEvent.type, "clock_input_set")));
    return rows.map((r) => r.data as { key: string; value: string }).findLast((d) => d.key === "plannedLoading")?.value;
  };
  beforeAll(async () => {
    const [practice] = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    id = practice!.id;
  });

  it("lists what can happen in the scenario, none of it played yet", async () => {
    const res = await events(id);
    expect(res.status).toBe(200);
    expect(res.body.items.map((e: Json) => [e.id, e.played])).toEqual([["documents-arrive", false], ["shipment-delay", false]]);
    expect((await callV1(w.stranger, "GET", `${PRACTICE}/${id}/events`)).status).toBe(404);
    expect((await callV1(null, "GET", `${PRACTICE}/${id}/events`)).status).toBe(401);
  });

  it("brings the documents in with a 12 kg discrepancy that raises FL-06, and holds the bank handoff until it is fixed", async () => {
    const res = await play(id, "documents-arrive");
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.yourRole).toBe("owner");
    expect(flagOf(res.body, "FL-06")).toMatchObject({ status: "open" });
    expect(JSON.stringify(res.body.reconciliation)).toMatch(/19596 ?kg/);

    // The learner finds the packing list is the one that's wrong, and corrects it.
    const fixed = await callV1(w.learner, "PUT", `${PRACTICE}/${id}/documents/final_packing_list/fields`, { fields: { grossWeight: "19584 kg" } });
    expect(fixed.status, JSON.stringify(fixed.body)).toBe(200);
    expect(flagOf(fixed.body, "FL-06")).toMatchObject({ status: "resolved" });
  });

  it("happens once", async () => {
    const again = await play(id, "documents-arrive");
    expect(again.status).toBe(409);
    expect(again.body.error).toMatch(/already happened/);
    expect((await events(id)).body.items[0]).toMatchObject({ id: "documents-arrive", played: true });
    expect((await play(id, "no-such-event")).status).toBe(404);
  });

  it("delays the vessel by moving the planned loading time five days, once it has one", async () => {
    const early = await play(id, "shipment-delay");
    expect(early.status).toBe(422);
    expect(early.body.error).toMatch(/planned loading time first/);

    const recorded = await callV1(w.learner, "POST", `${PRACTICE}/${id}/clock-inputs`, { key: "plannedLoading", value: "2026-11-10T09:00:00+03:00" });
    expect(recorded.status, JSON.stringify(recorded.body)).toBe(200);
    const delayed = await play(id, "shipment-delay");
    expect(delayed.status, JSON.stringify(delayed.body)).toBe(200);
    expect(await plannedLoading(id)).toBe("2026-11-15T09:00:00+03:00");
    expect(JSON.stringify(delayed.body.deadlines)).not.toBe(JSON.stringify(recorded.body.deadlines));
  });

  it("keeps a plain date a plain date, and carries it over a month end", async () => {
    const created = await callV1(w.learner, "POST", `${PRACTICE}/${id}/reset`);
    const fresh = created.body.id;
    await callV1(w.learner, "POST", `${PRACTICE}/${fresh}/clock-inputs`, { key: "plannedLoading", value: "2026-11-28" });
    expect((await play(fresh, "shipment-delay")).status).toBe(200);
    expect(await plannedLoading(fresh)).toBe("2026-12-03");
    id = fresh;
  });

  it("can be played again after a reset, and records each play in the audit trail as the learner's", async () => {
    const created = await callV1(w.learner, "POST", `${PRACTICE}/${id}/reset`);
    expect((await events(created.body.id)).body.items.every((e: Json) => e.played === false)).toBe(true);
    expect((await play(created.body.id, "documents-arrive", "facilitator")).body.yourRole).toBe("facilitator");
    const rows = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, created.body.id), eq(schema.auditLog.action, "practice.event_played")));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorUserId: w.learner.id, platform: "trade", after: { event: "documents-arrive" } });
  });

  it("is not available on a real case, or to another organisation", async () => {
    const real = await callV1(w.learner, "POST", "/clear/cases", { organizationId: w.org, facts: { product: "green_coffee", destinationCountry: "US", transportMode: "sea" } });
    expect(real.status).toBe(201);
    expect((await play(real.body.id, "documents-arrive")).status).toBe(404);
    expect((await callV1(w.stranger, "POST", `${PRACTICE}/${id}/events/documents-arrive`)).status).toBe(404);
  });
});
