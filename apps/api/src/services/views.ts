import { EVIDENCE_TYPES, FAILURE_RULES } from "@entrust/rules";
import { evidenceStatusOn, type Actor, type CaseEvaluation, type DeadlineClock } from "@entrust/gate-engine";
import type { CaseDetailView, CaseSummaryView } from "../schemas/clear";
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

export function detailOf(
  data: CaseData,
  organizationName: string,
  actor: Actor,
  evaluation: CaseEvaluation,
  clocks: readonly DeadlineClock[],
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
        warnings: s.warnings,
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
