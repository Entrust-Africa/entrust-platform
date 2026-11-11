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
  data: Record<
    string,
    {
      available: boolean;
      pathway?: { name: string; pathway: string; status: string; reasons: string[] } | null;
      placementAssessment?: { status: string } | null;
      modules?: { moduleId: string; status: string }[];
      /** For financial worksheets and the M04 brief: the newest submitted version of each, figures only. */
      worksheets?: SharedWorksheet[];
    }
  >;
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

interface SharedWorksheet {
  worksheetId: string;
  title: string;
  version: number;
  submittedAt: string | null;
  currency: string;
  computed: Record<string, unknown>;
}

const words = (value: string) => value.replaceAll("_", " ");
const label = (key: string) => {
  const text = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const figure = (value: unknown) => (typeof value === "number" ? value.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : String(value ?? "—"));

/** The figures of each shared worksheet, as the business submitted them. */
function Worksheets({ items }: { items: SharedWorksheet[] }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-ink-2">Shared, and nothing submitted yet. The newest submitted version appears here.</p>;
  return (
    <div className="mt-2 space-y-4">
      {items.map((w) => {
        const rows = Object.entries(w.computed).filter(([, v]) => typeof v === "number" || typeof v === "string");
        return (
          <div key={w.worksheetId}>
            <p className="text-sm font-semibold text-ink">
              {w.title} <span className="font-normal text-ink-3">version {w.version}{w.submittedAt ? `, submitted ${new Date(w.submittedAt).toLocaleDateString("en-GB")}` : ""} · {w.currency}</span>
            </p>
            {rows.length === 0 ? (
              <p className="text-sm text-ink-2">No figures were worked out on this version.</p>
            ) : (
              <dl className="mt-1 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {rows.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 border-b border-line/60 py-1">
                    <dt className="text-ink-2">{label(key)}</dt>
                    <dd className="font-semibold tabular-nums text-ink">{figure(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
            ) : kind === "financial_worksheets" || kind === "m04_brief" ? (
              <Worksheets items={entry.worksheets ?? []} />
            ) : (
              <p className="mt-2 text-sm text-ink-2">Shared, and not recorded in TRADE yet. It will appear here once it is.</p>
            )}
          </Card>
        );
      })}
      <p className="rounded-lg border border-line bg-surface p-3 text-xs leading-relaxed text-ink-2">{view.disclaimer}</p>
    </div>
  );
}
