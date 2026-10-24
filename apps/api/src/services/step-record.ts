import { schema } from "@entrust/db";
import { STEP_COMPLETED, type EvaluatedStep, type StepTransition } from "@entrust/gate-engine";
import { recordChange } from "./audit";
import type { CaseRow } from "./case-data";
import type { Executor } from "./db";

/**
 * Stores the outcome of a step transition the engine has allowed, with its audit row and case
 * event. A null user is CLEAR itself, for the checks that complete a step on their own.
 */
export async function writeStepTransition(
  tx: Executor,
  row: CaseRow,
  step: EvaluatedStep,
  transition: StepTransition,
  by: { userId: string | null; now: Date; occurredAt?: Date },
): Promise<void> {
  const completing = transition.action === "complete" || transition.action === "sign_off";
  const { status, reason } = transition.record;
  await tx
    .insert(schema.caseStep)
    .values({ caseId: row.id, stepId: step.id, status, notApplicableReason: reason ?? null })
    .onConflictDoUpdate({
      target: [schema.caseStep.caseId, schema.caseStep.stepId],
      set: { status, notApplicableReason: reason ?? null, updatedAt: by.now },
    });

  await recordChange(tx, by.userId, {
    caseId: row.id,
    organizationId: row.organizationId,
    action: `step.${transition.action}`,
    before: { stepId: step.id, status: transition.from },
    after: { stepId: step.id, status, reason: reason ?? null },
    reason,
    event: {
      type: completing ? STEP_COMPLETED : "step_status_changed",
      stepId: step.id,
      data: { action: transition.action, from: transition.from, to: status },
      occurredAt: by.occurredAt,
    },
  });
}
