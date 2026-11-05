import Link from "next/link";
import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { CatalogueList } from "@/components/catalogue/catalogue-list";

export const metadata = { title: "SME catalogue" };

const PATH = "/catalogue";

export default async function CataloguePage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const me = await requireUser(PATH);
  if (!me.staffRole) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for Entrust staff</h1>
          <p className="mt-3 text-sm text-ink-2">The catalogue lists the businesses in the pilot, by cohort.</p>
        </Card>
      </div>
    );
  }

  const { cohorts } = await load(PATH, (api) => ok(api.v1.trade.catalogue.$get()));
  const { cohort: asked } = await searchParams;
  const current = cohorts.find((c) => String(c.number) === asked) ?? cohorts[0];
  const names = Object.fromEntries(cohorts.map((c) => [c.number, c.name]));
  const total = cohorts.reduce((sum, c) => sum + c.count, 0);
  // A business in two cohorts has an entry in each: count it once, in the earliest cohort it is in.
  const inSeveral = cohorts.flatMap((c) => c.smes).filter((s) => s.alsoInCohorts.length > 0 && s.cohort < Math.min(...s.alsoInCohorts)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">SME catalogue</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          The businesses in the pilot, by cohort: {total} {total === 1 ? "entry" : "entries"}
          {inSeveral > 0 && `, ${inSeveral} ${inSeveral === 1 ? "business" : "businesses"} in more than one cohort`}. Only Entrust staff see this page; a sponsor sees none of it
          unless the business agrees to share it.
        </p>
      </div>

      <nav aria-label="Cohorts" className="flex flex-wrap gap-1">
        {cohorts.map((c) => (
          <Link
            key={c.number}
            href={`/catalogue?cohort=${c.number}`}
            aria-current={c.number === current?.number ? "page" : undefined}
            className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-md px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-brand-500 ${
              c.number === current?.number ? "bg-brand-50 text-brand-900" : "text-ink-2 hover:bg-canvas hover:text-ink"
            }`}
          >
            Cohort {c.number} · {c.name}
            <span className="rounded-full bg-canvas px-2 py-0.5 text-xs tabular-nums text-ink-2">{c.count}</span>
          </Link>
        ))}
      </nav>

      {current && (
        <section aria-label={`Cohort ${current.number}, ${current.name}`} className="space-y-4">
          <p className="text-sm text-ink-2">{current.description}</p>
          {/* Keyed on the cohort so switching tabs starts a fresh search. */}
          <CatalogueList key={current.number} smes={current.smes} cohortNames={names} />
        </section>
      )}
    </div>
  );
}
