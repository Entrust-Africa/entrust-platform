import { and, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { schema } from "@entrust/db";
import type {
  EvidenceConfidence,
  EvidenceReviewStatus,
  EvidenceTargetType,
} from "@entrust/trade-engine";
import type { Ctx } from "./access";
import { ServiceError } from "./errors";
import type {
  CreateEvidenceInput,
  EvidenceListQueryInput,
  EvidenceRecordView,
  RequestEvidenceInput,
  ReviewEvidenceInput,
} from "../schemas/trade";

const reviewerUser = alias(schema.user, "reviewer_user");
const requesterUser = alias(schema.user, "requester_user");

export async function listEvidence(
  ctx: Ctx,
  query: EvidenceListQueryInput
): Promise<EvidenceRecordView[]> {
  const { principal, db } = ctx;

  let orgFilter: string[] | null = null;
  if (principal.staffRole) {
    if (query.organizationId) {
      orgFilter = [query.organizationId];
    }
  } else {
    const userOrgIds = Array.from(principal.smeRoles.keys());
    if (userOrgIds.length === 0) {
      throw new ServiceError("forbidden", "Access denied.");
    }
    if (query.organizationId) {
      if (!principal.smeRoles.has(query.organizationId)) {
        throw new ServiceError("forbidden", "You cannot access evidence for this organization.");
      }
      orgFilter = [query.organizationId];
    } else {
      orgFilter = userOrgIds;
    }
  }

  const conditions = [];
  if (orgFilter) {
    conditions.push(inArray(schema.evidenceRecord.organizationId, orgFilter));
  }
  if (query.enrollmentId) {
    conditions.push(eq(schema.evidenceRecord.enrollmentId, query.enrollmentId));
  }
  if (query.targetType) {
    conditions.push(eq(schema.evidenceRecord.targetType, query.targetType));
  }
  if (query.targetId) {
    conditions.push(eq(schema.evidenceRecord.targetId, query.targetId));
  }
  if (query.status) {
    conditions.push(eq(schema.evidenceRecord.status, query.status));
  }

  const rows = await db
    .select({
      id: schema.evidenceRecord.id,
      organizationId: schema.evidenceRecord.organizationId,
      organizationName: schema.organization.name,
      enrollmentId: schema.evidenceRecord.enrollmentId,
      fileId: schema.evidenceRecord.fileId,
      fileName: schema.file.originalName,
      fileContentType: schema.file.contentType,
      fileSizeBytes: schema.file.sizeBytes,
      title: schema.evidenceRecord.title,
      targetType: schema.evidenceRecord.targetType,
      targetId: schema.evidenceRecord.targetId,
      confidence: schema.evidenceRecord.confidence,
      status: schema.evidenceRecord.status,
      reviewedByUserId: schema.evidenceRecord.reviewedByUserId,
      reviewedByUserName: reviewerUser.name,
      reviewedAt: schema.evidenceRecord.reviewedAt,
      reviewComment: schema.evidenceRecord.reviewComment,
      requestedByUserId: schema.evidenceRecord.requestedByUserId,
      requestedByUserName: requesterUser.name,
      requestedAt: schema.evidenceRecord.requestedAt,
      requestPrompt: schema.evidenceRecord.requestPrompt,
      createdAt: schema.evidenceRecord.createdAt,
      updatedAt: schema.evidenceRecord.updatedAt,
    })
    .from(schema.evidenceRecord)
    .innerJoin(
      schema.organization,
      eq(schema.organization.id, schema.evidenceRecord.organizationId)
    )
    .leftJoin(schema.file, eq(schema.file.id, schema.evidenceRecord.fileId))
    .leftJoin(
      reviewerUser,
      eq(reviewerUser.id, schema.evidenceRecord.reviewedByUserId)
    )
    .leftJoin(
      requesterUser,
      eq(requesterUser.id, schema.evidenceRecord.requestedByUserId)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.evidenceRecord.createdAt));

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    organizationName: r.organizationName,
    enrollmentId: r.enrollmentId,
    fileId: r.fileId,
    file:
      r.fileId && r.fileName
        ? {
            id: r.fileId,
            filename: r.fileName,
            contentType: r.fileContentType ?? "application/octet-stream",
            size: r.fileSizeBytes ?? 0,
          }
        : null,
    title: r.title,
    targetType: r.targetType as EvidenceTargetType,
    targetId: r.targetId,
    confidence: r.confidence as EvidenceConfidence,
    status: r.status as EvidenceReviewStatus,
    reviewedByUserId: r.reviewedByUserId,
    reviewedByUserName: r.reviewedByUserName ?? undefined,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    reviewComment: r.reviewComment,
    requestedByUserId: r.requestedByUserId,
    requestedByUserName: r.requestedByUserName ?? undefined,
    requestedAt: r.requestedAt ? r.requestedAt.toISOString() : null,
    requestPrompt: r.requestPrompt,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function createEvidence(
  ctx: Ctx,
  input: CreateEvidenceInput
): Promise<EvidenceRecordView> {
  const { principal, db, now } = ctx;

  let targetOrgId = input.organizationId;
  if (!targetOrgId) {
    if (input.enrollmentId) {
      const [enr] = await db
        .select({ organizationId: schema.enrollment.organizationId })
        .from(schema.enrollment)
        .where(eq(schema.enrollment.id, input.enrollmentId));
      if (enr) {
        targetOrgId = enr.organizationId;
      }
    }
    if (!targetOrgId) {
      const smeOrgIds = Array.from(principal.smeRoles.keys());
      if (smeOrgIds.length === 1) {
        targetOrgId = smeOrgIds[0];
      }
    }
  }

  if (!targetOrgId) {
    throw new ServiceError("invalid", "Organization ID is required.");
  }

  if (!principal.staffRole && !principal.smeRoles.has(targetOrgId)) {
    throw new ServiceError(
      "forbidden",
      "You cannot create evidence for this organization."
    );
  }

  if (input.fileId) {
    const [f] = await db
      .select({ id: schema.file.id })
      .from(schema.file)
      .where(eq(schema.file.id, input.fileId));
    if (!f) {
      throw new ServiceError("not_found", "Attached file not found.");
    }
  }

  const confidence: EvidenceConfidence =
    input.confidence ?? (input.fileId ? "documented" : "self_reported");

  const [inserted] = await db
    .insert(schema.evidenceRecord)
    .values({
      organizationId: targetOrgId,
      enrollmentId: input.enrollmentId || null,
      fileId: input.fileId || null,
      title: input.title.trim(),
      targetType: input.targetType,
      targetId: input.targetId?.trim() || null,
      confidence,
      status: "submitted",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create evidence record.");
  }

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: targetOrgId,
    platform: "trade",
    action: "trade.evidence.submitted",
    entityType: "evidence_record",
    entityId: inserted.id,
    after: {
      id: inserted.id,
      title: inserted.title,
      targetType: inserted.targetType,
      targetId: inserted.targetId,
      status: inserted.status,
      confidence: inserted.confidence,
    },
  });

  const list = await listEvidence(ctx, {
    organizationId: targetOrgId,
  });
  const found = list.find((item) => item.id === inserted.id);
  if (!found) {
    throw new ServiceError("not_found", "Failed to retrieve created evidence record.");
  }
  return found;
}

export async function reviewEvidence(
  ctx: Ctx,
  evidenceId: string,
  input: ReviewEvidenceInput
): Promise<EvidenceRecordView> {
  const { principal, db, now } = ctx;

  if (!principal.staffRole) {
    throw new ServiceError("forbidden", "Only Entrust staff can review evidence.");
  }

  const [existing] = await db
    .select()
    .from(schema.evidenceRecord)
    .where(eq(schema.evidenceRecord.id, evidenceId));

  if (!existing) {
    throw new ServiceError("not_found", "Evidence record not found.");
  }

  const isReject =
    input.status === "rejected" || input.status === "resubmission_required";
  if (isReject && !input.comment?.trim()) {
    throw new ServiceError(
      "invalid",
      "A comment is required when rejecting evidence or requesting resubmission."
    );
  }

  const confidence: EvidenceConfidence =
    input.confidence ??
    (input.status === "accepted" ? "reviewed" : (existing.confidence as EvidenceConfidence));

  await db
    .update(schema.evidenceRecord)
    .set({
      status: input.status,
      confidence,
      reviewedByUserId: principal.userId,
      reviewedAt: now,
      reviewComment: input.comment?.trim() || null,
      updatedAt: now,
    })
    .where(eq(schema.evidenceRecord.id, evidenceId));

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: existing.organizationId,
    platform: "trade",
    action: "trade.evidence.reviewed",
    entityType: "evidence_record",
    entityId: evidenceId,
    before: {
      status: existing.status,
      confidence: existing.confidence,
    },
    after: {
      status: input.status,
      confidence,
      comment: input.comment?.trim() || null,
    },
    reason: input.comment?.trim() || null,
  });

  const list = await listEvidence(ctx, {
    organizationId: existing.organizationId,
  });
  const found = list.find((item) => item.id === evidenceId);
  if (!found) {
    throw new ServiceError("not_found", "Evidence record not found.");
  }
  return found;
}

export async function requestEvidence(
  ctx: Ctx,
  input: RequestEvidenceInput
): Promise<EvidenceRecordView> {
  const { principal, db, now } = ctx;

  if (!principal.staffRole) {
    throw new ServiceError("forbidden", "Only Entrust staff can request evidence.");
  }

  const [org] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.id, input.organizationId));

  if (!org) {
    throw new ServiceError("not_found", "Organization not found.");
  }

  const [inserted] = await db
    .insert(schema.evidenceRecord)
    .values({
      organizationId: input.organizationId,
      enrollmentId: input.enrollmentId || null,
      title: input.title.trim(),
      targetType: input.targetType,
      targetId: input.targetId?.trim() || null,
      status: "not_submitted",
      confidence: "self_reported",
      requestedByUserId: principal.userId,
      requestedAt: now,
      requestPrompt: input.prompt.trim(),
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to create evidence request.");
  }

  await db.insert(schema.auditLog).values({
    actorUserId: principal.userId,
    organizationId: input.organizationId,
    platform: "trade",
    action: "trade.evidence.requested",
    entityType: "evidence_record",
    entityId: inserted.id,
    after: {
      id: inserted.id,
      title: inserted.title,
      targetType: inserted.targetType,
      targetId: inserted.targetId,
      prompt: inserted.requestPrompt,
    },
  });

  const list = await listEvidence(ctx, {
    organizationId: input.organizationId,
  });
  const found = list.find((item) => item.id === inserted.id);
  if (!found) {
    throw new ServiceError("not_found", "Failed to retrieve requested evidence record.");
  }
  return found;
}
