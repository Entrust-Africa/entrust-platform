import { evaluateRequirements, type CaseEvaluation } from "@entrust/gate-engine";
import { RULE_PACKS, compareVersions, findRulePack, latestRulePack, packChanges, type PackRequirement, type RulePack } from "@entrust/rules";
import type {
  CaseRulePackView,
  RulePackDetailView,
  RulePackSummaryView,
  RulePackUpdateView,
} from "../schemas/clear";
import type { CaseRow } from "./case-data";
import { ServiceError } from "./errors";

// Rule packs on cases (#7). A case keeps the pack version it was opened with: publishing a new
// version changes nothing on it until an Entrust admin or facilitator re-evaluates it on purpose
// (reevaluateRulePack in cases.ts).

/** The pack version the case is on, or null when no pack covered it. */
export function pinnedPack(row: CaseRow): RulePack | null {
  if (!row.rulePackId || !row.rulePackVersion) return null;
  const pack = findRulePack(row.rulePackId, row.rulePackVersion);
  // Published versions are never removed (packages/rules/test/rule-packs.test.ts), so this is a bug.
  if (!pack) throw new Error(`Case ${row.reference} is on rule pack ${row.rulePackId}@${row.rulePackVersion}, which isn't published`);
  return pack;
}

/** The pack a case opened now would get: the newest version covering its product and destination. */
export const currentPack = (row: Pick<CaseRow, "product" | "destinationCountry">): RulePack | null =>
  latestRulePack(row.product, row.destinationCountry) ?? null;

const covers = (pack: RulePack, row: Pick<CaseRow, "product" | "destinationCountry">) =>
  pack.corridor.products.includes(row.product) && pack.corridor.destinations.includes(row.destinationCountry);

const isLatest = (pack: RulePack) => !RULE_PACKS.some((p) => p.id === pack.id && compareVersions(p.version, pack.version) > 0);

/** What re-evaluating would move the case to, or null when it is on the newest pack for its corridor. */
export function rulePackUpdate(row: CaseRow): RulePackUpdateView | null {
  const pinned = pinnedPack(row);
  const current = currentPack(row);
  if (pinned?.id === current?.id && pinned?.version === current?.version) return null;
  return { id: current?.id ?? null, version: current?.version ?? null, ...packChanges(pinned ?? undefined, current ?? undefined) };
}

function requirementView(r: PackRequirement) {
  return {
    code: r.code,
    name: r.name,
    description: r.description,
    action: r.action,
    whyItMatters: r.whyItMatters,
    responsible: r.responsible,
    trigger: r.trigger,
    evidence: r.evidence,
    jurisdiction: r.jurisdiction,
    authority: r.authority,
    basis: r.basis,
    appliesWhen: r.appliesWhen?.description ?? null,
    verification: { ...r.verification },
    sources: r.sources.map((s) => ({ ...s })),
    steps: [...r.steps],
  };
}

function summaryView(pack: RulePack): RulePackSummaryView {
  return {
    id: pack.id,
    version: pack.version,
    name: pack.name,
    corridor: { products: [...pack.corridor.products], destinations: [...pack.corridor.destinations] },
    route: pack.route,
    status: pack.status,
    checkedOn: pack.checkedOn,
    changes: pack.changes,
    notes: [...pack.notes],
    latest: isLatest(pack),
  };
}

/** The case's pack with each requirement's status, read from the steps it sits on. */
export function caseRulePackView(row: CaseRow, evaluation: CaseEvaluation): CaseRulePackView | null {
  const pack = pinnedPack(row);
  if (!pack) return null;
  return {
    ...summaryView(pack),
    coversCase: covers(pack, row),
    requirements: evaluateRequirements(pack, row.facts, evaluation).map((r) => ({
      ...requirementView(r.requirement),
      status: r.status,
      reason: r.reason,
      steps: r.steps,
    })),
  };
}

/** Every published version, newest first within each pack. */
export function listRulePacks(): RulePackSummaryView[] {
  return [...RULE_PACKS]
    .sort((a, b) => a.id.localeCompare(b.id) || compareVersions(b.version, a.version))
    .map(summaryView);
}

export function getRulePack(id: string, version: string): RulePackDetailView {
  const pack = findRulePack(id, version);
  if (!pack) throw new ServiceError("not_found", `No rule pack ${id} version ${version}.`);
  return { ...summaryView(pack), requirements: pack.requirements.map(requirementView) };
}
