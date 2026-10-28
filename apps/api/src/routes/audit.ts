import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, count, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@entrust/db";
import type { AppEnv } from "../app";
import { AuditLogList, AuditQuery } from "../schemas/audit";
import { Problem } from "../schemas/problem";
import { loadPrincipal } from "../services/access";
import { ServiceError } from "../services/errors";

const tags = ["Audit"];

function sanitizeCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  let str = typeof val === "object" ? JSON.stringify(val) : String(val);
  // Formula injection protection: prepend single quote if cell starts with =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  // RFC 4180 escaping: wrap in quotes if contains comma, quotes, or newlines
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatAuditCsv(
  items: {
    id: string;
    occurredAt: Date | string;
    actorUserId: string | null;
    actorName: string | null;
    actorEmail: string | null;
    organizationId: string | null;
    organizationName: string | null;
    platform: string | null;
    action: string;
    entityType: string;
    entityId: string;
    reason: string | null;
  }[],
): string {
  const headers = [
    "id",
    "occurred_at",
    "actor_user_id",
    "actor_name",
    "actor_email",
    "organization_id",
    "organization_name",
    "platform",
    "action",
    "entity_type",
    "entity_id",
    "reason",
  ];
  const rows = items.map((item) =>
    [
      item.id,
      item.occurredAt instanceof Date ? item.occurredAt.toISOString() : item.occurredAt,
      item.actorUserId,
      item.actorName,
      item.actorEmail,
      item.organizationId,
      item.organizationName,
      item.platform,
      item.action,
      item.entityType,
      item.entityId,
      item.reason,
    ]
      .map(sanitizeCsvValue)
      .join(","),
  );
  return [headers.join(","), ...rows].join("\r\n") + "\r\n";
}

const listAuditRoute = createRoute({
  method: "get",
  path: "/audit",
  tags,
  summary: "Query platform audit trail",
  description:
    "Accessible exclusively to Entrust staff. Query and filter platform audit events by organisation, entity, action, and date range. Supports JSON pagination or CSV streaming export.",
  request: { query: AuditQuery },
  responses: {
    200: {
      description: "A page of audit log events or CSV text",
      content: {
        "application/json": { schema: AuditLogList },
        "text/csv": { schema: z.string() },
      },
    },
    400: { description: "Invalid query parameters", content: { "application/json": { schema: Problem } } },
    401: { description: "Not signed in", content: { "application/json": { schema: Problem } } },
    403: { description: "Only Entrust staff can view audit logs", content: { "application/json": { schema: Problem } } },
  },
});

export const auditRouter = new OpenAPIHono<AppEnv>({
  defaultHook: (result, c) => {
    if (result.success) return;
    const error = result.error.issues.map((i) => `${i.path.join(".") || "request"}: ${i.message}`).join("; ");
    return c.json({ error, code: "invalid" as const }, 400);
  },
}).openapi(listAuditRoute, async (c) => {
  const user = c.get("user");
  if (!user) throw new ServiceError("unauthenticated", "Not signed in.");

  const db = getDb();
  const principal = await loadPrincipal(db, user.id);
  if (!principal.staffRole) {
    throw new ServiceError("forbidden", "Only Entrust staff can view audit logs.");
  }

  const query = c.req.valid("query");

  // Validate date range order if both are provided
  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    return c.json({ error: "The 'from' timestamp must not be after 'to'.", code: "invalid" as const }, 400);
  }

  const conditions = [];
  if (query.organizationId) conditions.push(eq(schema.auditLog.organizationId, query.organizationId));
  if (query.entityType) conditions.push(eq(schema.auditLog.entityType, query.entityType));
  if (query.entityId) conditions.push(eq(schema.auditLog.entityId, query.entityId));
  if (query.action) conditions.push(eq(schema.auditLog.action, query.action));
  if (query.platform) conditions.push(eq(schema.auditLog.platform, query.platform));
  if (query.from) conditions.push(gte(schema.auditLog.occurredAt, new Date(query.from)));
  if (query.to) conditions.push(lte(schema.auditLog.occurredAt, new Date(query.to)));

  const whereClause = conditions.length ? and(...conditions) : undefined;
  const isCsv = query.format === "csv" || c.req.header("Accept")?.includes("text/csv");

  if (isCsv) {
    const rows = await db
      .select({
        id: schema.auditLog.id,
        occurredAt: schema.auditLog.occurredAt,
        actorUserId: schema.auditLog.actorUserId,
        actorName: schema.user.name,
        actorEmail: schema.user.email,
        organizationId: schema.auditLog.organizationId,
        organizationName: schema.organization.name,
        platform: schema.auditLog.platform,
        action: schema.auditLog.action,
        entityType: schema.auditLog.entityType,
        entityId: schema.auditLog.entityId,
        reason: schema.auditLog.reason,
      })
      .from(schema.auditLog)
      .leftJoin(schema.user, eq(schema.auditLog.actorUserId, schema.user.id))
      .leftJoin(schema.organization, eq(schema.auditLog.organizationId, schema.organization.id))
      .where(whereClause)
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(5000);

    const csvContent = formatAuditCsv(rows);
    const dateStr = new Date().toISOString().slice(0, 10);
    return c.text(csvContent, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-log-${dateStr}.csv"`,
    });
  }

  // JSON paginated query
  const [countResult] = await db
    .select({ count: count() })
    .from(schema.auditLog)
    .where(whereClause);

  const total = Number(countResult?.count ?? 0);
  const page = query.page;
  const limit = query.limit;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: schema.auditLog.id,
      occurredAt: schema.auditLog.occurredAt,
      actorUserId: schema.auditLog.actorUserId,
      actorName: schema.user.name,
      actorEmail: schema.user.email,
      organizationId: schema.auditLog.organizationId,
      organizationName: schema.organization.name,
      platform: schema.auditLog.platform,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      before: schema.auditLog.before,
      after: schema.auditLog.after,
      reason: schema.auditLog.reason,
    })
    .from(schema.auditLog)
    .leftJoin(schema.user, eq(schema.auditLog.actorUserId, schema.user.id))
    .leftJoin(schema.organization, eq(schema.auditLog.organizationId, schema.organization.id))
    .where(whereClause)
    .orderBy(desc(schema.auditLog.occurredAt))
    .limit(limit)
    .offset(offset);

  const items = rows.map((r) => ({
    ...r,
    occurredAt: r.occurredAt.toISOString(),
    before: (r.before as Record<string, unknown>) ?? null,
    after: (r.after as Record<string, unknown>) ?? null,
  }));

  return c.json({ items, total, page, limit, totalPages }, 200);
});
