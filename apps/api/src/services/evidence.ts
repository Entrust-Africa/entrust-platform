import { eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { transitionEvidence, type EvidenceStatus } from "@entrust/gate-engine";
import { EVIDENCE_TYPES } from "@entrust/rules";
import type { CaseDetailView } from "../schemas/clear";
import type { Ctx } from "./access";
import { recordChange } from "./audit";
import { evidenceRecord, latestEvidence, loadOneCaseData } from "./case-data";
import { mutateCase } from "./detail";
import { fromEngine, ServiceError } from "./errors";

function evidenceType(id: string) {
  const type = EVIDENCE_TYPES.find((t) => t.id === id);
  if (!type) throw new ServiceError("invalid", `"${id}" is not an evidence type.`);
  return type;
}

/**
 * Adds a submission of a document or record. Each submission is a new record, and the latest one
 * decides its type's status. Submitting only ever gives "submitted": the requirement is met when a
 * reviewer approves it. (The uploaded file comes with file uploads, #15.)
 */
export function submitEvidence(
  ctx: Ctx,
  caseId: string,
  input: { type: string; issuedOn?: string },
): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    const type = evidenceType(input.type);
    const { evidence } = await loadOneCaseData(tx, row);
    const current = latestEvidence(evidence, type.id);

    const transition = fromEngine(() =>
      transitionEvidence({
        type,
        current: current && evidenceRecord(current),
        to: "submitted",
        actor,
        asOf: ctx.now.toISOString(),
        issuedOn: input.issuedOn,
      }),
    );
    const [inserted] = await tx
      .insert(schema.evidence)
      .values({
        caseId: row.id,
        type: type.id,
        status: "submitted",
        issuedOn: transition.record.issuedOn ?? null,
        submittedByUserId: ctx.principal.userId,
        // Not the transaction's start: the latest submission of a type decides its status.
        submittedAt: sql`clock_timestamp()`,
      })
      .returning({ id: schema.evidence.id });
    if (!inserted) throw new Error("The evidence was not saved");

    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "evidence.submit",
      before: { type: type.id, status: transition.from },
      after: { evidenceId: inserted.id, type: type.id, status: "submitted", issuedOn: transition.record.issuedOn ?? null },
      event: { type: "evidence_submitted", evidenceId: inserted.id, data: { type: type.id } },
    });
  });
}

/**
 * Moves the latest submission of a type through review: start review, approve, request changes or
 * reject. The engine checks the reviewer's role, that a note says what is wrong, and that types
 * needing a human reviewer are not decided by CLEAR. Approval sets the expiry from the type's
 * validity period and the issue date.
 */
export function reviewEvidence(
  ctx: Ctx,
  caseId: string,
  evidenceId: string,
  input: { to: EvidenceStatus; note?: string; issuedOn?: string },
): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    const { evidence } = await loadOneCaseData(tx, row);
    const target = evidence.find((e) => e.id === evidenceId);
    if (!target) throw new ServiceError("not_found", "Evidence not found.");
    if (latestEvidence(evidence, target.type)?.id !== target.id) {
      throw new ServiceError("invalid_transition", "A newer submission of this evidence exists. Review that one.");
    }

    const type = evidenceType(target.type);
    const transition = fromEngine(() =>
      transitionEvidence({
        type,
        current: evidenceRecord(target),
        to: input.to,
        actor,
        asOf: ctx.now.toISOString(),
        issuedOn: input.issuedOn,
        note: input.note,
      }),
    );
    if (transition.action === "submit") {
      throw new ServiceError("invalid_transition", "A new document is submitted with a new submission, not a review.");
    }

    const { status, issuedOn, validUntil } = transition.record;
    await tx
      .update(schema.evidence)
      .set({
        status,
        issuedOn: issuedOn ?? null,
        validUntil: validUntil ?? null,
        reviewerUserId: ctx.principal.userId,
        reviewedAt: ctx.now,
        reviewNote: transition.note ?? target.reviewNote,
      })
      .where(eq(schema.evidence.id, target.id));

    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: `evidence.${transition.action}`,
      before: { evidenceId: target.id, type: type.id, status: transition.from, issuedOn: target.issuedOn, validUntil: target.validUntil },
      after: { evidenceId: target.id, type: type.id, status, issuedOn: issuedOn ?? null, validUntil: validUntil ?? null },
      reason: transition.note,
      event: {
        type: "evidence_reviewed",
        evidenceId: target.id,
        data: { type: type.id, action: transition.action, from: transition.from, to: status },
      },
    });
  });
}
