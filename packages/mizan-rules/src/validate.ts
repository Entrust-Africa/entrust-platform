import { AREAS, EVIDENCE_CODES, RATIO_KEYS, type Criterion, type MizanConfig } from "./types";

const VERSION = /^\d+\.\d+\.\d+(-[a-z0-9]+(\.[a-z0-9]+)*)?$/;
const share = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1;
const duplicates = (ids: string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

function checkSuggestion(c: Criterion, err: (msg: string) => void) {
  const s = c.suggestion;
  if (!s) return;
  if (!c.ratio) err(`${c.id}: a rating suggestion needs a ratio`);
  const ratings = s.bands.map((b) => b.rating);
  if (ratings.some((r, i) => i > 0 && r <= ratings[i - 1]!)) err(`${c.id}: suggestion bands must go from the lowest rating up, each once`);
  const limits = s.direction === "higher_is_better" ? s.bands.map((b) => b.atLeast) : s.bands.map((b) => b.atMost);
  if (limits[0] !== null || limits.slice(1).some((l) => l === null)) err(`${c.id}: only the first (lowest) suggestion band has no limit`);
  const set = limits.slice(1) as number[];
  const ordered = s.direction === "higher_is_better" ? set.every((l, i) => i === 0 || l > set[i - 1]!) : set.every((l, i) => i === 0 || l < set[i - 1]!);
  if (!ordered) err(`${c.id}: suggestion limits must ${s.direction === "higher_is_better" ? "rise" : "fall"} as the rating rises`);
}

/** Every problem in these configurations, prefixed with the version it was found in. An empty list means they are valid. */
export function validateMizanConfigs(configs: readonly MizanConfig[]): string[] {
  const errors: string[] = [];
  for (const v of duplicates(configs.map((c) => c.version))) errors.push(`${v}: published twice`);

  for (const cfg of configs) {
    const err = (msg: string) => errors.push(`${cfg.version}: ${msg}`);
    if (!VERSION.test(cfg.version)) err("the version is major.minor.patch, with an optional -label");

    const levelIds = cfg.levels.map((l) => l.level);
    for (const id of duplicates(cfg.pillars.map((p) => p.id))) err(`pillar ${id} appears twice`);
    for (const p of cfg.pillars) {
      if (!AREAS.includes(p.area)) err(`pillar ${p.id} has an unknown area "${p.area}"`);
      if (!cfg.dimensions.some((d) => d.pillar === p.id)) err(`pillar ${p.id} has no dimensions`);
    }

    for (const id of duplicates(cfg.dimensions.map((d) => d.id))) err(`dimension ${id} appears twice`);
    const total = cfg.dimensions.reduce((a, d) => a + d.weight, 0);
    if (Math.abs(total - 100) > 1e-9) err(`dimension weights add up to ${total}, not 100`);
    for (const d of cfg.dimensions) {
      if (!cfg.pillars.some((p) => p.id === d.pillar)) err(`dimension ${d.id} names an unknown pillar ${d.pillar}`);
      if (!(d.weight > 0)) err(`dimension ${d.id} needs a weight above 0`);
      if (!d.criteria.length) err(`dimension ${d.id} has no criteria`);
    }

    const criteria = cfg.dimensions.flatMap((d) => d.criteria.map((c) => ({ c, d })));
    for (const id of duplicates(criteria.map(({ c }) => c.id))) err(`criterion ${id} appears twice`);
    for (const { c, d } of criteria) {
      if (!c.id.startsWith(`${d.id}.`)) err(`criterion ${c.id} sits in dimension ${d.id}`);
      if (!(c.weight > 0)) err(`${c.id}: needs a weight above 0`);
      if (c.anchors.length !== 5 || c.anchors.some((a) => !a.trim())) err(`${c.id}: needs five written anchors, 0 to 4`);
      if (!c.evidence.length) err(`${c.id}: lists no evidence`);
      if (!c.improvement.trim()) err(`${c.id}: has no improvement action`);
      if (c.kind === "quantitative" && !c.ratio) err(`${c.id}: a quantitative criterion needs a ratio`);
      if (c.ratio && !RATIO_KEYS.includes(c.ratio)) err(`${c.id}: unknown ratio "${c.ratio}"`);
      if (c.ratingWhenNegativeEquity !== undefined && !c.ratio) err(`${c.id}: a negative-equity rating needs a ratio`);
      checkSuggestion(c, err);
    }

    if (cfg.evidenceLevels.map((e) => e.code).join() !== EVIDENCE_CODES.join()) err(`evidence levels must be ${EVIDENCE_CODES.join(", ")}, in order`);
    if (cfg.evidenceLevels.some((e, i) => !share(e.value) || (i > 0 && e.value > cfg.evidenceLevels[i - 1]!.value)))
      err("evidence level values run from 1 down to 0");

    for (const id of duplicates(cfg.gates.map((g) => g.id))) err(`gate ${id} appears twice`);
    for (const id of duplicates(cfg.overrides.map((o) => o.id))) err(`override ${id} appears twice`);
    for (const o of cfg.overrides) if (!levelIds.includes(o.capLevel)) err(`override ${o.id} caps at level ${o.capLevel}, which doesn't exist`);

    for (const id of duplicates(levelIds.map(String))) err(`level ${id} appears twice`);
    const levels = [...cfg.levels].sort((a, b) => a.level - b.level);
    if (levels[0]?.minScore !== 0) err("the lowest level must start at a score of 0");
    if (levels.some((l, i) => l.minScore < 0 || l.minScore > 100 || (i > 0 && l.minScore <= levels[i - 1]!.minScore)))
      err("each higher level needs a higher minimum score, between 0 and 100");

    const t = cfg.thresholds;
    if (!share(t.dimensionCoverage) || t.dimensionCoverage === 0) err("dimension coverage is a share above 0, up to 1");
    if (!share(t.pillarFloor)) err("the pillar floor is a share between 0 and 1");
    if (!levelIds.includes(t.pillarFloorCapLevel)) err(`the pillar floor caps at level ${t.pillarFloorCapLevel}, which doesn't exist`);
    if (!Number.isInteger(t.earlyStageMonths) || t.earlyStageMonths < 0) err("early-stage months is a whole number");
    const grades = t.confidenceGrades;
    if (grades.at(-1)?.min !== 0 || grades.some((g, i) => !share(g.min) || (i > 0 && g.min >= grades[i - 1]!.min)))
      err("confidence grades go from the highest minimum down to 0");

    const dx = cfg.diagnostics;
    if (!share(dx.strengthAtLeast) || !share(dx.weaknessBelow) || dx.weaknessBelow > dx.strengthAtLeast)
      err("diagnostics: the weakness share must be at or below the strength share, both between 0 and 1");
    if (dx.keyCriterionActionAtOrBelow < dx.actionAtOrBelow) err("diagnostics: key criteria get actions at least as often as others");
    if (!EVIDENCE_CODES.includes(dx.target.evidence)) err(`diagnostics: unknown target evidence "${dx.target.evidence}"`);
  }
  return errors;
}
