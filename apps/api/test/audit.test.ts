import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { cleanup, createOrganization, db, signUp, type TestUser } from "./support";

describe("audit log endpoint (GET /v1/audit) (#21)", () => {
  let smeOwner: TestUser;
  let smeMember: TestUser;
  let outsider: TestUser;
  let staffAdmin: TestUser;
  let staffReviewer: TestUser;

  let smeOrgId: string;
  let otherOrgId: string;
  let entrustOrgId: string;

  const createdAuditIds: string[] = [];

  const callAudit = async (
    user: TestUser | null,
    query: string = "",
    headers: Record<string, string> = {},
  ) => {
    return app.request(`/v1/audit${query}`, {
      method: "GET",
      headers: {
        ...(user ? { cookie: user.cookie } : {}),
        ...headers,
      },
    });
  };

  beforeAll(async () => {
    await cleanup();

    await db.delete(schema.auditLog);

    [smeOwner, smeMember, outsider, staffAdmin, staffReviewer] = await Promise.all([
      signUp("sme-owner-audit"),
      signUp("sme-member-audit"),
      signUp("outsider-audit"),
      signUp("staff-admin-audit"),
      signUp("staff-reviewer-audit"),
    ]);

    smeOrgId = await createOrganization("sme-audit-co", [
      [smeOwner, "owner"],
      [smeMember, "member"],
    ]);

    otherOrgId = await createOrganization("other-audit-co", [
      [outsider, "owner"],
    ]);

    entrustOrgId = await createOrganization(
      "entrust-audit-staff",
      [
        [staffAdmin, "admin"],
        [staffReviewer, "reviewer"],
      ],
      { smeProfile: false },
    );

    process.env.ENTRUST_ORG_ID = entrustOrgId;

    const id1 = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    const id3 = "33333333-3333-4333-8333-333333333333";
    const id4 = "44444444-4444-4444-8444-444444444444";
    const id5 = "55555555-5555-4555-8555-555555555555";

    const sharedTimestamp = new Date("2026-10-22T14:30:00.000Z");

    // Seed test audit log entries with real platform entity types
    const testLogs = [
      {
        id: id1,
        occurredAt: new Date("2026-10-20T10:00:00.000Z"),
        actorUserId: smeOwner.id,
        organizationId: smeOrgId,
        platform: "clear" as const,
        action: "case.created",
        entityType: "export_case",
        entityId: "case-001",
        reason: "Initial case opening",
        before: null,
        after: { reference: "CLR-ET-2026-000001" },
      },
      {
        id: id2,
        occurredAt: sharedTimestamp, // Tied timestamp 1
        actorUserId: staffReviewer.id,
        organizationId: smeOrgId,
        platform: "clear" as const,
        action: "evidence.amendment_reset",
        entityType: "export_case",
        entityId: "case-001",
        reason: "Reset evidence on amendment",
        before: { status: "under_review" },
        after: { status: "draft" },
      },
      {
        id: id3,
        occurredAt: sharedTimestamp, // Tied timestamp 2 (same tx)
        actorUserId: staffReviewer.id,
        organizationId: smeOrgId,
        platform: "clear" as const,
        action: "case.amended",
        entityType: "export_case",
        entityId: "case-001",
        reason: "Case amended with new quantity",
        before: { quantity: 100 },
        after: { quantity: 120 },
      },
      {
        id: id4,
        occurredAt: new Date("2026-10-24T09:15:00.000Z"),
        actorUserId: staffAdmin.id,
        organizationId: null,
        platform: "clear" as const,
        action: "minimum_price_table.record",
        entityType: "minimum_price_table",
        entityId: "table-001",
        reason: "=1+2 formula injection test",
        before: null,
        after: { source: "ECX", priceCount: 15 },
      },
      {
        id: id5,
        occurredAt: new Date("2026-10-25T16:00:00.000Z"),
        actorUserId: outsider.id,
        organizationId: otherOrgId,
        platform: "clear" as const,
        action: "file.uploaded",
        entityType: "file",
        entityId: "file-999",
        reason: "Commercial invoice file upload",
        before: null,
        after: { originalName: "invoice.pdf", sizeBytes: 1024 },
      },
    ];

    for (const log of testLogs) {
      createdAuditIds.push(log.id);
      await db.insert(schema.auditLog).values(log);
    }
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    await db.delete(schema.auditLog);
    await cleanup();
  });

  describe("authentication and authorization", () => {
    it("returns 401 unauthenticated when no session is provided", async () => {
      const res = await callAudit(null);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("unauthenticated");
    });

    it("returns 403 forbidden when called by an SME owner", async () => {
      const res = await callAudit(smeOwner);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("forbidden");
      expect(json.error).toBe("Only Entrust staff can view audit logs.");
    });

    it("returns 403 forbidden when called by an SME member", async () => {
      const res = await callAudit(smeMember);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("forbidden");
    });

    it("returns 403 forbidden when called by an unaffiliated outsider", async () => {
      const res = await callAudit(outsider);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.code).toBe("forbidden");
    });

    it("returns 200 OK when called by an Entrust staff admin", async () => {
      const res = await callAudit(staffAdmin);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toBeDefined();
      expect(json.total).toBeGreaterThanOrEqual(5);
    });

    it("returns 200 OK when called by an Entrust staff reviewer", async () => {
      const res = await callAudit(staffReviewer);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toBeDefined();
    });

    it("returns staffRole in /v1/me for staff and null for SME user", async () => {
      const adminMeRes = await app.request("/v1/me", {
        headers: { cookie: staffAdmin.cookie },
      });
      expect(adminMeRes.status).toBe(200);
      const adminMe = await adminMeRes.json();
      expect(adminMe.staffRole).toBe("admin");

      const smeMeRes = await app.request("/v1/me", {
        headers: { cookie: smeOwner.cookie },
      });
      expect(smeMeRes.status).toBe(200);
      const smeMe = await smeMeRes.json();
      expect(smeMe.staffRole).toBeNull();
    });
  });

  describe("query filtering and pagination", () => {
    it("filters by organizationId", async () => {
      const res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(3);
      expect(json.items.every((i: any) => i.organizationId === smeOrgId)).toBe(true);
      expect(json.items[0].organizationName).toBe("sme-audit-co");
    });

    it("filters by entityType", async () => {
      const resCase = await callAudit(staffAdmin, "?entityType=export_case");
      expect(resCase.status).toBe(200);
      const jsonCase = await resCase.json();
      expect(jsonCase.items.length).toBe(3);
      expect(jsonCase.items.every((i: any) => i.entityType === "export_case")).toBe(true);

      const resMpt = await callAudit(staffAdmin, "?entityType=minimum_price_table");
      expect(resMpt.status).toBe(200);
      const jsonMpt = await resMpt.json();
      expect(jsonMpt.items.length).toBe(1);
      expect(jsonMpt.items[0].entityType).toBe("minimum_price_table");
      expect(jsonMpt.items[0].entityId).toBe("table-001");
    });

    it("filters by action", async () => {
      const res = await callAudit(staffAdmin, "?action=case.amended");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      expect(json.items[0].action).toBe("case.amended");
      expect(json.items[0].actorUserId).toBe(staffReviewer.id);
    });

    it("filters by platform", async () => {
      const res = await callAudit(staffAdmin, "?platform=clear");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(5);
      expect(json.items.every((i: any) => i.platform === "clear")).toBe(true);
    });

    it("filters by date range (from and to)", async () => {
      const res = await callAudit(
        staffAdmin,
        "?from=2026-10-21T00:00:00.000Z&to=2026-10-23T23:59:59.000Z",
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(2);
      expect(json.items.every((i: any) => i.entityId === "case-001")).toBe(true);
    });

    it("returns 400 invalid when 'from' is after 'to'", async () => {
      const res = await callAudit(
        staffAdmin,
        "?from=2026-10-25T00:00:00.000Z&to=2026-10-20T00:00:00.000Z",
      );
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("invalid");
      expect(json.error).toBe("The 'from' timestamp must not be after 'to'.");
    });

    it("paginates records deterministically with id tiebreaker across tied timestamps", async () => {
      // Organization smeOrgId has 3 records:
      // - 1 at 2026-10-20
      // - 2 tied at 2026-10-22 (audit-002-bbbb-2222-evidence-reset & audit-003-cccc-3333-case-amended)
      const page1Res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}&limit=1&page=1`);
      expect(page1Res.status).toBe(200);
      const p1 = await page1Res.json();
      expect(p1.items.length).toBe(1);
      expect(p1.total).toBe(3);
      expect(p1.totalPages).toBe(3);
      expect(p1.page).toBe(1);
      expect(p1.limit).toBe(1);

      const page2Res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}&limit=1&page=2`);
      expect(page2Res.status).toBe(200);
      const p2 = await page2Res.json();
      expect(p2.items.length).toBe(1);
      expect(p2.page).toBe(2);
      expect(p2.items[0].id).not.toBe(p1.items[0].id);

      const page3Res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}&limit=1&page=3`);
      expect(page3Res.status).toBe(200);
      const p3 = await page3Res.json();
      expect(p3.items.length).toBe(1);
      expect(p3.page).toBe(3);
      expect(p3.items[0].id).not.toBe(p1.items[0].id);
      expect(p3.items[0].id).not.toBe(p2.items[0].id);

      // Verify that all 3 distinct IDs are accounted for (no repeats, no skips)
      const seenIds = new Set([p1.items[0].id, p2.items[0].id, p3.items[0].id]);
      expect(seenIds.size).toBe(3);
      expect(seenIds.has("11111111-1111-4111-8111-111111111111")).toBe(true);
      expect(seenIds.has("22222222-2222-4222-8222-222222222222")).toBe(true);
      expect(seenIds.has("33333333-3333-4333-8333-333333333333")).toBe(true);
      // Furthermore, between the two tied records (2026-10-22), id3 > id2, so id3 must come first under desc(id)
      expect(p1.items[0].id).toBe("33333333-3333-4333-8333-333333333333");
      expect(p2.items[0].id).toBe("22222222-2222-4222-8222-222222222222");
      expect(p3.items[0].id).toBe("11111111-1111-4111-8111-111111111111");
    });
  });

  describe("CSV export, streaming, and formula sanitization", () => {
    it("returns RFC 4180 CSV with Content-Disposition and count headers when format=csv is queried", async () => {
      const res = await callAudit(staffAdmin, "?format=csv");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
      expect(res.headers.get("X-Total-Count")).toBeDefined();
      expect(Number(res.headers.get("X-Total-Count"))).toBeGreaterThanOrEqual(5);
      expect(res.headers.get("X-Truncated")).toBe("false");

      const csv = await res.text();
      const lines = csv.trim().split("\r\n");
      expect(lines.length).toBeGreaterThanOrEqual(6);

      // Verify header row
      expect(lines[0]).toBe(
        "id,occurred_at,actor_user_id,actor_name,actor_email,organization_id,organization_name,platform,action,entity_type,entity_id,reason",
      );

      // Verify formula injection sanitization: '=1+2 formula injection test' must be escaped as ''=1+2...'
      const formulaLine = lines.find((l) => l.includes("formula injection test"));
      expect(formulaLine).toBeDefined();
      expect(formulaLine).toContain("'=1+2 formula injection test");
    });

    it("returns CSV when requested via Accept: text/csv header", async () => {
      const res = await callAudit(staffAdmin, "", { Accept: "text/csv" });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      const csv = await res.text();
      expect(csv.startsWith("id,occurred_at,actor_user_id")).toBe(true);
    });
  });
});
