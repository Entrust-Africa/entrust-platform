import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import type { Actor } from "@entrust/gate-engine";
import type { CaseDetailView } from "../schemas/clear";
import { findCase, type Ctx } from "./access";
import {
  currentPhaseOf,
  deadlines,
  evaluate,
  loadEvents,
  loadOneCaseData,
  organizationNames,
  type CaseRow,
} from "./case-data";
import type { Executor } from "./db";
import { detailOf } from "./views";

/** The case as the caller sees it: facts, the workflow the engine works out, evidence and deadlines. */
export async function buildDetail(db: Executor, row: CaseRow, actor: Actor, now: Date): Promise<CaseDetailView> {
  const data = await loadOneCaseData(db, row);
  const [events, names] = await Promise.all([loadEvents(db, row.id), organizationNames(db, [row.organizationId])]);
  return detailOf(data, names.get(row.organizationId) ?? "", actor, evaluate(data, now), deadlines(data, events, now), now);
}

/**
 * Runs a change to one case in a transaction. The case is locked first, so changes to it happen
 * one at a time and each sees the last. When the change is done, the case's current phase is
 * brought up to date from the engine and the updated case is returned.
 */
export function mutateCase(
  ctx: Ctx,
  caseId: string,
  change: (tx: Executor, found: { row: CaseRow; actor: Actor }) => Promise<void>,
): Promise<CaseDetailView> {
  return ctx.db.transaction(async (tx) => {
    const found = await findCase(tx, ctx.principal, caseId, { lock: true });
    await change(tx, found);

    const [current] = await tx.select().from(schema.exportCase).where(eq(schema.exportCase.id, caseId));
    if (!current) throw new Error("The case disappeared during the change");
    const evaluation = evaluate(await loadOneCaseData(tx, current), ctx.now);
    const [row] = await tx
      .update(schema.exportCase)
      .set({ currentPhase: currentPhaseOf(evaluation), updatedAt: ctx.now })
      .where(eq(schema.exportCase.id, caseId))
      .returning();
    if (!row) throw new Error("The case disappeared during the change");
    return buildDetail(tx, row, found.actor, ctx.now);
  });
}
