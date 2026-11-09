import { Card, StatusBadge } from "@entrust/ui";

export interface ReadinessArea {
  area: string;
  label: string;
  score: number | null;
  classification: string | null;
  evidenceCoverage: number | null;
  reviewStatus: "not_assessed" | "complete" | "awaiting_staff_review" | "awaiting_ethiolife_review";
}
export interface ReadinessData {
  current: ReadinessArea[];
  earlier: ReadinessArea[] | null;
  note: string;
}

const STATUS: Record<ReadinessArea["reviewStatus"], { label: string; tone: "idle" | "ok" | "warn" | "info" }> = {
  not_assessed: { label: "Not assessed yet", tone: "idle" },
  complete: { label: "Assessed", tone: "ok" },
  awaiting_staff_review: { label: "Waiting for Entrust to review", tone: "warn" },
  awaiting_ethiolife_review: { label: "Waiting for EthioLife's review", tone: "info" },
};

/** The six readiness areas, each on its own. They are never added into one number. */
export function ReadinessProfiles({ data }: { data: ReadinessData }) {
  return (
    <section aria-labelledby="readiness" className="space-y-3">
      <h2 id="readiness" className="font-display text-lg font-bold text-ink">Readiness profiles</h2>
      <p className="max-w-2xl text-sm text-ink-2">{data.note}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.current.map((a) => {
          const before = data.earlier?.find((e) => e.area === a.area)?.score ?? null;
          return (
            <Card key={a.area} className="space-y-2 p-4">
              <p className="text-sm font-semibold text-ink">{a.label}</p>
              <p className="font-display text-2xl font-bold text-ink">{a.score === null ? "Not scored" : `${a.score}%`}</p>
              <div className="flex flex-wrap items-center gap-2">
                {a.classification && <StatusBadge tone="info">{a.classification}</StatusBadge>}
                <StatusBadge tone={STATUS[a.reviewStatus].tone}>{STATUS[a.reviewStatus].label}</StatusBadge>
              </div>
              {a.score !== null && before !== null && <p className="text-xs text-ink-3">At placement: {before}% ({a.score - before >= 0 ? "+" : ""}{Math.round((a.score - before) * 100) / 100} points)</p>}
              {a.evidenceCoverage !== null && <p className="text-xs text-ink-3">Questions answered: {Math.round(a.evidenceCoverage * 100)}%</p>}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
