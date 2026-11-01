import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPrincipal, type Ctx, type PracticeScope } from "../src/services/access";
import { getCase, reevaluateRulePack, updateFacts } from "../src/services/cases";
import { recordContract } from "../src/services/contracts";
import { syncOpenCases } from "../src/services/flags";
import { listPracticeCases, resetPracticeCase, startPracticeCase } from "../src/services/practice";
import { FACTS, call, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Practice cases (#74): a CLEAR case that TRADE's M08 runs a simulated export on. It is a real case to the
// engine and nothing else's. These tests call the services, since the TRADE routes come with the next piece.
const w = {} as { owner: TestUser; other: TestUser; stranger: TestUser; admin: TestUser; org: string; plain: string; entrust: string };

/** A request context for `user`, in the practice scope when `actingAs` is given. */
const ctxFor = async (user: TestUser, actingAs?: PracticeScope["actingAs"]): Promise<Ctx> => ({
  db,
  principal: await loadPrincipal(db, user.id),
  now: new Date(),
  ...(actingAs ? { practice: { actingAs } } : {}),
});

const start = async (scenario = "zebu-coffee", user = w.owner, organizationId = w.org, facts?: Record<string, string>) =>
  startPracticeCase(await ctxFor(user), { organizationId, scenario, ...(facts ? { facts } : {}) });
const fails = (promise: Promise<unknown>, code: string) => expect(promise).rejects.toMatchObject({ code });

beforeAll(async () => {
  await cleanup();
  const [owner, other, stranger, admin] = await Promise.all(["owner", "other", "stranger", "admin"].map(signUp));
  Object.assign(w, { owner, other, stranger, admin });
  // The learner's organisation has TRADE and not CLEAR. The other has neither.
  w.org = await createOrganization("org", [[owner!, "owner"], [other!, "member"]]);
  w.plain = await createOrganization("plain", [[stranger!, "owner"]]);
  w.entrust = await createOrganization("entrust", [[admin!, "admin"]], { smeProfile: false });
  await db.insert(schema.platformAccess).values({ organizationId: w.org, platform: "trade" });
  process.env.ENTRUST_ORG_ID = w.entrust;
});
afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("starting a practice case", () => {
  it("opens the ZEBU Coffee scenario for an organisation that has TRADE and no CLEAR access", async () => {
    const created = await start();
    expect(created).toMatchObject({
      practiceScenario: "zebu-coffee",
      organizationId: w.org,
      status: "open",
      currentPhase: 1,
      product: "green_coffee",
      destinationCountry: "US",
      yourRole: "owner",
      facts: { transportMode: "sea", incoterm: "FOB", paymentTerms: ["cad"] },
    });
    expect(created.reference).toMatch(/^PRACTICE-ZEBU-COFFEE-[0-9A-F]{8}$/);
    expect(created.rulePack).not.toBeNull();
    const clearGrants = await db
      .select()
      .from(schema.platformAccess)
      .where(and(eq(schema.platformAccess.organizationId, w.org), eq(schema.platformAccess.platform, "clear")));
    expect(clearGrants).toEqual([]);
  });

  it("takes no number from the real case sequence", async () => {
    const counters = await db.select().from(schema.caseReferenceCounter).where(eq(schema.caseReferenceCounter.country, "QZ"));
    expect(counters).toEqual([]);
  });

  it("is refused to an organisation without TRADE access, and to someone who isn't a member", async () => {
    await fails(start("zebu-coffee", w.stranger, w.plain), "forbidden");
    await fails(start("zebu-coffee", w.stranger, w.org), "not_found");
    await fails(startPracticeCase(await ctxFor(w.owner), { scenario: "zebu-coffee" }), "invalid");
  });

  it("is refused for a scenario that doesn't exist, and a second time while the first stands", async () => {
    await fails(start("no-such-scenario"), "not_found");
    await fails(start(), "invalid_transition");
  });

  it("opens the learner's own deal with the facts they give, and needs the product and destination", async () => {
    const created = await start("own-deal", w.owner, w.org, { product: "green_coffee", destinationCountry: "de", incoterm: "FOB", paymentTerms: "lc" });
    expect(created).toMatchObject({ practiceScenario: "own-deal", destinationCountry: "DE", facts: { incoterm: "FOB", paymentTerms: ["lc"] } });
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, created.id));
    await fails(start("own-deal", w.owner, w.org, { product: "green_coffee" }), "invalid");
    await fails(start("own-deal"), "invalid");
    await fails(start("zebu-coffee", w.owner, w.org, { product: "green_coffee", destinationCountry: "US" }), "invalid");
  });

  it("lets Entrust staff open one for any organisation, for a demonstration", async () => {
    const created = await start("own-deal", w.admin, w.plain, { product: "green_coffee", destinationCountry: "US" });
    expect(created.organizationId).toBe(w.plain);
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, created.id));
  });
});

describe("keeping practice out of CLEAR", () => {
  let practiceId: string;
  let realId: string;
  beforeAll(async () => {
    const [practice] = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    practiceId = practice!.id;
    const opened = await call(w.owner, "POST", "/cases", { organizationId: w.org, facts: FACTS });
    expect(opened.status).toBe(201);
    realId = opened.body.id;
  });

  it("leaves it out of CLEAR's case list, for the learner and for staff", async () => {
    for (const user of [w.owner, w.other, w.admin]) {
      const listed = (await call(user, "GET", "/cases?limit=100")).body as Json;
      const ids = listed.items.map((i: Json) => i.id);
      expect(ids, user.id).toContain(realId);
      expect(ids, user.id).not.toContain(practiceId);
      expect(listed.items.every((i: Json) => i.practiceScenario === null)).toBe(true);
    }
  });

  it("is not found through CLEAR's endpoints, to read or to change", async () => {
    expect((await call(w.owner, "GET", `/cases/${practiceId}`)).status).toBe(404);
    expect((await call(w.owner, "PATCH", `/cases/${practiceId}/facts`, { facts: { coldChain: "no" } })).status).toBe(404);
    expect((await call(w.admin, "GET", `/cases/${practiceId}`)).status).toBe(404);
  });

  it("keeps real cases out of the practice scope", async () => {
    await fails(getCase(await ctxFor(w.owner, "owner"), realId), "not_found");
    await fails(resetPracticeCase(await ctxFor(w.owner), realId), "not_found");
  });

  it("is left alone by the scheduled failure-rule check", async () => {
    expect(await syncOpenCases(db, new Date(), { only: [practiceId] })).toEqual({ checked: 0, raised: 0, resolved: 0, failed: [] });
    expect(await syncOpenCases(db, new Date(), { only: [realId] })).toMatchObject({ checked: 1 });
  });

  it("writes its audit rows for TRADE, so CLEAR's audit view doesn't show them", async () => {
    const rows = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, practiceId));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.platform === "trade")).toBe(true);
    const real = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, realId));
    expect(real.every((r) => r.platform === "clear")).toBe(true);

    const clearView = await callV1(w.admin, "GET", `/audit?platform=clear&entityId=${practiceId}`);
    expect(clearView.status).toBe(200);
    expect(clearView.body.items).toEqual([]);
  });
});

describe("working a practice case", () => {
  let id: string;
  beforeAll(async () => {
    const [practice] = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    id = practice!.id;
  });

  it("shows the learner the case in the role they practise in", async () => {
    expect((await getCase(await ctxFor(w.owner, "owner"), id)).yourRole).toBe("owner");
    expect((await getCase(await ctxFor(w.owner, "reviewer"), id)).yourRole).toBe("reviewer");
    expect((await getCase(await ctxFor(w.other, "facilitator"), id)).yourRole).toBe("facilitator");
  });

  it("lets the learner take another party's turn, which their own role couldn't", async () => {
    // Moving a case to a newer rule pack is Entrust's. The case is already on the newest, so a facilitator is told that.
    await fails(reevaluateRulePack(await ctxFor(w.owner, "owner"), id, { reason: "Practice" }), "forbidden");
    await fails(reevaluateRulePack(await ctxFor(w.owner, "facilitator"), id, { reason: "Practice" }), "invalid_transition");
  });

  it("gives staff their own role, however they ask", async () => {
    expect((await getCase(await ctxFor(w.admin, "owner"), id)).yourRole).toBe("admin");
  });

  it("gives another organisation's learner nothing, whatever role they ask for", async () => {
    await fails(getCase(await ctxFor(w.stranger, "admin"), id), "not_found");
  });

  it("lists the organisation's practice cases for its members and nobody else's", async () => {
    const listed = await listPracticeCases(await ctxFor(w.owner));
    expect(listed.items.map((i) => i.id)).toEqual([id]);
    expect(listed.items[0]).toMatchObject({ practiceScenario: "zebu-coffee", organizationId: w.org });
    await fails(listPracticeCases(await ctxFor(w.stranger), w.org), "not_found");
    await fails(listPracticeCases(await ctxFor(w.stranger), w.plain), "forbidden");
  });
});

describe("resetting a practice case", () => {
  it("puts the scenario back to its start: a new case with the original facts and nothing recorded", async () => {
    const [before] = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    const practice = await ctxFor(w.owner, "owner");
    await updateFacts(practice, before!.id, { coldChain: "no", transportMode: "air" });
    await recordContract(practice, before!.id, { number: "PO-2026-KEFA-089", buyerName: "Artisan Coffee USA", contractDate: "2026-03-04" });
    const [worked] = await db.select().from(schema.exportCase).where(eq(schema.exportCase.id, before!.id));
    expect(worked!.facts).toMatchObject({ coldChain: "no", transportMode: "air" });
    expect(worked!.salesContractId).not.toBeNull();

    const reset = await resetPracticeCase(await ctxFor(w.owner), before!.id);
    expect(reset.id).not.toBe(before!.id);
    expect(reset).toMatchObject({ practiceScenario: "zebu-coffee", status: "open", currentPhase: 1, facts: { transportMode: "sea", incoterm: "FOB", paymentTerms: ["cad"] } });
    expect(reset.facts).not.toHaveProperty("coldChain");

    expect(await db.select().from(schema.exportCase).where(eq(schema.exportCase.id, before!.id))).toEqual([]);
    expect(await db.select().from(schema.salesContract).where(eq(schema.salesContract.id, worked!.salesContractId!))).toEqual([]);
    expect(await db.select().from(schema.caseEvent).where(eq(schema.caseEvent.caseId, before!.id))).toEqual([]);
    const mine = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    expect(mine.map((c) => c.id)).toEqual([reset.id]);

    // The audit trail keeps that it happened.
    const trail = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entityId, before!.id), eq(schema.auditLog.action, "case.practice_reset")));
    expect(trail).toHaveLength(1);
    expect(trail[0]!.platform).toBe("trade");
  });

  it("starts the learner's own deal again with the facts it began with", async () => {
    const created = await start("own-deal", w.owner, w.org, { product: "green_coffee", destinationCountry: "DE", incoterm: "FOB" });
    await updateFacts(await ctxFor(w.owner, "owner"), created.id, { incoterm: "CIF" });
    const reset = await resetPracticeCase(await ctxFor(w.owner), created.id);
    expect(reset).toMatchObject({ practiceScenario: "own-deal", destinationCountry: "DE", facts: { incoterm: "FOB" } });
    await db.delete(schema.exportCase).where(eq(schema.exportCase.id, reset.id));
  });

  it("is refused to someone outside the organisation, and once the organisation loses TRADE", async () => {
    const [practice] = await db.select().from(schema.exportCase).where(and(eq(schema.exportCase.organizationId, w.org), eq(schema.exportCase.practiceScenario, "zebu-coffee")));
    await fails(resetPracticeCase(await ctxFor(w.stranger), practice!.id), "not_found");

    await db.delete(schema.platformAccess).where(and(eq(schema.platformAccess.organizationId, w.org), eq(schema.platformAccess.platform, "trade")));
    await fails(resetPracticeCase(await ctxFor(w.owner), practice!.id), "forbidden");
    await db.insert(schema.platformAccess).values({ organizationId: w.org, platform: "trade" });
    expect((await resetPracticeCase(await ctxFor(w.owner), practice!.id)).practiceScenario).toBe("zebu-coffee");
  });
});
