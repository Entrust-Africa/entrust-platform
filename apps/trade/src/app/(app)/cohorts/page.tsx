import Link from "next/link";
import { Card, EmptyState, StatusBadge } from "@entrust/ui";
import { listCohorts, listPrograms, listSponsors } from "@/lib/api";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import type { CatalogueCohort } from "@/lib/catalogue";
import type { TradeCohort } from "@/lib/types";
import { CreateCohortDialog } from "./create-cohort-dialog";

export const metadata = { title: "Cohorts" };

const PATH = "/cohorts";

/** What there is to say about a cohort's businesses, from what each entry carries: readiness for the leather cohort, exporting and financing for the cohorts that applied through a form. */
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

function getDeliveryModeTone(mode: string): "info" | "idle" | "product" {
  switch (mode) {
    case "live":
      return "info";
    case "hybrid":
      return "product";
    default:
      return "idle";
  }
}

function formatDeliveryMode(mode: string): string {
  switch (mode) {
    case "live":
      return "Live Facilitated";
    case "hybrid":
      return "Hybrid";
    default:
      return "Self-paced";
  }
}

function TrainingCohortCard({ cohort }: { cohort: TradeCohort }) {
  return (
    <Card className="flex flex-col justify-between p-5 transition-colors hover:border-brand-500">
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">{cohort.programName}</span>
          <StatusBadge tone={getDeliveryModeTone(cohort.deliveryMode)}>{formatDeliveryMode(cohort.deliveryMode)}</StatusBadge>
        </div>
        <h3 className="mt-2 font-display text-lg font-bold text-ink">{cohort.name}</h3>
        <div className="mt-4 space-y-1.5 text-xs text-ink-2">
          <div className="flex items-center justify-between">
            <span>Region / Language:</span>
            <span className="font-medium uppercase text-ink">
              {cohort.country} • {cohort.language}
            </span>
          </div>
          {cohort.sponsorName && (
            <div className="flex items-center justify-between">
              <span>Sponsor:</span>
              <span className="font-medium text-ink">{cohort.sponsorName}</span>
            </div>
          )}
          {(cohort.startDate || cohort.endDate) && (
            <div className="flex items-center justify-between">
              <span>Timeline:</span>
              <span className="font-medium text-ink">
                {cohort.startDate ? new Date(cohort.startDate).toLocaleDateString() : "TBD"} –{" "}
                {cohort.endDate ? new Date(cohort.endDate).toLocaleDateString() : "TBD"}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-line pt-2">
            <span>Enrolled SMEs:</span>
            <span className="font-semibold text-brand-600">
              {cohort.enrolledCount} {cohort.enrolledCount === 1 ? "company" : "companies"}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-6 border-t border-line pt-3">
        <Link
          href={`/cohorts/${cohort.id}`}
          className="inline-flex w-full items-center justify-center rounded-md bg-canvas py-2 text-xs font-semibold text-ink transition-colors hover:bg-line"
        >
          View Enrolments & Details →
        </Link>
      </div>
    </Card>
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

  const [{ cohorts }, trainingCohorts, programs, orgs] = await Promise.all([
    load(PATH, (api) => ok(api.v1.trade.catalogue.$get())),
    listCohorts(),
    listPrograms(),
    listSponsors(),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Programme cohorts</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">The training cohorts you enrol businesses into, and the pilot cohorts that have already run with the businesses in each.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {me.staffRole === "admin" && (
            <Link href="/admin/sponsors" className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2">
              Sponsor banks
            </Link>
          )}
          <CreateCohortDialog programs={programs} sponsors={orgs} />
        </div>
      </div>

      <section aria-labelledby="training" className="space-y-3">
        <h2 id="training" className="font-display text-lg font-bold text-ink">
          Training cohorts <span className="text-sm font-semibold tabular-nums text-ink-3">{trainingCohorts.length}</span>
        </h2>
        {trainingCohorts.length === 0 ? (
          <EmptyState title="No training cohorts yet" description="Create a cohort under an export readiness programme to begin enrolling businesses." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trainingCohorts.map((c) => (
              <li key={c.id} className="flex">
                <div className="w-full">
                  <TrainingCohortCard cohort={c} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

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
