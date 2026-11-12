import { currentMizanConfig } from "@entrust/mizan-rules";
import { Card } from "@entrust/ui";

export const metadata = { title: "Methodology" };

const percent = (share: number) => `${Math.round(share * 100)}%`;

/** The scoring configuration in use, as MIZAN applies it. Read from the configuration itself, so it can't drift from the scoring. */
export default function MethodologyPage() {
  const cfg = currentMizanConfig();
  const t = cfg.thresholds;
  const levels = [...cfg.levels].sort((a, b) => b.level - a.level);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold tracking-wider text-product-600 uppercase">Methodology</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{cfg.methodology}</h1>
        <p className="mt-2 text-sm text-ink-2">
          Configuration <span className="font-mono">{cfg.version}</span>, in use since {cfg.effectiveFrom}. {cfg.status}
        </p>
      </header>

      <Card className="p-6">
        <h2 className="font-display text-lg font-bold text-ink">Readiness levels</h2>
        <ul className="mt-3 divide-y divide-line">
          {levels.map((l) => (
            <li key={l.level} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
              <span className="shrink-0 font-semibold whitespace-nowrap text-ink sm:w-56">
                {l.label} <span className="font-normal text-ink-3">({l.minScore}+)</span>
              </span>
              <span className="text-sm text-ink-2">{l.meaning}</span>
            </li>
          ))}
        </ul>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-2">
          <li>Missing evidence is never scored as poor performance: it is left out of the score, and a dimension needs at least {percent(t.dimensionCoverage)} of its weight evidenced before a level is issued.</li>
          <li>A pillar below {percent(t.pillarFloor)} of its points caps the level at {t.pillarFloorCapLevel}, so strength in one area can't hide a failing one.</li>
          <li>A business trading for less than {t.earlyStageMonths} months gets the diagnostics but no level.</li>
          <li>The Evidence Confidence Grade (A to E) is shown beside the score and never changes it.</li>
        </ul>
      </Card>

      {cfg.pillars.map((p) => {
        const dims = cfg.dimensions.filter((d) => d.pillar === p.id);
        return (
          <section key={p.id} aria-labelledby={`pillar-${p.id}`} className="space-y-3">
            <h2 id={`pillar-${p.id}`} className="font-display text-xl font-bold text-ink">
              {p.id} {p.title} <span className="text-base font-semibold text-ink-3">· {dims.reduce((a, d) => a + d.weight, 0)} points</span>
            </h2>
            {dims.map((d) => (
              <Card key={d.id} className="p-5">
                <h3 className="font-semibold text-ink">
                  {d.id} {d.title} <span className="font-normal text-ink-3">· {d.weight} points</span>
                </h3>
                <div className="mt-3 space-y-2">
                  {d.criteria.map((c) => (
                    <details key={c.id} className="group rounded-md border border-line px-4 py-2.5 open:bg-surface-2">
                      <summary className="cursor-pointer text-sm font-medium text-ink">
                        {c.id} {c.title}
                        <span className="ml-2 text-xs text-ink-3">
                          {c.mandatory ? "mandatory" : "optional"} · weight {c.weight}
                        </span>
                      </summary>
                      <ol start={0} className="mt-3 space-y-1.5 text-sm text-ink-2">
                        {c.anchors.map((a, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="w-4 shrink-0 font-mono font-semibold text-ink">{i}</span>
                            <span>{a}</span>
                          </li>
                        ))}
                      </ol>
                      {c.naWhen && <p className="mt-3 text-xs text-ink-3">Not applicable when: {c.naWhen}</p>}
                      <p className="mt-2 text-xs text-ink-3">Evidence: {c.evidence.join("; ")}</p>
                    </details>
                  ))}
                </div>
              </Card>
            ))}
          </section>
        );
      })}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink">Gates</h2>
          <p className="mt-1 text-sm text-ink-3">Any gate that fails means no level is issued.</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            {cfg.gates.map((g) => (
              <li key={g.id}>
                <span className="font-semibold text-ink">{g.id} {g.title}.</span> {g.description}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-lg font-bold text-ink">Critical risks</h2>
          <p className="mt-1 text-sm text-ink-3">Each caps the level while it is present.</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            {cfg.overrides.map((o) => (
              <li key={o.id}>
                <span className="font-semibold text-ink">{o.id} {o.title}</span> (level {o.capLevel} at most). {o.description}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-lg font-bold text-ink">Not yet validated</h2>
        <p className="mt-1 text-sm text-ink-3">These parts will change as the standard matures. Earlier reports are never restated.</p>
        <ul className="mt-3 space-y-2 text-sm text-ink-2">
          {cfg.provisional.map((f) => (
            <li key={f.register}>
              <span className="font-semibold text-ink">{f.item}</span> <span className="font-mono text-xs text-ink-3">({f.register})</span>: {f.note}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
