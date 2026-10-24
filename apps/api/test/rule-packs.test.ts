import { asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { RULE_PACKS, findRulePack, type RulePack } from "@entrust/rules";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FACTS, call, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Rule packs on cases (#7): a case keeps the pack version it was opened with, and moves only when
// an Entrust admin or facilitator re-evaluates it.
const w = {} as { owner: TestUser; admin: TestUser; facilitator: TestUser; reviewer: TestUser; org: string; entrust: string };

const openCase = async (facts: object = FACTS) => {
  const res = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as Json;
};
const view = async (id: string) => (await call(w.owner, "GET", `/cases/${id}`)).body as Json;
const requirement = (detail: Json, code: string) => detail.rulePack.requirements.find((r: Json) => r.code === code);
const reevaluate = (user: TestUser, id: string, reason = "Sources checked again") =>
  call(user, "POST", `/cases/${id}/rule-pack`, { reason });

beforeAll(async () => {
  await cleanup();
  const [owner, admin, facilitator, reviewer] = await Promise.all(["owner", "admin", "facilitator", "reviewer"].map(signUp));
  Object.assign(w, { owner, admin, facilitator, reviewer });
  w.org = await createOrganization("org", [[owner!, "owner"]]);
  w.entrust = await createOrganization("entrust", [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"]], { smeProfile: false });
  process.env.ENTRUST_ORG_ID = w.entrust;
});
afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("rule packs on cases", () => {
  it("opens a case on the newest pack for its product and destination", async () => {
    const created = await openCase();
    expect(created.rulePack).toMatchObject({ id: "et-us-green-coffee", version: "0.4.0", status: "draft", coversCase: true, latest: true });
    expect(created.rulePack.requirements).toHaveLength(35);
    expect(created.rulePackUpdate).toBeNull();
    const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, created.id));
    expect(audit?.after).toMatchObject({ rulePack: { id: "et-us-green-coffee", version: "0.4.0" } });
  });

  it("opens a case with no pack when none covers its corridor", async () => {
    const created = await openCase({ ...FACTS, destinationCountry: "DE" });
    expect(created.rulePack).toBeNull();
    expect(created.rulePackUpdate).toBeNull();
  });

  it("gives each requirement its sources and its status from the steps it sits on", async () => {
    const created = await openCase();
    expect(requirement(created, "USP-04")).toMatchObject({
      basis: "confirmed",
      steps: [{ id: "STEP-097", status: "blocked" }],
      status: "blocked",
      verification: { checkedOn: "2026-10-24" },
    });
    expect(requirement(created, "USP-04").sources[0].url).toMatch(/^https:\/\//);
    expect(requirement(created, "PHY-01")).toMatchObject({ status: "undetermined", appliesWhen: expect.stringContaining("phytosanitary") });
    const updated = await call(w.owner, "PATCH", `/cases/${created.id}/facts`, { facts: { phytoCertificateRequired: "no", inlandTransport: "rail" } });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(requirement(updated.body, "PHY-01").status).toBe("not_applicable");
    expect([requirement(updated.body, "TRN-01").status, requirement(updated.body, "TRN-02").status]).toEqual(["blocked", "not_applicable"]);
  });

  it("keeps the version a case was opened with when a newer one is published, until it is re-evaluated", async () => {
    const opened = await openCase();
    // Publish 0.4.1 for this test only, with one requirement reworded.
    const current = findRulePack("et-us-green-coffee", "0.4.0") as RulePack;
    const next: RulePack = {
      ...current,
      version: "0.4.1",
      requirements: current.requirements.map((r) => (r.code === "USE-02" ? { ...r, description: `${r.description} Checked again.` } : r)),
    };
    const published = RULE_PACKS as RulePack[];
    published.push(next);
    try {
      const before = await view(opened.id);
      expect(before.rulePack).toMatchObject({ version: "0.4.0", latest: false });
      expect(before.rulePackUpdate).toEqual({ id: "et-us-green-coffee", version: "0.4.1", added: [], removed: [], changed: ["USE-02"] });
      expect((await openCase()).rulePack.version).toBe("0.4.1");

      const moved = await reevaluate(w.facilitator, opened.id, "US tariff position checked again");
      expect(moved.status, JSON.stringify(moved.body)).toBe(200);
      expect(moved.body.rulePack).toMatchObject({ version: "0.4.1", latest: true });
      expect(moved.body.rulePackUpdate).toBeNull();
      expect(requirement(moved.body, "USE-02").description).toMatch(/Checked again\.$/);

      const audit = await db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, opened.id))
        .orderBy(asc(schema.auditLog.occurredAt));
      expect(audit.at(-1)).toMatchObject({
        action: "case.rule_pack_changed",
        reason: "US tariff position checked again",
        before: { id: "et-us-green-coffee", version: "0.4.0" },
        after: { rulePack: { id: "et-us-green-coffee", version: "0.4.1" }, changed: ["USE-02"] },
      });
      const [event] = await db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, opened.id)).orderBy(asc(schema.caseEvent.recordedAt)).offset(1);
      expect(event?.type).toBe("rule_pack_changed");
    } finally {
      published.splice(published.indexOf(next), 1);
    }
  });

  it("moves a case off its pack when its corridor changes, and onto one when a pack covers it", async () => {
    const opened = await openCase();
    const toGermany = await call(w.owner, "PATCH", `/cases/${opened.id}/facts`, { facts: { destinationCountry: "DE" } });
    expect(toGermany.body.rulePack.coversCase).toBe(false);
    expect(toGermany.body.rulePackUpdate).toMatchObject({ id: null, version: null, added: [] });
    expect(toGermany.body.rulePackUpdate.removed).toHaveLength(35);
    const detached = await reevaluate(w.admin, opened.id);
    expect(detached.status, JSON.stringify(detached.body)).toBe(200);
    expect(detached.body.rulePack).toBeNull();

    const back = await call(w.owner, "PATCH", `/cases/${opened.id}/facts`, { facts: { destinationCountry: "US" } });
    expect(back.body.rulePackUpdate).toMatchObject({ id: "et-us-green-coffee", version: "0.4.0", removed: [] });
    expect((await reevaluate(w.admin, opened.id)).body.rulePack.version).toBe("0.4.0");
  });

  it("refuses a re-evaluation that isn't needed or allowed", async () => {
    const opened = await openCase();
    expect((await reevaluate(w.owner, opened.id)).status).toBe(403);
    expect((await reevaluate(w.reviewer, opened.id)).status).toBe(403);
    expect((await reevaluate(w.admin, opened.id, "  ")).status).toBe(422);
    const already = await reevaluate(w.admin, opened.id);
    expect(already.status).toBe(409);
    expect(already.body.error).toBe("The case is already on et-us-green-coffee 0.4.0, the newest pack for green_coffee to US.");

    const uncovered = await openCase({ ...FACTS, destinationCountry: "DE" });
    expect((await reevaluate(w.admin, uncovered.id)).body.error).toBe("No rule pack covers green_coffee to DE yet.");

    await db.update(schema.exportCase).set({ status: "closed" }).where(eq(schema.exportCase.id, opened.id));
    expect((await reevaluate(w.admin, opened.id)).status).toBe(422);
  });
});

describe("rule pack endpoints", () => {
  it("lists every published version and shows one", async () => {
    const list = await call(w.owner, "GET", "/rule-packs");
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([expect.objectContaining({ id: "et-us-green-coffee", version: "0.4.0", latest: true })]);

    const pack = await call(w.owner, "GET", "/rule-packs/et-us-green-coffee/versions/0.4.0");
    expect(pack.status).toBe(200);
    expect(pack.body.requirements).toHaveLength(35);
    expect(pack.body.requirements[0]).toMatchObject({ code: "ELG-02", steps: ["STEP-002"], basis: "confirmed" });
    expect(pack.body.requirements.find((r: Json) => r.code === "USP-06").verification.status).toBe("awaiting_verification");

    expect((await call(w.owner, "GET", "/rule-packs/et-us-green-coffee/versions/9.9.9")).status).toBe(404);
    expect((await call(null, "GET", "/rule-packs")).status).toBe(401);
  });
});
