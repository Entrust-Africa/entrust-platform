import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { Card, StatusBadge, cn } from "@entrust/ui";
import { serverApi } from "@/lib/api";
import { countryName, productLabel, readable } from "@/lib/catalogue";
import { CASE_STATUSES, NEXT_ACTIONS, OWNERS, PHASES, ROLES } from "@/lib/statuses";
import { EvidenceList } from "./evidence";
import { Amendments, Contract, Deadlines, Facts, Flags, Requirements } from "./panels";
import { Phases } from "./phases";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Shared by the metadata and the page, so the case is fetched once per request.
const loadCase = cache(async (id: string) => {
  if (!UUID.test(id)) notFound();
  const res = await (await serverApi()).v1.clear.cases[":id"].$get({ param: { id } });
  if (res.status === 401) redirect("/sign-in");
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`The case didn't load (${res.status}).`);
  return res.json();
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadCase(id);
  return { title: detail.reference };
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadCase(id);
  const status = CASE_STATUSES[detail.status];
  const next = detail.nextAction;
  const openFlags = detail.flags.filter((f) => f.status === "open").length;
  const toReview = detail.evidence.filter((e) => e.latest && (e.status === "submitted" || e.status === "under_review")).length;

  return (
    <>
      <Link href="/" className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
        ← Cases
      </Link>

      <Card className="mt-3 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-6">
          <div className="min-w-0">
            <p className="font-mono text-xs text-ink-3">
              {detail.reference} · {detail.organizationName}
              {detail.version > 1 && ` · version ${detail.version}`}
            </p>
            <h1 className="mt-1 font-display text-xl font-bold sm:text-2xl">
              {productLabel(detail.product)} → {countryName(detail.destinationCountry)}
            </h1>
            <p className="mt-1 text-sm text-ink-2">Your role: {ROLES[detail.yourRole]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {openFlags > 0 && <StatusBadge tone="danger">{openFlags === 1 ? "1 open flag" : `${openFlags} open flags`}</StatusBadge>}
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
        </div>
        <ol className="grid grid-cols-7 gap-1 px-4 sm:px-6" aria-label={`Phase ${detail.currentPhase} of 7`}>
          {PHASES.map((p) => (
            <li
              key={p.n}
              title={`Phase ${p.n}: ${p.title}`}
              className={cn(
                "h-1.5 rounded-full",
                p.n < detail.currentPhase ? "bg-ok" : p.n === detail.currentPhase ? "bg-product" : "bg-line",
              )}
            />
          ))}
        </ol>
        <div className="mt-5 border-t border-line bg-surface-2 px-4 py-3 text-sm sm:px-6">
          {next ? (
            <p>
              <span className="font-semibold">
                Phase {detail.currentPhase} · next: {NEXT_ACTIONS[next.kind]}{" "}
                <a href={`#${next.stepId}`} className="font-mono text-brand-600 underline underline-offset-2">
                  {next.stepId}
                </a>
              </span>{" "}
              ({OWNERS[next.owner]}). {readable(next.detail)}
            </p>
          ) : (
            <p>
              <span className="font-semibold">Phase {detail.currentPhase}</span> · nothing is waiting.
            </p>
          )}
        </div>
      </Card>

      <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {[
          ["steps", "Steps"],
          ["evidence", toReview ? `Evidence (${toReview} to review)` : "Evidence"],
          ["flags", openFlags ? `Flags (${openFlags})` : "Flags"],
          ["facts", "Facts"],
          ["contract", "Contract"],
          ["deadlines", "Deadlines"],
          ["requirements", "Requirements"],
        ].map(([anchor, label]) => (
          <a key={anchor} href={`#${anchor}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
            {label}
          </a>
        ))}
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-8">
          <Section id="steps" title="Steps">
            <Phases detail={detail} />
          </Section>
          <Section id="evidence" title="Evidence">
            <EvidenceList detail={detail} />
          </Section>
        </div>
        <div className="flex min-w-0 flex-col gap-8">
          <Section id="flags" title="Flags">
            <Flags detail={detail} />
          </Section>
          <Section id="facts" title="Facts">
            <Card className="p-4">
              <Facts detail={detail} />
            </Card>
          </Section>
          <Section id="contract" title="Sales contract">
            <Card className="p-4">
              <Contract detail={detail} />
            </Card>
          </Section>
          <Section id="deadlines" title="Deadlines">
            <Card className="p-4">
              <Deadlines detail={detail} />
            </Card>
          </Section>
          {detail.amendments.length > 0 && (
            <Section id="amendments" title="Amendments">
              <Card className="p-4">
                <Amendments detail={detail} />
              </Card>
            </Section>
          )}
          <Section id="requirements" title="Requirements">
            <Card className="p-4">
              <Requirements detail={detail} />
            </Card>
          </Section>
        </div>
      </div>
    </>
  );
}
