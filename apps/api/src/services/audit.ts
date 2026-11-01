import { sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { StepId } from "@entrust/rules";
import type { Executor } from "./db";

export interface CaseChange {
  caseId: string;
  organizationId: string;
  /** For the audit log, such as "case.created" or "step.complete". */
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  /** For the case's own history, which the deadline clocks read. */
  event: { type: string; stepId?: StepId; evidenceId?: string; data?: unknown; occurredAt?: Date };
}

/**
 * Records a change to a case in the shared audit log and in the case's history. Run it in the
 * transaction that makes the change, so neither exists without the other. All of a case's audit
 * rows use the case as the entity, so one query gives its timeline. A null user is CLEAR itself,
 * for what it does on its own, such as raising a flag. A practice case belongs to TRADE, so its rows
 * say so and a CLEAR audit view doesn't show them.
 */
export async function recordChange(db: Executor, userId: string | null, change: CaseChange): Promise<void> {
  await db.insert(schema.auditLog).values({
    actorUserId: userId,
    organizationId: change.organizationId,
    platform: sql<"clear" | "trade">`case when exists (select 1 from clear.export_case where id = ${change.caseId} and practice_scenario is not null) then 'trade' else 'clear' end`,
    action: change.action,
    entityType: "export_case",
    entityId: change.caseId,
    before: change.before ?? null,
    after: change.after ?? null,
    reason: change.reason ?? null,
  });
  // clock_timestamp(), not the transaction's start: events are read in the order they were
  // recorded, and transactions on one case run one after another.
  await db.insert(schema.caseEvent).values({
    caseId: change.caseId,
    type: change.event.type,
    stepId: change.event.stepId ?? null,
    evidenceId: change.event.evidenceId ?? null,
    data: change.event.data ?? null,
    actorUserId: userId,
    occurredAt: change.event.occurredAt ?? sql`clock_timestamp()`,
    recordedAt: sql`clock_timestamp()`,
  });
}
