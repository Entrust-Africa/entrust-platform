import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import { schema } from "@entrust/db";
import {
  MODULE_CONTENT,
  findVersion,
  toLearnerView,
  validateModuleContent,
  type Audience,
  type LearnerModuleContent,
  type ModuleContent,
} from "@entrust/trade-content";
import { MODULE_IDS, compareVersions, type ModuleId } from "@entrust/trade-rules";
import { requireStaff, type Ctx } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { recordTradeChange } from "./trade-shared";

export function computeContentHash(content: unknown): string {
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

let seeded = false;

/**
 * Seeds the database with the baseline module content versions from @entrust/trade-content if empty.
 * All repository versions are marked as 'approved' with their canonical SHA-256 hash.
 */
export async function seedModuleVersionsIfEmpty(db: Executor): Promise<void> {
  if (seeded) return;
  const [existing] = await db
    .select({ id: schema.moduleContentVersion.id })
    .from(schema.moduleContentVersion)
    .limit(1);

  if (!existing) {
    for (const c of MODULE_CONTENT) {
      const hash = computeContentHash(c);
      await db
        .insert(schema.moduleContentVersion)
        .values({
          moduleId: c.module,
          version: c.version,
          status: c.status === "approved" ? "approved" : "draft",
          title: c.title,
          deliverable: c.deliverable,
          objectives: c.objectives,
          content: c as unknown as Record<string, unknown>,
          contentHash: hash,
          changeSummary: "Baseline repository content",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }
  seeded = true;
}

export interface AdminModuleVersionSummary {
  id: string;
  moduleId: ModuleId;
  version: string;
  status: "draft" | "in_review" | "approved" | "archived";
  title: string;
  deliverable: string;
  objectives: string[];
  contentHash: string;
  changeSummary: string | null;
  createdByUserId: string | null;
  createdByUser?: { id: string; name: string | null; email: string } | null;
  updatedByUserId: string | null;
  submittedByUserId: string | null;
  submittedAt: string | null;
  approvedByUserId: string | null;
  approvedByUser?: { id: string; name: string | null; email: string } | null;
  approvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminModuleSummary {
  id: ModuleId;
  title: string;
  deliverable: string;
  objectives: string[];
  latestApprovedVersion: string | null;
  activeDraftVersion: string | null;
  inReviewVersion: string | null;
  versions: AdminModuleVersionSummary[];
}

/** Lists all 12 modules and all their dynamic versions for authorized staff. */
export async function listAdminModules(ctx: Ctx): Promise<AdminModuleSummary[]> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "manage course content");
  await seedModuleVersionsIfEmpty(ctx.db);

  const rows = await ctx.db
    .select()
    .from(schema.moduleContentVersion)
    .orderBy(desc(schema.moduleContentVersion.createdAt));

  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.createdByUserId, r.approvedByUserId])
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const userMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (userIds.length > 0) {
    const userRows = await ctx.db
      .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, userIds));
    for (const u of userRows) {
      userMap.set(u.id, u);
    }
  }

  const moduleMap = new Map<ModuleId, AdminModuleVersionSummary[]>();
  for (const id of MODULE_IDS) {
    moduleMap.set(id, []);
  }

  for (const r of rows) {
    const modId = r.moduleId as ModuleId;
    const list = moduleMap.get(modId) ?? [];
    list.push({
      id: r.id,
      moduleId: modId,
      version: r.version,
      status: r.status as AdminModuleVersionSummary["status"],
      title: r.title,
      deliverable: r.deliverable,
      objectives: r.objectives as string[],
      contentHash: r.contentHash,
      changeSummary: r.changeSummary,
      createdByUserId: r.createdByUserId,
      createdByUser: r.createdByUserId ? userMap.get(r.createdByUserId) ?? null : null,
      updatedByUserId: r.updatedByUserId,
      submittedByUserId: r.submittedByUserId,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      approvedByUserId: r.approvedByUserId,
      approvedByUser: r.approvedByUserId ? userMap.get(r.approvedByUserId) ?? null : null,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      archivedAt: r.archivedAt ? r.archivedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });
    moduleMap.set(modId, list);
  }

  return MODULE_IDS.map((id) => {
    const versions = (moduleMap.get(id) ?? []).sort((a, b) => compareVersions(b.version, a.version));
    const latestApproved = versions.find((v) => v.status === "approved");
    const activeDraft = versions.find((v) => v.status === "draft");
    const inReview = versions.find((v) => v.status === "in_review");

    return {
      id,
      title: latestApproved?.title ?? versions[0]?.title ?? id,
      deliverable: latestApproved?.deliverable ?? versions[0]?.deliverable ?? "",
      objectives: latestApproved?.objectives ?? versions[0]?.objectives ?? [],
      latestApprovedVersion: latestApproved?.version ?? null,
      activeDraftVersion: activeDraft?.version ?? null,
      inReviewVersion: inReview?.version ?? null,
      versions,
    };
  });
}

export interface AdminModuleVersionDetail extends AdminModuleVersionSummary {
  content: Record<string, unknown>;
  validationErrors: string[];
}

/** Retrieves a specific module content version for editing and review. */
export async function getAdminModuleVersion(
  ctx: Ctx,
  moduleId: string,
  version: string,
): Promise<AdminModuleVersionDetail> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "view course content");
  await seedModuleVersionsIfEmpty(ctx.db);

  const [row] = await ctx.db
    .select()
    .from(schema.moduleContentVersion)
    .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.version, version)))
    .limit(1);

  if (!row) {
    const staticVersion = findVersion(moduleId as ModuleId, "staff", version);
    if (!staticVersion) throw new ServiceError("not_found", `Version ${version} of module ${moduleId} does not exist.`);
    return {
      id: "static",
      moduleId: moduleId as ModuleId,
      version: staticVersion.version,
      status: staticVersion.status === "approved" ? "approved" : "draft",
      title: staticVersion.title,
      deliverable: staticVersion.deliverable,
      objectives: staticVersion.objectives,
      contentHash: computeContentHash(staticVersion),
      changeSummary: "Static bundled baseline",
      createdByUserId: null,
      createdByUser: null,
      updatedByUserId: null,
      submittedByUserId: null,
      submittedAt: null,
      approvedByUserId: null,
      approvedByUser: null,
      approvedAt: staticVersion.approval?.at ?? null,
      archivedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      content: staticVersion as unknown as Record<string, unknown>,
      validationErrors: validateModuleContent([staticVersion]),
    };
  }

  let createdByUser = null;
  let approvedByUser = null;
  const userIds = [row.createdByUserId, row.approvedByUserId].filter((id): id is string => Boolean(id));
  if (userIds.length > 0) {
    const userRows = await ctx.db
      .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email })
      .from(schema.user)
      .where(inArray(schema.user.id, userIds));
    for (const u of userRows) {
      if (u.id === row.createdByUserId) createdByUser = u;
      if (u.id === row.approvedByUserId) approvedByUser = u;
    }
  }

  const validationErrors = validateModuleContent([row.content]);

  return {
    id: row.id,
    moduleId: row.moduleId as ModuleId,
    version: row.version,
    status: row.status as AdminModuleVersionDetail["status"],
    title: row.title,
    deliverable: row.deliverable,
    objectives: row.objectives as string[],
    contentHash: row.contentHash,
    changeSummary: row.changeSummary,
    createdByUserId: row.createdByUserId,
    createdByUser,
    updatedByUserId: row.updatedByUserId,
    submittedByUserId: row.submittedByUserId,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    approvedByUserId: row.approvedByUserId,
    approvedByUser,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    content: row.content as Record<string, unknown>,
    validationErrors,
  };
}

export interface CreateDraftVersionInput {
  sourceVersion?: string;
  targetVersion: string;
  changeSummary?: string;
}

/** Creates a new draft version for a module. */
export async function createDraftVersion(
  ctx: Ctx,
  moduleId: string,
  input: CreateDraftVersionInput,
): Promise<AdminModuleVersionDetail> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "create course content drafts");
  if (!MODULE_IDS.includes(moduleId as ModuleId)) {
    throw new ServiceError("not_found", `Module ${moduleId} is not a valid TRADE module.`);
  }

  const targetVersion = input.targetVersion.trim();
  if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
    throw new ServiceError("invalid", "Target version must follow major.minor.patch format (e.g. 1.1.0).");
  }

  await seedModuleVersionsIfEmpty(ctx.db);

  const [existing] = await ctx.db
    .select({ id: schema.moduleContentVersion.id })
    .from(schema.moduleContentVersion)
    .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.version, targetVersion)))
    .limit(1);

  if (existing) {
    throw new ServiceError("conflict", `Version ${targetVersion} already exists for module ${moduleId}.`);
  }

  // Find source version
  let sourceContent: ModuleContent | undefined;
  if (input.sourceVersion) {
    const [sourceRow] = await ctx.db
      .select()
      .from(schema.moduleContentVersion)
      .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.version, input.sourceVersion)))
      .limit(1);
    sourceContent = (sourceRow?.content as unknown as ModuleContent) ?? findVersion(moduleId as ModuleId, "staff", input.sourceVersion);
  } else {
    // Default to latest approved version
    const [latestApprovedRow] = await ctx.db
      .select()
      .from(schema.moduleContentVersion)
      .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.status, "approved")))
      .orderBy(desc(schema.moduleContentVersion.createdAt))
      .limit(1);
    sourceContent = (latestApprovedRow?.content as unknown as ModuleContent) ?? findVersion(moduleId as ModuleId, "staff");
  }

  if (!sourceContent) {
    throw new ServiceError("not_found", "No source content found to initialize the new version.");
  }

  const draftContent: ModuleContent = {
    ...JSON.parse(JSON.stringify(sourceContent)),
    module: moduleId as ModuleId,
    version: targetVersion,
    status: "draft",
  };
  delete (draftContent as Record<string, unknown>).approval;

  const contentHash = computeContentHash(draftContent);

  const [newRow] = await ctx.db
    .insert(schema.moduleContentVersion)
    .values({
      moduleId: moduleId as ModuleId,
      version: targetVersion,
      status: "draft",
      title: draftContent.title,
      deliverable: draftContent.deliverable,
      objectives: draftContent.objectives,
      content: draftContent as unknown as Record<string, unknown>,
      contentHash,
      changeSummary: input.changeSummary ?? `Draft created from version ${sourceContent.version}`,
      createdByUserId: ctx.principal.userId,
      updatedByUserId: ctx.principal.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  if (!newRow) {
    throw new ServiceError("invalid", "Failed to create draft version.");
  }

  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.content.draft_created",
    organizationId: null,
    entityType: "trade_module_content",
    entityId: newRow.id,
    after: { moduleId, version: targetVersion, status: "draft" },
    reason: input.changeSummary ?? "Draft created",
  });

  return getAdminModuleVersion(ctx, moduleId, targetVersion);
}

export interface UpdateDraftVersionInput {
  title?: string;
  deliverable?: string;
  objectives?: string[];
  content?: Record<string, unknown>;
  changeSummary?: string;
  strictValidation?: boolean;
}

/** Updates a draft version. Modifications to approved or archived versions are rejected. */
export async function updateDraftVersion(
  ctx: Ctx,
  moduleId: string,
  version: string,
  input: UpdateDraftVersionInput,
): Promise<AdminModuleVersionDetail> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "edit course content drafts");
  await seedModuleVersionsIfEmpty(ctx.db);

  const [row] = await ctx.db
    .select()
    .from(schema.moduleContentVersion)
    .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.version, version)))
    .limit(1);

  if (!row) {
    throw new ServiceError("not_found", `Version ${version} of module ${moduleId} does not exist.`);
  }

  if (row.status === "approved" || row.status === "archived") {
    throw new ServiceError("conflict", `Version ${version} is ${row.status} and cannot be modified. Approved versions are immutable.`);
  }

  const currentContent = row.content as unknown as ModuleContent;
  const mergedContent: ModuleContent = input.content
    ? {
        ...(input.content as unknown as ModuleContent),
        module: moduleId as ModuleId,
        version,
        status: "draft",
      }
    : {
        ...currentContent,
        title: input.title ?? currentContent.title,
        deliverable: input.deliverable ?? currentContent.deliverable,
        objectives: input.objectives ?? currentContent.objectives,
        module: moduleId as ModuleId,
        version,
        status: "draft",
      };
  delete (mergedContent as Record<string, unknown>).approval;

  const validationErrors = validateModuleContent([mergedContent]);
  if (input.strictValidation && validationErrors.length > 0) {
    throw new ServiceError("invalid", `Validation failed:\n${validationErrors.join("\n")}`);
  }

  const contentHash = computeContentHash(mergedContent);

  await ctx.db
    .update(schema.moduleContentVersion)
    .set({
      title: mergedContent.title,
      deliverable: mergedContent.deliverable,
      objectives: mergedContent.objectives,
      content: mergedContent as unknown as Record<string, unknown>,
      contentHash,
      changeSummary: input.changeSummary ?? row.changeSummary,
      updatedByUserId: ctx.principal.userId,
      updatedAt: new Date(),
    })
    .where(eq(schema.moduleContentVersion.id, row.id));

  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.content.draft_updated",
    organizationId: null,
    entityType: "trade_module_content",
    entityId: row.id,
    before: { status: row.status, contentHash: row.contentHash },
    after: { status: row.status, contentHash },
    reason: input.changeSummary ?? "Draft updated",
  });

  return getAdminModuleVersion(ctx, moduleId, version);
}

/** Transitions a draft to 'in_review' status. */
export async function submitDraftForReview(
  ctx: Ctx,
  moduleId: string,
  version: string,
): Promise<AdminModuleVersionDetail> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "submit course content for review");
  await seedModuleVersionsIfEmpty(ctx.db);

  const [row] = await ctx.db
    .select()
    .from(schema.moduleContentVersion)
    .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.version, version)))
    .limit(1);

  if (!row) {
    throw new ServiceError("not_found", `Version ${version} of module ${moduleId} does not exist.`);
  }

  if (row.status !== "draft") {
    throw new ServiceError("invalid", `Only drafts can be submitted for review. Current status is '${row.status}'.`);
  }

  const validationErrors = validateModuleContent([row.content]);
  if (validationErrors.length > 0) {
    throw new ServiceError("invalid", `Cannot submit for review due to validation errors:\n${validationErrors.join("\n")}`);
  }

  await ctx.db
    .update(schema.moduleContentVersion)
    .set({
      status: "in_review",
      submittedByUserId: ctx.principal.userId,
      submittedAt: new Date(),
      updatedByUserId: ctx.principal.userId,
      updatedAt: new Date(),
    })
    .where(eq(schema.moduleContentVersion.id, row.id));

  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.content.review_submitted",
    organizationId: null,
    entityType: "trade_module_content",
    entityId: row.id,
    before: { status: "draft" },
    after: { status: "in_review", submittedByUserId: ctx.principal.userId },
    reason: "Submitted for review",
  });

  return getAdminModuleVersion(ctx, moduleId, version);
}

export interface ApproveVersionInput {
  notes?: string;
}

/**
 * Approves a module content version for production.
 * STRICT: Only Entrust administrators (Super Admin) may approve versions.
 * Once approved, the version becomes immutable.
 */
export async function approveModuleVersion(
  ctx: Ctx,
  moduleId: string,
  version: string,
  input?: ApproveVersionInput,
): Promise<AdminModuleVersionDetail> {
  requireStaff(ctx.principal, ["admin"], "approve course content versions");
  await seedModuleVersionsIfEmpty(ctx.db);

  const [row] = await ctx.db
    .select()
    .from(schema.moduleContentVersion)
    .where(and(eq(schema.moduleContentVersion.moduleId, moduleId as ModuleId), eq(schema.moduleContentVersion.version, version)))
    .limit(1);

  if (!row) {
    throw new ServiceError("not_found", `Version ${version} of module ${moduleId} does not exist.`);
  }

  if (row.status === "approved") {
    throw new ServiceError("conflict", `Version ${version} of module ${moduleId} is already approved.`);
  }

  const approvedContent: ModuleContent = {
    ...(row.content as unknown as ModuleContent),
    status: "approved",
    approval: {
      by: ctx.principal.userId,
      at: new Date().toISOString().slice(0, 10),
    },
  };

  const validationErrors = validateModuleContent([approvedContent]);
  if (validationErrors.length > 0) {
    throw new ServiceError("invalid", `Cannot approve module version with validation errors:\n${validationErrors.join("\n")}`);
  }

  const contentHash = computeContentHash(approvedContent);

  await ctx.db
    .update(schema.moduleContentVersion)
    .set({
      status: "approved",
      approvedByUserId: ctx.principal.userId,
      approvedAt: new Date(),
      content: approvedContent as unknown as Record<string, unknown>,
      contentHash,
      updatedByUserId: ctx.principal.userId,
      updatedAt: new Date(),
    })
    .where(eq(schema.moduleContentVersion.id, row.id));

  await recordTradeChange(ctx.db, ctx.principal.userId, {
    action: "trade.content.approved",
    organizationId: null,
    entityType: "trade_module_content",
    entityId: row.id,
    before: { status: row.status },
    after: { status: "approved", approvedByUserId: ctx.principal.userId, contentHash },
    reason: input?.notes ?? "Approved into production",
  });

  return getAdminModuleVersion(ctx, moduleId, version);
}

/** Sanitizes and returns the learner preview for any draft/review version. */
export async function getAdminModulePreview(
  ctx: Ctx,
  moduleId: string,
  version: string,
): Promise<LearnerModuleContent> {
  requireStaff(ctx.principal, ["admin", "facilitator"], "preview course content");
  const detail = await getAdminModuleVersion(ctx, moduleId, version);
  return toLearnerView(detail.content as unknown as ModuleContent);
}
