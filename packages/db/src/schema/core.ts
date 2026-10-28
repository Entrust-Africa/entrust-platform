import { index, integer, jsonb, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { core, organization, user } from "./auth";

// Platforms that run on the shared core. TRADE and MIZAN have no UI yet.
export const PLATFORMS = ["clear", "trade", "mizan"] as const;
export type Platform = (typeof PLATFORMS)[number];

// Which organisation may use which platform.
export const platformAccess = core.table(
  "platform_access",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    platform: text("platform", { enum: PLATFORMS }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    grantedBy: text("granted_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("platform_access_org_platform_uidx").on(t.organizationId, t.platform)],
);

// One SME profile per organisation, shared by every platform. The SME ID is
// the permanent, human-readable identifier (e.g. ET-SME-000001).
export const smeProfile = core.table("sme_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  smeId: text("sme_id").notNull().unique(),
  legalName: text("legal_name").notNull(),
  tin: text("tin"),
  country: text("country").notNull().default("ET"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Append-only audit trail written by every platform.
export const auditLog = core.table(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    platform: text("platform", { enum: PLATFORMS }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_org_idx").on(t.organizationId, t.occurredAt),
  ],
);

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type AllowedFileType = (typeof ALLOWED_FILE_TYPES)[number];
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

// Generic file storage for all platforms (CLEAR, TRADE, MIZAN).
export const file = core.table(
  "file",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    uploaderUserId: text("uploader_user_id").references(() => user.id, { onDelete: "set null" }),
    storageKey: text("storage_key").notNull().unique(),
    originalName: text("original_name").notNull(),
    contentType: text("content_type", { enum: ALLOWED_FILE_TYPES }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("file_org_idx").on(t.organizationId),
    index("file_uploader_idx").on(t.uploaderUserId),
  ],
);
