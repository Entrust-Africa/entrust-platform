import { and, eq, inArray } from "drizzle-orm";
import { schema, type Database } from "@entrust/db";
import type { CaseDetailView } from "../schemas/clear";
import { requireRole, type Ctx } from "./access";
import { recordChange } from "./audit";
import { mutateCase } from "./detail";
import { syncFlags } from "./flag-sync";
import { ServiceError } from "./errors";

/**
 * Accepts an open flag as it is: it stays on the case with the reason, and the steps it held are
 * released. Only Entrust reviewers and admins can. If the situation clears the flag resolves as
 * usual; if it clears and comes back, that is a new flag.
 */
export function waiveFlag(ctx: Ctx, caseId: string, flagId: string, reason: string): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    requireRole(actor, ["reviewer", "admin"], "waive a flag");
    const [flag] = await tx
      .select()
      .from(schema.caseFlag)
      .where(and(eq(schema.caseFlag.id, flagId), eq(schema.caseFlag.caseId, row.id)));
    if (!flag) throw new ServiceError("not_found", "Flag not found.");
    if (flag.status !== "open") {
      throw new ServiceError("invalid_transition", `${flag.rule} is already ${flag.status}, so it can't be waived.`);
    }
    const why = reason.trim();
    if (!why) throw new ServiceError("precondition_failed", `Give a reason to waive ${flag.rule}.`);

    await tx
      .update(schema.caseFlag)
      .set({ status: "waived", waivedAt: ctx.now, waivedByUserId: ctx.principal.userId, waiveReason: why })
      .where(eq(schema.caseFlag.id, flag.id));
    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "flag.waive",
      before: { flagId: flag.id, rule: flag.rule, status: "open" },
      after: { flagId: flag.id, rule: flag.rule, status: "waived" },
      reason: why,
      event: { type: "flag_waived", data: { rule: flag.rule } },
    });
  });
}

/**
 * Checks every open case against the failure rules. Practice cases are left out: they are checked as
 * the learner works them, and time passing never raises anything on one. Some rules fire with time alone (the FX
 * repatriation deadline passing), when nobody touches the case, so the background worker (#16)
 * calls this on a schedule. Each case is checked in its own transaction, so one failing doesn't
 * hold up the rest. `only` limits the check to the given cases.
 */
export async function syncOpenCases(
  db: Database,
  now: Date,
  options: { only?: readonly string[] } = {},
): Promise<{ checked: number; raised: number; resolved: number; failed: string[] }> {
  const open = await db
    .select({ id: schema.exportCase.id })
    .from(schema.exportCase)
    .where(
      and(
        schema.realCase,
        inArray(schema.exportCase.status, ["open", "amendments_pending"]),
        options.only ? inArray(schema.exportCase.id, [...options.only]) : undefined,
      ),
    );

  const total = { checked: 0, raised: 0, resolved: 0, failed: [] as string[] };
  for (const { id } of open) {
    try {
      const result = await db.transaction(async (tx) => {
        const [row] = await tx.select().from(schema.exportCase).where(eq(schema.exportCase.id, id)).for("update");
        return row ? syncFlags(tx, row, now) : { raised: 0, resolved: 0 };
      });
      total.checked += 1;
      total.raised += result.raised;
      total.resolved += result.resolved;
    } catch (error) {
      console.error(`Checking the failure rules for case ${id} failed`, error);
      total.failed.push(id);
    }
  }
  return total;
}
