import { EVIDENCE_TYPES, FAILURE_RULES, RECONCILIATION_DOCUMENTS } from "@entrust/rules";
import {
  evidenceStatusOn,
  isDocumentRequired,
  isDone,
  type Actor,
  type CaseEvaluation,
  type DeadlineClock,
  type DocumentValues,
  type MinimumPriceCheck,
  type Reconciliation,
  type StepStatus,
} from "@entrust/gate-engine";
import type { CaseDetailView, CaseRulePackView, CaseSummaryView, ContractView, RulePackUpdateView } from "../schemas/clear";
import type { AmendmentRow } from "./amendment-sync";
import { evidenceRecord, latestEvidence, type CaseData } from "./case-data";

const TYPE_NAMES = new Map(EVIDENCE_TYPES.map((t) => [t.id, t.name]));
const RULES = new Map<string, (typeof FAILURE_RULES)[number]>(FAILURE_RULES.map((r) => [r.id, r]));

export function summaryOf(data: CaseData, organizationName: string, evaluation: CaseEvaluation): CaseSummaryView {
  const { row } = data;
  return {
    id: row.id,
    reference: row.reference,
    organizationId: row.organizationId,
    organizationName,
    product: row.product,
    destinationCountry: row.destinationCountry,
    status: row.status,
    currentPhase: row.currentPhase,
    nextAction: evaluation.nextAction,
    openFlags: data.flags.filter((f) => f.status === "open").length,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** What the case detail shows besides the engine's workflow: the contract, the documents, and their checks. */
export interface ChecksView {
  contract: ContractView | null;
  minimumPrice: MinimumPriceCheck | null;
  /** What has been entered from each document, by document id. */
  documents: Readonly<Record<string, DocumentValues>>;
  reconciliation: Reconciliation | null;
  /** The case's amendments, oldest first. */
  amendments: readonly AmendmentRow[];
  rulePack: CaseRulePackView | null;
  rulePackUpdate: RulePackUpdateView | null;
}

export function detailOf(
  data: CaseData,
  organizationName: string,
  actor: Actor,
  evaluation: CaseEvaluation,
  clocks: readonly DeadlineClock[],
  checks: ChecksView,
  now: Date,
): CaseDetailView {
  return {
    ...summaryOf(data, organizationName, evaluation),
    facts: { ...data.row.facts } as CaseDetailView["facts"],
    // "system" never signs in, so a caller's role is always one of the five.
    yourRole: actor as CaseDetailView["yourRole"],
    workflow: {
      steps: evaluation.steps.map((s) => ({
        id: s.id,
        phase: s.phase,
        name: s.definition.name,
        class: s.definition.class,
        milestone: s.definition.milestone === true,
        owner: s.owner,
        applicability: s.applicability,
        status: s.status,
        reason: s.reason,
        derived: s.derived,
        blockedBy: s.blockedBy,
        heldBy: s.heldBy,
        evidence: s.evidence,
        missingEvidence: s.missingEvidence,
        canComplete: s.canComplete,
        // While an automatic check is open, it says why: no price on file, a document that differs.
        warnings: [...s.warnings, ...openCheckMessage(s.id, s.status, checks)],
      })),
      phases: evaluation.phases,
      nextAction: evaluation.nextAction,
      warnings: evaluation.warnings,
    },
    evidence: data.evidence.map((item) => ({
      id: item.id,
      type: item.type,
      typeName: TYPE_NAMES.get(item.type) ?? item.type,
      status: evidenceStatusOn(evidenceRecord(item), now.toISOString()),
      issuedOn: item.issuedOn,
      validUntil: item.validUntil,
      latest: latestEvidence(data.evidence, item.type)?.id === item.id,
      submittedAt: item.submittedAt.toISOString(),
      submittedByUserId: item.submittedByUserId,
      reviewerUserId: item.reviewerUserId,
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      reviewNote: item.reviewNote,
    })),
    deadlines: [...clocks],
    documents: RECONCILIATION_DOCUMENTS.map((d) => ({
      document: d.id,
      name: d.name,
      role: d.role,
      required: isDocumentRequired(d, data.row.facts),
      fields: { ...checks.documents[d.id] },
    })),
    reconciliation: checks.reconciliation,
    version: Math.max(1, ...checks.amendments.map((a) => a.version)),
    amendments: checks.amendments.toReversed().map((a) => ({
      version: a.version,
      reason: a.reason,
      changes: a.changes,
      affectedSteps: a.impact.affected,
      reopenedSteps: a.impact.reopened,
      reverifySteps: a.impact.reverify,
      evidenceSentBack: a.impact.evidence,
      reopenedGates: a.impact.unlocked,
      madeByUserId: a.madeByUserId,
      madeAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      status: a.resolvedAt ? ("complete" as const) : ("pending" as const),
    })),
    contract: checks.contract,
    minimumPrice: checks.minimumPrice && {
      status: checks.minimumPrice.status,
      message: checks.minimumPrice.message,
      minimum: checks.minimumPrice.minimum && {
        id: checks.minimumPrice.minimum.id,
        tableId: checks.minimumPrice.minimum.tableId,
        effectiveFrom: checks.minimumPrice.minimum.effectiveFrom,
        effectiveTo: checks.minimumPrice.minimum.effectiveTo,
        coffeeType: checks.minimumPrice.minimum.coffeeType,
        grade: checks.minimumPrice.minimum.grade,
        origin: checks.minimumPrice.minimum.origin,
        currency: checks.minimumPrice.minimum.currency,
        unit: checks.minimumPrice.minimum.unit,
        minPrice: checks.minimumPrice.minimum.minPrice,
      },
      contractPrice: checks.minimumPrice.contractPrice,
    },
    rulePack: checks.rulePack,
    rulePackUpdate: checks.rulePackUpdate,
    flags: data.flags.toReversed().map((f) => ({
      id: f.id,
      rule: f.rule,
      name: RULES.get(f.rule)?.name ?? f.rule,
      severity: f.severity,
      status: f.status,
      message: f.message,
      blocks: f.blocks,
      raises: [...(RULES.get(f.rule)?.raises ?? [])],
      raisedAt: f.raisedAt.toISOString(),
      waivedAt: f.waivedAt?.toISOString() ?? null,
      waivedByUserId: f.waivedByUserId,
      waiveReason: f.waiveReason,
      resolvedAt: f.resolvedAt?.toISOString() ?? null,
    })),
  };
}

/** What an automatic check found, for the step it belongs to while the step is open. */
function openCheckMessage(stepId: string, status: StepStatus, checks: ChecksView): string[] {
  if (isDone(status)) return [];
  if (stepId === "STEP-024" && checks.minimumPrice && checks.minimumPrice.status !== "met") return [checks.minimumPrice.message];
  if (stepId === "STEP-099" && checks.reconciliation && checks.reconciliation.status !== "clear") return [checks.reconciliation.message];
  return [];
}
