import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { findVersion } from "@entrust/trade-content";
import { MODULE_IDS, type ModuleId } from "@entrust/trade-rules";
import type { Ctx } from "./access";
import { hasTradeAccess } from "./access";
import { ServiceError } from "./errors";
import { getStorageProvider } from "./storage";
import { notify, organizationMemberIds } from "./trade-notifications";
import { accessTo, recordTradeChange } from "./trade-shared";
import { findWorksheetDefinition } from "./trade-worksheet-definitions";

// What sits around a business's outputs (spec 7.5, 9.1, 9.2 and 11.3): documents attached to an output version, staff's review
// of a submitted version, evidence files on action items, and downloadable resources for modules. Every file is the business's own
// (or Entrust's, for a resource), and none is released to someone who couldn't see it already.

async function ownFile(ctx: Ctx, fileId: string, organizationId: string) {
  const [file] = await ctx.db.select().from(schema.file).where(eq(schema.file.id, fileId));
  // A file from another business looks like one that doesn't exist.
  if (!file || file.organizationId !== organizationId) throw new ServiceError("not_found", "File not found.");
  if (file.scanStatus === "infected") throw new ServiceError("invalid", "This file was flagged by a malware scan and can't be attached.");
  return file;
}

const fileView = (f: typeof schema.file.$inferSelect) => ({ id: f.id, name: f.originalName, contentType: f.contentType, sizeBytes: f.sizeBytes, scanStatus: f.scanStatus });

// ---- Output versions: attachments and review ----

async function versionFor(ctx: Ctx, versionId: string) {
  const [row] = await ctx.db
    .select({ version: schema.worksheetVersion, organizationId: schema.enrollment.organizationId })
    .from(schema.worksheetVersion)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.worksheetVersion.enrollmentId))
    .where(eq(schema.worksheetVersion.id, versionId));
  const access = row ? await accessTo(ctx.db, ctx.principal, row.organizationId) : null;
  if (!row || !access) throw new ServiceError("not_found", "Output not found.");
  return { version: row.version, organizationId: row.organizationId, access };
}

export async function outputVersionDetails(ctx: Ctx, versionId: string) {
  const { version } = await versionFor(ctx, versionId);
  const [attachments, [review]] = await Promise.all([
    ctx.db
      .select({ attachment: schema.worksheetAttachment, file: schema.file })
      .from(schema.worksheetAttachment)
      .innerJoin(schema.file, eq(schema.file.id, schema.worksheetAttachment.fileId))
      .where(eq(schema.worksheetAttachment.worksheetVersionId, versionId))
      .orderBy(asc(schema.worksheetAttachment.createdAt)),
    ctx.db.select().from(schema.worksheetVersionReview).where(eq(schema.worksheetVersionReview.worksheetVersionId, versionId)),
  ]);
  return {
    versionId,
    status: version.status,
    attachments: attachments.map(({ attachment, file }) => ({ id: attachment.id, description: attachment.description, file: fileView(file), createdAt: attachment.createdAt.toISOString() })),
    review: { status: review?.status ?? "pending", comments: review?.comments ?? null, reviewedAt: review?.reviewedAt?.toISOString() ?? null },
  };
}

export async function attachToOutput(ctx: Ctx, versionId: string, input: { fileId: string; description?: string | null | undefined }) {
  const { version, organizationId, access } = await versionFor(ctx, versionId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  if (version.status !== "draft") throw new ServiceError("invalid_transition", "Only a draft can take attachments. Start a new version to add one.");
  await ownFile(ctx, input.fileId, organizationId);
  const [row] = await ctx.db.insert(schema.worksheetAttachment).values({ worksheetVersionId: versionId, fileId: input.fileId, description: input.description ?? null, attachedByUserId: ctx.principal.userId }).onConflictDoNothing().returning();
  if (!row) throw new ServiceError("conflict", "This file is already attached.");
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.output.attachment_added", organizationId, entityType: "worksheet_version", entityId: versionId, after: { fileId: input.fileId } });
  return outputVersionDetails(ctx, versionId);
}

export async function removeOutputAttachment(ctx: Ctx, versionId: string, attachmentId: string) {
  const { version, organizationId, access } = await versionFor(ctx, versionId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  if (version.status !== "draft") throw new ServiceError("invalid_transition", "A submitted version keeps the documents it was reviewed with.");
  const deleted = await ctx.db.delete(schema.worksheetAttachment).where(and(eq(schema.worksheetAttachment.id, attachmentId), eq(schema.worksheetAttachment.worksheetVersionId, versionId))).returning();
  if (deleted.length === 0) throw new ServiceError("not_found", "Attachment not found.");
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.output.attachment_removed", organizationId, entityType: "worksheet_version", entityId: versionId });
  return outputVersionDetails(ctx, versionId);
}

/** Staff review a submitted version: they start looking, accept it, or send it back with comments. */
export async function reviewOutput(ctx: Ctx, versionId: string, input: { status: "under_review" | "reviewed" | "changes_requested"; comments?: string | null | undefined }) {
  const { version, organizationId, access } = await versionFor(ctx, versionId);
  if (!access.staff) throw new ServiceError("forbidden", "Only Entrust staff can review an output.");
  if (version.status !== "submitted") throw new ServiceError("invalid_transition", "Only a submitted version can be reviewed.");
  if (input.status === "changes_requested" && !input.comments?.trim()) throw new ServiceError("invalid", "Say what needs to change.");
  await ctx.db
    .insert(schema.worksheetVersionReview)
    .values({ worksheetVersionId: versionId, status: input.status, reviewerUserId: ctx.principal.userId, comments: input.comments?.trim() || null, reviewedAt: input.status === "under_review" ? null : ctx.now })
    .onConflictDoUpdate({ target: schema.worksheetVersionReview.worksheetVersionId, set: { status: input.status, reviewerUserId: ctx.principal.userId, comments: input.comments?.trim() || null, reviewedAt: input.status === "under_review" ? null : ctx.now } });
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.output.reviewed", organizationId, entityType: "worksheet_version", entityId: versionId, after: { status: input.status }, ...(input.comments ? { reason: input.comments } : {}) });
  if (input.status !== "under_review") {
    const title = findWorksheetDefinition(version.worksheetId)?.title ?? "output";
    await notify(ctx.db, {
      userIds: await organizationMemberIds(ctx.db, organizationId),
      kind: "assessment_result",
      title: input.status === "reviewed" ? `Your ${title} was reviewed` : `Your ${title} needs changes`,
      body: input.comments?.trim() || (input.status === "reviewed" ? "Entrust reviewed it and has no changes to ask for." : "Open it to see what to change."),
      path: `/worksheets/${version.worksheetId}`,
      organizationId,
    });
  }
  return outputVersionDetails(ctx, versionId);
}

// ---- Evidence on action items ----

async function itemFor(ctx: Ctx, itemId: string) {
  const [item] = await ctx.db.select().from(schema.actionItem).where(eq(schema.actionItem.id, itemId));
  const access = item ? await accessTo(ctx.db, ctx.principal, item.organizationId) : null;
  if (!item || !access) throw new ServiceError("not_found", "Action item not found.");
  return { item, access };
}

export async function listActionEvidence(ctx: Ctx, itemId: string) {
  await itemFor(ctx, itemId);
  const rows = await ctx.db
    .select({ evidence: schema.actionEvidence, file: schema.file })
    .from(schema.actionEvidence)
    .innerJoin(schema.file, eq(schema.file.id, schema.actionEvidence.fileId))
    .where(eq(schema.actionEvidence.actionItemId, itemId))
    .orderBy(desc(schema.actionEvidence.submittedAt));
  return { items: rows.map(({ evidence, file }) => ({ id: evidence.id, description: evidence.description, file: fileView(file), submittedAt: evidence.submittedAt.toISOString() })) };
}

export async function addActionEvidence(ctx: Ctx, itemId: string, input: { fileId: string; description?: string | null | undefined }) {
  const { item, access } = await itemFor(ctx, itemId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  await ownFile(ctx, input.fileId, item.organizationId);
  const [row] = await ctx.db.insert(schema.actionEvidence).values({ actionItemId: itemId, fileId: input.fileId, description: input.description ?? null, submittedByUserId: ctx.principal.userId }).onConflictDoNothing().returning();
  if (!row) throw new ServiceError("conflict", "This file is already attached as evidence.");
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.action_item.evidence_added", organizationId: item.organizationId, entityType: "action_item", entityId: itemId, after: { fileId: input.fileId } });
  return listActionEvidence(ctx, itemId);
}

export async function removeActionEvidence(ctx: Ctx, itemId: string, evidenceId: string) {
  const { item, access } = await itemFor(ctx, itemId);
  if (!access.write) throw new ServiceError("forbidden", "Write access required.");
  const deleted = await ctx.db.delete(schema.actionEvidence).where(and(eq(schema.actionEvidence.id, evidenceId), eq(schema.actionEvidence.actionItemId, itemId))).returning();
  if (deleted.length === 0) throw new ServiceError("not_found", "Evidence not found.");
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.action_item.evidence_removed", organizationId: item.organizationId, entityType: "action_item", entityId: itemId });
  return listActionEvidence(ctx, itemId);
}

// ---- Learning resources ----

type Resource = typeof schema.learningResource.$inferSelect;
const resourceView = (r: Resource, file: typeof schema.file.$inferSelect) => ({
  id: r.id,
  moduleId: r.moduleId,
  lessonId: r.lessonId,
  name: r.name,
  resourceType: r.resourceType,
  version: r.version,
  accessLevel: r.accessLevel,
  archived: r.archivedAt !== null,
  file: { name: file.originalName, contentType: file.contentType, sizeBytes: file.sizeBytes },
});

function requireResourceWriter(ctx: Ctx): void {
  if (ctx.principal.staffRole !== "admin" && ctx.principal.staffRole !== "facilitator") throw new ServiceError("forbidden", "Only a Super Admin or Cohort Manager can manage learning resources.");
}

const isModule = (id: string): id is ModuleId => (MODULE_IDS as readonly string[]).includes(id);

/** A learner can use a module's resources once they can see the module itself, and has TRADE access. */
async function requireLearnerAccess(ctx: Ctx, moduleId: ModuleId): Promise<void> {
  if (!findVersion(moduleId, "learner")) throw new ServiceError("not_found", "Module not found.");
  for (const organizationId of ctx.principal.smeRoles.keys()) if (await hasTradeAccess(ctx.db, organizationId)) return;
  throw new ServiceError("not_found", "Module not found.");
}

export async function createResource(ctx: Ctx, input: { moduleId: string; lessonId?: string | null | undefined; name: string; fileId: string; resourceType: Resource["resourceType"]; version?: string | undefined; accessLevel: Resource["accessLevel"] }) {
  requireResourceWriter(ctx);
  if (!isModule(input.moduleId)) throw new ServiceError("not_found", "Module not found.");
  const entrust = process.env.ENTRUST_ORG_ID;
  if (!entrust) throw new ServiceError("invalid", "Entrust's organisation isn't configured.");
  const file = await ownFile(ctx, input.fileId, entrust);
  const [row] = await ctx.db
    .insert(schema.learningResource)
    .values({ moduleId: input.moduleId, lessonId: input.lessonId ?? null, name: input.name, fileId: input.fileId, resourceType: input.resourceType, version: input.version ?? "1.0.0", accessLevel: input.accessLevel, createdByUserId: ctx.principal.userId })
    .returning();
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.resource.added", organizationId: null, entityType: "learning_resource", entityId: row!.id, after: { moduleId: input.moduleId, name: input.name, accessLevel: input.accessLevel } });
  return resourceView(row!, file);
}

export async function listResources(ctx: Ctx, moduleId: string, input: { includeArchived?: boolean | undefined }) {
  if (!isModule(moduleId)) throw new ServiceError("not_found", "Module not found.");
  const staff = Boolean(ctx.principal.staffRole);
  if (!staff) await requireLearnerAccess(ctx, moduleId);
  const rows = await ctx.db
    .select({ resource: schema.learningResource, file: schema.file })
    .from(schema.learningResource)
    .innerJoin(schema.file, eq(schema.file.id, schema.learningResource.fileId))
    .where(and(eq(schema.learningResource.moduleId, moduleId), staff && input.includeArchived ? undefined : isNull(schema.learningResource.archivedAt), staff ? undefined : eq(schema.learningResource.accessLevel, "learner")))
    .orderBy(asc(schema.learningResource.name));
  return { items: rows.map(({ resource, file }) => resourceView(resource, file)) };
}

export async function resourceDownload(ctx: Ctx, id: string) {
  const [row] = await ctx.db.select({ resource: schema.learningResource, file: schema.file }).from(schema.learningResource).innerJoin(schema.file, eq(schema.file.id, schema.learningResource.fileId)).where(eq(schema.learningResource.id, id));
  if (!row || row.resource.archivedAt) throw new ServiceError("not_found", "Resource not found.");
  if (!ctx.principal.staffRole) {
    if (row.resource.accessLevel !== "learner") throw new ServiceError("not_found", "Resource not found.");
    await requireLearnerAccess(ctx, row.resource.moduleId);
  }
  if (row.file.scanStatus === "infected") throw new ServiceError("forbidden", "This file was flagged by a malware scan and can't be downloaded.");
  const expiresInSeconds = 900;
  const downloadUrl = await getStorageProvider().createPresignedDownloadUrl(row.file.storageKey, row.file.originalName, expiresInSeconds, row.file.contentType);
  return { downloadUrl, expiresInSeconds, fileName: row.file.originalName };
}

export async function archiveResource(ctx: Ctx, id: string) {
  requireResourceWriter(ctx);
  const [row] = await ctx.db.update(schema.learningResource).set({ archivedAt: ctx.now }).where(and(eq(schema.learningResource.id, id), isNull(schema.learningResource.archivedAt))).returning();
  if (!row) throw new ServiceError("not_found", "Resource not found.");
  await recordTradeChange(ctx.db, ctx.principal.userId, { action: "trade.resource.archived", organizationId: null, entityType: "learning_resource", entityId: id });
  return { ok: true as const };
}
