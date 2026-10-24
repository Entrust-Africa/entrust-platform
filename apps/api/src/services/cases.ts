import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { allocateCaseReference, schema } from "@entrust/db";
import { STEP_WORKERS, checkCadCap, type CaseFacts } from "@entrust/gate-engine";
import type { PhaseId } from "@entrust/rules";
import type { CaseCreatedView, CaseDetailView, CaseListView } from "../schemas/clear";
import { actorFor, findCase, requireRole, type Ctx } from "./access";
import { evaluate, loadCaseData, loadOneCaseData, organizationNames } from "./case-data";
import { buildDetail, mutateCase } from "./detail";
import { syncFlags } from "./flag-sync";
import { recordChange } from "./audit";
import { fromEngine, ServiceError } from "./errors";
import { applyFacts, changesRecordedFact, checkFacts, sameFacts, type FactInput } from "./facts";
import { summaryOf } from "./views";

export interface CreateCaseInput {
  organizationId?: string | null;
  facts: Record<string, FactInput>;
  cadAmountUsd?: number;
}

/**
 * Opens a case for an SME organisation. SME owners and members open them for their own
 * organisation; Entrust admins and facilitators for any. The case starts in phase 1 with the
 * facts known so far, which must include the product and the destination.
 */
export async function createCase(ctx: Ctx, input: CreateCaseInput): Promise<CaseCreatedView> {
  const organizationId = input.organizationId;
  if (!organizationId) throw new ServiceError("invalid", "Say which organisation the case is for (organizationId).");
  const actor = actorFor(ctx.principal, organizationId);
  if (!actor) throw new ServiceError("not_found", "Organisation not found.");
  requireRole(actor, STEP_WORKERS.sme, "open cases");

  const { set: facts, clear } = checkFacts(input.facts);
  if (clear.length) throw new ServiceError("invalid", "A new case has no facts to clear.");
  if (!facts.product || !facts.destinationCountry) {
    throw new ServiceError("invalid", "A case needs at least its product and destination country.");
  }
  const cadCap = input.cadAmountUsd === undefined ? null : fromEngine(() => checkCadCap(input.cadAmountUsd as number));

  return ctx.db.transaction(async (tx) => {
    const [organisation] = await tx
      .select({ id: schema.organization.id })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId));
    if (!organisation) throw new ServiceError("not_found", "Organisation not found.");
    const [profile] = await tx
      .select({ country: schema.smeProfile.country })
      .from(schema.smeProfile)
      .where(eq(schema.smeProfile.organizationId, organizationId));

    const reference = await allocateCaseReference(tx, {
      country: profile?.country ?? "ET",
      year: ctx.now.getUTCFullYear(),
    });
    const [row] = await tx
      .insert(schema.exportCase)
      .values({ reference, organizationId, facts, createdByUserId: ctx.principal.userId })
      .returning();
    if (!row) throw new Error("The case was not created");

    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId,
      action: "case.created",
      after: { reference, facts, cadCap: cadCap && { withinCap: cadCap.withinCap, excessUsd: cadCap.excessUsd } },
      event: { type: "case_created", data: { facts, cadAmountUsd: input.cadAmountUsd ?? null } },
    });
    await syncFlags(tx, row, ctx.now);
    return { ...(await buildDetail(tx, row, actor, ctx.now)), cadCap };
  });
}

export interface ListCasesInput {
  status?: (typeof schema.CASE_STATUSES)[number];
  phase?: number;
  organizationId?: string;
  limit: number;
  offset: number;
}

/**
 * The cases the caller can see, newest first: those of their own organisations, or every case
 * for Entrust staff. Each comes with the next action the engine works out.
 */
export async function listCases(ctx: Ctx, input: ListCasesInput): Promise<CaseListView> {
  const { principal } = ctx;
  if (!principal.staffRole && principal.smeRoles.size === 0) return { items: [], total: 0 };

  const filters: (SQL | undefined)[] = [
    principal.staffRole ? undefined : inArray(schema.exportCase.organizationId, [...principal.smeRoles.keys()]),
    input.status ? eq(schema.exportCase.status, input.status) : undefined,
    input.phase ? eq(schema.exportCase.currentPhase, input.phase as PhaseId) : undefined,
    input.organizationId ? eq(schema.exportCase.organizationId, input.organizationId) : undefined,
  ];
  const where = and(...filters);

  const [rows, [total]] = await Promise.all([
    ctx.db
      .select()
      .from(schema.exportCase)
      .where(where)
      .orderBy(desc(schema.exportCase.createdAt), desc(schema.exportCase.id))
      .limit(input.limit)
      .offset(input.offset),
    ctx.db.select({ total: count() }).from(schema.exportCase).where(where),
  ]);

  const [data, names] = await Promise.all([
    loadCaseData(ctx.db, rows),
    organizationNames(ctx.db, rows.map((r) => r.organizationId)),
  ]);
  return {
    items: data.map((d) => summaryOf(d, names.get(d.row.organizationId) ?? "", evaluate(d, ctx.now))),
    total: total?.total ?? 0,
  };
}

export async function getCase(ctx: Ctx, caseId: string): Promise<CaseDetailView> {
  const { row, actor } = await findCase(ctx.db, ctx.principal, caseId);
  return buildDetail(ctx.db, row, actor, ctx.now);
}

/**
 * Sets or clears facts, and the engine re-works which steps apply. Once a phase gate is signed off,
 * a fact that is already recorded can't be changed here: that is an amendment (see amendCase). Recording a
 * fact that wasn't known yet is always fine.
 */
export function updateFacts(ctx: Ctx, caseId: string, input: Record<string, FactInput>): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    requireRole(actor, STEP_WORKERS.sme, "change a case's facts");
    const change = checkFacts(input);
    const before: CaseFacts = row.facts;
    const after = applyFacts(before, change);
    if (sameFacts(before, after)) return;

    if (changesRecordedFact(before, change)) {
      const locked = evaluate(await loadOneCaseData(tx, row), ctx.now).phases.filter((p) => p.status === "locked");
      const use = "an amendment: use POST /v1/clear/cases/{id}/amendments";
      if (locked.length) {
        throw new ServiceError(
          "precondition_failed",
          `Phase ${locked.map((p) => p.phase).join(", ")} is signed off. Changing a recorded fact now is ${use}.`,
        );
      }
      if (row.status === "amendments_pending") {
        throw new ServiceError("precondition_failed", `An amendment is still pending. Changing a recorded fact now is ${use}.`);
      }
    }
    await tx.update(schema.exportCase).set({ facts: after }).where(eq(schema.exportCase.id, row.id));
    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "case.facts_updated",
      before,
      after,
      event: { type: "facts_updated", data: { set: change.set, cleared: change.clear } },
    });
  });
}
