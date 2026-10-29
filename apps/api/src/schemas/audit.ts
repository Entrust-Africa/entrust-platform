import { z } from "@hono/zod-openapi";
import { schema } from "@entrust/db";

export const AuditQuery = z
  .object({
    organizationId: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
    action: z.string().optional(),
    platform: z.enum(schema.PLATFORMS).optional(),
    from: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format for 'from'" })
      .optional(),
    to: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format for 'to'" })
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    format: z.enum(["json", "csv"]).default("json"),
  })
  .openapi("AuditQuery");

export const AuditLogItem = z
  .object({
    id: z.string().uuid(),
    occurredAt: z.string(),
    actorUserId: z.string().nullable(),
    actorName: z.string().nullable(),
    actorEmail: z.string().nullable(),
    organizationId: z.string().nullable(),
    organizationName: z.string().nullable(),
    platform: z.string().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    before: z.record(z.string(), z.unknown()).nullable(),
    after: z.record(z.string(), z.unknown()).nullable(),
    reason: z.string().nullable(),
  })
  .openapi("AuditLogItem");

export const AuditLogList = z
  .object({
    items: z.array(AuditLogItem),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
  })
  .openapi("AuditLogList");

export type AuditQueryType = z.infer<typeof AuditQuery>;
export type AuditLogItemType = z.infer<typeof AuditLogItem>;
export type AuditLogListType = z.infer<typeof AuditLogList>;
