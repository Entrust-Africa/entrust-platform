import { eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  evidenceStatusOn,
  transitionEvidence,
  transitionStep,
  type CaseEvaluation,
  type EvidenceStatus,
} from "@entrust/gate-engine";
import { EVIDENCE_TYPES, type StepId } from "@entrust/rules";
import { recordChange } from "./audit";
import { evaluate, evidenceRecord, latestEvidence, loadOneCaseData, type CaseRow, type EvidenceRow } from "./case-data";
import type { Executor } from "./db";
import { fromEngine } from "./errors";
import { writeStepTransition } from "./step-record";

// Checks CLEAR runs on its own, whose steps it can complete when they pass: the minimum export
// price check (STEP-024) and the shipping document comparison (STEP-099). Both are system steps
// with evidence that needs no human reviewer, which is why CLEAR may approve it.

export interface PassedCheck {
  stepId: StepId;
  /** The evidence type the step asks for, such as minimum_price_check. */
  evidenceType: string;
  /** What the check found, kept with the evidence as its review note. */
  note: string;
}

/**
 * A check has passed: approve its evidence and complete its step, as CLEAR, with the audit rows
 * that come with each. It waits until the step's prerequisites are done and nothing holds it,
 * because evidence approved early would stand if the facts changed before the step could be
 * completed. It does nothing for a step that is already completed or doesn't apply. Run it in the
 * transaction that changed the case, with the case locked. `current` is the case as evaluated.
 */
export async function passCheck(
  tx: Executor,
  row: CaseRow,
  now: Date,
  current: CaseEvaluation,
  check: PassedCheck,
): Promise<void> {
  const step = current.steps.find((s) => s.id === check.stepId);
  if (!step || step.applicability !== "applicable" || step.status === "completed" || step.status === "not_applicable") return;
  if (step.blockedBy.length || step.heldBy.length) return;

  const data = await loadOneCaseData(tx, row);
  await approveEvidence(tx, row, latestEvidence(data.evidence, check.evidenceType), check, now);

  const ready = evaluate(await loadOneCaseData(tx, row), now).steps.find((s) => s.id === check.stepId);
  if (ready?.canComplete) {
    const transition = fromEngine(() => transitionStep(ready, { to: "completed", actor: "system" }));
    await writeStepTransition(tx, row, ready, transition, { userId: null, now });
  }
}

/**
 * Records the check's evidence as approved. It goes through the same transitions a person's would
 * (submit, review, approve), so the engine decides what CLEAR may do. A submission still waiting
 * for review is approved in place; otherwise this is a new submission.
 */
async function approveEvidence(
  tx: Executor,
  row: CaseRow,
  current: EvidenceRow | undefined,
  check: PassedCheck,
  now: Date,
): Promise<void> {
  const type = EVIDENCE_TYPES.find((t) => t.id === check.evidenceType);
  if (!type) throw new Error(`${check.evidenceType} is not an evidence type`);

  const asOf = now.toISOString();
  const from: EvidenceStatus = evidenceStatusOn(current && evidenceRecord(current), asOf);
  if (from === "approved") return;
  const hops =
    from === "submitted"
      ? (["under_review", "approved"] as const)
      : from === "under_review"
        ? (["approved"] as const)
        : (["submitted", "under_review", "approved"] as const);

  let record = current && evidenceRecord(current);
  for (const to of hops) {
    record = fromEngine(() => transitionEvidence({ type, current: record, to, actor: "system", asOf })).record;
  }
  const reviewed = { status: "approved" as const, reviewerUserId: null, reviewedAt: now, reviewNote: check.note };

  let evidenceId: string;
  if (hops[0] === "submitted" || !current) {
    const [inserted] = await tx
      .insert(schema.evidence)
      .values({
        caseId: row.id,
        type: type.id,
        ...reviewed,
        issuedOn: record?.issuedOn ?? null,
        validUntil: record?.validUntil ?? null,
        // Not the transaction's start: the latest submission of a type decides its status.
        submittedAt: sql`clock_timestamp()`,
      })
      .returning({ id: schema.evidence.id });
    if (!inserted) throw new Error("The evidence was not saved");
    evidenceId = inserted.id;
  } else {
    await tx.update(schema.evidence).set(reviewed).where(eq(schema.evidence.id, current.id));
    evidenceId = current.id;
  }

  await recordChange(tx, null, {
    caseId: row.id,
    organizationId: row.organizationId,
    action: "evidence.auto_approve",
    before: { type: type.id, status: from },
    after: { evidenceId, type: type.id, status: "approved" },
    reason: check.note,
    event: {
      type: "evidence_reviewed",
      evidenceId,
      data: { type: type.id, action: "approve", from, to: "approved", automatic: true },
    },
  });
}
