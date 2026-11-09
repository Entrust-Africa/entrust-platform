import Link from "next/link";
import { Card, StatusBadge, type StatusTone } from "@entrust/ui";
import type { PlacementReportData } from "@/lib/types";
import { PrintButton } from "./print-button";

const BAND_TONES: Record<string, StatusTone> = { critical_gap: "danger", developing: "warn", functional: "info", demonstrated: "ok" };
const MODULE_TONES: Record<string, StatusTone> = { priority_required: "danger", required: "info", assessment_needed: "idle", optional: "ok" };
const CONTENT_NOTES: Record<string, string> = { draft: "Content is being checked", in_production: "Content is being prepared" };

const formatDate = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * The placement report (placement spec section 6): baseline, the pathway and why, each domain's score, band, coverage
 * and evidence status, the ordered learning plan with the reason for each module, and the commercial objectives. It only
 * shows what the API sends; the print styles hide the menus so it prints cleanly.
 */
export function PlacementReport({ report, backHref }: { report: PlacementReportData; backHref: string | null }) {
  const { baseline, pathway, domains, plan, objectives } = report;
  const target = objectives.target;
  const hasTarget = target.status || target.product || target.market || target.buyerType;
  return (
    <article className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Placement report</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{baseline.organisation}</h1>
          <p className="mt-1 text-sm text-ink-2">
            SME ID {baseline.smeId} · assessed on {formatDate(baseline.assessedOn)} · assessment {baseline.attempt}
          </p>
        </div>
        <PrintButton />
      </header>

      {report.status === "superseded" && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This report is superseded. A later assessment replaced it. It stays here so you can see where you started.
        </p>
      )}

      <Card className="space-y-3 p-5 sm:p-6 print:break-inside-avoid">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold text-ink">
            Pathway {pathway.id}: {pathway.name}
          </h2>
          {pathway.provisional && <StatusBadge tone="warn">Self-reported</StatusBadge>}
          {pathway.liveOrder && <StatusBadge tone="danger">Live order</StatusBadge>}
        </div>
        {pathway.provisional && (
          <p className="text-sm text-ink-2">This rests on what you told us about your shipment. Entrust may ask to see a record of it.</p>
        )}
        <div>
          <h3 className="text-sm font-semibold text-ink">Why</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-2">
            {pathway.reasons.map((reason) => (
              <li key={reason.code}>{reason.text}</li>
            ))}
          </ul>
        </div>
      </Card>

      <section aria-labelledby="scores" className="space-y-3">
        <h2 id="scores" className="font-display text-lg font-bold text-ink">
          Where your business stands
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {domains.map((domain) => (
            <Card key={domain.id} className="space-y-2 p-4 print:break-inside-avoid">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-ink">{domain.title}</h3>
                {domain.band && domain.bandLabel ? (
                  <StatusBadge tone={BAND_TONES[domain.band] ?? "idle"}>{domain.bandLabel}</StatusBadge>
                ) : (
                  <StatusBadge tone="idle">Not scored yet</StatusBadge>
                )}
              </div>
              {domain.score === null ? (
                <p className="text-sm text-ink-2">Too few of the questions have an answer we can score, so there is no score yet. It is not a zero.</p>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-ink">{Math.round(domain.score)}</span>
                    <span className="text-xs text-ink-3">out of 100</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <div className="h-full rounded-full bg-brand-600 print:bg-black" style={{ width: `${Math.min(100, Math.max(0, domain.score))}%` }} />
                  </div>
                </div>
              )}
              {domain.guidance && <p className="text-xs leading-relaxed text-ink-2">{domain.guidance}</p>}
              <p className="text-xs text-ink-3">
                {domain.answered} of {domain.total} questions answered ({domain.coverage}%) · {domain.evidenceLabel}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="plan" className="space-y-3">
        <h2 id="plan" className="font-display text-lg font-bold text-ink">
          Your learning plan
        </h2>
        {plan.requiresStaffReview && (
          <div role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Entrust will look at this plan before it is final.</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {plan.reviewNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
        <ol className="space-y-3">
          {plan.modules.map((m) => (
            <li key={m.module}>
              <Card className="p-4 print:break-inside-avoid">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-canvas text-xs font-bold text-ink ring-1 ring-line">{m.sequence}</span>
                  <h3 className="text-sm font-semibold text-ink">
                    {m.module}: {m.title}
                  </h3>
                  <StatusBadge tone={MODULE_TONES[m.status] ?? "idle"}>{m.statusLabel}</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-ink-2">
                  <span className="font-semibold text-ink">You will produce:</span> {m.deliverable}
                </p>
                <div className="mt-2">
                  <p className="text-xs font-semibold text-ink">Why it is in your plan</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-2">
                    {m.reasons.map((reason) => (
                      <li key={reason.code}>{reason.text}</li>
                    ))}
                  </ul>
                </div>
                {CONTENT_NOTES[m.contentStatus] && <p className="mt-2 text-[11px] text-ink-3">{CONTENT_NOTES[m.contentStatus]}</p>}
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {(objectives.opportunity || hasTarget) && (
        <Card className="space-y-2 p-5 sm:p-6 print:break-inside-avoid">
          <h2 className="font-display text-lg font-bold text-ink">What you want from exporting</h2>
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {objectives.opportunity && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Where your best export opportunity stands</dt>
                <dd className="text-ink-2">{objectives.opportunity.label}</dd>
              </div>
            )}
            {target.status && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Product and market for your next export</dt>
                <dd className="text-ink-2">{target.status.label}</dd>
              </div>
            )}
            {target.product && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Product</dt>
                <dd className="text-ink-2">{target.product}</dd>
              </div>
            )}
            {target.market && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Market</dt>
                <dd className="text-ink-2">{target.market}</dd>
              </div>
            )}
            {target.buyerType && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">Buyer type</dt>
                <dd className="text-ink-2">{target.buyerType}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      <footer className="space-y-2 text-xs leading-relaxed text-ink-3">
        <p>
          Worked out with the TRADE placement rules, version {report.rulesVersion}. The same answers always give the same report. A score is a guide for planning your learning,
          not a judgement of your business, and it does not guarantee any financing, insurance cover, export approval or contract.
        </p>
        {backHref && (
          <Link href={backHref} className="inline-block text-sm font-semibold text-brand-600 hover:underline print:hidden">
            ← Back
          </Link>
        )}
      </footer>
    </article>
  );
}
