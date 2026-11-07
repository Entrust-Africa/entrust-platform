"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  ExternalLink,
  Filter,
  Globe2,
  History,
  MessageSquare,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Button, Card, StatusBadge, cn } from "@entrust/ui";
import { browserApi, errorText, ok } from "@/lib/summit-api";
import type {
  ActivityView,
  CreateOpportunityActivityInput,
  ExportJourneyStageView,
  OpportunityScorecardInput,
  OpportunityView,
} from "@/lib/types";
import { PIPELINE_STAGES, VERIFICATION_LADDER_STATUSES } from "@entrust/trade-engine";

interface PipelineDashboardProps {
  initialOpportunities: OpportunityView[];
  initialJourney: ExportJourneyStageView;
  organizationId: string;
}

const STAGE_LABELS: Record<string, string> = {
  lead_discovered: "1. Lead Discovered",
  contact_established: "2. Contact Established",
  initial_pitch_made: "3. Initial Pitch Made",
  lead_verified: "4. Lead Verified",
  needs_assessed: "5. Needs Assessed",
  commercial_fit_confirmed: "6. Commercial Fit Confirmed",
  rfq_received: "7. RFQ Received",
  quote_submitted: "8. Quote Submitted",
  samples_requested: "9. Samples Requested",
  samples_dispatched: "10. Samples Dispatched",
  sample_approved: "11. Sample Approved",
  contract_negotiated: "12. Contract Negotiated",
  firm_order_secured: "13. Firm Order Secured",
  closed_lost: "Closed / Lost",
  disqualified: "Disqualified",
};

const VERIFICATION_LABELS: Record<string, { label: string; tone: "idle" | "info" | "warn" | "ok" | "product" }> = {
  unverified: { label: "Unverified Lead", tone: "idle" },
  identity_checked: { label: "Identity Checked", tone: "info" },
  commercially_relevant: { label: "Commercially Relevant", tone: "warn" },
  qualified_opportunity: { label: "Qualified Opportunity", tone: "ok" },
};

export function PipelineDashboard({
  initialOpportunities,
  initialJourney,
  organizationId,
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
        `Stage transition refused for "${opp.companyName}": A commercial activity (call, email, meeting, RFQ) must be logged before updating the pipeline stage.`
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
        setGatingAlert(err?.error ?? "Stage transition refused.");
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

  return (
    <div className="space-y-6">
      {/* Top Banner: Export Journey Progress */}
      <Card className="p-6 bg-gradient-to-r from-brand-50 to-brand-100/40 border-brand-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-brand-700 px-3 py-1 text-xs font-bold text-white shadow-sm">
                Export Journey Stage {journey.stageNumber} of 10
              </span>
              <h2 className="font-display text-lg font-bold text-ink">{journey.title}</h2>
            </div>
            <p className="mt-1 text-sm text-ink-2 max-w-2xl">{journey.description}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="rounded-lg bg-white/80 p-3 shadow-xs border border-brand-200/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                M05 Verified Buyer Leads
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="font-display text-lg font-bold text-ink">
                  {journey.m05DeliverableStatus.verifiedCount} / 5
                </span>
                {journey.m05DeliverableStatus.isEligible ? (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    <CheckCircle2 className="size-3.5" /> Requirement Met
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    {journey.m05DeliverableStatus.missingCount} more required
                  </span>
                )}
              </div>
            </div>
            <Link
              href="/outcomes"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas transition-colors shadow-xs"
            >
              <Coins className="size-4 text-ink-3" />
              Financing & Outcomes →
            </Link>
            <Button
              variant="primary"
              onClick={() => setAddModalOpen(true)}
              className="flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="size-4" />
              Add Buyer Lead
            </Button>
          </div>
        </div>

        {/* 10-Stage Visual Stepper */}
        <div className="mt-6 pt-4 border-t border-brand-200/60">
          <div className="grid grid-cols-5 md:grid-cols-10 gap-1.5 text-center">
            {[
              "1. Idea & Readiness",
              "2. Market Selection",
              "3. Leads & Outreach",
              "4. Quote & Sampling",
              "5. Sample Evaluation",
              "6. Sample Approved",
              "7. Contract & Order",
              "8. Fulfilment",
              "9. Delivery",
              "10. Proceeds & Scale",
            ].map((label, idx) => {
              const stageNum = idx + 1;
              const isCurrent = stageNum === journey.stageNumber;
              const isPast = stageNum < journey.stageNumber;
              return (
                <div
                  key={label}
                  className={cn(
                    "rounded-md p-2 text-xs transition-all",
                    isCurrent
                      ? "bg-brand-700 text-white font-bold ring-2 ring-brand-700 ring-offset-1 shadow-sm"
                      : isPast
                      ? "bg-brand-200/70 text-brand-900 font-semibold"
                      : "bg-white/60 text-ink-3 font-medium"
                  )}
                >
                  <div className="text-[10px] opacity-80">Stage {stageNum}</div>
                  <div className="truncate mt-0.5" title={label}>
                    {label.split(". ")[1]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Pipeline Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Total Opportunities</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">{opportunities.length}</div>
          <div className="text-xs text-ink-2 mt-0.5">Active buyer contacts</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Verified Leads</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            {opportunities.filter((o) => o.verificationStatus !== "unverified").length}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Passed identity verification</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Qualified Leads</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            {opportunities.filter((o) => o.scorecardBand === "high").length}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Scorecard band High (≥23/30)</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Pipeline Value</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            $
            {opportunities
              .reduce((acc, curr) => acc + (curr.estimatedValue ?? 0), 0)
              .toLocaleString()}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Total estimated volume</div>
        </Card>
      </div>

      {/* Main Opportunities Board / Table */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-ink">Commercial Opportunities</h3>
            <p className="text-xs text-ink-2 mt-0.5">
              Refuse stage transitions on any lead where no dated commercial activity exists.
            </p>
          </div>
          <div className="text-xs text-ink-3 font-medium">
            Showing {opportunities.length} {opportunities.length === 1 ? "lead" : "leads"}
          </div>
        </div>

        {opportunities.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="size-12 mx-auto text-ink-3/40 mb-3" />
            <h4 className="font-display text-base font-bold text-ink">No buyer opportunities recorded yet</h4>
            <p className="text-sm text-ink-2 max-w-md mx-auto mt-1">
              Add overseas buyers, importers, or distributors discovered in your M05 market research.
            </p>
            <Button variant="primary" onClick={() => setAddModalOpen(true)} className="mt-4">
              Add First Lead
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {opportunities.map((opp) => {
              const vMeta = VERIFICATION_LABELS[opp.verificationStatus] ?? { label: "Unverified Lead", tone: "idle" as const };
              return (
                <div key={opp.id} className="p-6 hover:bg-canvas/40 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Left: Lead Identity */}
                    <div className="space-y-2 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-lg font-bold text-ink">{opp.companyName}</span>
                        <span className="rounded bg-canvas-2 px-2 py-0.5 text-xs font-bold text-ink-2">
                          {opp.country}
                        </span>
                        <StatusBadge tone={vMeta.tone}>{vMeta.label}</StatusBadge>
                        {opp.scorecardBand && (
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase",
                              opp.scorecardBand === "high"
                                ? "bg-emerald-100 text-emerald-800"
                                : opp.scorecardBand === "medium"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            )}
                          >
                            Score: {opp.scorecardTotal}/30 ({opp.scorecardBand})
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-ink-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span>Deal: {opp.title}</span>
                        {opp.buyerName && <span>Contact: {opp.buyerName}</span>}
                        {opp.decisionMakerRole && <span>Role: {opp.decisionMakerRole}</span>}
                        {opp.estimatedValue && (
                          <span className="font-semibold text-ink">
                            Est: {opp.currency} {opp.estimatedValue.toLocaleString()}
                          </span>
                        )}
                      </div>

                      {opp.notes && <p className="text-xs text-ink-2 line-clamp-2">{opp.notes}</p>}

                      {/* Source links */}
                      {opp.sourceLinks.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="text-[11px] font-semibold text-ink-3 uppercase">Sources:</span>
                          {opp.sourceLinks.map((link, idx) => (
                            <a
                              key={link}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                            >
                              <ExternalLink className="size-3" />
                              Link {idx + 1}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Latest Activity Snippet */}
                      <div className="pt-2 text-xs flex items-center gap-2 text-ink-2">
                        <History className="size-3.5 text-ink-3 shrink-0" />
                        {opp.latestActivity ? (
                          <span>
                            <strong>{opp.latestActivity.type.toUpperCase()}:</strong> {opp.latestActivity.summary} (
                            {new Date(opp.latestActivity.occurredAt).toLocaleDateString()})
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold">
                            No activities logged yet (stage gating active).
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions & Stage Selector */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-end gap-3 shrink-0">
                      <div className="w-full sm:w-auto">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1">
                          Current Pipeline Stage
                        </label>
                        <select
                          value={opp.stage}
                          onChange={(e) => handleStageChange(opp, e.target.value)}
                          className={cn(
                            "h-9 rounded-md border text-xs font-semibold px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500",
                            opp.activityCount === 0
                              ? "border-amber-300 bg-amber-50/50 text-amber-900"
                              : "border-border bg-white text-ink"
                          )}
                        >
                          {PIPELINE_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {STAGE_LABELS[st] ?? st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openActivityModal(opp)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <MessageSquare className="size-3.5" />
                          Log Activity ({opp.activityCount})
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openScorecardModal(opp)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Sparkles className="size-3.5" />
                          {opp.scorecard ? "Edit Scorecard" : "Evaluate Scorecard"}
                        </Button>
                      </div>
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
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-border">
            <div className="flex items-center gap-3 text-danger">
              <AlertCircle className="size-6 shrink-0" />
              <h3 className="font-display text-lg font-bold text-ink">Stage Transition Gated</h3>
            </div>
            <p className="mt-3 text-sm text-ink-2 leading-relaxed">{gatingAlert}</p>
            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={() => setGatingAlert(null)}>
                Understood
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Opportunity Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-display text-lg font-bold text-ink">Add Buyer Opportunity</h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
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
                <label className="block text-xs font-semibold text-ink mb-1">Company / Importer Name *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Kaffee Welt GmbH"
                  value={addForm.companyName}
                  onChange={(e) => setAddForm({ ...addForm, companyName: e.target.value })}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Opportunity Title *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. 2026 Arabica Contract"
                    value={addForm.title}
                    onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Destination Country *</label>
                  <input
                    required
                    type="text"
                    maxLength={2}
                    placeholder="e.g. DE, KE, US"
                    value={addForm.country}
                    onChange={(e) => setAddForm({ ...addForm, country: e.target.value.toUpperCase() })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Contact / Buyer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Hans Gruber"
                    value={addForm.buyerName}
                    onChange={(e) => setAddForm({ ...addForm, buyerName: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Decision Maker Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Procurement Lead"
                    value={addForm.decisionMakerRole}
                    onChange={(e) => setAddForm({ ...addForm, decisionMakerRole: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Website URL</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={addForm.website}
                  onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Source Links (one URL per line)</label>
                <textarea
                  rows={2}
                  placeholder="https://linkedin.com/in/...&#10;https://directory.trade.gov/..."
                  value={addForm.sourceLinks}
                  onChange={(e) => setAddForm({ ...addForm, sourceLinks: e.target.value })}
                  className="w-full rounded-md border border-border p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-ink mb-1">Estimated Deal Value</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 50000"
                    value={addForm.estimatedValue}
                    onChange={(e) => setAddForm({ ...addForm, estimatedValue: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Currency</label>
                  <select
                    value={addForm.currency}
                    onChange={(e) => setAddForm({ ...addForm, currency: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                <label className="block text-xs font-semibold text-ink mb-1">Context / Discovery Notes</label>
                <textarea
                  rows={2}
                  placeholder="How was this lead discovered? Relevant product specifications..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  className="w-full rounded-md border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="secondary" type="button" onClick={() => setAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save Opportunity
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {selectedOppForActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Log Commercial Activity</h3>
                <p className="text-xs text-ink-2 mt-0.5">For {selectedOppForActivity.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOppForActivity(null)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Activity Type *</label>
                  <select
                    value={activityForm.type}
                    onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value as any })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="email">Email</option>
                    <option value="call">Phone / Video Call</option>
                    <option value="meeting">In-Person Meeting</option>
                    <option value="rfq">RFQ Received</option>
                    <option value="sample">Sample Dispatch</option>
                    <option value="follow_up">Follow Up</option>
                    <option value="note">Internal Note</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Date & Time *</label>
                  <input
                    required
                    type="datetime-local"
                    value={activityForm.occurredAt}
                    onChange={(e) => setActivityForm({ ...activityForm, occurredAt: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Summary / Touchpoint Outcome *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="e.g. Sent introductory catalogue and quote for 5,000 units FOB Mombasa..."
                  value={activityForm.summary}
                  onChange={(e) => setActivityForm({ ...activityForm, summary: e.target.value })}
                  className="w-full rounded-md border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-ink">M05 Follow-Up Cadence</label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCadence(1)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-canvas-2"
                    >
                      Day 1
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadence(4)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-canvas-2"
                    >
                      Day 4
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadence(8)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-canvas-2"
                    >
                      Day 8
                    </button>
                    <button
                      type="button"
                      onClick={() => setCadence(14)}
                      className="px-2 py-0.5 rounded bg-canvas text-[11px] font-semibold text-ink-2 hover:bg-canvas-2"
                    >
                      Day 14
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={activityForm.followUpDate}
                  onChange={(e) => setActivityForm({ ...activityForm, followUpDate: e.target.value })}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Evidence URL (Optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={activityForm.evidenceUrl}
                  onChange={(e) => setActivityForm({ ...activityForm, evidenceUrl: e.target.value })}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Activity History Preview */}
              <div className="pt-2 border-t border-border">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-2">
                  Touchpoint History ({activityHistory.length})
                </div>
                {loadingActivities ? (
                  <p className="text-xs text-ink-3">Loading history...</p>
                ) : activityHistory.length === 0 ? (
                  <p className="text-xs text-ink-3 italic">No prior activities recorded.</p>
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="secondary" type="button" onClick={() => setSelectedOppForActivity(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save Activity
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Qualification Scorecard Modal */}
      {selectedOppForScorecard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Lead Qualification Scorecard</h3>
                <p className="text-xs text-ink-2 mt-0.5">Evaluating {selectedOppForScorecard.companyName}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOppForScorecard(null)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
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
              <div className="rounded-lg bg-canvas p-4 border border-border flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
                    Total Qualification Score
                  </div>
                  <div className="font-display text-2xl font-bold text-ink">{scorecardTotal} / 30</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Qualification Band</div>
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
                    {scorecardBand.toUpperCase()} FIT
                  </span>
                </div>
              </div>

              {/* 6 Criteria Sliders */}
              <div className="space-y-3">
                {[
                  { key: "productFit", label: "1. Product Specifications Fit (0-5)", desc: "Quality and technical standards alignment" },
                  { key: "purchasingPowerOrVolume", label: "2. Purchasing Power & Volume (0-5)", desc: "Deal volume matches export production capacity" },
                  { key: "paymentTerms", label: "3. Payment Terms Alignment (0-5)", desc: "LC, cash against documents, or credit risk fit" },
                  { key: "accessToDecisionMaker", label: "4. Access to Decision Maker (0-5)", desc: "Direct touchpoint with procurement head" },
                  { key: "importExperience", label: "5. Import Experience & Compliance (0-5)", desc: "Clear track record importing from Africa" },
                  { key: "timeline", label: "6. Procurement Timeline (0-5)", desc: "Immediacy and urgency of deal closing" },
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

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="secondary" type="button" onClick={() => setSelectedOppForScorecard(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save Scorecard
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
