import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import { schema } from "@entrust/db";
import { STEP_WORKERS, type CaseFacts } from "@entrust/gate-engine";
import type { CaseCreatedView, CaseDetailView, CaseListView } from "../schemas/clear";
import { actorFor, findCase, hasTradeAccess, requireRole, type Ctx } from "./access";
import { recordChange } from "./audit";
import { evaluate, loadCaseData, loadEvents, organizationNames, type EventRow } from "./case-data";
import { applyClockInput, latestClockInput } from "./clocks";
import { buildDetail, mutateCase } from "./detail";
import { applyDocumentFields } from "./documents";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { checkFacts, type FactInput } from "./facts";
import { syncFlags } from "./flag-sync";
import { PRACTICE_LABEL, PRACTICE_SCENARIOS, findScenario, type PracticeScenario } from "./practice-scenarios";
import { currentPack } from "./rule-packs";
import { summaryOf } from "./views";

// Practice cases for TRADE's M08 (#74). A practice case is a CLEAR case with practice_scenario set, made
// through CLEAR's own case flow, so every rule of a real case applies. What differs is who can reach it
// and what it counts for: it belongs to the learner's organisation and needs TRADE access, not CLEAR;
// CLEAR's lists, scheduled checks, queues and reports leave it out (schema.realCase); and it never
// uses a real case number.

/** The scenarios a learner can start, and the label every screen shows on a practice case. */
export function listPracticeScenarios() {
  return {
    label: PRACTICE_LABEL,
    scenarios: PRACTICE_SCENARIOS.map(({ id, title, summary, ownFacts }) => ({ id, title, summary, ownFacts })),
  };
}

export interface StartPracticeInput {
  organizationId?: string | null;
  scenario: string;
  /** The facts of the learner's own deal. Only for a scenario that takes them. */
  facts?: Record<string, FactInput>;
}

/** The organisation's practice cases need TRADE access. Entrust staff, who run demonstrations, don't. */
async function requireTradeAccess(ctx: Ctx, organizationId: string): Promise<void> {
  if (ctx.principal.staffRole || (await hasTradeAccess(ctx.db, organizationId))) return;
  throw new ServiceError("forbidden", "Your organisation doesn't have access to TRADE.");
}

/** Who may start, reset or list an organisation's practice cases: the people who could open its cases, if it has TRADE. */
async function practiceActor(ctx: Ctx, organizationId: string | null | undefined) {
  if (!organizationId) throw new ServiceError("invalid", "Say which organisation the practice case is for (organizationId).");
  const actor = actorFor(ctx.principal, organizationId);
  if (!actor) throw new ServiceError("not_found", "Organisation not found.");
  requireRole(actor, STEP_WORKERS.sme, "practise on a case");
  await requireTradeAccess(ctx, organizationId);
  return actor;
}

/** The case's facts as the learner's scenario fixes them, or as the learner gave them for their own deal. */
function startFacts(scenario: PracticeScenario, given: Record<string, FactInput> | undefined): CaseFacts {
  if (!scenario.ownFacts) {
    if (given && Object.keys(given).length) throw new ServiceError("invalid", `${scenario.title} has its own facts. Leave facts out.`);
    return checkFacts(scenario.facts).set;
  }
  const { set, clear } = checkFacts(given ?? {});
  if (clear.length) throw new ServiceError("invalid", "A new case has no facts to clear.");
  if (!set.product || !set.destinationCountry) {
    throw new ServiceError("invalid", "A practice case needs at least its product and destination country.");
  }
  return set;
}

async function openPracticeCase(
  tx: Executor,
  ctx: Ctx,
  organizationId: string,
  scenario: PracticeScenario,
  facts: CaseFacts,
): Promise<CaseCreatedView> {
  const pack = currentPack({ product: facts.product as string, destinationCountry: facts.destinationCountry as string });
  const rulePack = pack && { id: pack.id, version: pack.version };
  const [row] = await tx
    .insert(schema.exportCase)
    .values({
      // Not from the real sequence: a practice case never takes a CLR number.
      reference: `PRACTICE-${scenario.id.toUpperCase()}-${randomUUID().slice(0, 8).toUpperCase()}`,
      organizationId,
      practiceScenario: scenario.id,
      facts,
      rulePackId: rulePack?.id ?? null,
      rulePackVersion: rulePack?.version ?? null,
      createdByUserId: ctx.principal.userId,
    })
    .returning();
  if (!row) throw new Error("The practice case was not created");

  await recordChange(tx, ctx.principal.userId, {
    caseId: row.id,
    organizationId,
    action: "case.created",
    after: { reference: row.reference, facts, rulePack, practiceScenario: scenario.id },
    event: { type: "case_created", data: { facts, rulePack, practiceScenario: scenario.id } },
  });
  await syncFlags(tx, row, ctx.now);
  // The learner starts as the SME. They pick another party's role to take that party's turn.
  return { ...(await buildDetail(tx, row, "owner", ctx.now)), cadCap: null };
}

/**
 * Starts a practice case from a scenario for the learner's organisation. An organisation has one per
 * scenario at a time; resetting it starts the scenario again.
 */
export async function startPracticeCase(ctx: Ctx, input: StartPracticeInput): Promise<CaseCreatedView> {
  await practiceActor(ctx, input.organizationId);
  const organizationId = input.organizationId as string;
  const scenario = findScenario(input.scenario);
  if (!scenario) throw new ServiceError("not_found", "No such practice scenario.");
  const facts = startFacts(scenario, input.facts);

  return ctx.db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: schema.exportCase.id })
      .from(schema.exportCase)
      .where(and(eq(schema.exportCase.organizationId, organizationId), eq(schema.exportCase.practiceScenario, scenario.id)));
    if (existing) {
      throw new ServiceError("invalid_transition", `${scenario.title} is already started. Reset it to start again.`);
    }
    return openPracticeCase(tx, ctx, organizationId, scenario, facts);
  });
}

/**
 * Puts a practice case back at the start of its scenario: the case, with everything recorded on it, is
 * deleted and the scenario opens again with the facts it began with. The new case has a new id.
 */
export async function resetPracticeCase(ctx: Ctx, caseId: string): Promise<CaseCreatedView> {
  return ctx.db.transaction(async (tx) => {
    const { row } = await findCase(tx, ctx.principal, caseId, { lock: true, practice: {} });
    await practiceActor(ctx, row.organizationId);
    const scenario = findScenario(row.practiceScenario ?? "");
    if (!scenario) throw new ServiceError("not_found", "Case not found.");

    // The facts it opened with are on its first event, since the learner may have changed the case's own.
    const [opened] = await tx
      .select({ data: schema.caseEvent.data })
      .from(schema.caseEvent)
      .where(and(eq(schema.caseEvent.caseId, row.id), eq(schema.caseEvent.type, "case_created")))
      .orderBy(asc(schema.caseEvent.occurredAt))
      .limit(1);
    const facts = (opened?.data as { facts?: CaseFacts } | null)?.facts ?? checkFacts(scenario.facts).set;

    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "case.practice_reset",
      before: { reference: row.reference },
      event: { type: "practice_reset" },
    });
    // The children go with the case. The contract it recorded is the learner's practice only.
    await tx.delete(schema.exportCase).where(eq(schema.exportCase.id, row.id));
    if (row.salesContractId) await tx.delete(schema.salesContract).where(eq(schema.salesContract.id, row.salesContractId));
    return openPracticeCase(tx, ctx, row.organizationId, scenario, facts);
  });
}

/** The practice cases of the organisations the caller belongs to, or of one organisation, newest first. */
export async function listPracticeCases(ctx: Ctx, organizationId?: string): Promise<CaseListView> {
  const organizations = organizationId ? [organizationId] : [...ctx.principal.smeRoles.keys()];
  const rows: (typeof schema.exportCase.$inferSelect)[] = [];
  for (const id of organizations) {
    await practiceActor(ctx, id);
    const found = await ctx.db
      .select()
      .from(schema.exportCase)
      .where(and(eq(schema.exportCase.organizationId, id), isNotNull(schema.exportCase.practiceScenario)))
      .orderBy(desc(schema.exportCase.createdAt));
    rows.push(...found);
  }
  return summaries(ctx, rows);
}

async function summaries(ctx: Ctx, rows: (typeof schema.exportCase.$inferSelect)[]): Promise<CaseListView> {
  const [data, names] = await Promise.all([loadCaseData(ctx.db, rows), organizationNames(ctx.db, rows.map((r) => r.organizationId))]);
  return { items: data.map((d) => summaryOf(d, names.get(d.row.organizationId) ?? "", evaluate(d, ctx.now))), total: rows.length };
}

const PRACTICE_EVENT_PLAYED = "practice_event_played";

const playedEvents = (history: readonly EventRow[]): Set<string> =>
  new Set(history.filter((e) => e.type === PRACTICE_EVENT_PLAYED).map((e) => (e.data as { event: string }).event));

/** A date or timestamp moved by whole days, keeping its time and offset. */
function shiftDays(value: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(value);
  if (!match) throw new Error(`Not a date: ${value}`);
  const moved = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${moved.toISOString().slice(0, 10)}${match[4]}`;
}

/** The scripted events of a practice case's scenario, and which of them have happened. */
export async function listPracticeEvents(ctx: Ctx, caseId: string) {
  const { row } = await findCase(ctx.db, ctx.principal, caseId, { practice: ctx.practice ?? {} });
  const played = playedEvents(await loadEvents(ctx.db, row.id));
  const events = findScenario(row.practiceScenario ?? "")?.events ?? [];
  return { items: events.map(({ id, title, story }) => ({ id, title, story, played: played.has(id) })) };
}

/**
 * Plays a scripted event: what happens to the shipment, which the learner then has to handle. Its
 * effects are applied the way the SME would enter them, in one transaction with the case locked, so an
 * event happens once even if it is played twice at the same time. Anyone who can work the case can play it.
 * Resetting the case lets it be played again.
 */
export function playPracticeEvent(ctx: Ctx, caseId: string, eventId: string): Promise<CaseDetailView> {
  return mutateCase({ ...ctx, practice: ctx.practice ?? {} }, caseId, async (tx, { row }) => {
    const event = findScenario(row.practiceScenario ?? "")?.events.find((e) => e.id === eventId);
    if (!event) throw new ServiceError("not_found", "No such event in this scenario.");
    const history = await loadEvents(tx, row.id);
    if (playedEvents(history).has(event.id)) {
      throw new ServiceError("invalid_transition", `"${event.title}" has already happened. Reset the case to play it again.`);
    }

    for (const effect of event.effects) {
      if (effect.kind === "document_fields") {
        for (const [document, fields] of Object.entries(effect.documents)) await applyDocumentFields(tx, row, ctx, document, { ...fields });
      } else {
        const planned = latestClockInput(history, "plannedLoading");
        if (!planned) throw new ServiceError("precondition_failed", "Record the planned loading time first. The delay moves it.");
        await applyClockInput(tx, row, ctx, { key: "plannedLoading", value: shiftDays(planned, effect.days) });
      }
    }
    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "practice.event_played",
      after: { event: event.id },
      event: { type: PRACTICE_EVENT_PLAYED, data: { event: event.id } },
    });
  });
}
