import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { STEPS } from "@entrust/rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// #74's first acceptance test: a learner whose organisation has TRADE and no CLEAR runs the ZEBU Coffee scenario
// from the first step to the last. One person takes every party's turn through /v1/trade/practice-cases, handles
// both scripted events, and ends with all seven phase gates signed off. It lives in its own file because it makes a
// few hundred calls.
const w = {} as { learner: TestUser; other: TestUser; org: string };
const P = "/trade/practice-cases";
const asQuery = (as?: string) => (as ? `?as=${as}` : "");
const TODAY = new Date().toISOString().slice(0, 10);

// What the learner answers when the workflow asks them to determine a fact.
const ANSWERS = { sourcingChannel: "ecx", phytoCertificateRequired: "yes", healthCertificateRequired: "no", customsChannel: "green", inlandTransport: "road", coldChain: "no" };

beforeAll(async () => {
  await cleanup();
  const [learner, other] = await Promise.all(["learner", "other"].map(signUp));
  Object.assign(w, { learner, other });
  w.org = await createOrganization("org", [[learner!, "owner"]]);
  await createOrganization("other-org", [[other!, "owner"]]);
  await db.insert(schema.platformAccess).values({ organizationId: w.org, platform: "trade" });
});
afterAll(cleanup);

describe("running ZEBU Coffee from start to finish", () => {
  it("takes one learner through all seven phases, the discrepancy and the delay included", async () => {
    const started = await callV1(w.learner, "POST", P, { organizationId: w.org, scenario: "zebu-coffee" });
    expect(started.status, JSON.stringify(started.body)).toBe(201);
    const id: string = started.body.id;
    let detail: Json = started.body;
    const turns: string[] = [];

    const call = async (method: string, path: string, body?: unknown) => {
      const res = await callV1(w.learner, method, `${P}/${id}${path}`, body);
      if (res.status >= 400) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(res.body)} after ${turns.slice(-6).join(", ")}`);
      return res.body as Json;
    };

    // The vessel slips five days: the learner records when loading is planned, and then it moves.
    const loading = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await call("POST", "/clock-inputs", { key: "plannedLoading", value: `${loading}T09:00:00+03:00` });
    detail = await call("POST", "/events/shipment-delay");

    let documentsArrived = false;
    for (let i = 0; i < 600; i++) {
      const next = detail.workflow.nextAction;

      // An open FL-06 holds the handoff to the bank, so nothing is next until the discrepancy is dealt with.
      // The packing list's gross weight is the figure that is wrong.
      if (!next && detail.flags.some((f: Json) => f.rule === "FL-06" && f.status === "open")) {
        turns.push("fix:FL-06");
        detail = await call("PUT", "/documents/final_packing_list/fields", { fields: { grossWeight: "19584 kg" } });
        continue;
      }
      if (!next) break;

      // The shipping documents arrive when the story reaches their comparison.
      if (next.stepId === "STEP-099" && !documentsArrived) {
        documentsArrived = true;
        turns.push("event:documents-arrive");
        detail = await call("POST", "/events/documents-arrive");
        continue;
      }

      turns.push(`${next.kind}:${next.stepId}`);
      const definition = STEPS.find((s) => s.id === next.stepId)!;
      // Entrust's steps are the reviewer's, the system's are the facilitator's, the rest are the SME's own.
      const as = next.kind === "sign_off" || next.owner === "entrust" ? "reviewer" : next.owner === "system" ? "facilitator" : undefined;

      if (next.kind === "provide_evidence") {
        for (const { type } of definition.evidence) {
          if (detail.evidence.some((e: Json) => e.type === type && e.status !== "rejected")) continue;
          detail = await call("POST", "/evidence", { type, issuedOn: TODAY });
        }
      } else if (next.kind === "review_evidence") {
        for (const e of detail.evidence.filter((e: Json) => definition.evidence.some((d) => d.type === e.type) && ["submitted", "under_review"].includes(e.status))) {
          if (e.status === "submitted") await call("POST", `/evidence/${e.id}/review?as=reviewer`, { to: "under_review" });
          detail = await call("POST", `/evidence/${e.id}/review?as=reviewer`, { to: "approved" });
        }
      } else if (next.kind === "complete" || next.kind === "sign_off") {
        detail = await call("POST", `/steps/${next.stepId}/transition${asQuery(as)}`, { to: "completed", occurredAt: TODAY });
      } else if (next.kind === "determine") {
        detail = await call("PATCH", "/facts", { facts: ANSWERS });
      } else {
        throw new Error(`Unexpected next action ${next.kind} on ${next.stepId}: ${next.detail}`);
      }
    }

    // Every phase gate signed off, nothing left to do, and nothing left open.
    expect(detail.workflow.phases.map((p: Json) => [p.phase, p.status])).toEqual([1, 2, 3, 4, 5, 6, 7].map((p) => [p, "locked"]));
    expect(detail.workflow.steps.filter((s: Json) => !["completed", "not_applicable"].includes(s.status)).map((s: Json) => s.id)).toEqual([]);
    expect(detail.workflow.nextAction).toBeNull();
    expect(detail.flags.filter((f: Json) => f.status === "open")).toEqual([]);

    // The discrepancy was raised and then resolved by the correction, not waived.
    expect(detail.flags.find((f: Json) => f.rule === "FL-06")).toMatchObject({ status: "resolved" });
    expect(turns).toContain("event:documents-arrive");
    expect(turns).toContain("fix:FL-06");
    expect(detail.practiceScenario).toBe("zebu-coffee");

    // Nothing in it reached CLEAR: not its list, its endpoints or its audit view, and the organisation never had CLEAR.
    const clearList = await callV1(w.learner, "GET", "/clear/cases?limit=100");
    expect(clearList.body.items.map((c: Json) => c.id)).not.toContain(id);
    expect((await callV1(w.learner, "GET", `/clear/cases/${id}`)).status).toBe(404);
    const audit = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, id));
    expect(audit.length).toBeGreaterThan(200);
    expect(audit.every((a) => a.platform === "trade")).toBe(true);
    const grants = await db.select().from(schema.platformAccess).where(and(eq(schema.platformAccess.organizationId, w.org), eq(schema.platformAccess.platform, "clear")));
    expect(grants).toEqual([]);
    expect((await callV1(w.other, "GET", `${P}/${id}`)).status).toBe(404);
  }, 240_000);
});
