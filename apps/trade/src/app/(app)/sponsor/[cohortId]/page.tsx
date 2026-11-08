import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Cohort" };

interface CohortDetail {
  id: string;
  name: string;
  program: string;
  country: string;
  disclaimer: string;
  figures: { enrolled: number | null; byStatus: Record<string, number | null>; diagnosticsSubmitted: number | null; pathwayA: number | null; pathwayB: number | null };
  consenting: { organizationId: string; name: string; smeId: string | null; kinds: string[] }[];
}

const KIND_LABELS: Record<string, string> = {
  placement_results: "Placement results",
  learning_progress: "Learning progress",
  financial_worksheets: "Financial worksheets",
  financial_documents: "Financial documents",
  m04_brief: "Transaction finance brief",
  commercial_outcomes: "Orders and export results",
  insurance_profile: "Insurance profile",
};

export default async function SponsorCohortPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { cohortId } = await params;
  const result = await tradeGet<CohortDetail>(`/sponsor/cohorts/${encodeURIComponent(cohortId)}`);
  if (!result.data) notFound();
  const cohort = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/sponsor" className="text-sm font-semibold text-brand-600 hover:underline">
        ← Sponsored cohorts
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{cohort.name}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {cohort.program} · {cohort.country}
        </p>
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg font-bold text-ink">The cohort, without names</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Figure label="Enrolled" value={cohort.figures.enrolled} />
          <Figure label="Diagnostics done" value={cohort.figures.diagnosticsSubmitted} />
          <Figure label="Pathway A" value={cohort.figures.pathwayA} />
          <Figure label="Pathway B" value={cohort.figures.pathwayB} />
        </dl>
      </Card>

      <section aria-labelledby="sharing">
        <h2 id="sharing" className="font-display text-lg font-bold text-ink">
          Businesses that share with you
        </h2>
        <p className="mt-1 text-sm text-ink-2">Only businesses whose owners turned something on appear here, and only for what they turned on.</p>
        {cohort.consenting.length === 0 ? (
          <Card className="mt-4 p-6 text-center text-sm text-ink-2">No business has shared anything with you yet.</Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {cohort.consenting.map((sme) => (
              <li key={sme.organizationId}>
                <Link href={`/sponsor/${cohort.id}/${encodeURIComponent(sme.organizationId)}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500">
                  <Card className="p-4 transition-colors hover:border-brand-500">
                    <p className="font-semibold text-ink">{sme.name}</p>
                    {sme.smeId && <p className="text-xs text-ink-3">{sme.smeId}</p>}
                    <p className="mt-2 text-xs text-ink-2">{sme.kinds.map((k) => KIND_LABELS[k] ?? k).join(" · ")}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs leading-relaxed text-ink-3">{cohort.disclaimer}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-xl font-bold text-ink">{value ?? "Under 5"}</dd>
    </div>
  );
}
