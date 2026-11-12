import type { Area, MizanConfig } from "@entrust/mizan-rules";
import { formatPercent } from "./format";
import type { ScoreInput, ScoreResult } from "./score";

export const AREA_LABELS: Readonly<Record<Area, string>> = {
  financial: "Financial risk",
  operational: "Operational gap",
  commercial: "Commercial gap",
  governance: "Governance gap",
};

export type Priority = "high" | "medium" | "low";

export interface Action {
  criterionId: string;
  title: string;
  dimensionId: string;
  pillarId: string;
  area: Area;
  finding: string;
  action: string;
  priority: Priority;
  timeline: string;
  /** How progress is measured at reassessment. */
  indicator: string;
}

export interface Diagnostics {
  strengths: string[];
  weaknesses: string[];
  /** High priority first, then in the configuration's order. */
  actions: Action[];
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Strengths, weaknesses and the improvement plan for the report, from the ratings and the score. */
export function buildDiagnostics(cfg: MizanConfig, input: ScoreInput, result: ScoreResult): Diagnostics {
  const dx = cfg.diagnostics;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  for (const d of result.dimensions) {
    if (!d.applicable) continue;
    if (d.insufficient) weaknesses.push(`${d.id} ${d.title}: not enough evidence to assess (coverage ${formatPercent(d.coverage ?? 0)}).`);
    else if (d.pct === null) continue;
    else if (d.pct >= dx.strengthAtLeast) strengths.push(`${d.id} ${d.title}: ${formatPercent(d.pct)} of available points.`);
    else if (d.pct < dx.weaknessBelow) weaknesses.push(`${d.id} ${d.title}: ${formatPercent(d.pct)} of available points.`);
  }

  const target = cfg.evidenceLevels.find((e) => e.code === dx.target.evidence)!;
  const areaOf = new Map(cfg.pillars.map((p) => [p.id, p.area]));
  const actions: (Action & { order: number })[] = [];
  let order = 0;
  for (const d of cfg.dimensions) {
    const key = d.weight >= dx.keyDimensionWeight;
    for (const c of d.criteria) {
      order++;
      const r = input.ratings[c.id]?.rating;
      if (r === undefined || r === "NA") continue;
      let finding: string | null = null;
      if (r === "NE") finding = "No evidence was provided for this criterion.";
      else if (r === "UV") finding = "Evidence was provided but could not be independently verified.";
      else if (r <= dx.actionAtOrBelow || (c.mandatory && key && r <= dx.keyCriterionActionAtOrBelow)) finding = `Rated ${r} of 4: ${c.anchors[r]}`;
      if (!finding) continue;

      const serious = r === "NE" || (typeof r === "number" && r <= dx.actionAtOrBelow);
      const priority: Priority = c.mandatory && key && serious ? "high" : c.mandatory ? "medium" : "low";
      actions.push({
        criterionId: c.id,
        title: c.title,
        dimensionId: d.id,
        pillarId: d.pillar,
        area: areaOf.get(d.pillar)!,
        finding,
        action: r === "NE" || r === "UV" ? `Provide verifiable evidence: ${c.evidence.join("; ")}. ${c.improvement}` : c.improvement,
        priority,
        timeline: dx.timelines[priority],
        indicator: `${c.id} rated ${dx.target.rating} or higher at reassessment, supported by evidence at level ${target.code} (${target.label.toLowerCase()}) or better.`,
        order,
      });
    }
  }
  actions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.order - b.order);
  return { strengths, weaknesses, actions: actions.map(({ order: _order, ...a }) => a) };
}
