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

    // Seed test audit log entries
    const testLogs = [
      {
        id: randomUUID(),
        occurredAt: new Date("2026-10-20T10:00:00.000Z"),
        actorUserId: smeOwner.id,
        organizationId: smeOrgId,
        platform: "clear" as const,
        action: "case.created",
        entityType: "case",
        entityId: "case-001",
        reason: "Initial case opening",
        before: null,
        after: { reference: "CLR-ET-2026-000001" },
      },
      {
        id: randomUUID(),
        occurredAt: new Date("2026-10-22T14:30:00.000Z"),
        actorUserId: staffReviewer.id,
        organizationId: smeOrgId,
        platform: "clear" as const,
        action: "evidence.reviewed",
        entityType: "evidence",
        entityId: "evi-001",
        reason: "Commercial invoice approved",
        before: { status: "under_review" },
        after: { status: "approved" },
      },
      {
        id: randomUUID(),
        occurredAt: new Date("2026-10-24T09:15:00.000Z"),
        actorUserId: staffAdmin.id,
        organizationId: null,
        platform: "clear" as const,
        action: "rule_pack.updated",
        entityType: "rule_pack",
        entityId: "rp-001",
        reason: "=1+2 formula injection test",
        before: { version: "1.0.0" },
        after: { version: "1.1.0" },
      },
      {
        id: randomUUID(),
        occurredAt: new Date("2026-10-25T16:00:00.000Z"),
        actorUserId: outsider.id,
        organizationId: otherOrgId,
        platform: "trade" as const,
        action: "trade.initiated",
        entityType: "trade_order",
        entityId: "order-999",
        reason: "Trade contract order",
        before: null,
        after: null,
      },
    ];

    for (const log of testLogs) {
      createdAuditIds.push(log.id);
      await db.insert(schema.auditLog).values(log);
    }
  });

  afterAll(async () => {
    delete process.env.ENTRUST_ORG_ID;
    if (createdAuditIds.length > 0) {
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.id, createdAuditIds));
    }
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
      expect(json.total).toBeGreaterThanOrEqual(4);
    });

    it("returns 200 OK when called by an Entrust staff reviewer", async () => {
      const res = await callAudit(staffReviewer);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items).toBeDefined();
    });
  });

  describe("query filtering and pagination", () => {
    it("filters by organizationId", async () => {
      const res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(2);
      expect(json.items.every((i: any) => i.organizationId === smeOrgId)).toBe(true);
      expect(json.items[0].organizationName).toBe("sme-audit-co");
    });

    it("filters by entityType", async () => {
      const res = await callAudit(staffAdmin, "?entityType=case");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      expect(json.items[0].entityType).toBe("case");
      expect(json.items[0].entityId).toBe("case-001");
    });

    it("filters by action", async () => {
      const res = await callAudit(staffAdmin, "?action=evidence.reviewed");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      expect(json.items[0].action).toBe("evidence.reviewed");
      expect(json.items[0].actorUserId).toBe(staffReviewer.id);
    });

    it("filters by platform", async () => {
      const res = await callAudit(staffAdmin, "?platform=trade");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      expect(json.items[0].action).toBe("trade.initiated");
    });

    it("filters by date range (from and to)", async () => {
      const res = await callAudit(
        staffAdmin,
        "?from=2026-10-21T00:00:00.000Z&to=2026-10-23T23:59:59.000Z",
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      expect(json.items[0].action).toBe("evidence.reviewed");
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

    it("paginates records properly with page and limit", async () => {
      const page1Res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}&limit=1&page=1`);
      expect(page1Res.status).toBe(200);
      const p1 = await page1Res.json();
      expect(p1.items.length).toBe(1);
      expect(p1.total).toBe(2);
      expect(p1.totalPages).toBe(2);
      expect(p1.page).toBe(1);
      expect(p1.limit).toBe(1);

      const page2Res = await callAudit(staffAdmin, `?organizationId=${smeOrgId}&limit=1&page=2`);
      expect(page2Res.status).toBe(200);
      const p2 = await page2Res.json();
      expect(p2.items.length).toBe(1);
      expect(p2.page).toBe(2);
      expect(p2.items[0].id).not.toBe(p1.items[0].id);
    });
  });

  describe("CSV export and formula sanitization", () => {
    it("returns RFC 4180 CSV with Content-Disposition when format=csv is queried", async () => {
      const res = await callAudit(staffAdmin, "?format=csv");
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");

      const csv = await res.text();
      const lines = csv.trim().split("\r\n");
      expect(lines.length).toBeGreaterThanOrEqual(5);

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
