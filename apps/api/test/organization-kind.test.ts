import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, like } from "drizzle-orm";
import { schema } from "@entrust/db";
import { app } from "../src/app";
import { cleanup, createOrganization, db, PREFIX, signUp, type TestUser } from "./support";

// An organisation's kind (business, sponsor, Entrust) is set by the API. Better Auth's own organisation endpoints must not
// let a signed-in user make a sponsor, or turn their business into one.

const w = {} as { owner: TestUser; org: string };
const slug = `${PREFIX}self-made-sponsor-${Date.now()}`;

async function authCall(user: TestUser, path: string, body: unknown) {
  const response = await app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { cookie: user.cookie, "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  });
  return response.status;
}

beforeAll(async () => {
  await cleanup();
  w.owner = await signUp("org-kind-owner");
  w.org = await createOrganization("org-kind-sme", [[w.owner, "owner"]]);
});

afterAll(async () => {
  // In case a create got through, so the shared dev database keeps nothing.
  await db.delete(schema.organization).where(like(schema.organization.slug, `${PREFIX}self-made-sponsor-%`));
  await cleanup();
});

describe("organisation kind", () => {
  it("refuses creating an organisation through Better Auth", async () => {
    const status = await authCall(w.owner, "/organization/create", { name: "Self-made sponsor", slug, metadata: { kind: "sponsor" } });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(await db.select().from(schema.organization).where(eq(schema.organization.slug, slug))).toHaveLength(0);
  });

  it("refuses an owner changing the metadata, and still lets them rename", async () => {
    const refused = await authCall(w.owner, "/organization/update", { organizationId: w.org, data: { metadata: { kind: "sponsor" } } });
    expect(refused).toBeGreaterThanOrEqual(400);
    const [row] = await db.select({ metadata: schema.organization.metadata }).from(schema.organization).where(eq(schema.organization.id, w.org));
    expect(JSON.parse(row!.metadata!)).toMatchObject({ kind: "sme" });
    expect(await authCall(w.owner, "/organization/update", { organizationId: w.org, data: { name: "Renamed business" } })).toBe(200);
  });
});
