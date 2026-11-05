import Link from "next/link";
import { Card, EmptyState, StatusBadge } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import type { CatalogueCohort } from "@/lib/catalogue";

export const metadata = { title: "Cohorts" };

const PATH = "/cohorts";

/** What there is to say about a cohort's businesses, from what each entry carries: readiness for the leather cohort, exporting and financing for the agro cohort. */
function figures(cohort: CatalogueCohort): { label: string; value: string }[] {
  const out = [{ label: "Businesses", value: String(cohort.count) }];
  const scores = cohort.smes.map((s) => s.readinessScore).filter((n): n is number => n !== null);
  if (scores.length > 0) {
    out.push({ label: "Average export readiness", value: `${Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10} of 25` });
    out.push({ label: "High readiness", value: String(cohort.smes.filter((s) => s.readinessLevel === "high").length) });
  }
  if (cohort.smes.some((s) => s.exportedBefore !== null)) out.push({ label: "Have exported", value: String(cohort.smes.filter((s) => s.exportedBefore === true).length) });
  if (cohort.smes.some((s) => s.wantsZemenFinancing !== null)) out.push({ label: "Want Zemen financing", value: String(cohort.smes.filter((s) => s.wantsZemenFinancing === true).length) });
  return out;
}

function CohortCard({ cohort }: { cohort: CatalogueCohort }) {
  const previous = cohort.status === "previous";
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Cohort {cohort.number}</p>
          <h3 className="font-display text-lg font-bold text-ink">{cohort.name}</h3>
        </div>
        <StatusBadge tone={previous ? "idle" : "ok"}>{previous ? "Previous" : "Active"}</StatusBadge>
      </div>
      <p className="text-sm text-ink-2">{cohort.description}</p>
      <dl className="grid grid-cols-2 gap-3">
        {figures(cohort).map((f) => (
          <div key={f.label}>
            <dt className="text-xs text-ink-3">{f.label}</dt>
            <dd className="font-display text-xl font-bold tabular-nums text-ink">{f.value}</dd>
          </div>
        ))}
      </dl>
      <Link
        href={`/catalogue?cohort=${cohort.number}`}
        className="mt-auto text-sm font-semibold text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {`See the ${cohort.count === 1 ? "business" : `${cohort.count} businesses`} →`}
      </Link>
    </Card>
  );
}

function CohortGroup({ id, title, cohorts, empty }: { id: string; title: string; cohorts: CatalogueCohort[]; empty: { title: string; description: string } }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="font-display text-lg font-bold text-ink">
        {title} <span className="text-sm font-semibold tabular-nums text-ink-3">{cohorts.length}</span>
      </h2>
      {cohorts.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cohorts.map((c) => (
            <li key={c.number}>
              <CohortCard cohort={c} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function CohortsPage() {
  const me = await requireUser(PATH);
  if (!me.staffRole) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for Entrust staff</h1>
          <p className="mt-3 text-sm text-ink-2">It lists the TRADE cohorts, active and previous, and the businesses in each.</p>
        </Card>
      </div>
    );
  }

  const { cohorts } = await load(PATH, (api) => ok(api.v1.trade.catalogue.$get()));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Program Cohorts</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">The TRADE pilot cohorts, the ones running now and the ones that have finished, and the businesses in each.</p>
      </div>

      <CohortGroup
        id="active"
        title="Active cohorts"
        cohorts={cohorts.filter((c) => c.status === "active")}
        empty={{ title: "No cohorts active", description: "A cohort appears here while its programme is running or about to start." }}
      />
      <CohortGroup
        id="previous"
        title="Previous cohorts"
        cohorts={cohorts.filter((c) => c.status === "previous")}
        empty={{ title: "No previous cohorts yet", description: "A cohort moves here once its programme has finished." }}
      />
    </div>
  );
}
