import { schema } from "@entrust/db";
import {
  CLOCK_ANCHOR_STEPS,
  STEP_COMPLETED,
  parseEventTime,
  transitionStep,
  type RecordedStatus,
} from "@entrust/gate-engine";
import type { CaseDetailView } from "../schemas/clear";
import type { Ctx } from "./access";
import { recordChange } from "./audit";
import { evaluate, loadOneCaseData } from "./case-data";
import { mutateCase } from "./detail";
import { fromEngine, ServiceError } from "./errors";

export interface StepTransitionInput {
  to: RecordedStatus;
  reason?: string;
  /** When completing: the date the thing happened. */
  occurredAt?: string;
}

/**
 * Changes a step's status. The engine decides whether the caller's role may make the change and
 * whether the step is ready (prerequisites done, evidence approved and in date). Completing a step
 * writes a step_completed event, which the deadline clocks run from; the steps that start a clock
 * must say when the thing happened, because recording it late would start the clock late.
 */
export function transitionCaseStep(
  ctx: Ctx,
  caseId: string,
  stepId: string,
  input: StepTransitionInput,
): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    const evaluation = evaluate(await loadOneCaseData(tx, row), ctx.now);
    const step = evaluation.steps.find((s) => s.id === stepId);
    if (!step) throw new ServiceError("not_found", `There is no step ${stepId}.`);

    const transition = fromEngine(() => transitionStep(step, { to: input.to, actor, reason: input.reason }));
    const completing = transition.action === "complete" || transition.action === "sign_off";

    let occurredAt: Date | undefined;
    if (input.occurredAt !== undefined) {
      if (!completing) throw new ServiceError("invalid", "occurredAt is the date a step was completed.");
      occurredAt = fromEngine(() => parseEventTime(input.occurredAt as string));
      if (occurredAt > ctx.now) throw new ServiceError("invalid", "occurredAt can't be in the future.");
    } else if (completing && CLOCK_ANCHOR_STEPS.includes(step.id)) {
      throw new ServiceError(
        "precondition_failed",
        `Give the date this happened (occurredAt) to complete ${step.id}: it starts a deadline clock.`,
      );
    }

    const { status, reason } = transition.record;
    await tx
      .insert(schema.caseStep)
      .values({ caseId: row.id, stepId: step.id, status, notApplicableReason: reason ?? null })
      .onConflictDoUpdate({
        target: [schema.caseStep.caseId, schema.caseStep.stepId],
        set: { status, notApplicableReason: reason ?? null, updatedAt: ctx.now },
      });

    await recordChange(tx, ctx.principal.userId, {
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
        occurredAt,
      },
    });
  });
}
