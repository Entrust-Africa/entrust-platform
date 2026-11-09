import { and, desc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import { accessTo, recordTradeChange } from "./trade-shared";

// Integration records (spec 12.4): one row for each thing TRADE holds that lives in another system, with how its last sync went.
// A failure is written here and nowhere else: it never stops learning or the business profile. MIZAN isn't built, so it is shown
// as pending and nothing is recorded against it.

type Provider = (typeof schema.INTEGRATION_PROVIDERS)[number];
type Row = typeof schema.integrationRecord.$inferSelect;

const view = (r: Row) => ({
  id: r.id,
  provider: r.provider,
  recordType: r.recordType,
  externalReference: r.externalReference,
  syncStatus: r.syncStatus,
  lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
  errorCode: r.errorCode,
  errorDescription: r.errorDescription,
});

const NOT_BUILT: Provider[] = ["mizan"];

export async function listIntegrations(ctx: Ctx, input: { organizationId?: string | undefined }) {
  const id = input.organizationId ?? (ctx.principal.smeRoles.size === 1 ? [...ctx.principal.smeRoles.keys()][0] : undefined);
  if (!id) throw new ServiceError("invalid", "Say which organisation (`organizationId`) this is for.");
  if (!(await accessTo(ctx.db, ctx.principal, id))) throw new ServiceError("not_found", "Organisation not found.");
  const rows = await ctx.db.select().from(schema.integrationRecord).where(eq(schema.integrationRecord.organizationId, id)).orderBy(desc(schema.integrationRecord.updatedAt));
  return {
    organizationId: id,
    // One line for each system, so a screen can say where each stands even before anything has synced.
    providers: schema.INTEGRATION_PROVIDERS.map((provider) => ({
      provider,
      available: !NOT_BUILT.includes(provider),
      status: NOT_BUILT.includes(provider) ? ("pending" as const) : rows.some((r) => r.provider === provider && r.syncStatus === "failed") ? ("failed" as const) : rows.some((r) => r.provider === provider) ? ("synced" as const) : ("pending" as const),
    })),
    items: rows.map(view),
  };
}

export interface RecordIntegrationInput {
  organizationId: string;
  provider: Provider;
  recordType: string;
  externalReference?: string | null | undefined;
  syncStatus: (typeof schema.INTEGRATION_SYNC_STATUSES)[number];
  errorCode?: string | null | undefined;
  errorDescription?: string | null | undefined;
}

/** What an integration (or an administrator) writes after a sync. The same record type for the same business is updated, not repeated. */
export async function recordIntegration(ctx: Ctx, input: RecordIntegrationInput) {
  if (ctx.principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only a Super Admin can record an integration.");
  if (NOT_BUILT.includes(input.provider)) throw new ServiceError("invalid", `${input.provider.toUpperCase()} isn't connected yet, so nothing can be recorded for it.`);
  if (!(await accessTo(ctx.db, ctx.principal, input.organizationId))) throw new ServiceError("not_found", "Organisation not found.");
  const [existing] = await ctx.db
    .select()
    .from(schema.integrationRecord)
    .where(and(eq(schema.integrationRecord.organizationId, input.organizationId), eq(schema.integrationRecord.provider, input.provider), eq(schema.integrationRecord.recordType, input.recordType)));
  const failed = input.syncStatus === "failed";
  const values = {
    externalReference: input.externalReference ?? null,
    syncStatus: input.syncStatus,
    lastSyncAt: input.syncStatus === "synced" || failed ? ctx.now : (existing?.lastSyncAt ?? null),
    errorCode: failed ? (input.errorCode ?? "unknown") : null,
    errorDescription: failed ? (input.errorDescription ?? null) : null,
  };
  const [row] = existing
    ? await ctx.db.update(schema.integrationRecord).set(values).where(eq(schema.integrationRecord.id, existing.id)).returning()
    : await ctx.db.insert(schema.integrationRecord).values({ organizationId: input.organizationId, provider: input.provider, recordType: input.recordType, ...values }).returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.integration.recorded", organizationId: input.organizationId, entityType: "integration", entityId: row!.id, after: { provider: input.provider, recordType: input.recordType, syncStatus: input.syncStatus } });
  return view(row!);
}
