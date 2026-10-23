import { CLOCK_INPUT_SET, STEP_WORKERS, checkClockInput, type ClockInputKey } from "@entrust/gate-engine";
import type { CaseDetailView } from "../schemas/clear";
import type { Ctx } from "./access";
import { requireRole } from "./access";
import { recordChange } from "./audit";
import { loadEvents } from "./case-data";
import { mutateCase } from "./detail";
import { fromEngine } from "./errors";

/**
 * Records a date or setting the deadline clocks need and the case's steps don't capture: the
 * planned loading time (ISF), the estimated arrival and filing system (Prior Notice) and the LC
 * expiry. The latest value for a key wins, and the clocks move with it.
 */
export function recordClockInput(
  ctx: Ctx,
  caseId: string,
  input: { key: ClockInputKey; value: string },
): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    requireRole(actor, STEP_WORKERS.sme, "record dates for a case's deadlines");
    const value = fromEngine(() => checkClockInput(input.key, input.value));

    const previous = (await loadEvents(tx, row.id))
      .findLast((e) => e.type === CLOCK_INPUT_SET && isInput(e.data, input.key))
      ?.data as { value: string } | undefined;

    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "case.clock_input_set",
      before: previous ? { key: input.key, value: previous.value } : null,
      after: { key: input.key, value },
      event: { type: CLOCK_INPUT_SET, data: { key: input.key, value } },
    });
  });
}

const isInput = (data: unknown, key: string): data is { key: string; value: string } =>
  typeof data === "object" && data !== null && "key" in data && data.key === key && "value" in data;
