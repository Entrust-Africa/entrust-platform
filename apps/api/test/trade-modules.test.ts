import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

// TRADE's module endpoints (#61). The content package is empty until Entrust's content is loaded, so
// these cover who may call them and what an unloaded module looks like. What an SME is kept from in a
// loaded module is tested with a fixture in packages/trade-content.
const w = {} as { learner: TestUser; noGrant: TestUser; stranger: TestUser; admin: TestUser; trade: string; clearOnly: string; entrust: string };

const get = (user: TestUser | null, path: string) => callV1(user, "GET", `/trade${path}`);

beforeAll(async () => {
  await cleanup();
  const [learner, noGrant, stranger, admin] = await Promise.all(["learner", "no-grant", "stranger", "admin"].map(signUp));
  Object.assign(w, { learner, noGrant, stranger, admin });
  w.trade = await createOrganization("trade-org", [[learner!, "owner"]]);
  w.clearOnly = await createOrganization("clear-org", [[noGrant!, "owner"]]);
  w.entrust = await createOrganization("entrust", [[admin!, "admin"]], { smeProfile: false });
  await db.insert(schema.platformAccess).values([
    { organizationId: w.trade, platform: "trade", grantedBy: admin!.id },
    { organizationId: w.clearOnly, platform: "clear", grantedBy: admin!.id },
  ]);
  process.env.ENTRUST_ORG_ID = w.entrust;
});
afterAll(async () => {
  delete process.env.ENTRUST_ORG_ID;
  await cleanup();
});

describe("who can open the modules", () => {
  it("needs a signed-in user", async () => {
    expect((await get(null, "/modules")).status).toBe(401);
    expect((await get(null, "/modules/M04")).status).toBe(401);
  });

  it("refuses someone whose organisation has no TRADE access, or who has no organisation", async () => {
    for (const user of [w.noGrant, w.stranger]) {
      const res = await get(user, "/modules");
      expect(res.status).toBe(403);
      expect(res.body.error).toContain("TRADE");
      expect((await get(user, "/modules/M04")).status).toBe(403);
    }
  });

  it("lets an organisation with TRADE access and Entrust staff in", async () => {
    expect((await get(w.learner, "/modules")).status).toBe(200);
    expect((await get(w.admin, "/modules")).status).toBe(200);
  });
});

describe("modules without content", () => {
  it("lists all twelve as content in production", async () => {
    for (const user of [w.learner, w.admin]) {
      const { body } = await get(user, "/modules");
      expect(body.items.map((m: { id: string }) => m.id)).toEqual(["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10", "M11", "M12"]);
      expect(body.items.every((m: { contentStatus: string; latestVersion: unknown; versions: unknown[] }) => m.contentStatus === "in_production" && m.latestVersion === null && m.versions.length === 0)).toBe(true);
      expect(body.items[3]).toMatchObject({ id: "M04", title: "Trade Finance and Payment Risk", deliverable: "Transaction finance and payment-risk brief" });
    }
  });

  it("shows a module with no content", async () => {
    const { status, body } = await get(w.learner, "/modules/M07");
    expect(status).toBe(200);
    expect(body).toMatchObject({ id: "M07", contentStatus: "in_production", content: null });
  });

  it("finds no module or version that isn't there", async () => {
    expect((await get(w.learner, "/modules/M99")).status).toBe(404);
    expect((await get(w.admin, "/modules/m04")).status).toBe(404);
    expect((await get(w.learner, "/modules/M04?version=0.1.0")).status).toBe(404);
    expect((await get(w.admin, "/modules/M04?version=0.1.0")).status).toBe(404);
  });
});

describe("API documentation", () => {
  it("describes both endpoints", async () => {
    const doc = (await (await app.request("/openapi.json")).json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(["/v1/trade/modules", "/v1/trade/modules/{id}"]));
  });
});
