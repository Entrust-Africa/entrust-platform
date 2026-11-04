import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Sponsored cohorts" };

interface Cohort {
  id: string;
  name: string;
  program: string;
  country: string;
  startDate: string | null;
  endDate: string | null;
  figures: { enrolled: number; diagnosticsSubmitted: number; pathwayA: number; pathwayB: number };
}

export default async function SponsorHomePage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const result = await tradeGet<{ disclaimer: string; items: Cohort[] }>("/sponsor/cohorts");

  if (!result.data) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for sponsors</h1>
          <p className="mt-3 text-sm text-ink-2">Your account isn't part of a sponsor organisation. Switch to your sponsor organisation using the switcher above.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Sponsored cohorts</h1>
        <p className="mt-1 text-sm text-ink-2">The cohorts your organisation sponsors. The figures below name nobody.</p>
      </div>
      {result.data.items.length === 0 ? (
        <EmptyState title="No cohorts yet" description="When Entrust names your organisation as the sponsor of a cohort, it appears here." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {result.data.items.map((cohort) => (
            <li key={cohort.id}>
              <Link href={`/sponsor/${cohort.id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500">
                <Card className="h-full p-5 transition-colors hover:border-brand-500">
                  <h2 className="font-display text-lg font-bold text-ink">{cohort.name}</h2>
                  <p className="mt-1 text-xs text-ink-3">
                    {cohort.program} · {cohort.country}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <Figure label="Enrolled" value={cohort.figures.enrolled} />
                    <Figure label="Diagnostics done" value={cohort.figures.diagnosticsSubmitted} />
                    <Figure label="Pathway A" value={cohort.figures.pathwayA} />
                    <Figure label="Pathway B" value={cohort.figures.pathwayB} />
                  </dl>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-ink-3">{result.data.disclaimer}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-xl font-bold text-ink">{value}</dd>
    </div>
  );
}
