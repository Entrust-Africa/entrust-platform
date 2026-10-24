import { asc, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { isDone, type CaseEvaluation } from "@entrust/gate-engine";
import { recordChange } from "./audit";
import type { CaseRow } from "./case-data";
import type { Executor } from "./db";

export type AmendmentRow = typeof schema.caseAmendment.$inferSelect;

/** A case's amendments, oldest first (version 2 first). */
export function loadAmendments(db: Executor, caseId: string): Promise<AmendmentRow[]> {
  return db
    .select()
    .from(schema.caseAmendment)
    .where(eq(schema.caseAmendment.caseId, caseId))
    .orderBy(asc(schema.caseAmendment.version));
}

/**
 * Keeps the case in step with its amendments. An amendment is complete when everything it set back
 * (the reopened steps, the steps it made applicable, the reopened gates) is done again with its
 * evidence approved; the case is "amendments pending" while any amendment isn't. Run it where the
 * case's phase is brought up to date, with the case locked. Returns the status the case should
 * have. A closed or cancelled case keeps its status.
 */
export async function syncAmendments(
  tx: Executor,
  row: CaseRow,
  evaluation: CaseEvaluation,
  now: Date,
): Promise<CaseRow["status"]> {
  if (row.status !== "open" && row.status !== "amendments_pending") return row.status;

  const byId = new Map(evaluation.steps.map((s) => [s.id, s]));
  const done = (id: string) => {
    const step = byId.get(id as never);
    return !step || (isDone(step.status) && step.missingEvidence.length === 0);
  };

  let pending = 0;
  for (const amendment of await loadAmendments(tx, row.id)) {
    if (amendment.resolvedAt) continue;
    if (!amendment.impact.reverify.every(done)) {
      pending += 1;
      continue;
    }
    await tx.update(schema.caseAmendment).set({ resolvedAt: now }).where(eq(schema.caseAmendment.id, amendment.id));
    await recordChange(tx, null, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "amendment.resolve",
      before: { version: amendment.version, resolved: false },
      after: { version: amendment.version, resolved: true },
      event: { type: "amendment_resolved", data: { version: amendment.version } },
    });
  }
  return pending > 0 ? "amendments_pending" : "open";
}
