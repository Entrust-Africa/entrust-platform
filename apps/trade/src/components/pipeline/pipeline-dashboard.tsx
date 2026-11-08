"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Coins,
  ExternalLink,
  History,
  MessageSquare,
  Plus,
  Sparkles,
} from "lucide-react";
import { Button, Card, StatusBadge, cn } from "@entrust/ui";
import { StaffNotice } from "@/components/staff-notice";
import { totalsByCurrency } from "@/lib/money";
import { browserApi, errorText, ok } from "@/lib/summit-api";
import type {
  ActivityView,
  CreateOpportunityActivityInput,
  ExportJourneyStageView,
  OpportunityScorecardInput,
  OpportunityView,
} from "@/lib/types";
import { EXPORT_JOURNEY_STAGES, PIPELINE_STAGES } from "@entrust/trade-engine";

interface PipelineDashboardProps {
  initialOpportunities: OpportunityView[];
  initialJourney: ExportJourneyStageView;
  organizationId: string;
  organizationName: string;
  /** A reviewer reads a pipeline and changes nothing. */
  readOnly: boolean;
  /** An administrator or facilitator working in a business's pipeline. What they add is recorded against it. */
  actingAsStaff: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  lead_discovered: "1. Lead discovered",
  contact_established: "2. Contact established",
  initial_pitch_made: "3. Initial pitch made",
  lead_verified: "4. Lead verified",
  needs_assessed: "5. Needs assessed",
  commercial_fit_confirmed: "6. Commercial fit confirmed",
  rfq_received: "7. Request for quote received",
  quote_submitted: "8. Quote submitted",
  samples_requested: "9. Samples requested",
  samples_dispatched: "10. Samples sent",
  sample_approved: "11. Sample approved",
  contract_negotiated: "12. Contract negotiated",
  firm_order_secured: "13. Firm order secured",
  closed_lost: "Closed or lost",
  disqualified: "Disqualified",
};

const VERIFICATION_LABELS: Record<string, { label: string; tone: "idle" | "info" | "warn" | "ok" | "product" }> = {
  unverified: { label: "Unverified", tone: "idle" },
  identity_checked: { label: "Identity checked", tone: "info" },
  commercially_relevant: { label: "Commercially relevant", tone: "warn" },
  qualified_opportunity: { label: "Qualified", tone: "ok" },
};

const ACTIVITY_LABELS: Record<string, string> = {
  email: "Email",
  call: "Call",
  meeting: "Meeting",
  rfq: "Request for quote",
  sample: "Sample",
  follow_up: "Follow-up",
  note: "Note",
};

const BAND_LABELS: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };
const BAND_STYLES: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-amber-100 text-amber-800",
};

/** The M05 deliverable asks for this many verified buyer leads. */
const M05_REQUIRED = 5;

/** "Target Market Selected" read as a sentence: "Target market selected". */
const sentence = (text: string) => text.charAt(0) + text.slice(1).toLowerCase();

export function PipelineDashboard({
  initialOpportunities,
  initialJourney,
  organizationId,
  organizationName,
  readOnly,
  actingAsStaff,
}: PipelineDashboardProps) {
  const [opportunities, setOpportunities] = useState<OpportunityView[]>(initialOpportunities);
  const [journey, setJourney] = useState<ExportJourneyStageView>(initialJourney);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedOppForActivity, setSelectedOppForActivity] = useState<OpportunityView | null>(null);
  const [selectedOppForScorecard, setSelectedOppForScorecard] = useState<OpportunityView | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityView[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Gate refusal alert dialog state
  const [gatingAlert, setGatingAlert] = useState<string | null>(null);

  // Form states
  const [addForm, setAddForm] = useState({
    title: "",
    companyName: "",
    country: "DE",
    buyerName: "",
    website: "",
    sourceLinks: "",
    decisionMakerRole: "",
    estimatedValue: "",
    currency: "USD",
    notes: "",
  });

  const [activityForm, setActivityForm] = useState({
    type: "email" as const,
    summary: "",
    occurredAt: new Date().toISOString().slice(0, 16),
    followUpDate: "",
    evidenceUrl: "",
  });

  const [scorecardForm, setScorecardForm] = useState<OpportunityScorecardInput>({
    productFit: 3,
    purchasingPowerOrVolume: 3,
    paymentTerms: 3,
    accessToDecisionMaker: 3,
    importExperience: 3,
    timeline: 3,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Refresh pipeline data from API
  async function refreshData() {
    try {
      const res = await browserApi().v1.trade.pipeline.$get({
        query: { organizationId },
      });
      if (res.ok) {
        const body = (await res.json()) as { items: OpportunityView[] };
        setOpportunities(body.items);
      }
      const jRes = await browserApi().v1.trade.pipeline.journey.$get({
        query: { organizationId },
      });
      if (jRes.ok) {
        const jBody = (await jRes.json()) as ExportJourneyStageView;
        setJourney(jBody);
      }
    } catch {
      // ignore
    }
  }

  // Handle stage update with strict enforcement check
  async function handleStageChange(opp: OpportunityView, newStage: string) {
    if (opp.activityCount === 0) {
      setGatingAlert(
        `Log a call, email, meeting or request for quote for ${opp.companyName} first. A lead can move to a new stage only after a dated contact is on record.`
      );
      return;
    }

    try {
      const res = await browserApi().v1.trade.pipeline[":id"].stage.$patch({
        param: { id: opp.id },
        json: { stage: newStage as any },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setGatingAlert(err?.error ?? "That stage change was refused.");
        return;
      }

      await refreshData();
    } catch (e) {
      setGatingAlert(errorText(e));
    }
  }

  // Open activity log modal and load history
  async function openActivityModal(opp: OpportunityView) {
    setSelectedOppForActivity(opp);
    setFormError(null);
    setActivityForm({
      type: "email",
      summary: "",
      occurredAt: new Date().toISOString().slice(0, 16),
      followUpDate: "",
      evidenceUrl: "",
    });
    setLoadingActivities(true);
    try {
      const res = await browserApi().v1.trade.pipeline[":id"].activities.$get({
        param: { id: opp.id },
      });
      if (res.ok) {
        const data = (await res.json()) as { items: ActivityView[] };
        setActivityHistory(data.items);
      }
    } finally {
      setLoadingActivities(false);
    }
  }

  // Open scorecard modal
  function openScorecardModal(opp: OpportunityView) {
    setSelectedOppForScorecard(opp);
    setFormError(null);
    if (opp.scorecard) {
      setScorecardForm({
        productFit: opp.scorecard.productFit ?? 3,
        purchasingPowerOrVolume: opp.scorecard.purchasingPowerOrVolume ?? 3,
        paymentTerms: opp.scorecard.paymentTerms ?? 3,
        accessToDecisionMaker: opp.scorecard.accessToDecisionMaker ?? 3,
        importExperience: opp.scorecard.importExperience ?? 3,
        timeline: opp.scorecard.timeline ?? 3,
      });
    } else {
      setScorecardForm({
        productFit: 3,
        purchasingPowerOrVolume: 3,
        paymentTerms: 3,
        accessToDecisionMaker: 3,
        importExperience: 3,
        timeline: 3,
      });
    }
  }

  // Submit Add Opportunity
  async function submitAddOpportunity(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const sourceLinks = addForm.sourceLinks
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      const res = await browserApi().v1.trade.pipeline.$post({
        json: {
          organizationId,
          title: addForm.title,
          companyName: addForm.companyName,
          country: addForm.country,
          buyerName: addForm.buyerName || undefined,
          website: addForm.website || undefined,
          sourceLinks,
          decisionMakerRole: addForm.decisionMakerRole || undefined,
          estimatedValue: addForm.estimatedValue ? Number(addForm.estimatedValue) : undefined,
          currency: addForm.currency,
          notes: addForm.notes || undefined,
        },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to create opportunity");
      }

      setAddModalOpen(false);
      setAddForm({
        title: "",
        companyName: "",
        country: "DE",
        buyerName: "",
        website: "",
        sourceLinks: "",
        decisionMakerRole: "",
        estimatedValue: "",
        currency: "USD",
        notes: "",
      });
      await refreshData();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submit Log Activity
  async function submitLogActivity(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOppForActivity) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await browserApi().v1.trade.pipeline[":id"].activities.$post({
        param: { id: selectedOppForActivity.id },
        json: {
          type: activityForm.type,
          summary: activityForm.summary,
          occurredAt: new Date(activityForm.occurredAt).toISOString(),
          followUpDate: activityForm.followUpDate ? new Date(activityForm.followUpDate).toISOString() : null,
          evidenceUrl: activityForm.evidenceUrl || null,
        },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to log activity");
      }

      setSelectedOppForActivity(null);
      await refreshData();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submit Scorecard
  async function submitScorecard(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOppForScorecard) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await browserApi().v1.trade.pipeline[":id"].scorecard.$post({
        param: { id: selectedOppForScorecard.id },
        json: scorecardForm,
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to evaluate scorecard");
      }

      setSelectedOppForScorecard(null);
      await refreshData();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Cadence helper
  function setCadence(daysAhead: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setActivityForm((prev) => ({
      ...prev,
      followUpDate: d.toISOString().slice(0, 16),
    }));
  }

  // Scorecard score live calculation
  const scorecardTotal =
    Number(scorecardForm.productFit) +
    Number(scorecardForm.purchasingPowerOrVolume) +
    Number(scorecardForm.paymentTerms) +
    Number(scorecardForm.accessToDecisionMaker) +
    Number(scorecardForm.importExperience) +
    Number(scorecardForm.timeline);

  const scorecardBand =
    scorecardTotal >= 23 ? "high" : scorecardTotal >= 15 ? "medium" : "low";

  const hasLeads = opportunities.length > 0;
  const stageNumber = journey.stageNumber;
  const nextStage = EXPORT_JOURNEY_STAGES[stageNumber] ?? null;
  const m05 = journey.m05DeliverableStatus;
  const m05Percent = Math.min(100, Math.round((m05.verifiedCount / M05_REQUIRED) * 100));
  const scoredHigh = opportunities.filter((o) => o.scorecardBand === "high").length;

  return (
    <div className="space-y-6">
      <StaffNotice readOnly={readOnly} actingAsStaff={actingAsStaff} organizationName={organizationName} />

      {/* Where the business is on the export journey */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-brand-50 to-brand-100/40 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Your export journey</p>
          <h2 className="mt-1 font-display text-xl font-bold text-ink sm:text-2xl">{sentence(journey.title)}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            {hasLeads || stageNumber > 2 ? journey.description : "Add the buyers you have found and your pipeline starts here."}
          </p>

          <div className="mt-5">
            <div
              role="progressbar"
              aria-label={`Stage ${stageNumber} of ${EXPORT_JOURNEY_STAGES.length}: ${sentence(journey.title)}`}
              aria-valuemin={1}
              aria-valuemax={EXPORT_JOURNEY_STAGES.length}
              aria-valuenow={stageNumber}
              className="grid grid-cols-10 gap-1"
            >
              {EXPORT_JOURNEY_STAGES.map((stage) => (
                <span key={stage.stageNumber} className={cn("h-2 rounded-full", stage.stageNumber <= stageNumber ? "bg-brand-600" : "bg-brand-600/15")} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-xs text-ink-2">
              <span className="font-semibold text-ink">
                Stage {stageNumber} of {EXPORT_JOURNEY_STAGES.length}
              </span>
              {nextStage && <span>Next: {sentence(nextStage.title)}</span>}
            </div>
          </div>

          <details className="group mt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500 [&::-webkit-details-marker]:hidden">
              See all {EXPORT_JOURNEY_STAGES.length} stages
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ol className="mt-3 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {EXPORT_JOURNEY_STAGES.map((stage) => {
                const done = stage.stageNumber < stageNumber;
                const current = stage.stageNumber === stageNumber;
                return (
                  <li key={stage.stageNumber} aria-current={current ? "step" : undefined} className="flex items-start gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        done ? "bg-brand-600 text-white" : current ? "bg-brand-700 text-white ring-2 ring-brand-700/30 ring-offset-1" : "bg-surface text-ink-3 ring-1 ring-inset ring-line-strong",
                      )}
                    >
                      {done ? <Check className="size-3" /> : stage.stageNumber}
                    </span>
                    <span className={cn("leading-snug", current ? "font-semibold text-ink" : done ? "text-ink-2" : "text-ink-3")}>
                      {sentence(stage.title)}
                      {current && <span className="sr-only"> (you are here)</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
          </details>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-5 py-3 sm:px-6">
          <Link href="/outcomes" className="inline-flex min-h-10 items-center gap-1.5 rounded text-sm font-semibold text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
            <Coins className="size-4" aria-hidden="true" />
            <span>Financing &amp; outcomes</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          {!readOnly && hasLeads && (
            <Button variant="primary" onClick={() => setAddModalOpen(true)} className="flex w-full items-center justify-center gap-1.5 sm:w-auto">
              <Plus className="size-4" aria-hidden="true" />
              Add buyer lead
            </Button>
          )}
        </div>
      </Card>

      {/* Figures: only once there is something to count */}
      {hasLeads && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-ink-3">Buyer leads</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">{opportunities.length}</div>
            <div className="mt-0.5 text-xs text-ink-2">Being tracked</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-ink-3">Verified buyer leads</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">
              {m05.verifiedCount} <span className="text-base font-semibold text-ink-3">of {M05_REQUIRED}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Verified buyer leads toward the M05 requirement"
              aria-valuemin={0}
              aria-valuemax={M05_REQUIRED}
              aria-valuenow={Math.min(m05.verifiedCount, M05_REQUIRED)}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div className={cn("h-full rounded-full", m05.isEligible ? "bg-emerald-600" : "bg-amber-500")} style={{ width: `${m05Percent}%` }} />
            </div>
            <div className="mt-1.5 text-xs text-ink-2">{m05.isEligible ? "M05 requirement met" : `${m05.missingCount} more needed for M05`}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-ink-3">Scored high</div>
            <div className="mt-1 font-display text-2xl font-bold text-ink">{scoredHigh}</div>
            <div className="mt-0.5 text-xs text-ink-2">Scored 23 or more out of 30</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-ink-3">Estimated total value</div>
            <div className="mt-1 break-words font-display text-xl font-bold leading-tight text-ink">{totalsByCurrency(opportunities.map((o) => ({ currency: o.currency, amount: o.estimatedValue }))).map((line) => (
                <div key={line}>{line}</div>
              ))}</div>
            <div className="mt-0.5 text-xs text-ink-2">Across all leads</div>
          </Card>
        </div>
      )}

      {/* The leads */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="font-display font-bold text-ink">Your buyer leads</h2>
            <p className="mt-0.5 text-xs text-ink-2">A lead moves to the next stage only after you log a dated contact or activity.</p>
          </div>
          {hasLeads && (
            <div className="text-xs font-medium text-ink-3">
              {opportunities.length} {opportunities.length === 1 ? "lead" : "leads"}
            </div>
          )}
        </div>

        {!hasLeads ? (
          <div className="px-6 py-12 text-center">
            <Building2 className="mx-auto mb-3 size-12 text-ink-3/40" aria-hidden="true" />
            <h3 className="font-display text-base font-bold text-ink">No buyer leads yet</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
              Add the overseas buyers, importers or distributors you found in your market research. You need {M05_REQUIRED} verified buyer leads to complete M05.
            </p>
            {!readOnly && (
              <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
                Add your first buyer lead
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-line">
            {opportunities.map((opp) => {
              const vMeta = VERIFICATION_LABELS[opp.verificationStatus] ?? { label: "Unverified", tone: "idle" as const };
              return (
                <div key={opp.id} className="p-5 transition-colors hover:bg-canvas/40 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Who the lead is */}
                    <div className="min-w-0 space-y-2 lg:max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-bold leading-tight text-ink">{opp.companyName}</span>
                        <span className="rounded bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-2">{opp.country}</span>
                        <StatusBadge tone={vMeta.tone}>{vMeta.label}</StatusBadge>
                        {opp.scorecardBand && (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", BAND_STYLES[opp.scorecardBand])}>
                            Scored {opp.scorecardTotal} of 30 · {BAND_LABELS[opp.scorecardBand]}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                        <span>Deal: {opp.title}</span>
                        {opp.buyerName && <span>Contact: {opp.buyerName}</span>}
                        {opp.decisionMakerRole && <span>Role: {opp.decisionMakerRole}</span>}
                        {opp.estimatedValue && (
                          <span className="font-semibold text-ink">
                            Estimated: {opp.currency ?? "USD"} {opp.estimatedValue.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {opp.notes && <p className="line-clamp-2 text-sm text-ink-2">{opp.notes}</p>}

                      {opp.sourceLinks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                          <span className="text-xs font-semibold text-ink-3">Sources</span>
                          {opp.sourceLinks.map((link, idx) => (
                            <a
                              key={link}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                            >
                              <ExternalLink className="size-3" aria-hidden="true" />
                              Link {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex items-start gap-2 pt-1 text-xs text-ink-2">
                        <History className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden="true" />
                        {opp.latestActivity ? (
                          <span>
                            <strong>{ACTIVITY_LABELS[opp.latestActivity.type] ?? opp.latestActivity.type}:</strong> {opp.latestActivity.summary} (
                            {new Date(opp.latestActivity.occurredAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })})
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-700">Nothing logged yet. Log a contact to move this lead forward.</span>
                        )}
                      </div>
                    </div>

                    {/* What you can do with it */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:w-64 lg:flex-col lg:items-stretch">
                      <div className="min-w-0 sm:flex-1 lg:flex-none">
                        <label htmlFor={`stage-${opp.id}`} className="mb-1 block text-xs font-semibold text-ink-3">
                          Stage
                        </label>
                        <select
                          id={`stage-${opp.id}`}
                          value={opp.stage}
                          disabled={readOnly}
                          onChange={(e) => handleStageChange(opp, e.target.value)}
                          className={cn(
                            "h-11 w-full rounded-md border px-3 text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-70 sm:h-10 sm:text-sm",
                            opp.activityCount === 0 ? "border-amber-300 bg-amber-50/50 text-amber-900" : "border-line bg-surface text-ink",
                          )}
                        >
                          {PIPELINE_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {STAGE_LABELS[st] ?? st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {!readOnly && (
                        <div className="flex gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openActivityModal(opp)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 text-xs sm:flex-none">
                            <MessageSquare className="size-3.5" aria-hidden="true" />
                            Log activity ({opp.activityCount})
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => openScorecardModal(opp)} className="flex min-h-10 flex-1 items-center justify-center gap-1.5 text-xs sm:flex-none">
                            <Sparkles className="size-3.5" aria-hidden="true" />
                            {opp.scorecard ? "Edit score" : "Score lead"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Stage Gating Refusal Alert Dialog */}
      {gatingAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-2xl border border-line">
            <div className="flex items-center gap-3 text-danger">
              <AlertCircle className="size-6 shrink-0" />
              <h3 className="font-display text-lg font-bold text-ink">Log an activity first</h3>
            </div>
            <p className="mt-3 text-sm text-ink-2 leading-relaxed">{gatingAlert}</p>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setGatingAlert(null)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Opportunity Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/60 p-4">
          <div className="m-auto w-full max-w-lg rounded-xl bg-surface p-5 shadow-2xl border border-line sm:p-6" role="dialog" aria-modal="true" aria-label="Add a buyer lead">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h3 className="font-display text-lg font-bold text-ink">Add a buyer lead</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-md text-xl font-bold text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitAddOpportunity} className="space-y-4 mt-4">
              {formError && (
                <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Company or importer name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Kaffee Welt GmbH"
                  value={addForm.companyName}
                  onChange={(e) => setAddForm({ ...addForm, companyName: e.target.value })}
                  className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Deal title *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 2026 Arabica Contract"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Destination country *</label>
                  <input
                    required
                    type="text"
                    maxLength={2}
                    placeholder="e.g. DE, KE, US"
                    value={addForm.country}
                    onChange={(e) => setAddForm({ ...addForm, country: e.target.value.toUpperCase() })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Contact name</label>
                  <input
                    type="text"
                    placeholder="e.g. Hans Gruber"
                    value={addForm.buyerName}
                    onChange={(e) => setAddForm({ ...addForm, buyerName: e.target.value })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Decision-maker&rsquo;s role</label>
                  <input
                    type="text"
                    placeholder="e.g. Procurement Lead"
                    value={addForm.decisionMakerRole}
                    onChange={(e) => setAddForm({ ...addForm, decisionMakerRole: e.target.value })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Website</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={addForm.website}
                  onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                  className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Where you found them (one link per line)</label>
                <textarea
                  rows={2}
                  placeholder="https://linkedin.com/in/...&#10;https://directory.trade.gov/..."
                  value={addForm.sourceLinks}
                  onChange={(e) => setAddForm({ ...addForm, sourceLinks: e.target.value })}
                  className="w-full rounded-md border border-line bg-surface p-2.5 font-mono text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-ink mb-1">Estimated deal value</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 50000"
                    value={addForm.estimatedValue}
                    onChange={(e) => setAddForm({ ...addForm, estimatedValue: e.target.value })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Currency</label>
                  <select
                    value={addForm.currency}
                    onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-2 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="KES">KES</option>
                    <option value="ETB">ETB</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Notes</label>
                <textarea
                  rows={2}
                  placeholder="How was this lead discovered? Relevant product specifications..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full rounded-md border border-line bg-surface p-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button variant="secondary" type="button" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save lead
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {selectedOppForActivity && (
        <div className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/60 p-4">
          <div className="m-auto w-full max-w-lg rounded-xl bg-surface p-5 shadow-2xl border border-line sm:p-6" role="dialog" aria-modal="true" aria-label="Log an activity">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Log an activity</h3>
                <p className="text-xs text-ink-2 mt-0.5">For {selectedOppForActivity.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOppForActivity(null)}
                aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-md text-xl font-bold text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitLogActivity} className="space-y-4 mt-4">
              {formError && (
                <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Type *</label>
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="email">Email</option>
                    <option value="call">Phone or video call</option>
                    <option value="meeting">In-person meeting</option>
                    <option value="rfq">Request for quote received</option>
                    <option value="sample">Sample sent</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="note">Internal note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Date and time *</label>
                  <input
                    required
                    type="datetime-local"
                    value={activityForm.occurredAt}
                    onChange={(e) => setActivityForm({ ...activityForm, occurredAt: e.target.value })}
                    className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">What happened *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Sent introductory catalogue and quote for 5,000 units FOB Mombasa..."
                  value={activityForm.summary}
                  onChange={(e) => setActivityForm({ ...activityForm, summary: e.target.value })}
                  className="w-full rounded-md border border-line bg-surface p-2.5 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-ink">Follow up on</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCadence(1)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-surface-2"
                    >
                      In 1 day
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadence(4)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-surface-2"
                    >
                      In 4 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadence(8)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-surface-2"
                    >
                      In 8 days
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadence(14)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-surface-2"
                    >
                      In 14 days
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={activityForm.followUpDate}
                  onChange={(e) => setActivityForm({ ...activityForm, followUpDate: e.target.value })}
                  className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Link to evidence (optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={activityForm.evidenceUrl}
                  onChange={(e) => setActivityForm({ ...activityForm, evidenceUrl: e.target.value })}
                  className="w-full h-11 rounded-md border border-line bg-surface px-3 text-base sm:h-9 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Activity History Preview */}
              <div className="pt-2 border-t border-line">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">
                  Earlier activity ({activityHistory.length})
                </div>
                {loadingActivities ? (
                  <p className="text-xs text-ink-3">Loading…</p>
                ) : activityHistory.length === 0 ? (
                  <p className="text-xs text-ink-3 italic">Nothing logged for this lead yet.</p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {activityHistory.map((act) => (
                      <div key={act.id} className="rounded bg-canvas p-2 text-xs">
                        <div className="flex items-center justify-between font-semibold text-ink">
                          <span className="uppercase">{act.type}</span>
                          <span className="text-[11px] text-ink-3 font-normal">
                            {new Date(act.occurredAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-ink-2">{act.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button variant="secondary" type="button" onClick={() => setSelectedOppForActivity(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save activity
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Qualification Scorecard Modal */}
      {selectedOppForScorecard && (
        <div className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/60 p-4">
          <div className="m-auto w-full max-w-lg rounded-xl bg-surface p-5 shadow-2xl border border-line sm:p-6" role="dialog" aria-modal="true" aria-label="Score this lead">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Score this lead</h3>
                <p className="text-xs text-ink-2 mt-0.5">Scoring {selectedOppForScorecard.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOppForScorecard(null)}
                aria-label="Close" className="flex size-10 shrink-0 items-center justify-center rounded-md text-xl font-bold text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitScorecard} className="space-y-4 mt-4">
              {formError && (
                <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}

              {/* Live Score Header */}
              <div className="rounded-lg bg-canvas p-4 border border-line flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                    Total score
                  </div>
                  <div className="font-display text-2xl font-bold text-ink">{scorecardTotal} / 30</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Rating</div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase mt-1",
                      scorecardBand === "high"
                        ? "bg-emerald-100 text-emerald-800"
                        : scorecardBand === "medium"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    )}
                  >
                    {BAND_LABELS[scorecardBand]} fit
                  </span>
                </div>
              </div>

              {/* 6 Criteria Sliders */}
              <div className="space-y-3">
                {[
                  { key: "productFit", label: "Product specifications fit", desc: "Quality and technical standards alignment" },
                  { key: "purchasingPowerOrVolume", label: "Buying power and volume", desc: "Deal volume matches export production capacity" },
                  { key: "paymentTerms", label: "Payment terms", desc: "LC, cash against documents, or credit risk fit" },
                  { key: "accessToDecisionMaker", label: "Access to the decision-maker", desc: "Direct touchpoint with procurement head" },
                  { key: "importExperience", label: "Import experience and compliance", desc: "Clear track record importing from Africa" },
                  { key: "timeline", label: "Buying timeline", desc: "Immediacy and urgency of deal closing" },
                ].map(({ key, label, desc }) => {
                  const val = (scorecardForm as any)[key];
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-ink">{label}</span>
                        <span className="font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded">{val} / 5</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={5}
                        step={1}
                        value={val}
                        onChange={(e) =>
                          setScorecardForm({ ...scorecardForm, [key]: Number(e.target.value) })
                        }
                        className="w-full accent-brand-600 cursor-pointer"
                      />
                      <div className="text-[11px] text-ink-3">{desc}</div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
                <Button variant="secondary" type="button" onClick={() => setSelectedOppForScorecard(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save score
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
