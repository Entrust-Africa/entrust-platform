import { asc, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  STEP_COMPLETED,
  evaluateCase,
  evaluateDeadlines,
  type CaseEvaluation,
  type CaseState,
  type DeadlineClock,
  type DeadlineInput,
  type EvidenceRecord,
} from "@entrust/gate-engine";
import { STEPS, type PhaseId } from "@entrust/rules";
import type { Executor } from "./db";

export type CaseRow = typeof schema.exportCase.$inferSelect;
export type StepRow = typeof schema.caseStep.$inferSelect;
export type EvidenceRow = typeof schema.evidence.$inferSelect;
export type EventRow = typeof schema.caseEvent.$inferSelect;
export type FlagRow = typeof schema.caseFlag.$inferSelect;

/** Everything the engine needs to evaluate a case. */
export interface CaseData {
  row: CaseRow;
  steps: StepRow[];
  /** In the order submitted. */
  evidence: EvidenceRow[];
  /** Every flag the case has had, oldest first. */
  flags: FlagRow[];
}

/** Loads the recorded steps, evidence and flags of the given cases, in the order given. */
export async function loadCaseData(db: Executor, rows: readonly CaseRow[]): Promise<CaseData[]> {
  const data = rows.map((row): CaseData => ({ row, steps: [], evidence: [], flags: [] }));
  if (rows.length === 0) return data;
  const byId = new Map(data.map((d) => [d.row.id, d]));
  const ids = rows.map((r) => r.id);
  // One after another: this runs inside transactions, where queries share a single connection.
  const steps = await db.select().from(schema.caseStep).where(inArray(schema.caseStep.caseId, ids));
  // Submission time, then id, so records submitted together keep a stable order.
  const evidence = await db
    .select()
    .from(schema.evidence)
    .where(inArray(schema.evidence.caseId, ids))
    .orderBy(asc(schema.evidence.submittedAt), asc(schema.evidence.id));
  const flags = await db
    .select()
    .from(schema.caseFlag)
    .where(inArray(schema.caseFlag.caseId, ids))
    .orderBy(asc(schema.caseFlag.raisedAt), asc(schema.caseFlag.id));
  for (const step of steps) byId.get(step.caseId)?.steps.push(step);
  for (const item of evidence) byId.get(item.caseId)?.evidence.push(item);
  for (const flag of flags) byId.get(flag.caseId)?.flags.push(flag);
  return data;
}

export async function loadOneCaseData(db: Executor, row: CaseRow): Promise<CaseData> {
  const [data] = await loadCaseData(db, [row]);
  if (!data) throw new Error("Case data was not loaded");
  return data;
}

/** The case's history, in the order it was recorded. */
export function loadEvents(db: Executor, caseId: string): Promise<EventRow[]> {
  return db
    .select()
    .from(schema.caseEvent)
    .where(eq(schema.caseEvent.caseId, caseId))
    .orderBy(asc(schema.caseEvent.recordedAt), asc(schema.caseEvent.id));
}

export async function organizationNames(db: Executor, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: schema.organization.id, name: schema.organization.name })
    .from(schema.organization)
    .where(inArray(schema.organization.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export const evidenceRecord = (item: EvidenceRow): EvidenceRecord => ({
  type: item.type,
  status: item.status,
  issuedOn: item.issuedOn,
  validUntil: item.validUntil,
});

/** The submission that decides a type's status: the latest of that type. */
export function latestEvidence(evidence: readonly EvidenceRow[], type: string): EvidenceRow | undefined {
  return evidence.findLast((item) => item.type === type);
}

export function toCaseState({ row, steps, evidence, flags }: CaseData): CaseState {
  return {
    facts: row.facts,
    flags: flags.filter((f) => f.status === "open").map((f) => ({ rule: f.rule, message: f.message, blocks: f.blocks })),
    steps: Object.fromEntries(steps.map((s) => [s.stepId, { status: s.status, reason: s.notApplicableReason }])),
    evidence: evidence.map(evidenceRecord),
    raisedExceptions: steps.filter((s) => s.raisedAt !== null).map((s) => s.stepId),
  };
}

/** The case as it stands, with its open flags holding the steps they list. */
export function evaluate(data: CaseData, now: Date): CaseEvaluation {
  return evaluateCase(STEPS, toCaseState(data), { asOf: now.toISOString() });
}

/** The case without its flags: what the failure rules read, so a flag can't switch off its own cause. */
export function evaluateWithoutFlags(data: CaseData, now: Date): CaseEvaluation {
  return evaluateCase(STEPS, { ...toCaseState(data), flags: [] }, { asOf: now.toISOString() });
}

/** The first phase whose gate is not locked, or the last phase once all are. */
export function currentPhaseOf(evaluation: CaseEvaluation): PhaseId {
  const open = evaluation.phases.filter((p) => p.status !== "locked").map((p) => p.phase);
  return open.length ? Math.min(...open) as PhaseId : 7;
}

/**
 * What the deadline clocks read. A step that is no longer completed (it was reopened or marked not
 * applicable) has not discharged its obligation, so its completion events are left out.
 */
export function deadlineInput(data: CaseData, events: readonly EventRow[]): DeadlineInput {
  const completed = new Set(data.steps.filter((s) => s.status === "completed").map((s) => s.stepId));
  return {
    facts: data.row.facts,
    steps: toCaseState(data).steps,
    events: events
      .filter((e) => e.type !== STEP_COMPLETED || (e.stepId !== null && completed.has(e.stepId)))
      .map((e) => ({ type: e.type, stepId: e.stepId, occurredAt: e.occurredAt.toISOString(), data: e.data })),
  };
}

export function deadlines(data: CaseData, events: readonly EventRow[], now: Date): DeadlineClock[] {
  return evaluateDeadlines(STEPS, deadlineInput(data, events), { now: now.toISOString() });
}
