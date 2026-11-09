import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { notify, organizationMemberIds, staffForEnrollment } from "./trade-notifications";
import { schema } from "@entrust/db";
import { NOT_KNOWN, canSubmit, checkAnswers, isNotKnown, type FormDefinition } from "@entrust/forms";
import {
  PATHWAY_NAMES,
  assignPathwayFromDiagnostic,
  isNotApplicable,
  placementAnswerFromForm,
  placementAnswerToForm,
  placementAsForm,
  validateResponses,
  visibleQuestions as placementVisible,
  type Answer as EngineAnswer,
  type Answers as EngineAnswers,
} from "@entrust/trade-engine";
import {
  findDiagnosticTemplate,
  findTradeRules,
  latestDiagnosticTemplate,
  latestTradeRules,
  type DiagnosticTemplate,
  type Pathway,
  type TradeRules,
} from "@entrust/trade-rules";
import type { AssessmentView } from "../schemas/trade";
import { hasTradeAccess, type Ctx, type Principal } from "./access";
import type { Executor } from "./db";
import { ServiceError } from "./errors";
import { rescoreLivePlacement, requireAvenue, scorePlacement, scoreExit } from "./trade-placement";
import { savePrefill, writeSectionOne } from "./trade-profile";
import { accessTo, recordTradeChange, unwrapAnswer, wrapAnswer, type Access, assignedOrganizationIds, limitedToAssignedCohorts } from "./trade-shared";

export { recordTradeChange } from "./trade-shared";

// The forms an enrolled SME fills in on TRADE: the onboarding diagnostic (#78), the placement
// assessment (#57), and the exit assessment (#71). They share one implementation: a form definition, answers that save as the person
// goes, and a submit that locks them. What differs is only how a kind checks its answers and what its
// submit leaves behind (the diagnostic assigns an avenue; the placement assessment builds the plan; the exit assessment rescores capability without touching the plan).

export const ASSESSMENT_FORM_KINDS = ["placement", "diagnostic", "exit"] as const;
export type FormKind = (typeof ASSESSMENT_FORM_KINDS)[number];

type AssessmentRow = typeof schema.tradeAssessment.$inferSelect;
type ResponseRow = typeof schema.assessmentResponse.$inferSelect;
type EnrollmentRow = typeof schema.enrollment.$inferSelect;
type CohortRow = typeof schema.cohort.$inferSelect;

/** Section 10 of the diagnostic: the declaration's signature. */
const SIGNATURE = { name: "D1", position: "D2", date: "D3" } as const;
const REASON_MAX = 300;

// ---- Access ----

function requireWrite(access: Access, doing: string): void {
  if (!access.write) throw new ServiceError("forbidden", `You can't ${doing}.`);
}

const todayOf = (now: Date): string => now.toISOString().slice(0, 10);

const problemsText = (problems: readonly string[]): string =>
  problems.slice(0, 5).join("; ") + (problems.length > 5 ? `; and ${problems.length - 5} more` : "");

// ---- The two kinds ----

interface Stored {
  answer: unknown;
  unscored: "not_known" | "not_applicable" | null;
  reason: string | null;
}

interface Check {
  errors: string[];
  incomplete: string[];
  conflicts: { code: string; questions: readonly string[]; message: string }[];
  ignored: string[];
  progress: { total: number; answered: number; percent: number; bySection: Record<string, { answered: number; total: number }> };
}

interface Kit {
  kind: FormKind;
  version: string;
  form: FormDefinition;
  /** An answer from a screen, as a row to store. Throws for an answer the question can't take. */
  encode(questionId: string, wire: unknown): Stored;
  /** A stored row, as a screen wants the answer. */
  decode(row: Pick<ResponseRow, "questionId" | "answer" | "unscored" | "unscoredReason">): unknown;
  check(rows: readonly ResponseRow[], today: string): Check;
}

const hasAnswer = (r: Pick<ResponseRow, "answer" | "unscored">): boolean => r.unscored !== null || (r.answer !== null && r.answer !== undefined);

const isNotKnownWire = (wire: unknown): boolean => isNotKnown(wire as never);

function reasonOf(questionId: string, wire: { reason?: unknown }): string {
  const reason = typeof wire.reason === "string" ? wire.reason.trim() : "";
  if (!reason) throw new ServiceError("invalid", `${questionId}: say in a few words why this doesn't apply to you`);
  if (reason.length > REASON_MAX) throw new ServiceError("invalid", `${questionId}: keep the reason to ${REASON_MAX} characters`);
  return reason;
}

function placementKit(rules: TradeRules): Kit {
  const questions = new Map(rules.template.questions.map((q) => [q.id, q]));
  const form = placementAsForm(rules);
  const engineAnswers = (rows: readonly ResponseRow[]): EngineAnswers =>
    Object.fromEntries(rows.filter(hasAnswer).map((r) => [r.questionId, (r.unscored ?? r.answer) as EngineAnswer]));
  return {
    kind: "placement",
    version: rules.version,
    form,
    encode(questionId, wire) {
      const q = questions.get(questionId);
      if (!q) throw new ServiceError("invalid", `${questionId}: this form has no such question`);
      if (isNotApplicable(wire)) {
        if (q.kind !== "capability") throw new ServiceError("invalid", `${questionId}: "does not apply" isn't an answer to this question`);
        return { answer: null, unscored: "not_applicable", reason: reasonOf(questionId, wire) };
      }
      if (isNotKnownWire(wire)) {
        if (q.kind !== "capability") throw new ServiceError("invalid", `${questionId}: choose one of the options`);
        return { answer: null, unscored: "not_known", reason: null };
      }
      return { answer: placementAnswerFromForm(rules, q, wire), unscored: null, reason: null };
    },
    decode(row) {
      const q = questions.get(row.questionId);
      if (!q) return null;
      if (row.unscored === "not_known") return NOT_KNOWN;
      if (row.unscored === "not_applicable") return { notApplicable: true, reason: row.unscoredReason ?? "" };
      return placementAnswerToForm(q, row.answer as EngineAnswer);
    },
    check(rows) {
      const answers = engineAnswers(rows);
      const result = validateResponses(rules, answers, { submit: true });
      const visible = placementVisible(rules, answers);
      const bad = new Set(result.errors.filter((e) => e.code !== "missing").map((e) => e.question));
      const bySection: Check["progress"]["bySection"] = {};
      let answered = 0;
      for (const q of visible) {
        const done = q.id in answers && !bad.has(q.id);
        bySection[q.section] ??= { answered: 0, total: 0 };
        bySection[q.section]!.total += 1;
        if (done) {
          answered += 1;
          bySection[q.section]!.answered += 1;
        }
      }
      return {
        errors: result.errors.filter((e) => e.code !== "missing").map((e) => e.message),
        incomplete: result.errors.filter((e) => e.code === "missing").map((e) => e.message),
        conflicts: result.conflicts.map((c) => ({ code: c.code, questions: c.questions, message: c.message })),
        ignored: [...result.ignored],
        progress: { total: visible.length, answered, percent: visible.length ? Math.floor((answered / visible.length) * 100) : 100, bySection },
      };
    },
  };
}

function diagnosticKit(template: DiagnosticTemplate): Kit {
  const questions = new Set(template.questions.map((q) => q.id));
  return {
    kind: "diagnostic",
    version: template.version,
    form: template,
    encode(questionId, wire) {
      if (!questions.has(questionId)) throw new ServiceError("invalid", `${questionId}: this form has no such question`);
      if (isNotApplicable(wire)) throw new ServiceError("invalid", `${questionId}: "does not apply" isn't an answer to this question`);
      if (isNotKnownWire(wire)) return { answer: null, unscored: "not_known", reason: null };
      return { answer: wire, unscored: null, reason: null };
    },
    decode(row) {
      return row.unscored === "not_known" ? NOT_KNOWN : row.answer;
    },
    check(rows, today) {
      const answers = Object.fromEntries(rows.filter(hasAnswer).map((r) => [r.questionId, (r.unscored === "not_known" ? NOT_KNOWN : r.answer) as never]));
      const result = checkAnswers(template, answers, { today });
      return {
        errors: result.errors.map((e) => e.message),
        incomplete: result.incomplete.map((e) => e.message),
        conflicts: [],
        ignored: [...result.ignored],
        progress: { ...result.progress, bySection: { ...result.progress.bySection } },
      };
    },
  };
}

function kitFor(kind: FormKind, version?: string): Kit {
  if (kind === "placement") {
    const rules = version ? findTradeRules(version) : latestTradeRules();
    if (!rules) throw new ServiceError("not_found", "No such version of the placement assessment.");
    return placementKit(rules);
  }
  if (kind === "exit") {
    const rules = version ? findTradeRules(version) : latestTradeRules();
    if (!rules) throw new ServiceError("not_found", "No such version of the exit assessment.");
    return exitKit(rules);
  }
  const template = version ? findDiagnosticTemplate(version) : latestDiagnosticTemplate();
  if (!template) throw new ServiceError("not_found", "No such version of the diagnostic.");
  return diagnosticKit(template);
}

function exitKit(rules: TradeRules): Kit {
  const base = placementKit(rules);
  const exitQuestions = new Map(rules.template.questions.filter((q) => q.section !== "A").map((q) => [q.id, q]));
  const form: FormDefinition = {
    ...base.form,
    id: "trade.exit",
    title: "TRADE Exit Assessment",
    sections: base.form.sections.filter((s) => s.id !== "A"),
    questions: base.form.questions.filter((q) => exitQuestions.has(q.id)),
  };
  return {
    kind: "exit",
    version: rules.version,
    form,
    encode(questionId, wire) {
      if (!exitQuestions.has(questionId)) throw new ServiceError("invalid", `${questionId}: this form has no such question`);
      return base.encode(questionId, wire);
    },
    decode: base.decode,
    check(rows) {
      const answers = Object.fromEntries(
        rows.filter((r) => hasAnswer(r) && exitQuestions.has(r.questionId)).map((r) => [r.questionId, (r.unscored ?? r.answer) as EngineAnswer]),
      );
      const visible = placementVisible(rules, answers).filter((q) => q.section !== "A");
      const result = validateResponses(rules, answers, { submit: true });
      const bad = new Set(result.errors.filter((e) => e.code !== "missing").map((e) => e.question));
      const bySection: Check["progress"]["bySection"] = {};
      let answered = 0;
      for (const q of visible) {
        const done = q.id in answers && !bad.has(q.id);
        bySection[q.section] ??= { answered: 0, total: 0 };
        bySection[q.section]!.total += 1;
        if (done) {
          answered += 1;
          bySection[q.section]!.answered += 1;
        }
      }
      const exitErrors = result.errors.filter((e) => {
        const q = rules.template.questions.find((x) => x.id === e.question);
        return q && q.section !== "A";
      });
      return {
        errors: exitErrors.filter((e) => e.code !== "missing").map((e) => e.message),
        incomplete: exitErrors.filter((e) => e.code === "missing").map((e) => e.message),
        conflicts: result.conflicts.map((c) => ({ code: c.code, questions: c.questions, message: c.message })),
        ignored: [...result.ignored],
        progress: {
          total: visible.length,
          answered,
          percent: visible.length ? Math.floor((answered / visible.length) * 100) : 100,
          bySection,
        },
      };
    },
  };
}

/** The form to show, for a kind and a version (the newest unless named). */
export function getTemplate(kind: FormKind, version?: string) {
  const kit = kitFor(kind, version);
  return { kind, version: kit.version, form: kit.form };
}

// ---- Loading ----

const countryOf = (code: string): string => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

interface Found {
  row: AssessmentRow;
  enrollment: EnrollmentRow;
  cohort: CohortRow;
  access: Access;
}

async function findAssessment(tx: Executor, principal: Principal, id: string, options: { lock?: boolean } = {}): Promise<Found> {
  const [found] = await tx
    .select({ row: schema.tradeAssessment, enrollment: schema.enrollment, cohort: schema.cohort })
    .from(schema.tradeAssessment)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.tradeAssessment.enrollmentId))
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .where(eq(schema.tradeAssessment.id, id));
  const access = found ? await accessTo(tx, principal, found.enrollment.organizationId) : null;
  if (!found || !access || !(ASSESSMENT_FORM_KINDS as readonly string[]).includes(found.row.kind)) {
    throw new ServiceError("not_found", "Assessment not found.");
  }
  if (!options.lock) return { ...found, access };
  // Locked, so two saves of the same draft run one after another.
  const [locked] = await tx.select().from(schema.tradeAssessment).where(eq(schema.tradeAssessment.id, id)).for("update");
  return { ...found, row: locked ?? found.row, access };
}

async function rowsOf(tx: Executor, assessmentId: string): Promise<ResponseRow[]> {
  const rows = await tx.select().from(schema.assessmentResponse).where(eq(schema.assessmentResponse.assessmentId, assessmentId));
  return rows.map((r) => ({ ...r, answer: unwrapAnswer(r.answer) }));
}

// ---- The avenue ----

export async function pathwayView(tx: Executor, enrollmentId: string) {
  const [live] = await tx
    .select()
    .from(schema.pathwayAssignment)
    .where(and(eq(schema.pathwayAssignment.enrollmentId, enrollmentId), inArray(schema.pathwayAssignment.status, ["provisional", "confirmed"])))
    .limit(1);
  if (!live) return null;
  const rules = findTradeRules(live.rulesVersion);
  const texts = new Map((rules?.reasonCodes ?? []).map((c) => [c.code as string, c.text]));
  return {
    pathway: live.pathway,
    name: PATHWAY_NAMES[live.pathway],
    status: live.status === "provisional" ? ("provisional" as const) : ("confirmed" as const),
    liveOrder: live.liveOrder,
    reasons: live.reasonCodes.map((code) => texts.get(code)).filter((t): t is string => !!t),
    decidedByStaff: live.decidedByUserId !== null,
    decisionReason: live.decisionReason,
    rulesVersion: live.rulesVersion,
    since: live.createdAt.toISOString(),
  };
}

// ---- Views ----

async function buildView(tx: Executor, found: Found, now: Date): Promise<AssessmentView> {
  const { row, enrollment, cohort, access } = found;
  const kit = kitFor(row.kind as FormKind, row.templateVersion);
  const rows = await rowsOf(tx, row.id);
  const check = kit.check(rows, todayOf(now));
  const answers: Record<string, unknown> = {};
  const documents: Record<string, boolean> = {};
  const approvals: Record<string, boolean> = {};
  for (const r of rows) {
    if (hasAnswer(r)) answers[r.questionId] = kit.decode(r);
    if (r.documentsAvailable) documents[r.questionId] = true;
    if (r.unscored === "not_applicable") approvals[r.questionId] = r.approvedAt !== null;
  }
  let assessor: { userId: string; name: string } | null = null;
  if (row.assessedByUserId) {
    const [u] = await tx.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, row.assessedByUserId));
    assessor = { userId: row.assessedByUserId, name: u?.name ?? "Entrust staff" };
  }
  const pending = Object.entries(approvals).filter(([, approved]) => !approved).map(([id]) => id);
  return {
    id: row.id,
    kind: row.kind as FormKind,
    status: row.status,
    templateVersion: row.templateVersion,
    enrollmentId: row.enrollmentId,
    organizationId: enrollment.organizationId,
    canEdit: access.write && row.status === "draft",
    filledInByStaff: assessor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.status === "draft" ? null : (row.assessedAt?.toISOString() ?? null),
    variables: { country: countryOf(cohort.country) },
    answers,
    documents,
    notApplicableApproved: approvals,
    progress: check.progress,
    errors: check.errors,
    incomplete: check.incomplete,
    conflicts: check.conflicts.map((c) => ({ ...c, questions: [...c.questions] })),
    reviewReasons: row.status === "draft" ? [] : [...check.conflicts.map((c) => c.message), ...pending.map((id) => `${id}: "does not apply" waits for staff to approve it`)],
    pathway: row.kind === "diagnostic" && row.status !== "draft" ? await pathwayView(tx, row.enrollmentId) : null,
  };
}

export async function getAssessment(ctx: Ctx, id: string): Promise<AssessmentView> {
  return buildView(ctx.db, await findAssessment(ctx.db, ctx.principal, id), ctx.now);
}

export interface ListInput {
  organizationId?: string | undefined;
  kind?: FormKind | undefined;
}

/** The assessments the caller can see, newest first: their organisations' (or, for staff, everyone's). */
export async function listAssessments(ctx: Ctx, input: ListInput) {
  const { principal } = ctx;
  let organizations = principal.staffRole ? (input.organizationId ? [input.organizationId] : null) : [...principal.smeRoles.keys()].filter((o) => !input.organizationId || o === input.organizationId);
  // A facilitator or reviewer sees the businesses in their own cohorts.
  if (limitedToAssignedCohorts(principal)) {
    const assigned = await assignedOrganizationIds(ctx.db, principal.userId);
    organizations = organizations ? organizations.filter((o) => assigned.includes(o)) : assigned;
  }
  if (organizations && organizations.length === 0) return [];
  if (!principal.staffRole && organizations) {
    const allowed: string[] = [];
    for (const org of organizations) if (await hasTradeAccess(ctx.db, org)) allowed.push(org);
    if (allowed.length === 0) return [];
    organizations.splice(0, organizations.length, ...allowed);
  }
  const rows = await ctx.db
    .select({ row: schema.tradeAssessment, organizationId: schema.enrollment.organizationId, organization: schema.organization.name, cohort: schema.cohort.name })
    .from(schema.tradeAssessment)
    .innerJoin(schema.enrollment, eq(schema.enrollment.id, schema.tradeAssessment.enrollmentId))
    .innerJoin(schema.cohort, eq(schema.cohort.id, schema.enrollment.cohortId))
    .innerJoin(schema.organization, eq(schema.organization.id, schema.enrollment.organizationId))
    .where(
      and(
        inArray(schema.tradeAssessment.kind, input.kind ? [input.kind] : [...ASSESSMENT_FORM_KINDS]),
        organizations ? inArray(schema.enrollment.organizationId, organizations) : undefined,
      ),
    )
    .orderBy(desc(schema.tradeAssessment.createdAt))
    .limit(200);
  const diagnostics = rows.filter((r) => r.row.kind === "diagnostic" && r.row.status !== "draft" && r.row.status !== "superseded");
  const pathways = new Map<string, Awaited<ReturnType<typeof pathwayView>>>();
  for (const d of diagnostics) if (!pathways.has(d.row.enrollmentId)) pathways.set(d.row.enrollmentId, await pathwayView(ctx.db, d.row.enrollmentId));
  return rows.map(({ row, organizationId, organization, cohort }) => ({
    id: row.id,
    kind: row.kind as FormKind,
    status: row.status,
    templateVersion: row.templateVersion,
    enrollmentId: row.enrollmentId,
    organizationId,
    organizationName: organization,
    cohortName: cohort,
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.status === "draft" ? null : (row.assessedAt?.toISOString() ?? null),
    pathway: pathways.get(row.enrollmentId)?.pathway ?? null,
    pathwayStatus: pathways.get(row.enrollmentId)?.status ?? null,
  }));
}

// ---- Starting ----

export interface StartInput {
  kind: FormKind;
  enrollmentId?: string | undefined;
  organizationId?: string | undefined;
  /** A new assessment after a submitted one. The old one becomes superseded and keeps its answers. */
  retake?: boolean | undefined;
}

const LIVE_ENROLLMENT = ["invited", "registered", "active"] as const;

async function enrollmentFor(tx: Executor, ctx: Ctx, input: StartInput): Promise<{ enrollment: EnrollmentRow; access: Access }> {
  const { principal } = ctx;
  if (input.enrollmentId) {
    const [enrollment] = await tx.select().from(schema.enrollment).where(eq(schema.enrollment.id, input.enrollmentId));
    const access = enrollment ? await accessTo(tx, principal, enrollment.organizationId) : null;
    if (!enrollment || !access) throw new ServiceError("not_found", "Enrolment not found.");
    return { enrollment, access };
  }
  const organizationId = input.organizationId ?? (principal.smeRoles.size === 1 ? [...principal.smeRoles.keys()][0] : undefined);
  if (!organizationId) throw new ServiceError("invalid", "Say which organisation (`organizationId`) or enrolment (`enrollmentId`) this is for.");
  const access = await accessTo(tx, principal, organizationId);
  if (!access) throw new ServiceError("not_found", "Organisation not found.");
  const enrollments = await tx
    .select()
    .from(schema.enrollment)
    .where(and(eq(schema.enrollment.organizationId, organizationId), inArray(schema.enrollment.status, [...LIVE_ENROLLMENT])))
    .orderBy(desc(schema.enrollment.enrolledAt));
  if (enrollments.length === 0) throw new ServiceError("precondition_failed", "This organisation isn't enrolled in a TRADE cohort yet.");
  if (enrollments.length > 1) throw new ServiceError("invalid", "This organisation has more than one enrolment. Say which one (`enrollmentId`).");
  return { enrollment: enrollments[0]!, access };
}

/**
 * Starts the assessment of a kind for an enrolment, or returns the one already there: a draft to resume, or the
 * submitted one. A retake needs `retake: true` and a submitted assessment to replace. When staff start it, they
 * are recorded as the assessor.
 */
export async function startAssessment(ctx: Ctx, input: StartInput): Promise<AssessmentView> {
  const { principal } = ctx;
  return ctx.db.transaction(async (tx) => {
    const { enrollment, access } = await enrollmentFor(tx, ctx, input);
    requireWrite(access, "start an assessment");
    const [cohort] = await tx.select().from(schema.cohort).where(eq(schema.cohort.id, enrollment.cohortId));
    if (!cohort) throw new Error("The enrolment has no cohort");

    const live = async () =>
      (
        await tx
          .select()
          .from(schema.tradeAssessment)
          .where(and(eq(schema.tradeAssessment.enrollmentId, enrollment.id), eq(schema.tradeAssessment.kind, input.kind)))
          .orderBy(desc(schema.tradeAssessment.createdAt))
      ).find((a) => a.status !== "superseded");
    const existing = await live();
    if (existing && !(input.retake && existing.status !== "draft")) {
      if (input.retake) throw new ServiceError("invalid_transition", "There is already a draft. Finish it instead of starting a retake.");
      return buildView(tx, { row: existing, enrollment, cohort, access }, ctx.now);
    }
    if (input.retake && !existing) throw new ServiceError("invalid_transition", "There is nothing to retake yet.");

    // The old one gives way first: only one assessment of a kind is live for an enrolment.
    if (existing) await tx.update(schema.tradeAssessment).set({ status: "superseded", supersededAt: ctx.now }).where(eq(schema.tradeAssessment.id, existing.id));

    const kit = kitFor(input.kind);
    const [row] = await tx
      .insert(schema.tradeAssessment)
      .values({
        enrollmentId: enrollment.id,
        kind: input.kind,
        templateVersion: kit.version,
        assessedByUserId: access.staff ? principal.userId : null,
      })
      .returning();
    if (!row) throw new Error("The assessment was not created");
    if (existing) await tx.update(schema.tradeAssessment).set({ supersededById: row.id }).where(eq(schema.tradeAssessment.id, existing.id));
    // Section 1 is the business's registry entry, so a new diagnostic opens with what the registry holds.
    if (input.kind === "diagnostic") await savePrefill(tx, row.id, enrollment.organizationId, kit.version, todayOf(ctx.now));

    await recordTradeChange(tx, principal.userId, {
      action: existing ? "trade.assessment.retake" : "trade.assessment.started",
      organizationId: enrollment.organizationId,
      entityId: row.id,
      after: { kind: input.kind, templateVersion: kit.version, enrollmentId: enrollment.id, byStaff: access.staff },
    });
    return buildView(tx, { row, enrollment, cohort, access }, ctx.now);
  });
}

// ---- Answering ----

export interface SaveInput {
  /** A value sets an answer and null clears it. Answers not named stay. */
  answers?: Readonly<Record<string, unknown>> | undefined;
  /** For questions that ask whether documents are available. */
  documents?: Readonly<Record<string, boolean>> | undefined;
}

/**
 * Saves answers as the person goes, so they can leave and resume. An answer that isn't valid for its question is
 * refused; a question left unanswered is not, since that only blocks the submit.
 */
export async function saveResponses(ctx: Ctx, id: string, input: SaveInput): Promise<AssessmentView> {
  return ctx.db.transaction(async (tx) => {
    const found = await findAssessment(tx, ctx.principal, id, { lock: true });
    requireWrite(found.access, "answer this assessment");
    const { row } = found;
    if (row.status !== "draft") {
      throw new ServiceError("invalid_transition", "A submitted assessment can't be changed. Start a retake to answer again.");
    }
    const kit = kitFor(row.kind as FormKind, row.templateVersion);
    const evidenceQuestions = new Set(kit.form.questions.filter((q) => q.evidenceBased).map((q) => q.id));

    const next = new Map<string, ResponseRow>((await rowsOf(tx, id)).map((r) => [r.questionId, r]));
    const removed: string[] = [];
    const changed = new Set<string>();
    for (const [questionId, wire] of Object.entries(input.answers ?? {})) {
      if (wire === null) {
        next.delete(questionId);
        removed.push(questionId);
        continue;
      }
      const stored = kit.encode(questionId, wire);
      const before = next.get(questionId);
      next.set(questionId, {
        id: before?.id ?? "",
        assessmentId: id,
        questionId,
        answer: stored.answer,
        unscored: stored.unscored,
        unscoredReason: stored.reason,
        approvedByUserId: null,
        approvedAt: null,
        documentsAvailable: before?.documentsAvailable ?? false,
        createdAt: before?.createdAt ?? ctx.now,
      });
      changed.add(questionId);
    }
    for (const [questionId, available] of Object.entries(input.documents ?? {})) {
      if (!evidenceQuestions.has(questionId)) throw new ServiceError("invalid", `${questionId}: this question doesn't ask about documents`);
      const before = next.get(questionId);
      next.set(
        questionId,
        before
          ? { ...before, documentsAvailable: available }
          : { id: "", assessmentId: id, questionId, answer: null, unscored: null, unscoredReason: null, approvedByUserId: null, approvedAt: null, documentsAvailable: available, createdAt: ctx.now },
      );
      changed.add(questionId);
    }

    const check = kit.check([...next.values()], todayOf(ctx.now));
    if (check.errors.length) throw new ServiceError("invalid", problemsText(check.errors));

    if (removed.length) {
      await tx.delete(schema.assessmentResponse).where(and(eq(schema.assessmentResponse.assessmentId, id), inArray(schema.assessmentResponse.questionId, removed)));
    }
    for (const questionId of changed) {
      const r = next.get(questionId)!;
      await tx
        .insert(schema.assessmentResponse)
        .values({
          assessmentId: id,
          questionId,
          answer: wrapAnswer(r.answer),
          unscored: r.unscored,
          unscoredReason: r.unscoredReason,
          documentsAvailable: r.documentsAvailable,
        })
        .onConflictDoUpdate({
          target: [schema.assessmentResponse.assessmentId, schema.assessmentResponse.questionId],
          set: { answer: wrapAnswer(r.answer), unscored: r.unscored, unscoredReason: r.unscoredReason, documentsAvailable: r.documentsAvailable, approvedByUserId: null, approvedAt: null },
        });
    }
    // Keeps updatedAt moving, and records staff who fill it in on the SME's behalf as the assessor.
    const [saved] = await tx
      .update(schema.tradeAssessment)
      .set(found.access.staff ? { assessedByUserId: ctx.principal.userId } : { status: "draft" })
      .where(eq(schema.tradeAssessment.id, id))
      .returning();
    return buildView(tx, { ...found, row: saved ?? row }, ctx.now);
  });
}

// ---- Submitting ----

/**
 * Submits the assessment: every visible question answered and nothing invalid, then the answers are locked. The
 * placement assessment goes to staff review when its answers disagree or a "does not apply" waits for approval. The
 * diagnostic assigns the avenue (A or B) with the rules, and records the declaration's consents.
 */
export async function submitAssessment(ctx: Ctx, id: string): Promise<AssessmentView> {
  const told: { kind: string; status: string; organizationId: string; enrollmentId: string }[] = [];
  const view = await ctx.db.transaction(async (tx) => {
    const found = await findAssessment(tx, ctx.principal, id, { lock: true });
    requireWrite(found.access, "submit this assessment");
    const { row, enrollment } = found;
    if (row.status !== "draft") throw new ServiceError("invalid_transition", "This assessment has already been submitted.");

    const kit = kitFor(row.kind as FormKind, row.templateVersion);
    const rows = await rowsOf(tx, id);
    const check = kit.check(rows, todayOf(ctx.now));
    if (check.errors.length || check.incomplete.length) {
      throw new ServiceError("precondition_failed", `The assessment isn't complete: ${problemsText([...check.errors, ...check.incomplete])}`);
    }

    // The avenue comes first: the diagnostic decides it, and the placement assessment's plan is built on it.
    if (row.kind === "diagnostic") await assignDiagnosticPathway(tx, ctx, found, rows);
    else await requireAvenue(tx, enrollment.id);

    const [submitted] = await tx
      .update(schema.tradeAssessment)
      .set({ status: "submitted", assessedAt: ctx.now, ...(found.access.staff ? { assessedByUserId: ctx.principal.userId } : {}) })
      .where(eq(schema.tradeAssessment.id, id))
      .returning();
    let saved = submitted ?? row;
    // The placement assessment is scored on submit: it becomes scored, or review_required when staff have something to look at.
    if (row.kind === "placement") saved = { ...saved, status: await scorePlacement(tx, ctx, row, enrollment.organizationId, "submitted") };
    else if (row.kind === "exit") saved = { ...saved, status: await scoreExit(tx, ctx, row, enrollment.organizationId) };
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.assessment.submitted",
      organizationId: enrollment.organizationId,
      entityId: id,
      after: { kind: row.kind, status: saved.status, templateVersion: row.templateVersion, byStaff: found.access.staff },
    });
    told.push({ kind: row.kind, status: saved.status, organizationId: enrollment.organizationId, enrollmentId: enrollment.id });
    return buildView(tx, { ...found, row: saved }, ctx.now);
  });
  // Said after the work commits, so nobody is told about something that rolled back.
  for (const t of told) {
    const members = await organizationMemberIds(ctx.db, t.organizationId);
    if (t.kind === "diagnostic") {
      await notify(ctx.db, { userIds: members, kind: "diagnostic_completed", title: "Your diagnostic is complete", body: "Thank you. Your answers are saved and your pathway has been set. Your placement assessment is next.", path: "/", organizationId: t.organizationId });
    } else if (t.kind === "placement") {
      if (t.status === "review_required") {
        await notify(ctx.db, { userIds: await staffForEnrollment(ctx.db, t.enrollmentId), kind: "admin_alert", title: "A learning plan needs review", body: "A business finished its placement assessment and its plan needs a staff look before it starts.", path: "/cohorts", organizationId: t.organizationId });
      } else {
        await notify(ctx.db, { userIds: members, kind: "module_assigned", title: "Your learning plan is ready", body: "Your placement assessment is scored and your modules are assigned. Open your plan to see where to start.", path: "/", organizationId: t.organizationId });
      }
    }
  }
  return view;
}

async function assignDiagnosticPathway(tx: Executor, ctx: Ctx, found: Found, rows: readonly ResponseRow[]): Promise<void> {
  const { row, enrollment } = found;
  const template = findDiagnosticTemplate(row.templateVersion)!;
  const rules = latestTradeRules();
  const answers = Object.fromEntries(rows.filter(hasAnswer).map((r) => [r.questionId, (r.unscored === "not_known" ? NOT_KNOWN : r.answer) as never]));
  const assigned = assignPathwayFromDiagnostic(rules, template, answers, { asOf: todayOf(ctx.now) });

  const [old] = await tx
    .select()
    .from(schema.pathwayAssignment)
    .where(and(eq(schema.pathwayAssignment.enrollmentId, enrollment.id), inArray(schema.pathwayAssignment.status, ["provisional", "confirmed"])));
  if (old) await tx.update(schema.pathwayAssignment).set({ status: "superseded", supersededAt: ctx.now }).where(eq(schema.pathwayAssignment.id, old.id));
  const [created] = await tx
    .insert(schema.pathwayAssignment)
    .values({
      enrollmentId: enrollment.id,
      assessmentId: row.id,
      pathway: assigned.pathway,
      status: assigned.provisional ? "provisional" : "confirmed",
      liveOrder: assigned.liveOrder,
      rulesVersion: assigned.rulesVersion,
      reasonCodes: [...assigned.reasonCodes],
    })
    .returning();
  if (old && created) await tx.update(schema.pathwayAssignment).set({ supersededById: created.id }).where(eq(schema.pathwayAssignment.id, old.id));

  // The consents of section 10: who, when, the wording version, and the declaration's signature.
  const consentSections = new Set(Object.entries(template.storage).filter(([, where]) => where === "consent").map(([section]) => section));
  const text = (id: string): string | null => {
    const value = answers[id] as unknown;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const consents = template.questions.filter((q) => consentSections.has(q.section) && q.type === "yes_no" && typeof answers[q.id] === "string");
  if (consents.length) {
    await tx.insert(schema.assessmentConsent).values(
      consents.map((q) => ({
        assessmentId: row.id,
        questionId: q.id,
        userId: ctx.principal.userId,
        termsVersion: template.version,
        accepted: answers[q.id] === "yes",
        signedName: text(SIGNATURE.name),
        signedPosition: text(SIGNATURE.position),
        signedDate: text(SIGNATURE.date),
      })),
    );
  }
  await recordTradeChange(tx, ctx.principal.userId, {
    action: "trade.pathway.assigned",
    organizationId: enrollment.organizationId,
    entityId: enrollment.id,
    before: old ? { pathway: old.pathway, status: old.status } : null,
    after: { pathway: assigned.pathway, provisional: assigned.provisional, liveOrder: assigned.liveOrder, reasonCodes: assigned.reasonCodes },
  });
  // Section 1 is kept in the SME registry: what the business said about itself is written to its profile, and audited.
  await writeSectionOne(tx, ctx.principal.userId, enrollment.organizationId, row.id, answers);
  // A retaken diagnostic can move the avenue under a placement assessment that is already scored.
  await rescoreLivePlacement(tx, ctx, enrollment.id, enrollment.organizationId, "avenue");
}

// ---- Staff ----

/** Staff approve a "does not apply" answer. Once nothing waits and nothing conflicts, the review ends. */
export async function approveNotApplicable(ctx: Ctx, id: string, questionId: string): Promise<AssessmentView> {
  return ctx.db.transaction(async (tx) => {
    const found = await findAssessment(tx, ctx.principal, id, { lock: true });
    if (!found.access.staff || !found.access.write) throw new ServiceError("forbidden", "Only Entrust staff can approve a \"does not apply\" answer.");
    const { row } = found;
    if (row.status === "draft" || row.status === "superseded") throw new ServiceError("invalid_transition", "Only a submitted assessment can be reviewed.");
    const [response] = await tx
      .select()
      .from(schema.assessmentResponse)
      .where(and(eq(schema.assessmentResponse.assessmentId, id), eq(schema.assessmentResponse.questionId, questionId)));
    if (!response || response.unscored !== "not_applicable") throw new ServiceError("not_found", "That question has no \"does not apply\" answer.");

    await tx
      .update(schema.assessmentResponse)
      .set({ approvedByUserId: ctx.principal.userId, approvedAt: ctx.now })
      .where(eq(schema.assessmentResponse.id, response.id));
    await recordTradeChange(tx, ctx.principal.userId, {
      action: "trade.assessment.notApplicableApproved",
      organizationId: found.enrollment.organizationId,
      entityId: id,
      after: { question: questionId, reason: response.unscoredReason },
    });

    // An approval takes the question out of the denominator, so the placement assessment is scored again and may be ready.
    let current = row;
    if (row.kind === "placement") current = { ...row, status: await scorePlacement(tx, ctx, row, found.enrollment.organizationId, "approval") };
    else if (row.kind === "exit") current = { ...row, status: await scoreExit(tx, ctx, row, found.enrollment.organizationId) };
    return buildView(tx, { ...found, row: current }, ctx.now);
  });
}

/** The avenue the enrolment is on, or null before the diagnostic is submitted. */
export async function getEnrollmentPathway(ctx: Ctx, enrollmentId: string) {
  const [enrollment] = await ctx.db.select().from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId));
  const access = enrollment ? await accessTo(ctx.db, ctx.principal, enrollment.organizationId) : null;
  if (!enrollment || !access) throw new ServiceError("not_found", "Enrolment not found.");
  return { enrollmentId, pathway: await pathwayView(ctx.db, enrollmentId) };
}

/** Staff confirm or change the avenue, with a reason. It adds a row and supersedes the old one; an override is recorded as one. */
export async function setEnrollmentPathway(ctx: Ctx, enrollmentId: string, input: { pathway: Pathway; reason: string }) {
  const { principal } = ctx;
  if (!principal.staffRole || principal.staffRole === "reviewer") {
    throw new ServiceError("forbidden", "Only an Entrust administrator or facilitator can confirm or change an avenue.");
  }
  const reason = input.reason.trim();
  if (!reason) throw new ServiceError("invalid", "Say why.");
  return ctx.db.transaction(async (tx) => {
    const [enrollment] = await tx.select().from(schema.enrollment).where(eq(schema.enrollment.id, enrollmentId)).for("update");
    if (!enrollment || !(await accessTo(tx, principal, enrollment.organizationId))) throw new ServiceError("not_found", "Enrolment not found.");
    const [old] = await tx
      .select()
      .from(schema.pathwayAssignment)
      .where(and(eq(schema.pathwayAssignment.enrollmentId, enrollmentId), inArray(schema.pathwayAssignment.status, ["provisional", "confirmed"])))
      .orderBy(asc(schema.pathwayAssignment.createdAt));
    if (old) await tx.update(schema.pathwayAssignment).set({ status: "superseded", supersededAt: ctx.now }).where(eq(schema.pathwayAssignment.id, old.id));
    const changed = old !== undefined && old.pathway !== input.pathway;
    const [created] = await tx
      .insert(schema.pathwayAssignment)
      .values({
        enrollmentId,
        assessmentId: old?.assessmentId ?? null,
        pathway: input.pathway,
        status: "confirmed",
        liveOrder: old?.liveOrder ?? false,
        rulesVersion: old?.rulesVersion ?? latestTradeRules().version,
        reasonCodes: changed || !old ? ["STAFF_OVERRIDE"] : old.reasonCodes.filter((code) => code !== "PATHWAY_SHIPMENT_UNVERIFIED"),
        decidedByUserId: principal.userId,
        decisionReason: reason,
      })
      .returning();
    if (old && created) await tx.update(schema.pathwayAssignment).set({ supersededById: created.id }).where(eq(schema.pathwayAssignment.id, old.id));
    await recordTradeChange(tx, principal.userId, {
      action: changed || !old ? "trade.pathway.overridden" : "trade.pathway.confirmed",
      organizationId: enrollment.organizationId,
      entityId: enrollmentId,
      before: old ? { pathway: old.pathway, status: old.status } : null,
      after: { pathway: input.pathway, status: "confirmed" },
      reason,
    });
    // Confirming or changing the avenue is what a plan on a provisional avenue waits for, so the plan is made again on it.
    await rescoreLivePlacement(tx, ctx, enrollmentId, enrollment.organizationId, "avenue");
    return { enrollmentId, pathway: await pathwayView(tx, enrollmentId) };
  });
}

