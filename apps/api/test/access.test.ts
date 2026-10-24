import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { FACTS, call, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

// Who can open and see cases. Organisation A and B are SME companies; "entrust" is the Entrust team.
const w = {} as {
  ownerA: TestUser; memberA: TestUser; ownerB: TestUser; outsider: TestUser;
  admin: TestUser; facilitator: TestUser; reviewer: TestUser; strayOwner: TestUser; strayAdmin: TestUser;
  orgA: string; orgB: string; orgC: string; entrust: string;
};

const open = async (user: TestUser, organizationId: string, facts: object = FACTS) => {
  const res = await call(user, "POST", "/cases", { organizationId, facts });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body;
};

beforeAll(async () => {
  await cleanup();
  const names = ["owner-a", "member-a", "owner-b", "outsider", "admin", "facilitator", "reviewer", "stray-owner", "stray-admin"];
  const [ownerA, memberA, ownerB, outsider, admin, facilitator, reviewer, strayOwner, strayAdmin] = await Promise.all(names.map(signUp));
  Object.assign(w, { ownerA, memberA, ownerB, outsider, admin, facilitator, reviewer, strayOwner, strayAdmin });
  w.orgA = await createOrganization("org-a", [[ownerA!, "owner"], [memberA!, "member"]]);
  w.orgB = await createOrganization("org-b", [[ownerB!, "owner"]]);
  // Better Auth's own "admin" role is not an SME role, so it grants nothing in an SME organisation.
  w.orgC = await createOrganization("org-c", [[strayAdmin!, "admin"]]);
  w.entrust = await createOrganization(
    "entrust",
    [[admin!, "admin"], [facilitator!, "facilitator"], [reviewer!, "reviewer"], [strayOwner!, "owner"]],
    { smeProfile: false },
  );
  process.env.ENTRUST_ORG_ID = w.entrust;
});

afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("signed out", () => {
  it("is refused everywhere, before the request is even read", async () => {
    const id = randomUUID();
    for (const [method, path, body] of [
      ["GET", "/cases"],
      ["POST", "/cases", { nonsense: true }],
      ["GET", `/cases/${id}`],
      ["PATCH", `/cases/${id}/facts`, {}],
      ["POST", `/cases/${id}/steps/STEP-001/transition`, {}],
      ["POST", `/cases/${id}/evidence`, {}],
      ["POST", `/cases/${id}/evidence/${id}/review`, {}],
      ["POST", `/cases/${id}/clock-inputs`, {}],
      ["PUT", `/cases/${id}/contract`, {}],
      ["GET", "/minimum-prices"],
      ["GET", `/minimum-prices/${id}`],
      ["POST", "/minimum-prices", {}],
      ["POST", "/minimum-prices/csv", {}],
    ] as const) {
      const res = await call(null, method, path, body);
      expect([method, path, res.status, res.body.code]).toEqual([method, path, 401, "unauthenticated"]);
    }
  });
});

describe("opening a case", () => {
  it("lets an SME owner or member open one for their organisation", async () => {
    const created = await open(w.ownerA, w.orgA);
    expect(created).toMatchObject({
      organizationId: w.orgA,
      organizationName: "org-a",
      product: "green_coffee",
      destinationCountry: "US",
      status: "open",
      currentPhase: 1,
      yourRole: "owner",
      cadCap: null,
    });
    expect(created.reference).toMatch(/^CLR-QZ-\d{4}-\d{6}$/);
    expect(created.workflow.steps).toHaveLength(125);
    expect(created.workflow.phases).toHaveLength(7);
    expect(created.workflow.nextAction).toMatchObject({ stepId: "STEP-001", kind: "complete", owner: "sme" });
    expect((await open(w.memberA, w.orgA)).yourRole).toBe("member");
  });

  it("numbers cases in sequence", async () => {
    const [a, b] = [await open(w.ownerA, w.orgA), await open(w.ownerA, w.orgA)];
    expect(Number(b.reference.slice(-6))).toBe(Number(a.reference.slice(-6)) + 1);
  });

  it("stores the facts in their canonical form", async () => {
    const created = await open(w.ownerA, w.orgA, { product: "Green_Coffee", destinationCountry: "us", paymentTerms: "cad" });
    expect(created.facts).toEqual({ product: "green_coffee", destinationCountry: "US", paymentTerms: ["cad"] });
  });

  it("uses the active organisation when none is given", async () => {
    const withoutOrg = await call(w.memberA, "POST", "/cases", { facts: FACTS });
    expect(withoutOrg).toMatchObject({ status: 422, body: { code: "invalid" } });

    await db.update(schema.session).set({ activeOrganizationId: w.orgA }).where(eq(schema.session.userId, w.ownerA.id));
    const res = await call(w.ownerA, "POST", "/cases", { facts: FACTS });
    expect(res.status).toBe(201);
    expect(res.body.organizationId).toBe(w.orgA);
  });

  it("lets Entrust admins and facilitators open one for any organisation, but not reviewers", async () => {
    expect((await open(w.facilitator, w.orgB)).yourRole).toBe("facilitator");
    expect((await open(w.admin, w.orgB)).yourRole).toBe("admin");
    const res = await call(w.reviewer, "POST", "/cases", { organizationId: w.orgB, facts: FACTS });
    expect(res).toMatchObject({ status: 403, body: { code: "forbidden" } });
  });

  it("does not let anyone open a case in an organisation they don't belong to", async () => {
    for (const user of [w.ownerB, w.outsider]) {
      const res = await call(user, "POST", "/cases", { organizationId: w.orgA, facts: FACTS });
      expect(res).toMatchObject({ status: 404, body: { code: "not_found" } });
    }
    const unknown = await call(w.admin, "POST", "/cases", { organizationId: "no-such-org", facts: FACTS });
    expect(unknown).toMatchObject({ status: 404, body: { code: "not_found" } });
  });

  it("refuses facts the case can't start with", async () => {
    const refuse = async (facts: object, status: number, pattern: RegExp) => {
      const res = await call(w.ownerA, "POST", "/cases", { organizationId: w.orgA, facts });
      expect([JSON.stringify(facts), res.status]).toEqual([JSON.stringify(facts), status]);
      expect(res.body.error).toMatch(pattern);
    };
    await refuse({ destinationCountry: "US" }, 422, /product and destination/);
    await refuse({ product: "green_coffee" }, 422, /product and destination/);
    await refuse({ ...FACTS, transportMode: "rail" }, 422, /Allowed: sea, air/);
    await refuse({ ...FACTS, colour: "red" }, 422, /not a case fact/);
    await refuse({ ...FACTS, destinationCountry: "USA" }, 422, /two-letter/);
    const malformed = await call(w.ownerA, "POST", "/cases", { organizationId: w.orgA });
    expect(malformed).toMatchObject({ status: 400, body: { code: "invalid" } });
  });

  it("checks the CAD cap when the amount is given, without refusing the case", async () => {
    const over = await call(w.ownerA, "POST", "/cases", { organizationId: w.orgA, facts: FACTS, cadAmountUsd: 620_000 });
    expect(over.status).toBe(201);
    expect(over.body.cadCap).toMatchObject({ withinCap: false, excessUsd: 120_000, capUsd: 500_000, clause: "Annex One 1.3.2(c), (e)" });
    const within = await call(w.ownerA, "POST", "/cases", { organizationId: w.orgA, facts: FACTS, cadAmountUsd: 500_000 });
    expect(within.body.cadCap).toMatchObject({ withinCap: true, excessUsd: 0 });
    const negative = await call(w.ownerA, "POST", "/cases", { organizationId: w.orgA, facts: FACTS, cadAmountUsd: -1 });
    expect(negative.status).toBe(400);
  });
});

describe("seeing cases", () => {
  const cases = {} as { a1: string; a2: string; b1: string };

  it("sets up one case in A twice and one in B", async () => {
    // Start from none: the cases opened above belong to these organisations too. Only the test
    // organisations' cases are removed.
    await db.delete(schema.exportCase).where(inArray(schema.exportCase.organizationId, [w.orgA, w.orgB]));
    cases.a1 = (await open(w.ownerA, w.orgA)).id;
    cases.a2 = (await open(w.memberA, w.orgA)).id;
    cases.b1 = (await open(w.ownerB, w.orgB)).id;
  });

  it("lists only the caller's organisations' cases, with the next action", async () => {
    const a = await call(w.ownerA, "GET", "/cases");
    expect(a.body.total).toBe(2);
    expect(a.body.items.map((c: Json) => c.id).sort()).toEqual([cases.a1, cases.a2].sort());
    expect(a.body.items[0]).toMatchObject({ organizationName: "org-a", nextAction: { stepId: "STEP-001" } });
    expect((await call(w.ownerB, "GET", "/cases")).body.items.map((c: Json) => c.id)).toEqual([cases.b1]);
    expect((await call(w.outsider, "GET", "/cases")).body).toEqual({ items: [], total: 0 });
  });

  it("shows Entrust staff every case, and lets them narrow it to one organisation", async () => {
    // The database may hold other cases too, so look for ours among them.
    const all = await call(w.reviewer, "GET", "/cases?limit=100");
    expect(all.body.items.map((c: Json) => c.id)).toEqual(expect.arrayContaining([cases.a1, cases.a2, cases.b1]));
    const onlyA = await call(w.facilitator, "GET", `/cases?organizationId=${w.orgA}`);
    expect(onlyA.body.items.map((c: Json) => c.id).sort()).toEqual([cases.a1, cases.a2].sort());
  });

  it("doesn't let a filter reach another organisation's cases", async () => {
    const res = await call(w.ownerA, "GET", `/cases?organizationId=${w.orgB}`);
    expect(res.body).toEqual({ items: [], total: 0 });
  });

  it("filters by status and phase, and pages newest first", async () => {
    expect((await call(w.ownerA, "GET", "/cases?status=closed")).body.total).toBe(0);
    expect((await call(w.ownerA, "GET", "/cases?status=open&phase=1")).body.total).toBe(2);
    expect((await call(w.ownerA, "GET", "/cases?phase=2")).body.total).toBe(0);

    const first = await call(w.ownerA, "GET", "/cases?limit=1&offset=0");
    const second = await call(w.ownerA, "GET", "/cases?limit=1&offset=1");
    expect(first.body.total).toBe(2);
    expect(first.body.items).toHaveLength(1);
    expect([first.body.items[0].id, second.body.items[0].id]).toEqual([cases.a2, cases.a1]);
  });

  it("refuses filters it can't read", async () => {
    for (const query of ["limit=0", "limit=101", "phase=8", "status=archived", "offset=-1"]) {
      expect((await call(w.ownerA, "GET", `/cases?${query}`)).status, query).toBe(400);
    }
  });

  it("shows a case to its organisation and to Entrust staff, each with their own role", async () => {
    expect((await call(w.ownerA, "GET", `/cases/${cases.a1}`)).body).toMatchObject({ id: cases.a1, yourRole: "owner" });
    expect((await call(w.memberA, "GET", `/cases/${cases.a1}`)).body.yourRole).toBe("member");
    expect((await call(w.admin, "GET", `/cases/${cases.a1}`)).body.yourRole).toBe("admin");
    expect((await call(w.reviewer, "GET", `/cases/${cases.a1}`)).body.yourRole).toBe("reviewer");
  });

  it("gives a member of another organisation a 404, not a 403, and the same 404 as for a case that doesn't exist", async () => {
    const other = await call(w.ownerB, "GET", `/cases/${cases.a1}`);
    const missing = await call(w.ownerB, "GET", `/cases/${randomUUID()}`);
    expect(other).toEqual(missing);
    expect(other).toMatchObject({ status: 404, body: { code: "not_found" } });
    expect((await call(w.outsider, "GET", `/cases/${cases.a1}`)).status).toBe(404);
  });

  it("gives the same 404 on every change to another organisation's case", async () => {
    const id = cases.a1;
    const missing = await call(w.ownerB, "GET", `/cases/${randomUUID()}`);
    for (const [method, path, body] of [
      ["PATCH", `/cases/${id}/facts`, { facts: { transportMode: "air" } }],
      ["POST", `/cases/${id}/steps/STEP-001/transition`, { to: "in_progress" }],
      ["POST", `/cases/${id}/evidence`, { type: "business_registration" }],
      ["POST", `/cases/${id}/evidence/${randomUUID()}/review`, { to: "approved" }],
      ["POST", `/cases/${id}/clock-inputs`, { key: "lcExpiry", value: "2026-12-31" }],
    ] as const) {
      const res = await call(w.ownerB, method, path, body);
      expect([method, path, res]).toEqual([method, path, missing]);
    }
    // And nothing changed.
    expect((await call(w.ownerA, "GET", `/cases/${id}`)).body.facts).toEqual(FACTS);
  });

  it("rejects a case id that isn't a UUID", async () => {
    expect((await call(w.ownerA, "GET", "/cases/not-a-uuid")).status).toBe(400);
  });
});

describe("roles that grant nothing", () => {
  it("ignores a role the permission checks don't know, in an SME organisation", async () => {
    const created = await open(w.facilitator, w.orgC);
    expect((await call(w.strayAdmin, "GET", `/cases/${created.id}`)).status).toBe(404);
    expect((await call(w.strayAdmin, "GET", "/cases")).body).toEqual({ items: [], total: 0 });
  });

  it("ignores a role that isn't an Entrust role, in the Entrust organisation", async () => {
    const created = await open(w.facilitator, w.orgB);
    expect((await call(w.strayOwner, "GET", `/cases/${created.id}`)).status).toBe(404);
  });

  it("makes nobody staff while ENTRUST_ORG_ID is unset", async () => {
    const created = await open(w.facilitator, w.orgB);
    const id = process.env.ENTRUST_ORG_ID;
    delete process.env.ENTRUST_ORG_ID;
    try {
      expect((await call(w.admin, "GET", `/cases/${created.id}`)).status).toBe(404);
      expect((await call(w.admin, "GET", "/cases")).body.total).toBe(0);
    } finally {
      process.env.ENTRUST_ORG_ID = id;
    }
  });
});

describe("API documentation", () => {
  it("lists every case endpoint in the OpenAPI document and serves /docs", async () => {
    const doc = await (await app.request("/openapi.json")).json();
    expect(Object.keys(doc.paths).sort()).toEqual(
      [
        "/v1/clear/cases",
        "/v1/clear/cases/{id}",
        "/v1/clear/cases/{id}/clock-inputs",
        "/v1/clear/cases/{id}/contract",
        "/v1/clear/cases/{id}/evidence",
        "/v1/clear/cases/{id}/evidence/{evidenceId}/review",
        "/v1/clear/cases/{id}/facts",
        "/v1/clear/cases/{id}/flags/{flagId}/waive",
        "/v1/clear/cases/{id}/steps/{stepId}/transition",
        "/v1/clear/minimum-prices",
        "/v1/clear/minimum-prices/csv",
        "/v1/clear/minimum-prices/{id}",
        "/v1/health",
        "/v1/me",
      ].sort(),
    );
    expect(Object.keys(doc.paths["/v1/clear/cases"]).sort()).toEqual(["get", "post"]);
    expect(doc.components.schemas).toHaveProperty("CaseDetail");
    expect(doc.components.schemas).toHaveProperty("Problem");
    expect((await app.request("/docs")).status).toBe(200);
  });
});
