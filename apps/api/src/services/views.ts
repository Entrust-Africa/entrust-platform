import { EVIDENCE_TYPES, FAILURE_RULES } from "@entrust/rules";
import { evidenceStatusOn, isDone, type Actor, type CaseEvaluation, type DeadlineClock, type MinimumPriceCheck } from "@entrust/gate-engine";
import type { CaseDetailView, CaseSummaryView, ContractView } from "../schemas/clear";
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

/** What the case detail shows besides the engine's workflow: the contract and its price check. */
export interface PriceView {
  contract: ContractView | null;
  minimumPrice: MinimumPriceCheck | null;
}

export function detailOf(
  data: CaseData,
  organizationName: string,
  actor: Actor,
  evaluation: CaseEvaluation,
  clocks: readonly DeadlineClock[],
  price: PriceView,
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
        // While STEP-024 is open, the check says why: no price on file, a price below the floor.
        warnings:
          s.id === "STEP-024" && price.minimumPrice && price.minimumPrice.status !== "met" && !isDone(s.status)
            ? [...s.warnings, price.minimumPrice.message]
            : s.warnings,
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
    contract: price.contract,
    minimumPrice: price.minimumPrice && {
      status: price.minimumPrice.status,
      message: price.minimumPrice.message,
      minimum: price.minimumPrice.minimum && {
        id: price.minimumPrice.minimum.id,
        tableId: price.minimumPrice.minimum.tableId,
        effectiveFrom: price.minimumPrice.minimum.effectiveFrom,
        effectiveTo: price.minimumPrice.minimum.effectiveTo,
        coffeeType: price.minimumPrice.minimum.coffeeType,
        grade: price.minimumPrice.minimum.grade,
        origin: price.minimumPrice.minimum.origin,
        currency: price.minimumPrice.minimum.currency,
        unit: price.minimumPrice.minimum.unit,
        minPrice: price.minimumPrice.minimum.minPrice,
      },
      contractPrice: price.minimumPrice.contractPrice,
    },
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
