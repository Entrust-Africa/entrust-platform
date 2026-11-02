import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { PLATFORMS } from "@entrust/roles";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { call, callV1, cleanup, createOrganization, db, signUp, type TestUser } from "./support";

describe("Organisation kinds, roles and platform access (#50)", () => {
  const w = {} as {
    admin: TestUser;
    smeUser: TestUser;
    tradeOnlyOrg: string;
    clearOnlyOrg: string;
    entrustOrg: string;
  };

  beforeAll(async () => {
    await cleanup();
    const [admin, smeUser] = await Promise.all(["admin", "sme-user"].map(signUp));
    Object.assign(w, { admin, smeUser });

    // Entrust organization
    w.entrustOrg = await createOrganization("entrust-team", [[admin!, "admin"]], { smeProfile: false });
    process.env.ENTRUST_ORG_ID = w.entrustOrg;

    // Create a trade-only organization for the SME user
    w.tradeOnlyOrg = await createOrganization("trade-only-sme", [[smeUser!, "owner"]], {
      smeProfile: true,
      platform: "trade",
    });

    // Create a clear-only organization for the SME user
    w.clearOnlyOrg = await createOrganization("clear-only-sme", [[smeUser!, "owner"]], {
      smeProfile: true,
      platform: "clear",
    });
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await cleanup();
  });

  describe("platform access enforcement", () => {
    it("an organisation without clear gets 404 from /v1/clear/*", async () => {
      // Access clear cases specifying the trade-only organisation
      const res = await call(w.smeUser, "GET", `/cases?organizationId=${w.tradeOnlyOrg}`);
      expect(res.status).toBe(404);

      // Attempting to open a CLEAR case for trade-only organisation gets 404
      const openRes = await call(w.smeUser, "POST", "/cases", {
        organizationId: w.tradeOnlyOrg,
        facts: { product: "green_coffee", destinationCountry: "US", transportMode: "sea" },
      });
      expect(openRes.status).toBe(404);
    });

    it("an organisation without trade gets 404 from /v1/trade/*", async () => {
      // Practice cases list for clear-only organisation gets 404
      const res = await callV1(w.smeUser, "GET", `/trade/practice-cases?organizationId=${w.clearOnlyOrg}`);
      expect(res.status).toBe(404);

      // Trade modules for clear-only organisation gets 404
      const modRes = await callV1(w.smeUser, "GET", `/trade/modules?organizationId=${w.clearOnlyOrg}`);
      expect(modRes.status).toBe(404);
    });

    it("Entrust staff pass platform access checks on both CLEAR and TRADE", async () => {
      // Staff can access cases for any org
      const clearRes = await call(w.admin, "GET", `/cases?organizationId=${w.clearOnlyOrg}`);
      expect(clearRes.status).toBe(200);

      // Staff can access practice scenarios / cases
      const tradeRes = await callV1(w.admin, "GET", "/trade/practice-scenarios");
      expect(tradeRes.status).toBe(200);
    });
  });

  describe("GET /v1/organizations and GET /v1/me", () => {
    it("returns each organisation's kind, user role, SME ID, and platforms", async () => {
      const res = await callV1(w.smeUser, "GET", "/organizations");
      expect(res.status).toBe(200);
      expect(res.body.organizations).toBeDefined();

      const tradeOrg = res.body.organizations.find((o: any) => o.id === w.tradeOnlyOrg);
      expect(tradeOrg).toMatchObject({
        id: w.tradeOnlyOrg,
        role: "owner",
        kind: "sme",
        platforms: ["trade"],
      });
      expect(tradeOrg.smeId).toMatch(/^TEST-/);

      const clearOrg = res.body.organizations.find((o: any) => o.id === w.clearOnlyOrg);
      expect(clearOrg).toMatchObject({
        id: w.clearOnlyOrg,
        role: "owner",
        kind: "sme",
        platforms: ["clear"],
      });
      expect(clearOrg.smeId).toMatch(/^TEST-/);
    });

    it("returns kind as entrust for Entrust organization in /organizations and /me", async () => {
      const orgsRes = await callV1(w.admin, "GET", "/organizations");
      expect(orgsRes.status).toBe(200);
      const entrustOrg = orgsRes.body.organizations.find((o: any) => o.id === w.entrustOrg);
      expect(entrustOrg).toMatchObject({
        id: w.entrustOrg,
        role: "admin",
        kind: "entrust",
        smeId: null,
      });

      const meRes = await callV1(w.admin, "GET", "/me");
      expect(meRes.status).toBe(200);
      expect(meRes.body.staffRole).toBe("admin");
      expect(meRes.body.organizations).toBeDefined();
    });
  });

  describe("platform-access management and audit logging", () => {
    it("accepts all PLATFORMS and records audit log on grant and revocation", async () => {
      for (const platform of PLATFORMS) {
        // Grant platform
        const grantRes = await callV1(w.admin, "POST", `/organizations/${w.tradeOnlyOrg}/platform-access`, {
          platform,
          enabled: true,
        });
        expect(grantRes.status).toBe(200);
        expect(grantRes.body).toMatchObject({ platform, enabled: true });

        // Verify audit log has grant
        const [grantAudit] = await db
          .select()
          .from(schema.auditLog)
          .where(
            and(
              eq(schema.auditLog.organizationId, w.tradeOnlyOrg),
              eq(schema.auditLog.action, "organization.platform_access_granted"),
              eq(schema.auditLog.platform, platform),
            ),
          );
        expect(grantAudit).toBeDefined();
        expect(grantAudit?.actorUserId).toBe(w.admin.id);

        // Revoke platform (except trade so tradeOnlyOrg retains its base)
        if (platform !== "trade") {
          const revokeRes = await callV1(w.admin, "POST", `/organizations/${w.tradeOnlyOrg}/platform-access`, {
            platform,
            enabled: false,
          });
          expect(revokeRes.status).toBe(200);
          expect(revokeRes.body).toMatchObject({ platform, enabled: false });

          // Verify audit log has revocation
          const [revokeAudit] = await db
            .select()
            .from(schema.auditLog)
            .where(
              and(
                eq(schema.auditLog.organizationId, w.tradeOnlyOrg),
                eq(schema.auditLog.action, "organization.platform_access_revoked"),
                eq(schema.auditLog.platform, platform),
              ),
            );
          expect(revokeAudit).toBeDefined();
        }
      }
    });
  });

  describe("SME lifecycle: joined via TRADE then given CLEAR", () => {
    it("maintains the same user, organisation and SME ID across both platforms", async () => {
      // 1. SME signs up and creates organisation for TRADE
      const user = await signUp("trade-first-user");
      const createRes = await callV1(user, "POST", "/organizations", {
        name: "Trade First Exporters",
        slug: `trade-first-exp-${Date.now()}`,
        legalName: "Trade First PLC",
        country: "ET",
        platform: "trade",
      });
      expect(createRes.status).toBe(201);
      const { id: orgId, smeId } = createRes.body;
      expect(smeId).toMatch(/^ET-SME-\d{6}$/);

      // 2. Initially, organisation cannot access CLEAR (gets 404)
      const clearAccessBefore = await call(user, "GET", `/cases?organizationId=${orgId}`);
      expect(clearAccessBefore.status).toBe(404);

      // 3. Entrust admin turns on CLEAR for this organisation
      const grantRes = await callV1(w.admin, "POST", `/organizations/${orgId}/platform-access`, {
        platform: "clear",
        enabled: true,
      });
      expect(grantRes.status).toBe(200);

      // 4. Now organisation has access to CLEAR with the exact same user, organisation, and SME ID
      const orgsRes = await callV1(user, "GET", "/organizations");
      expect(orgsRes.status).toBe(200);
      const org = orgsRes.body.organizations.find((o: any) => o.id === orgId);
      expect(org).toMatchObject({
        id: orgId,
        smeId,
        role: "owner",
        kind: "sme",
      });
      expect(org.platforms).toContain("trade");
      expect(org.platforms).toContain("clear");

      // Can now open a case in CLEAR under that same SME organisation
      const openCase = await call(user, "POST", "/cases", {
        organizationId: orgId,
        facts: { product: "green_coffee", destinationCountry: "US", transportMode: "sea" },
      });
      expect(openCase.status).toBe(201);
      expect(openCase.body.organizationId).toBe(orgId);
    });
  });

  describe("database migration backfill", () => {
    it("ensures existing SME organisations have clear access", async () => {
      // Create an org and delete its platform access to simulate pre-migration state
      const tempUser = await signUp("migration-test-user");
      const orgId = await createOrganization("pre-migration-sme", [[tempUser!, "owner"]], {
        smeProfile: true,
        platform: null,
      });

      // Confirm no platform access row initially
      const initialGrants = await db
        .select()
        .from(schema.platformAccess)
        .where(eq(schema.platformAccess.organizationId, orgId));
      expect(initialGrants).toHaveLength(0);

      // Execute the migration backfill query
      await db.execute(
        `INSERT INTO core.platform_access (id, organization_id, platform, granted_at)
         SELECT gen_random_uuid(), sp.organization_id, 'clear', now()
         FROM core.sme_profile sp
         WHERE sp.organization_id = '${orgId}'
         ON CONFLICT (organization_id, platform) DO NOTHING;`
      );

      // Verify clear access is now present
      const afterGrants = await db
        .select()
        .from(schema.platformAccess)
        .where(and(eq(schema.platformAccess.organizationId, orgId), eq(schema.platformAccess.platform, "clear")));
      expect(afterGrants).toHaveLength(1);
    });
  });
});
