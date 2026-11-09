import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Business" };

interface SmeView {
  sponsor: { id: string; name: string };
  cohort: { id: string; name: string };
  sme: { organizationId: string; name: string; legalName: string | null; smeId: string | null; country: string | null };
  sharedKinds: string[];
  data: Record<string, { available: boolean; pathway?: { name: string; pathway: string; status: string; reasons: string[] } | null; placementAssessment?: { status: string } | null; modules?: { moduleId: string; status: string }[] }>;
  disclaimer: string;
}

const TITLES: Record<string, string> = {
  placement_results: "Placement results",
  learning_progress: "Learning progress",
  financial_worksheets: "Financial worksheets",
  financial_documents: "Financial documents",
  m04_brief: "Transaction finance brief",
  commercial_outcomes: "Orders and export results",
  insurance_profile: "Insurance profile",
};

const words = (value: string) => value.replaceAll("_", " ");

export default async function SponsorSmePage({ params }: { params: Promise<{ cohortId: string; organizationId: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { cohortId, organizationId } = await params;
  const result = await tradeGet<SmeView>(`/sponsor/cohorts/${encodeURIComponent(cohortId)}/smes/${encodeURIComponent(organizationId)}`);
  if (!result.data) notFound();
  const view = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/sponsor/${view.cohort.id}`} className="text-sm font-semibold text-brand-600 hover:underline">
        ← {view.cohort.name}
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{view.sme.name}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {[view.sme.legalName, view.sme.smeId, view.sme.country].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-2 text-xs text-ink-3">You see only what the owner chose to share with {view.sponsor.name}.</p>
      </div>

      {view.sharedKinds.map((kind) => {
        const entry = view.data[kind];
        return (
          <Card key={kind} className="p-5">
            <h2 className="font-display text-lg font-bold text-ink">{TITLES[kind] ?? kind}</h2>
            {!entry?.available ? (
              <p className="mt-2 text-sm text-ink-2">Shared, and not recorded in TRADE yet. It will appear here once it is.</p>
            ) : kind === "placement_results" ? (
              <div className="mt-2 space-y-2 text-sm text-ink-2">
                {entry.pathway ? (
                  <>
                    <p>
                      <span className="font-semibold text-ink">{entry.pathway.name}</span> (Pathway {entry.pathway.pathway}
                      {entry.pathway.status === "provisional" ? ", self-reported" : ""})
                    </p>
                    <ul className="list-disc pl-5">
                      {entry.pathway.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p>The onboarding diagnostic isn't submitted yet.</p>
                )}
                <p>Placement assessment: {entry.placementAssessment ? words(entry.placementAssessment.status) : "not started"}.</p>
              </div>
            ) : kind === "learning_progress" ? (
              entry.modules && entry.modules.length > 0 ? (
                <ul className="mt-2 divide-y divide-line text-sm">
                  {entry.modules.map((m) => (
                    <li key={m.moduleId} className="flex justify-between py-2">
                      <span className="font-semibold text-ink">{m.moduleId}</span>
                      <span className="text-ink-2">{words(m.status)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-2">No module started yet.</p>
              )
            ) : null}
          </Card>
        );
      })}
      <p className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-2">{view.disclaimer}</p>
    </div>
  );
}
