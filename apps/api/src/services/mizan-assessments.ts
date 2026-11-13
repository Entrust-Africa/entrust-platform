import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  analyseYears,
  buildDiagnostics,
  COUNTRY_MODULES,
  inputErrors,
  MIZAN_ENGINE_VERSION,
  ratingDepartures,
  scoreAssessment,
  type AssessmentStatus,
  type Diagnostics,
  type FinancialYear,
  type MizanCountry,
  type RatingValue,
  type ScoreInput,
  type ScoreResult,
  type YearAnalysis,
} from "@entrust/mizan-engine";
import { configFingerprint, currentMizanConfig, getMizanConfig, type MizanConfig } from "@entrust/mizan-rules";
import { mizanCan } from "@entrust/roles";
import type { Ctx, Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { assessBlockers, hasSupportRelationship } from "./mizan-access";
import { lockSme, requireAssessmentNotice } from "./mizan-consents";

// An assessment's life (#229): created under the configuration in use that day, which it keeps for good; worked on while it is a
// draft or returned; submitted for review once nothing is missing; locked while in review; frozen once approved (#230).

type AssessmentRow = typeof schema.mizanAssessment.$inferSelect;

/** Draft and returned are open for work; in review and approved are not. */
export const EDITABLE_STATUSES: readonly AssessmentStatus[] = ["draft", "returned"];
const OPEN_STATUSES: readonly AssessmentStatus[] = ["draft", "in_review", "returned"];

const DEFAULT_CURRENCY: Readonly<Record<MizanCountry, string>> = { ET: "ETB", KE: "KES" };

const isCountry = (c: string): c is MizanCountry => c in COUNTRY_MODULES;

/** Whole months from a start date to now. */
export function monthsSince(start: string | null, now: Date): number | null {
  if (!start) return null;
  const d = new Date(`${start}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const months = (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth()) - (now.getUTCDate() < d.getUTCDate() ? 1 : 0);
  return Math.max(0, months);
}

/** Records a change in the shared audit log and the assessment's own history. Run it in the transaction making the change. */
export async function recordAssessmentChange(
  tx: Executor,
  userId: string,
  a: Pick<AssessmentRow, "id" | "organizationId">,
  change: { type: string; before?: unknown; after?: unknown; reason?: string | null },
): Promise<void> {
  await tx.insert(schema.auditLog).values({
    actorUserId: userId,
    organizationId: a.organizationId,
    platform: "mizan",
    action: `mizan.assessment.${change.type}`,
    entityType: "mizan_assessment",
    entityId: a.id,
    before: change.before ?? null,
    after: change.after ?? null,
    reason: change.reason ?? null,
  });
  await tx.insert(schema.mizanAssessmentEvent).values({
    assessmentId: a.id,
    type: change.type,
    data: change.after ?? null,
    actorUserId: userId,
    occurredAt: sql`clock_timestamp()`,
  });
}

// ---------------------------------------------------------------- create

export interface CreateInput {
  organizationId: string;
  currency?: string | undefined;
  industry?: string | undefined;
}

/**
 * Starts an assessment. The SME must have accepted the assessment notice (in MIZAN or in TRADE), and the caller must be an
 * Assessor or Super Admin who never supported it. It pins the configuration in use now, its fingerprint, the engine release
 * and the country module, and is numbered <SME ID>-A<n>. One open assessment per SME at a time.
 */
export async function createAssessment(ctx: Ctx, input: CreateInput): Promise<AssessmentView> {
  const blockers = await assessBlockers(ctx.db, ctx.principal, input.organizationId);
  if (blockers.length) throw new ServiceError("forbidden", blockers.join(" "));
  const cfg = currentMizanConfig();
  const fingerprint = await configFingerprint(cfg);

  // Two creates at once for one SME can pick the same number; the unique index turns one away and it tries the next.
  for (let attempt = 0; ; attempt++) {
    try {
      const id = await ctx.db.transaction(async (tx) => {
        // Before the notice check, so a withdrawal can't commit between it and the insert.
        await lockSme(tx, input.organizationId);
        const [sme] = await tx
          .select({
            smeId: schema.smeProfile.smeId,
            country: schema.smeProfile.country,
            sector: schema.smeProfile.sector,
            mergedInto: schema.smeProfile.mergedIntoSmeId,
            operatingSince: schema.mizanSme.operatingSince,
          })
          .from(schema.smeProfile)
          .leftJoin(schema.mizanSme, eq(schema.mizanSme.organizationId, schema.smeProfile.organizationId))
          .where(eq(schema.smeProfile.organizationId, input.organizationId))
          .limit(1);
        if (!sme) throw new ServiceError("not_found", "No such SME.");
        if (sme.mergedInto) throw new ServiceError("precondition_failed", `This SME was merged into ${sme.mergedInto}. Assess that one instead.`);
        if (!isCountry(sme.country)) throw new ServiceError("precondition_failed", `MIZAN has no country module for ${sme.country}: it assesses SMEs in Ethiopia and Kenya.`);

        await requireAssessmentNotice(tx, input.organizationId, "start an assessment");

        const [open] = await tx
          .select({ assessmentNo: schema.mizanAssessment.assessmentNo, status: schema.mizanAssessment.status })
          .from(schema.mizanAssessment)
          .where(and(eq(schema.mizanAssessment.organizationId, input.organizationId), inArray(schema.mizanAssessment.status, [...OPEN_STATUSES])))
          .limit(1);
        if (open) throw openConflict(open.assessmentNo, open.status);

        const [last] = await tx
          .select({ sequence: sql<number>`coalesce(max(${schema.mizanAssessment.sequence}), 0)` })
          .from(schema.mizanAssessment)
          .where(eq(schema.mizanAssessment.organizationId, input.organizationId));
        const sequence = Number(last?.sequence ?? 0) + 1;

        const [created] = await tx
          .insert(schema.mizanAssessment)
          .values({
            organizationId: input.organizationId,
            sequence,
            assessmentNo: `${sme.smeId}-A${sequence}`,
            kind: "initial",
            methodology: cfg.methodology,
            configVersion: cfg.version,
            configFingerprint: fingerprint,
            engineVersion: MIZAN_ENGINE_VERSION,
            countryModule: COUNTRY_MODULES[sme.country],
            industry: input.industry?.trim() || sme.sector,
            currency: input.currency ?? DEFAULT_CURRENCY[sme.country],
            status: "draft",
            assessorUserId: ctx.principal.userId,
            monthsOperating: monthsSince(sme.operatingSince, ctx.now),
          })
          .returning();
        await recordAssessmentChange(tx, ctx.principal.userId, created!, {
          type: "created",
          after: {
            assessmentNo: created!.assessmentNo,
            configVersion: cfg.version,
            configFingerprint: fingerprint,
            engineVersion: MIZAN_ENGINE_VERSION,
            countryModule: created!.countryModule,
            currency: created!.currency,
          },
        });
        return created!.id;
      });
      return getAssessment(ctx, id);
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint === "mizan_assessment_org_sequence_uidx" && attempt < 3) continue;
      if (constraint === "mizan_assessment_one_open_uidx") throw new ServiceError("conflict", "This SME already has an open assessment. Finish it first.");
      throw error;
    }
  }
}

const openConflict = (assessmentNo: string, status: AssessmentStatus) =>
  new ServiceError("conflict", `${assessmentNo} is still open (${STATUS_LABELS[status]}). An SME has one open assessment at a time: finish that one first.`);

const STATUS_LABELS: Readonly<Record<AssessmentStatus, string>> = { draft: "draft", in_review: "in review", returned: "returned to the assessor", approved: "approved" };

function uniqueViolation(error: unknown): string | null {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const { code, constraint } = e as { code?: string; constraint?: string };
    if (code === "23505") return constraint ?? "";
  }
  return null;
}

// ---------------------------------------------------------------- read

/** Staff who read SMEs see every assessment. Anyone else gets not found: an SME reads its approved report, not the file. */
async function findAssessment(db: Executor, principal: Principal, id: string, opts: { lock?: boolean } = {}): Promise<AssessmentRow> {
  if (!mizanCan(principal, "read_smes")) throw new ServiceError("not_found", "No such assessment.");
  const query = db.select().from(schema.mizanAssessment).where(eq(schema.mizanAssessment.id, id));
  const [row] = opts.lock ? await query.for("update") : await query;
  if (!row) throw new ServiceError("not_found", "No such assessment.");
  return row;
}

/** Whether this person may change the assessment's inputs: its assessor or a Super Admin, and only while it is open for work. */
function canEdit(principal: Principal, a: AssessmentRow): boolean {
  return EDITABLE_STATUSES.includes(a.status) && mizanCan(principal, "assess") && (a.assessorUserId === principal.userId || principal.staffRole === "admin");
}

/**
 * The assessment, locked, if the caller may change its inputs now. Every edit route (context, financials, ratings, gates,
 * documents) goes through this, so a locked assessment rejects them all the same way.
 */
export async function loadEditable(tx: Executor, principal: Principal, id: string): Promise<AssessmentRow> {
  const a = await findAssessment(tx, principal, id, { lock: true });
  if (a.status === "in_review") throw new ServiceError("invalid_transition", `${a.assessmentNo} is in review, so it is locked. The reviewer can return it if something must change.`);
  if (a.status === "approved") throw new ServiceError("invalid_transition", `${a.assessmentNo} is approved and frozen. Corrections go in an amendment.`);
  if (!mizanCan(principal, "assess")) throw new ServiceError("forbidden", "Your role can't change an assessment in MIZAN.");
  if (a.assessorUserId !== principal.userId && principal.staffRole !== "admin") throw new ServiceError("forbidden", "Only its assessor or a Super Admin can change this assessment.");
  return a;
}

export interface Computation {
  analyses: YearAnalysis[];
  input: ScoreInput;
  result: ScoreResult;
  diagnostics: Diagnostics;
  departures: ReturnType<typeof ratingDepartures>;
  /** Input that doesn't fit the configuration, such as a rating of a criterion it doesn't have. */
  inputErrors: string[];
}

/** Scores the assessment's current inputs under the configuration it pinned. */
export async function computeLive(db: Executor, a: AssessmentRow): Promise<Computation> {
  const cfg = getMizanConfig(a.configVersion);
  const [years, ratings, gates, overrides] = await Promise.all([
    db.select().from(schema.mizanFinancialYear).where(eq(schema.mizanFinancialYear.assessmentId, a.id)),
    db.select().from(schema.mizanRating).where(eq(schema.mizanRating.assessmentId, a.id)),
    db.select().from(schema.mizanGateResult).where(eq(schema.mizanGateResult.assessmentId, a.id)),
    db.select().from(schema.mizanOverrideFlag).where(eq(schema.mizanOverrideFlag.assessmentId, a.id)),
  ]);
  // Financial years that can't be put in order (no digits in the label, the same year twice) leave the analysis empty and are
  // reported as something to fix, rather than failing the whole read.
  const yearErrors: string[] = [];
  let analyses: YearAnalysis[] = [];
  try {
    analyses = analyseYears(
      years.map((y): FinancialYear => ({ ...y.data, fiscalYear: y.fiscalYear })),
      { topCustomerShare: a.topCustomerShare },
    );
  } catch (error) {
    yearErrors.push(error instanceof Error ? error.message : String(error));
  }
  const input: ScoreInput = {
    ratings: Object.fromEntries(
      ratings.map((r) => [r.criterionId, { rating: (/^[0-4]$/.test(r.rating) ? Number(r.rating) : r.rating) as RatingValue, evidence: r.evidence, note: r.note }]),
    ),
    gates: Object.fromEntries(gates.map((g) => [g.gateId, g.status])),
    overrides: Object.fromEntries(overrides.map((o) => [o.overrideId, o.triggered])),
    latest: analyses.at(-1) ?? null,
    monthsOperating: a.monthsOperating,
  };
  const result = scoreAssessment(cfg, input);
  return {
    analyses,
    input,
    result,
    diagnostics: buildDiagnostics(cfg, input, result),
    departures: ratingDepartures(cfg, input.ratings, input.latest),
    inputErrors: [...yearErrors, ...inputErrors(cfg, input)],
  };
}

/** Everything that stops submission, each naming what is missing. Empty when it can go to review. */
export function submissionBlockers(cfg: MizanConfig, c: Computation): string[] {
  const out: string[] = [];
  if (c.inputErrors.length) out.push(`Fix what doesn't fit configuration ${cfg.version}: ${c.inputErrors.join("; ")}.`);
  if (c.result.missingMandatory.length) out.push(`Rate every mandatory criterion: ${c.result.missingMandatory.join(", ")}.`);
  if (c.result.missingEvidenceLevel.length) out.push(`Give an evidence level for: ${c.result.missingEvidenceLevel.join(", ")}.`);
  const pending = c.result.gates.filter((g) => g.status === "pending");
  if (pending.length) out.push(`Resolve every gate (pass or fail): ${pending.map((g) => `${g.id} ${g.title}`).join(", ")}.`);
  const unexplained = c.departures.filter((d) => !d.explained);
  if (unexplained.length) {
    out.push(
      `Write why these ratings differ from the interim ratio suggestion: ${unexplained.map((d) => `${d.criterionId} (rated ${d.rating}, suggestion ${d.suggested})`).join(", ")}.`,
    );
  }
  return out;
}

async function view(db: Executor, principal: Principal, a: AssessmentRow) {
  const [sme] = await db
    .select({ smeId: schema.smeProfile.smeId, legalName: schema.smeProfile.legalName })
    .from(schema.smeProfile)
    .where(eq(schema.smeProfile.organizationId, a.organizationId));
  const people = [a.assessorUserId, a.reviewerUserId].filter((x): x is string => !!x);
  const names = new Map((await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, people))).map((u) => [u.id, u.name]));

  let computation: { frozen: boolean; analyses: unknown; result: unknown; diagnostics: unknown };
  let blockers: string[] = [];
  let departures: Computation["departures"] = [];
  if (a.status === "approved" && a.resultJson) {
    // The record frozen at approval (#230), never recomputed.
    const frozen = JSON.parse(a.resultJson) as { analyses?: unknown; result?: unknown; diagnostics?: unknown };
    computation = { frozen: true, analyses: frozen.analyses ?? [], result: frozen.result ?? null, diagnostics: frozen.diagnostics ?? null };
  } else {
    const live = await computeLive(db, a);
    computation = { frozen: false, analyses: live.analyses, result: live.result, diagnostics: live.diagnostics };
    departures = live.departures;
    blockers = submissionBlockers(getMizanConfig(a.configVersion), live);
  }
  return {
    id: a.id,
    assessmentNo: a.assessmentNo,
    organizationId: a.organizationId,
    smeId: sme?.smeId ?? null,
    legalName: sme?.legalName ?? null,
    kind: a.kind,
    status: a.status,
    previousAssessmentId: a.previousAssessmentId,
    supersededById: a.supersededById,
    reason: a.reason,
    methodology: a.methodology,
    configVersion: a.configVersion,
    configFingerprint: a.configFingerprint,
    engineVersion: a.engineVersion,
    countryModule: a.countryModule,
    industry: a.industry,
    currency: a.currency,
    topCustomerShare: a.topCustomerShare,
    monthsOperating: a.monthsOperating,
    assessor: { id: a.assessorUserId, name: names.get(a.assessorUserId) ?? null },
    reviewer: a.reviewerUserId ? { id: a.reviewerUserId, name: names.get(a.reviewerUserId) ?? null } : null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    submittedAt: a.submittedAt?.toISOString() ?? null,
    approvedAt: a.approvedAt?.toISOString() ?? null,
    canEdit: canEdit(principal, a),
    canSubmit: canEdit(principal, a) && blockers.length === 0,
    submissionBlockers: blockers,
    departures,
    computation,
  };
}

export type AssessmentView = Awaited<ReturnType<typeof view>>;

/** One assessment: its live computation while open, the frozen record once approved. */
export async function getAssessment(ctx: Ctx, id: string): Promise<AssessmentView> {
  const a = await findAssessment(ctx.db, ctx.principal, id);
  return view(ctx.db, ctx.principal, a);
}

export interface ListFilter {
  organizationId?: string | undefined;
  status?: AssessmentStatus | undefined;
  /** Only the caller's own. */
  mine?: boolean | undefined;
}

export async function listAssessments(ctx: Ctx, filter: ListFilter) {
  if (!mizanCan(ctx.principal, "read_smes")) throw new ServiceError("forbidden", "Your role can't see assessments in MIZAN.");
  const where: SQL[] = [];
  if (filter.organizationId) where.push(eq(schema.mizanAssessment.organizationId, filter.organizationId));
  if (filter.status) where.push(eq(schema.mizanAssessment.status, filter.status));
  if (filter.mine) where.push(eq(schema.mizanAssessment.assessorUserId, ctx.principal.userId));
  const rows = await ctx.db
    .select({
      id: schema.mizanAssessment.id,
      assessmentNo: schema.mizanAssessment.assessmentNo,
      organizationId: schema.mizanAssessment.organizationId,
      legalName: schema.smeProfile.legalName,
      kind: schema.mizanAssessment.kind,
      status: schema.mizanAssessment.status,
      configVersion: schema.mizanAssessment.configVersion,
      assessorName: schema.user.name,
      createdAt: schema.mizanAssessment.createdAt,
      submittedAt: schema.mizanAssessment.submittedAt,
      approvedAt: schema.mizanAssessment.approvedAt,
    })
    .from(schema.mizanAssessment)
    .leftJoin(schema.smeProfile, eq(schema.smeProfile.organizationId, schema.mizanAssessment.organizationId))
    .leftJoin(schema.user, eq(schema.user.id, schema.mizanAssessment.assessorUserId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.mizanAssessment.createdAt))
    .limit(500);
  return {
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      approvedAt: r.approvedAt?.toISOString() ?? null,
    })),
  };
}

// ---------------------------------------------------------------- change

export interface ContextInput {
  currency?: string | undefined;
  industry?: string | null | undefined;
  topCustomerShare?: number | null | undefined;
  monthsOperating?: number | null | undefined;
}

/** The assessment's context: currency, industry, the largest customer's share of revenue and months operating. */
export async function updateAssessment(ctx: Ctx, id: string, input: ContextInput): Promise<AssessmentView> {
  await ctx.db.transaction(async (tx) => {
    const a = await loadEditable(tx, ctx.principal, id);
    const changes: Partial<AssessmentRow> = {};
    if (input.currency !== undefined) changes.currency = input.currency;
    if (input.industry !== undefined) changes.industry = input.industry?.trim() || null;
    if (input.topCustomerShare !== undefined) changes.topCustomerShare = input.topCustomerShare;
    if (input.monthsOperating !== undefined) changes.monthsOperating = input.monthsOperating;
    if (!Object.keys(changes).length) return;
    const before = Object.fromEntries(Object.keys(changes).map((k) => [k, a[k as keyof AssessmentRow]]));
    await tx.update(schema.mizanAssessment).set(changes).where(eq(schema.mizanAssessment.id, id));
    await recordAssessmentChange(tx, ctx.principal.userId, a, { type: "context_saved", before, after: changes });
  });
  return getAssessment(ctx, id);
}

/**
 * Sends the assessment for review, which locks it. Refused while the SME's notice is withdrawn, while the assessor is recorded
 * as having supported the SME, and while anything is missing: the error names each item.
 */
export async function submitAssessment(ctx: Ctx, id: string): Promise<AssessmentView> {
  await ctx.db.transaction(async (tx) => {
    // The SME first, as a withdrawal takes it, so one can't commit between the notice check and the status change.
    const [target] = await tx.select({ organizationId: schema.mizanAssessment.organizationId }).from(schema.mizanAssessment).where(eq(schema.mizanAssessment.id, id));
    if (target) await lockSme(tx, target.organizationId);
    const a = await loadEditable(tx, ctx.principal, id);
    await requireAssessmentNotice(tx, a.organizationId, "submit it for review");
    // Both the person submitting and the assessor of record: a Super Admin may submit someone else's work.
    const independence = await assessBlockers(tx, ctx.principal, a.organizationId);
    if (independence.length) throw new ServiceError("forbidden", independence.join(" "));
    if (a.assessorUserId !== ctx.principal.userId && (await hasSupportRelationship(tx, a.assessorUserId, a.organizationId))) {
      throw new ServiceError("forbidden", "Its assessor is recorded as having supported this SME, so someone else must assess it (control C-1).");
    }
    const live = await computeLive(tx, a);
    const blockers = submissionBlockers(getMizanConfig(a.configVersion), live);
    if (blockers.length) throw new ServiceError("precondition_failed", `${a.assessmentNo} can't be submitted yet. ${blockers.join(" ")}`);
    await tx.update(schema.mizanAssessment).set({ status: "in_review", submittedAt: ctx.now }).where(eq(schema.mizanAssessment.id, id));
    await recordAssessmentChange(tx, ctx.principal.userId, a, {
      type: "submitted",
      before: { status: a.status },
      after: { status: "in_review", total: live.result.total, resultStatus: live.result.status, computedLevel: live.result.computedLevel },
    });
  });
  return getAssessment(ctx, id);
}
