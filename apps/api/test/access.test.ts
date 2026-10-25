import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { FACTS, call, callV1, cleanup, createOrganization, db, signUp, type Json, type TestUser } from "./support";

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
      ["POST", `/cases/${id}/amendments`, {}],
      ["PUT", `/cases/${id}/documents/final_packing_list/fields`, {}],
      ["GET", "/document-fields"],
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
        "/v1/clear/cases/{id}/amendments",
        "/v1/clear/cases/{id}/clock-inputs",
        "/v1/clear/cases/{id}/contract",
        "/v1/clear/cases/{id}/documents/{document}/fields",
        "/v1/clear/cases/{id}/evidence",
        "/v1/clear/cases/{id}/evidence/{evidenceId}/review",
        "/v1/clear/cases/{id}/facts",
        "/v1/clear/cases/{id}/flags/{flagId}/waive",
        "/v1/clear/cases/{id}/rule-pack",
        "/v1/clear/cases/{id}/steps/{stepId}/transition",
        "/v1/clear/document-fields",
        "/v1/clear/minimum-prices",
        "/v1/clear/minimum-prices/csv",
        "/v1/clear/minimum-prices/{id}",
        "/v1/clear/rule-packs",
        "/v1/clear/rule-packs/{id}/versions/{version}",
        "/v1/files/finalise",
        "/v1/files/upload-url",
        "/v1/files/{fileId}",
        "/v1/files/{fileId}/download-url",
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

describe("organisation and member management permissions (#18)", () => {
  const createdOrgIds: string[] = [];

  afterAll(async () => {
    if (createdOrgIds.length) {
      await db.delete(schema.organization).where(inArray(schema.organization.id, createdOrgIds));
    }
  });

  describe("listing organisations (GET /v1/organizations)", () => {
    it("requires authentication", async () => {
      const res = await callV1(null, "GET", "/organizations");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("unauthenticated");
    });

    it("lists only organisations the caller belongs to", async () => {
      const ownerRes = await callV1(w.ownerA, "GET", "/organizations");
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.body.organizations).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: w.orgA, role: "owner" })]),
      );

      const memberRes = await callV1(w.memberA, "GET", "/organizations");
      expect(memberRes.status).toBe(200);
      expect(memberRes.body.organizations).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: w.orgA, role: "member" })]),
      );

      const ownerBRes = await callV1(w.ownerB, "GET", "/organizations");
      expect(ownerBRes.status).toBe(200);
      expect(ownerBRes.body.organizations).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: w.orgB, role: "owner" })]),
      );
      expect(ownerBRes.body.organizations.some((o: { id: string }) => o.id === w.orgA)).toBe(false);

      const outsiderRes = await callV1(w.outsider, "GET", "/organizations");
      expect(outsiderRes.status).toBe(200);
      expect(outsiderRes.body.organizations).toEqual([]);
    });
  });

  describe("creating an organisation (POST /v1/organizations)", () => {
    it("requires authentication", async () => {
      const res = await callV1(null, "POST", "/organizations", {
        name: "Test Co",
        legalName: "Test Co LLC",
        slug: "test-co",
      });
      expect(res.status).toBe(401);
    });

    it("rejects invalid slugs with a descriptive error message", async () => {
      const res = await callV1(w.ownerA, "POST", "/organizations", {
        name: "Test Co",
        legalName: "Test Co LLC",
        slug: "Invalid Slug!",
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Slug can only contain lowercase letters, numbers, and hyphens");
      expect(res.body.code).toBe("invalid");
    });

    it("rejects duplicate slugs", async () => {
      const res = await callV1(w.ownerA, "POST", "/organizations", {
        name: "Duplicate Org",
        legalName: "Duplicate LLC",
        slug: w.orgA,
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("An organisation with that slug already exists.");
      expect(res.body.code).toBe("invalid");
    });

    it("creates an organisation with an owner and SME profile", async () => {
      const slug = `new-sme-${randomUUID().slice(0, 8)}`;
      const res = await callV1(w.ownerA, "POST", "/organizations", {
        name: "New SME",
        legalName: "New SME Ltd",
        slug,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.smeId).toMatch(/^ET-SME-\d{6}$/);
      createdOrgIds.push(res.body.id);
    });
  });

  describe("viewing members (GET /v1/organizations/:id/members)", () => {
    it("requires authentication", async () => {
      const res = await callV1(null, "GET", `/organizations/${w.orgA}/members`);
      expect(res.status).toBe(401);
    });

    it("allows members of the organisation to view member list", async () => {
      const resOwner = await callV1(w.ownerA, "GET", `/organizations/${w.orgA}/members`);
      expect(resOwner.status).toBe(200);
      expect(resOwner.body.members).toHaveLength(2);
      expect(resOwner.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: w.ownerA.id, role: "owner" }),
          expect.objectContaining({ userId: w.memberA.id, role: "member" }),
        ]),
      );

      const resMember = await callV1(w.memberA, "GET", `/organizations/${w.orgA}/members`);
      expect(resMember.status).toBe(200);
      expect(resMember.body.members).toHaveLength(2);
    });

    it("allows Entrust admin to view members of any organisation", async () => {
      const resAdmin = await callV1(w.admin, "GET", `/organizations/${w.orgA}/members`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.members).toHaveLength(2);
    });

    it("forbids non-members and non-admin staff from viewing members", async () => {
      const resB = await callV1(w.ownerB, "GET", `/organizations/${w.orgA}/members`);
      expect(resB.status).toBe(403);
      expect(resB.body.error).toBe("You are not a member of this organisation.");

      const resOutsider = await callV1(w.outsider, "GET", `/organizations/${w.orgA}/members`);
      expect(resOutsider.status).toBe(403);

      const resFacilitator = await callV1(w.facilitator, "GET", `/organizations/${w.orgA}/members`);
      expect(resFacilitator.status).toBe(403);
    });
  });

  describe("inviting members (POST /v1/organizations/:id/invitations)", () => {
    it("requires authentication", async () => {
      const res = await callV1(null, "POST", `/organizations/${w.orgA}/invitations`, {
        email: "test@example.com",
        role: "member",
      });
      expect(res.status).toBe(401);
    });

    it("allows SME owner to invite members", async () => {
      const email = `invitee-${randomUUID().slice(0, 8)}@example.test`;
      const res = await callV1(w.ownerA, "POST", `/organizations/${w.orgA}/invitations`, {
        email,
        role: "member",
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();

      // Duplicate invitation to the same pending email triggers Better Auth APIError
      const resDup = await callV1(w.ownerA, "POST", `/organizations/${w.orgA}/invitations`, {
        email,
        role: "member",
      });
      expect(resDup.status).toBe(400);
      expect(resDup.body.code).toBe("invalid");
    });

    it("forbids SME member, other org owner, and outsider from inviting", async () => {
      const email = `invitee-${randomUUID().slice(0, 8)}@example.test`;
      const resMember = await callV1(w.memberA, "POST", `/organizations/${w.orgA}/invitations`, {
        email,
        role: "member",
      });
      expect(resMember.status).toBe(403);
      expect(resMember.body.error).toBe("Only organisation owners and Entrust admins can manage members.");

      const resOwnerB = await callV1(w.ownerB, "POST", `/organizations/${w.orgA}/invitations`, {
        email,
        role: "member",
      });
      expect(resOwnerB.status).toBe(403);

      const resOutsider = await callV1(w.outsider, "POST", `/organizations/${w.orgA}/invitations`, {
        email,
        role: "member",
      });
      expect(resOutsider.status).toBe(403);
    });

    it("allows Entrust admin to invite staff, but forbids facilitators and reviewers", async () => {
      const email = `staff-${randomUUID().slice(0, 8)}@example.test`;
      const resAdmin = await callV1(w.admin, "POST", `/organizations/${w.entrust}/invitations`, {
        email,
        role: "member",
      });
      expect(resAdmin.status).toBe(201);

      const resFacilitator = await callV1(w.facilitator, "POST", `/organizations/${w.entrust}/invitations`, {
        email: `staff2-${randomUUID().slice(0, 8)}@example.test`,
        role: "member",
      });
      expect(resFacilitator.status).toBe(403);

      const resReviewer = await callV1(w.reviewer, "POST", `/organizations/${w.entrust}/invitations`, {
        email: `staff3-${randomUUID().slice(0, 8)}@example.test`,
        role: "member",
      });
      expect(resReviewer.status).toBe(403);
    });

    it("forbids stray admin in SME organisation from inviting", async () => {
      const email = `stray-${randomUUID().slice(0, 8)}@example.test`;
      const res = await callV1(w.strayAdmin, "POST", `/organizations/${w.orgC}/invitations`, {
        email,
        role: "member",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("updating member roles (PATCH /v1/organizations/:id/members/:userId)", () => {
    it("allows SME owner to change member role, but forbids members", async () => {
      const resForbidden = await callV1(w.memberA, "PATCH", `/organizations/${w.orgA}/members/${w.memberA.id}`, {
        role: "owner",
      });
      expect(resForbidden.status).toBe(403);

      const resOwner = await callV1(w.ownerA, "PATCH", `/organizations/${w.orgA}/members/${w.memberA.id}`, {
        role: "owner",
      });
      expect(resOwner.status).toBe(200);

      await callV1(w.ownerA, "PATCH", `/organizations/${w.orgA}/members/${w.memberA.id}`, {
        role: "member",
      });
    });

    it("allows Entrust admin to update roles in any SME organisation", async () => {
      const resAdmin = await callV1(w.admin, "PATCH", `/organizations/${w.orgA}/members/${w.memberA.id}`, {
        role: "owner",
      });
      expect(resAdmin.status).toBe(200);

      await callV1(w.admin, "PATCH", `/organizations/${w.orgA}/members/${w.memberA.id}`, {
        role: "member",
      });
    });

    it("rejects invalid roles for SME organisations", async () => {
      const res = await callV1(w.ownerA, "PATCH", `/organizations/${w.orgA}/members/${w.memberA.id}`, {
        role: "facilitator",
      });
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("That role is not valid for this organisation.");
    });

    it("prevents demoting the last owner or last admin", async () => {
      // ownerA is the only owner in orgA
      const resOwner = await callV1(w.ownerA, "PATCH", `/organizations/${w.orgA}/members/${w.ownerA.id}`, {
        role: "member",
      });
      expect(resOwner.status).toBe(422);
      expect(resOwner.body.error).toBe("Cannot demote the last owner of the organisation.");

      // admin is the only admin in entrust
      const resAdmin = await callV1(w.admin, "PATCH", `/organizations/${w.entrust}/members/${w.admin.id}`, {
        role: "facilitator",
      });
      expect(resAdmin.status).toBe(422);
      expect(resAdmin.body.error).toBe("Cannot demote the last admin of the organisation.");
    });

    it("returns 404 when target user is not a member of the organisation", async () => {
      const res = await callV1(w.ownerA, "PATCH", `/organizations/${w.orgA}/members/${w.outsider.id}`, {
        role: "member",
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Member not found in this organisation.");
    });

    it("allows Entrust admin to change staff roles, but forbids facilitators", async () => {
      const resForbidden = await callV1(w.facilitator, "PATCH", `/organizations/${w.entrust}/members/${w.reviewer.id}`, {
        role: "facilitator",
      });
      expect(resForbidden.status).toBe(403);

      const resAdmin = await callV1(w.admin, "PATCH", `/organizations/${w.entrust}/members/${w.reviewer.id}`, {
        role: "facilitator",
      });
      expect(resAdmin.status).toBe(200);

      await callV1(w.admin, "PATCH", `/organizations/${w.entrust}/members/${w.reviewer.id}`, {
        role: "reviewer",
      });
    });
  });

  describe("removing members (DELETE /v1/organizations/:id/members/:userId)", () => {
    it("prevents self-removal", async () => {
      const res = await callV1(w.ownerA, "DELETE", `/organizations/${w.orgA}/members/${w.ownerA.id}`);
      expect(res.status).toBe(422);
      expect(res.body.error).toBe("You cannot remove yourself.");
    });

    it("forbids non-owners from removing members", async () => {
      const res = await callV1(w.memberA, "DELETE", `/organizations/${w.orgA}/members/${w.ownerA.id}`);
      expect(res.status).toBe(403);
    });

    it("returns 404 when removing non-member", async () => {
      const res = await callV1(w.ownerA, "DELETE", `/organizations/${w.orgA}/members/${w.outsider.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Member not found in this organisation.");
    });

    it("prevents removing the last owner or admin by another manager", async () => {
      // Temporarily add a second owner so admin can try removing the original owner
      const tempOwner = await signUp("temp-second-owner");
      await db.insert(schema.member).values({
        id: randomUUID(),
        organizationId: w.orgA,
        userId: tempOwner.id,
        role: "owner",
        createdAt: new Date(),
      });

      // Admin removes tempOwner
      const resDel1 = await callV1(w.admin, "DELETE", `/organizations/${w.orgA}/members/${tempOwner.id}`);
      expect(resDel1.status).toBe(200);

      // Now only ownerA is left. Admin cannot remove ownerA (last owner)
      const resDelLast = await callV1(w.admin, "DELETE", `/organizations/${w.orgA}/members/${w.ownerA.id}`);
      expect(resDelLast.status).toBe(422);
      expect(resDelLast.body.error).toBe("Cannot remove the last owner of the organisation.");
    });

    it("allows SME owner and Entrust admin to remove members", async () => {
      const disposableUser = await signUp("disposable-member");
      await db.insert(schema.member).values({
        id: randomUUID(),
        organizationId: w.orgA,
        userId: disposableUser.id,
        role: "member",
        createdAt: new Date(),
      });

      const resOwner = await callV1(w.ownerA, "DELETE", `/organizations/${w.orgA}/members/${disposableUser.id}`);
      expect(resOwner.status).toBe(200);

      const disposableStaff = await signUp("disposable-staff");
      await db.insert(schema.member).values({
        id: randomUUID(),
        organizationId: w.entrust,
        userId: disposableStaff.id,
        role: "reviewer",
        createdAt: new Date(),
      });

      const resReviewer = await callV1(w.reviewer, "DELETE", `/organizations/${w.entrust}/members/${disposableStaff.id}`);
      expect(resReviewer.status).toBe(403);

      const resAdmin = await callV1(w.admin, "DELETE", `/organizations/${w.entrust}/members/${disposableStaff.id}`);
      expect(resAdmin.status).toBe(200);
    });
  });

  describe("profile and platform access management", () => {
    it("allows SME owner and Entrust admin to update profile and forbids members", async () => {
      const resMember = await callV1(w.memberA, "PATCH", `/organizations/${w.orgA}/profile`, {
        legalName: "Updated Legal Name",
      });
      expect(resMember.status).toBe(403);

      const resOwner = await callV1(w.ownerA, "PATCH", `/organizations/${w.orgA}/profile`, {
        legalName: "Owner Updated Name",
      });
      expect(resOwner.status).toBe(200);

      const resAdmin = await callV1(w.admin, "PATCH", `/organizations/${w.orgA}/profile`, {
        legalName: "Admin Updated Name",
      });
      expect(resAdmin.status).toBe(200);
    });

    it("restricts platform access management to Entrust admins only", async () => {
      const resOwner = await callV1(w.ownerA, "POST", `/organizations/${w.orgA}/platform-access`, {
        platform: "clear",
        enabled: true,
      });
      expect(resOwner.status).toBe(403);
      expect(resOwner.body.error).toBe("Only Entrust admins can manage platform access.");

      const resMember = await callV1(w.memberA, "POST", `/organizations/${w.orgA}/platform-access`, {
        platform: "clear",
        enabled: true,
      });
      expect(resMember.status).toBe(403);

      const resAdmin = await callV1(w.admin, "POST", `/organizations/${w.orgA}/platform-access`, {
        platform: "clear",
        enabled: true,
      });
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.enabled).toBe(true);
    });
  });
});
