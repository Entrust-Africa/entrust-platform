import { eq, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import { checkFailureRules, reconcileFlags, type TriggeredFlag } from "@entrust/gate-engine";
import { STEPS } from "@entrust/rules";
import { recordChange } from "./audit";
import {
  deadlineInput,
  deadlines,
  evaluateWithoutFlags,
  loadEvents,
  loadOneCaseData,
  toCaseState,
  type CaseRow,
} from "./case-data";
import type { Executor } from "./db";

export interface FlagSync {
  raised: number;
  resolved: number;
}

/**
 * Brings a case's flags in line with the failure rules. A rule that fires with no active flag
 * raises one, together with the exception steps it lists; a flag whose rule has stopped firing
 * resolves. Run it in the transaction that changed the case, with the case locked. CLEAR does this
 * itself, so the audit rows have no user.
 *
 * The rules read the case as it would be without its flags. Otherwise a flag holding a step would
 * change the step's status, switch its own cause off, resolve, and raise again.
 */
export async function syncFlags(tx: Executor, row: CaseRow, now: Date): Promise<FlagSync> {
  const data = await loadOneCaseData(tx, row);
  const events = await loadEvents(tx, row.id);
  const input = deadlineInput(data, events);
  const triggered = checkFailureRules(
    STEPS,
    {
      state: toCaseState(data),
      evaluation: evaluateWithoutFlags(data, now),
      clocks: deadlines(data, events, now),
      events: input.events,
    },
    { now: now.toISOString() },
  );
  const changes = reconcileFlags(triggered, data.flags);

  for (const flag of changes.raise) await raise(tx, row, flag, now);

  for (const flag of changes.resolve) {
    await tx
      .update(schema.caseFlag)
      .set({ status: "resolved", resolvedAt: now })
      .where(eq(schema.caseFlag.id, flag.id));
    await recordChange(tx, null, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "flag.resolve",
      before: { flagId: flag.id, rule: flag.rule, status: flag.status },
      after: { flagId: flag.id, rule: flag.rule, status: "resolved" },
      event: { type: "flag_resolved", data: { rule: flag.rule, was: flag.status } },
    });
  }

  for (const { flag, message } of changes.refresh) {
    await tx.update(schema.caseFlag).set({ message }).where(eq(schema.caseFlag.id, flag.id));
    await recordChange(tx, null, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "flag.update",
      before: { flagId: flag.id, rule: flag.rule, message: flag.message },
      after: { flagId: flag.id, rule: flag.rule, message },
      event: { type: "flag_updated", data: { rule: flag.rule } },
    });
  }
  return { raised: changes.raise.length, resolved: changes.resolve.length };
}

async function raise(tx: Executor, row: CaseRow, flag: TriggeredFlag, now: Date): Promise<void> {
  const [created] = await tx
    .insert(schema.caseFlag)
    .values({
      caseId: row.id,
      rule: flag.rule,
      severity: flag.severity,
      message: flag.message,
      blocks: [...flag.blocks],
      // Not the transaction's start: flags are listed in the order they were raised.
      raisedAt: sql`clock_timestamp()`,
    })
    .returning({ id: schema.caseFlag.id });
  if (!created) throw new Error("The flag was not saved");

  // The exception steps the rule lists become part of the case. They stay raised after the flag
  // clears: resolving the exception is work for a person.
  for (const stepId of flag.raises) {
    await tx
      .insert(schema.caseStep)
      .values({ caseId: row.id, stepId, raisedAt: now })
      .onConflictDoUpdate({
        target: [schema.caseStep.caseId, schema.caseStep.stepId],
        set: { raisedAt: sql`coalesce(${schema.caseStep.raisedAt}, ${now.toISOString()}::timestamptz)` },
      });
  }

  await recordChange(tx, null, {
    caseId: row.id,
    organizationId: row.organizationId,
    action: "flag.raise",
    after: {
      flagId: created.id,
      rule: flag.rule,
      severity: flag.severity,
      message: flag.message,
      blocks: flag.blocks,
      raises: flag.raises,
    },
    event: { type: "flag_raised", data: { rule: flag.rule, severity: flag.severity, raises: flag.raises } },
  });
}
