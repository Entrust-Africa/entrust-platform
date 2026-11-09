import type { PublicDiagnosticCounts } from "@/lib/types";

const formatDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The avenues side by side: a stacked bar, with the numbers written out so nothing depends on the colours. */
export function AvenueSplit({ a, b, provisional }: { a: number; b: number; provisional: number }) {
  const total = a + b;
  const share = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return (
    <figure className="space-y-3">
      <figcaption className="text-sm font-semibold text-ink">Which avenue they start on</figcaption>
      {total === 0 ? (
        <p className="text-sm text-ink-3">No submitted forms yet.</p>
      ) : (
        <>
          <div role="img" aria-label={`Pathway A ${a} (${share(a)}%), Pathway B ${b} (${share(b)}%)`} className="flex h-4 overflow-hidden rounded-full bg-surface-2">
            <div className="bg-brand-600" style={{ width: `${(a / total) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(b / total) * 100}%` }} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="flex items-center gap-2 text-ink-2">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-brand-600" />
                A: Export readiness
              </dt>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">
                {a} <span className="text-sm font-semibold text-ink-3">{share(a)}%</span>
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-ink-2">
                <span aria-hidden="true" className="size-2.5 rounded-full bg-amber-500" />
                B: Export execution
              </dt>
              <dd className="font-display text-xl font-bold tabular-nums text-ink">
                {b} <span className="text-sm font-semibold text-ink-3">{share(b)}%</span>
              </dd>
            </div>
          </dl>
          {provisional > 0 && <p className="text-xs text-ink-3">{provisional} of the Pathway B forms are self-reported, with no shipment record seen yet.</p>}
        </>
      )}
    </figure>
  );
}

/** Forms started and submitted on each of the last 14 days, as pairs of bars with the numbers under them. */
export function ActivityBars({ perDay }: { perDay: PublicDiagnosticCounts["perDay"] }) {
  const max = Math.max(1, ...perDay.flatMap((d) => [d.started, d.submitted]));
  const startedTotal = perDay.reduce((n, d) => n + d.started, 0);
  const submittedTotal = perDay.reduce((n, d) => n + d.submitted, 0);
  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold text-ink">
        <span>Last 14 days</span>
        <span className="flex items-center gap-3 text-xs font-medium text-ink-2">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-line-strong" />
            Started {startedTotal}
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-sm bg-brand-600" />
            Submitted {submittedTotal}
          </span>
        </span>
      </figcaption>
      <ol className="grid grid-cols-14 items-end gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {perDay.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-1" aria-label={`${formatDay(d.date)}: ${d.started} started, ${d.submitted} submitted`}>
            <div className="flex h-20 w-full items-end justify-center gap-0.5">
              <div className="w-1/2 rounded-t-sm bg-line-strong" style={{ height: `${(d.started / max) * 100}%`, minHeight: d.started ? 2 : 0 }} />
              <div className="w-1/2 rounded-t-sm bg-brand-600" style={{ height: `${(d.submitted / max) * 100}%`, minHeight: d.submitted ? 2 : 0 }} />
            </div>
            <span className="text-[10px] tabular-nums text-ink-3">{new Date(`${d.date}T00:00:00Z`).getUTCDate()}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
