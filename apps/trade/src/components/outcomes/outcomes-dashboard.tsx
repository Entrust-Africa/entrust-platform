"use client";

import { useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  DollarSign,
  ExternalLink,
  FileCheck2,
  History,
  Landmark,
  PackageCheck,
  PlaneTakeoff,
  Plus,
  Receipt,
  Scale,
  ShieldCheck,
  Ship,
  TrendingUp,
} from "lucide-react";
import { Button, Card, StatusBadge, cn } from "@entrust/ui";
import { browserApi, errorText } from "@/lib/summit-api";
import type {
  CreateExportOutcomeInput,
  CreateFinancingOutcomeInput,
  OutcomeEventView,
  OutcomeView,
  UpdateExportStatusInput,
  UpdateFinancingStatusInput,
} from "@/lib/types";
import {
  EXPORT_OUTCOME_STATUSES,
  FINANCING_OUTCOME_STATUSES,
  FINANCING_TYPES,
  OUTCOME_EVIDENCE_TIERS,
} from "@entrust/trade-engine";

interface OutcomesDashboardProps {
  initialOutcomes: OutcomeView[];
  organizationId: string;
}

const FINANCING_STATUS_CONFIG: Record<string, { label: string; tone: "idle" | "info" | "warn" | "ok" | "product" | "danger" }> = {
  not_started: { label: "Not Started", tone: "idle" },
  application_prepared: { label: "Application Prepared", tone: "info" },
  submitted: { label: "Submitted to Lender", tone: "warn" },
  approved: { label: "Approved (Undisbursed)", tone: "product" },
  declined: { label: "Declined", tone: "danger" },
  disbursed: { label: "Disbursed / Active", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

const EXPORT_STATUS_CONFIG: Record<string, { label: string; tone: "idle" | "info" | "warn" | "ok" | "product" | "danger" }> = {
  planned: { label: "Planned Deal", tone: "idle" },
  preparing: { label: "Production & Prep", tone: "info" },
  shipped: { label: "Shipped (Unpaid)", tone: "warn" },
  delivered: { label: "Delivered to Buyer", tone: "product" },
  payment_pending: { label: "Payment Pending", tone: "warn" },
  paid: { label: "Proceeds Paid & Cleared", tone: "ok" },
  disputed: { label: "Disputed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "idle" },
};

export function OutcomesDashboard({
  initialOutcomes,
  organizationId,
}: OutcomesDashboardProps) {
  const [outcomes, setOutcomes] = useState<OutcomeView[]>(initialOutcomes);
  const [activeTab, setActiveTab] = useState<"financing" | "export">("financing");

  // Modals state
  const [financingModalOpen, setFinancingModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedOutcomeForUpdate, setSelectedOutcomeForUpdate] = useState<OutcomeView | null>(null);
  const [selectedOutcomeForEvents, setSelectedOutcomeForEvents] = useState<OutcomeView | null>(null);
  const [eventsList, setEventsList] = useState<OutcomeEventView[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Forms
  const [financingForm, setFinancingForm] = useState({
    lenderName: "",
    financingType: "working_capital" as const,
    amountRequested: "",
    currency: "USD",
    notes: "",
    evidenceTier: "self_reported" as const,
  });

  const [exportForm, setExportForm] = useState({
    buyerName: "",
    destinationCountry: "DE",
    productDescription: "",
    valuePlanned: "",
    currency: "USD",
    notes: "",
    evidenceTier: "self_reported" as const,
  });

  // Update financing status form
  const [updateFinancingForm, setUpdateFinancingForm] = useState({
    status: "approved" as any,
    amountApproved: "",
    amountDisbursed: "",
    approvalDate: new Date().toISOString().slice(0, 16),
    disbursementDate: "",
    evidenceTier: "formal_bank_decision" as any,
    notes: "",
  });

  // Update export status form
  const [updateExportForm, setUpdateExportForm] = useState({
    status: "shipped" as any,
    valueShipped: "",
    valuePaid: "",
    shipmentDate: new Date().toISOString().slice(0, 16),
    deliveryDate: "",
    paymentDate: "",
    evidenceTier: "documented" as any,
    notes: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Refresh data from API
  async function refreshData() {
    try {
      const res = await browserApi().v1.trade.outcomes.$get({
        query: { organizationId },
      });
      if (res.ok) {
        const body = (await res.json()) as { items: OutcomeView[] };
        setOutcomes(body.items);
      }
    } catch {
      // ignore
    }
  }

  // Open events audit drawer
  async function openEventsDrawer(outcome: OutcomeView) {
    setSelectedOutcomeForEvents(outcome);
    setLoadingEvents(true);
    try {
      const res = await browserApi().v1.trade.outcomes[":id"].events.$get({
        param: { id: outcome.id },
      });
      if (res.ok) {
        const data = (await res.json()) as { items: OutcomeEventView[] };
        setEventsList(data.items);
      }
    } finally {
      setLoadingEvents(false);
    }
  }

  // Open update modal
  function openUpdateModal(outcome: OutcomeView) {
    setSelectedOutcomeForUpdate(outcome);
    setFormError(null);
    if (outcome.kind === "financing") {
      setUpdateFinancingForm({
        status: (outcome.status === "application_prepared" ? "approved" : outcome.status === "approved" ? "disbursed" : outcome.status) as any,
        amountApproved: outcome.amountApproved ? String(outcome.amountApproved) : outcome.amountRequested ? String(outcome.amountRequested) : "",
        amountDisbursed: outcome.amountDisbursed ? String(outcome.amountDisbursed) : "",
        approvalDate: outcome.approvalDate ? outcome.approvalDate.slice(0, 16) : new Date().toISOString().slice(0, 16),
        disbursementDate: outcome.disbursementDate ? outcome.disbursementDate.slice(0, 16) : "",
        evidenceTier: outcome.evidenceTier,
        notes: "",
      });
    } else {
      setUpdateExportForm({
        status: (outcome.status === "planned" ? "shipped" : outcome.status === "shipped" ? "delivered" : outcome.status === "delivered" ? "paid" : outcome.status) as any,
        valueShipped: outcome.valueShipped ? String(outcome.valueShipped) : outcome.valuePlanned ? String(outcome.valuePlanned) : "",
        valuePaid: outcome.valuePaid ? String(outcome.valuePaid) : "",
        shipmentDate: outcome.shipmentDate ? outcome.shipmentDate.slice(0, 16) : new Date().toISOString().slice(0, 16),
        deliveryDate: outcome.deliveryDate ? outcome.deliveryDate.slice(0, 16) : "",
        paymentDate: outcome.paymentDate ? outcome.paymentDate.slice(0, 16) : "",
        evidenceTier: outcome.evidenceTier,
        notes: "",
      });
    }
  }

  // Submit new financing application
  async function submitCreateFinancing(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await browserApi().v1.trade.outcomes.financing.$post({
        json: {
          organizationId,
          lenderName: financingForm.lenderName,
          financingType: financingForm.financingType,
          amountRequested: Number(financingForm.amountRequested),
          currency: financingForm.currency,
          notes: financingForm.notes || undefined,
          evidenceTier: financingForm.evidenceTier,
        },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to create financing outcome");
      }

      setFinancingModalOpen(false);
      setFinancingForm({
        lenderName: "",
        financingType: "working_capital",
        amountRequested: "",
        currency: "USD",
        notes: "",
        evidenceTier: "self_reported",
      });
      await refreshData();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submit new export deal
  async function submitCreateExport(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await browserApi().v1.trade.outcomes.export.$post({
        json: {
          organizationId,
          buyerName: exportForm.buyerName,
          destinationCountry: exportForm.destinationCountry,
          productDescription: exportForm.productDescription,
          valuePlanned: exportForm.valuePlanned ? Number(exportForm.valuePlanned) : undefined,
          currency: exportForm.currency,
          notes: exportForm.notes || undefined,
          evidenceTier: exportForm.evidenceTier,
        },
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Failed to create export outcome");
      }

      setExportModalOpen(false);
      setExportForm({
        buyerName: "",
        destinationCountry: "DE",
        productDescription: "",
        valuePlanned: "",
        currency: "USD",
        notes: "",
        evidenceTier: "self_reported",
      });
      await refreshData();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Submit update status
  async function submitUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOutcomeForUpdate) return;
    setIsSubmitting(true);
    setFormError(null);

    try {
      if (selectedOutcomeForUpdate.kind === "financing") {
        const res = await browserApi().v1.trade.outcomes.financing[":id"].status.$patch({
          param: { id: selectedOutcomeForUpdate.id },
          json: {
            status: updateFinancingForm.status,
            amountApproved: updateFinancingForm.amountApproved ? Number(updateFinancingForm.amountApproved) : null,
            amountDisbursed: updateFinancingForm.amountDisbursed ? Number(updateFinancingForm.amountDisbursed) : null,
            approvalDate: updateFinancingForm.approvalDate ? new Date(updateFinancingForm.approvalDate).toISOString() : null,
            disbursementDate: updateFinancingForm.disbursementDate ? new Date(updateFinancingForm.disbursementDate).toISOString() : null,
            evidenceTier: updateFinancingForm.evidenceTier,
            notes: updateFinancingForm.notes || undefined,
          },
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? "Failed to update financing status");
        }
      } else {
        const res = await browserApi().v1.trade.outcomes.export[":id"].status.$patch({
          param: { id: selectedOutcomeForUpdate.id },
          json: {
            status: updateExportForm.status,
            valueShipped: updateExportForm.valueShipped ? Number(updateExportForm.valueShipped) : null,
            valuePaid: updateExportForm.valuePaid ? Number(updateExportForm.valuePaid) : null,
            shipmentDate: updateExportForm.shipmentDate ? new Date(updateExportForm.shipmentDate).toISOString() : null,
            deliveryDate: updateExportForm.deliveryDate ? new Date(updateExportForm.deliveryDate).toISOString() : null,
            paymentDate: updateExportForm.paymentDate ? new Date(updateExportForm.paymentDate).toISOString() : null,
            evidenceTier: updateExportForm.evidenceTier,
            notes: updateExportForm.notes || undefined,
          },
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? "Failed to update export status");
        }
      }

      setSelectedOutcomeForUpdate(null);
      await refreshData();
    } catch (err) {
      setFormError(errorText(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const financingOutcomes = outcomes.filter((o) => o.kind === "financing");
  const exportOutcomes = outcomes.filter((o) => o.kind === "export");

  const totalFinancingRequested = financingOutcomes.reduce((acc, c) => acc + (c.amountRequested ?? 0), 0);
  const totalFinancingApproved = financingOutcomes.reduce((acc, c) => acc + (c.amountApproved ?? 0), 0);
  const totalFinancingDisbursed = financingOutcomes.reduce((acc, c) => acc + (c.amountDisbursed ?? 0), 0);

  const totalExportShipped = exportOutcomes.reduce((acc, c) => acc + (c.valueShipped ?? 0), 0);
  const totalExportPaid = exportOutcomes.reduce((acc, c) => acc + (c.valuePaid ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Metric summary banner */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-4 bg-surface">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Financing Approved</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            ${totalFinancingApproved.toLocaleString()}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">
            Requested: ${totalFinancingRequested.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4 bg-surface border-l-4 border-l-brand-600">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Financing Disbursed</div>
          <div className="mt-1 font-display text-2xl font-bold text-brand-700">
            ${totalFinancingDisbursed.toLocaleString()}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Cleared liquidity in account</div>
        </Card>
        <Card className="p-4 bg-surface">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Export Cargo Shipped</div>
          <div className="mt-1 font-display text-2xl font-bold text-ink">
            ${totalExportShipped.toLocaleString()}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Vessel / air cargo dispatched</div>
        </Card>
        <Card className="p-4 bg-surface border-l-4 border-l-emerald-600">
          <div className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Proceeds Received</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-700">
            ${totalExportPaid.toLocaleString()}
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Cleared foreign exchange receipts</div>
        </Card>
      </div>

      {/* Tabs Switcher & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("financing")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2",
              activeTab === "financing"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-canvas text-ink-2 hover:bg-canvas-2"
            )}
          >
            <Landmark className="size-4" />
            Trade Financing ({financingOutcomes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("export")}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2",
              activeTab === "export"
                ? "bg-brand-600 text-white shadow-xs"
                : "bg-canvas text-ink-2 hover:bg-canvas-2"
            )}
          >
            <Ship className="size-4" />
            Export Shipments & Proceeds ({exportOutcomes.length})
          </button>
        </div>

        <div>
          {activeTab === "financing" ? (
            <Button variant="primary" onClick={() => setFinancingModalOpen(true)} className="flex items-center gap-1.5">
              <Plus className="size-4" />
              New Financing Application
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setExportModalOpen(true)} className="flex items-center gap-1.5">
              <Plus className="size-4" />
              Record Export Deal
            </Button>
          )}
        </div>
      </div>

      {/* Financing Outcomes Tab */}
      {activeTab === "financing" && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-ink">Trade Finance Applications</h3>
              <p className="text-xs text-ink-2 mt-0.5">
                Separate credit committee approval from actual bank disbursement.
              </p>
            </div>
          </div>

          {financingOutcomes.length === 0 ? (
            <div className="p-12 text-center">
              <Landmark className="size-12 mx-auto text-ink-3/40 mb-3" />
              <h4 className="font-display text-base font-bold text-ink">No trade finance applications recorded</h4>
              <p className="text-sm text-ink-2 max-w-md mx-auto mt-1">
                Record working capital, PO finance, invoice discounting, or LC facilities applied for during your trade journey.
              </p>
              <Button variant="primary" onClick={() => setFinancingModalOpen(true)} className="mt-4">
                Record First Application
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {financingOutcomes.map((item) => {
                const conf = FINANCING_STATUS_CONFIG[item.status] ?? { label: item.status, tone: "idle" as const };
                return (
                  <div key={item.id} className="p-6 hover:bg-canvas/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-bold text-ink">{item.lenderName}</span>
                          <span className="rounded bg-canvas-2 px-2 py-0.5 text-xs font-semibold uppercase text-ink-2">
                            {item.financingType?.replace("_", " ")}
                          </span>
                          <StatusBadge tone={conf.tone}>{conf.label}</StatusBadge>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            Evidence: {item.evidenceTier}
                          </span>
                        </div>

                        {/* Milestone separation callouts */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="rounded bg-canvas p-2.5 text-xs">
                            <span className="text-ink-3 block">Requested Facility:</span>
                            <span className="font-bold text-ink text-sm">
                              {item.currency} {item.amountRequested?.toLocaleString() ?? "—"}
                            </span>
                          </div>
                          <div className="rounded bg-canvas p-2.5 text-xs border-l-2 border-l-brand-500">
                            <span className="text-ink-3 block">Approved by Credit:</span>
                            <span className="font-bold text-brand-700 text-sm">
                              {item.amountApproved ? `${item.currency} ${item.amountApproved.toLocaleString()}` : "Pending Approval"}
                            </span>
                            {item.approvalDate && (
                              <span className="block text-[10px] text-ink-3 mt-0.5">
                                On {new Date(item.approvalDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="rounded bg-canvas p-2.5 text-xs border-l-2 border-l-emerald-500">
                            <span className="text-ink-3 block">Disbursed to Account:</span>
                            <span className="font-bold text-emerald-700 text-sm">
                              {item.amountDisbursed ? `${item.currency} ${item.amountDisbursed.toLocaleString()}` : "Not Yet Disbursed"}
                            </span>
                            {item.disbursementDate && (
                              <span className="block text-[10px] text-ink-3 mt-0.5">
                                On {new Date(item.disbursementDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.notes && <p className="text-xs text-ink-2 pt-1">{item.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEventsDrawer(item)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <History className="size-3.5" />
                          Audit Log ({item.events?.length ?? 1})
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openUpdateModal(item)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Coins className="size-3.5" />
                          Update Milestones
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Export Outcomes Tab */}
      {activeTab === "export" && (
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-ink">Export Shipments & Commercial Proceeds</h3>
              <p className="text-xs text-ink-2 mt-0.5">
                Separate vessel shipment from verified export proceeds settlement.
              </p>
            </div>
          </div>

          {exportOutcomes.length === 0 ? (
            <div className="p-12 text-center">
              <Ship className="size-12 mx-auto text-ink-3/40 mb-3" />
              <h4 className="font-display text-base font-bold text-ink">No export shipments recorded yet</h4>
              <p className="text-sm text-ink-2 max-w-md mx-auto mt-1">
                Link real export consignments to your buyer opportunities to advance your export journey to Stage 8, 9, and 10.
              </p>
              <Button variant="primary" onClick={() => setExportModalOpen(true)} className="mt-4">
                Record First Consignment
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {exportOutcomes.map((item) => {
                const conf = EXPORT_STATUS_CONFIG[item.status] ?? { label: item.status, tone: "idle" as const };
                return (
                  <div key={item.id} className="p-6 hover:bg-canvas/40 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-lg font-bold text-ink">{item.buyerName}</span>
                          <span className="rounded bg-canvas-2 px-2 py-0.5 text-xs font-bold text-ink-2">
                            {item.destinationCountry}
                          </span>
                          <StatusBadge tone={conf.tone}>{conf.label}</StatusBadge>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            Evidence: {item.evidenceTier}
                          </span>
                        </div>

                        <div className="text-sm font-medium text-ink-2">
                          <span>Product: {item.productDescription}</span>
                        </div>

                        {/* Milestone separation callouts */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                          <div className="rounded bg-canvas p-2.5 text-xs">
                            <span className="text-ink-3 block">Planned Contract Value:</span>
                            <span className="font-bold text-ink text-sm">
                              {item.currency} {item.valuePlanned?.toLocaleString() ?? "—"}
                            </span>
                          </div>
                          <div className="rounded bg-canvas p-2.5 text-xs border-l-2 border-l-amber-500">
                            <span className="text-ink-3 block">Value Shipped (Stage 8):</span>
                            <span className="font-bold text-amber-700 text-sm">
                              {item.valueShipped ? `${item.currency} ${item.valueShipped.toLocaleString()}` : "Not Yet Shipped"}
                            </span>
                            {item.shipmentDate && (
                              <span className="block text-[10px] text-ink-3 mt-0.5">
                                On {new Date(item.shipmentDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="rounded bg-canvas p-2.5 text-xs border-l-2 border-l-emerald-500">
                            <span className="text-ink-3 block">Proceeds Paid (Stage 10):</span>
                            <span className="font-bold text-emerald-700 text-sm">
                              {item.valuePaid ? `${item.currency} ${item.valuePaid.toLocaleString()}` : "Payment Outstanding"}
                            </span>
                            {item.paymentDate && (
                              <span className="block text-[10px] text-ink-3 mt-0.5">
                                Settled on {new Date(item.paymentDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {item.notes && <p className="text-xs text-ink-2 pt-1">{item.notes}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEventsDrawer(item)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <History className="size-3.5" />
                          Audit Log ({item.events?.length ?? 1})
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openUpdateModal(item)}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <Receipt className="size-3.5" />
                          Update Shipment/Paid
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* New Financing Modal */}
      {financingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-display text-lg font-bold text-ink">New Financing Application</h3>
              <button
                type="button"
                onClick={() => setFinancingModalOpen(false)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitCreateFinancing} className="space-y-4 mt-4">
              {formError && (
                <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Financial Institution / Lender *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Equity Bank Kenya, Ecobank, Afreximbank"
                  value={financingForm.lenderName}
                  onChange={(e) => setFinancingForm({ ...financingForm, lenderName: e.target.value })}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Facility Type *</label>
                  <select
                    value={financingForm.financingType}
                    onChange={(e) => setFinancingForm({ ...financingForm, financingType: e.target.value as any })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {FINANCING_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.replace(/_/g, " ").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Evidence Quality</label>
                  <select
                    value={financingForm.evidenceTier}
                    onChange={(e) => setFinancingForm({ ...financingForm, evidenceTier: e.target.value as any })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {OUTCOME_EVIDENCE_TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-ink mb-1">Amount Requested *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    placeholder="e.g. 100000"
                    value={financingForm.amountRequested}
                    onChange={(e) => setFinancingForm({ ...financingForm, amountRequested: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Currency</label>
                  <select
                    value={financingForm.currency}
                    onChange={(e) => setFinancingForm({ ...financingForm, currency: e.target.value })}
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
                <label className="block text-xs font-semibold text-ink mb-1">Facility Purpose / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Pre-shipment inventory purchase, packaging financing, etc."
                  value={financingForm.notes}
                  onChange={(e) => setFinancingForm({ ...financingForm, notes: e.target.value })}
                  className="w-full rounded-md border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="secondary" type="button" onClick={() => setFinancingModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Record Application
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Export Deal Modal */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-display text-lg font-bold text-ink">Record Export Consignment</h3>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitCreateExport} className="space-y-4 mt-4">
              {formError && (
                <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Overseas Buyer Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Kaffee Welt GmbH"
                    value={exportForm.buyerName}
                    onChange={(e) => setExportForm({ ...exportForm, buyerName: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Destination Country *</label>
                  <input
                    required
                    type="text"
                    maxLength={2}
                    placeholder="e.g. DE, US, AE"
                    value={exportForm.destinationCountry}
                    onChange={(e) => setExportForm({ ...exportForm, destinationCountry: e.target.value.toUpperCase() })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Product Description *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Grade 1 Washed Coffee Beans (1 Container)"
                  value={exportForm.productDescription}
                  onChange={(e) => setExportForm({ ...exportForm, productDescription: e.target.value })}
                  className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-ink mb-1">Planned Deal Value</label>
                  <input
                    type="number"
                    min={0}
                    placeholder="e.g. 60000"
                    value={exportForm.valuePlanned}
                    onChange={(e) => setExportForm({ ...exportForm, valuePlanned: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Currency</label>
                  <select
                    value={exportForm.currency}
                    onChange={(e) => setExportForm({ ...exportForm, currency: e.target.value })}
                    className="w-full h-9 rounded-md border border-border px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Consignment Notes</label>
                <textarea
                  rows={2}
                  placeholder="Port of departure, carrier, terms (FOB/CIF)..."
                  value={exportForm.notes}
                  onChange={(e) => setExportForm({ ...exportForm, notes: e.target.value })}
                  className="w-full rounded-md border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="secondary" type="button" onClick={() => setExportModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save Consignment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Milestone Modal (Financing & Export) */}
      {selectedOutcomeForUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">
                  Update {selectedOutcomeForUpdate.kind === "financing" ? "Financing" : "Export"} Milestones
                </h3>
                <p className="text-xs text-ink-2 mt-0.5">
                  {selectedOutcomeForUpdate.kind === "financing"
                    ? selectedOutcomeForUpdate.lenderName
                    : selectedOutcomeForUpdate.buyerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOutcomeForUpdate(null)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={submitUpdateStatus} className="space-y-4 mt-4">
              {formError && (
                <div className="rounded-md bg-danger/10 border border-danger/20 p-3 text-xs text-danger">
                  {formError}
                </div>
              )}

              {selectedOutcomeForUpdate.kind === "financing" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Application Status *</label>
                      <select
                        value={updateFinancingForm.status}
                        onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, status: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {FINANCING_OUTCOME_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {FINANCING_STATUS_CONFIG[st]?.label ?? st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Evidence Tier *</label>
                      <select
                        value={updateFinancingForm.evidenceTier}
                        onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, evidenceTier: e.target.value as any })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {OUTCOME_EVIDENCE_TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface border border-brand-200 p-3 text-xs text-brand-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Scale className="size-3.5" /> Separate Approval from Disbursement
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Credit approval records sanctioned amount. Leave disbursement blank until loan proceeds are credited to your bank account.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Amount Approved</label>
                      <input
                        type="number"
                        placeholder="e.g. 85000"
                        value={updateFinancingForm.amountApproved}
                        onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, amountApproved: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Approval Date</label>
                      <input
                        type="datetime-local"
                        value={updateFinancingForm.approvalDate}
                        onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, approvalDate: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Amount Disbursed</label>
                      <input
                        type="number"
                        placeholder="e.g. 85000"
                        value={updateFinancingForm.amountDisbursed}
                        onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, amountDisbursed: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Disbursement Date</label>
                      <input
                        type="datetime-local"
                        value={updateFinancingForm.disbursementDate}
                        onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, disbursementDate: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Transition Note / Reference</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Facility agreement executed, funds disbursed via RTGS..."
                      value={updateFinancingForm.notes}
                      onChange={(e) => setUpdateFinancingForm({ ...updateFinancingForm, notes: e.target.value })}
                      className="w-full rounded-md border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Consignment Status *</label>
                      <select
                        value={updateExportForm.status}
                        onChange={(e) => setUpdateExportForm({ ...updateExportForm, status: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {EXPORT_OUTCOME_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {EXPORT_STATUS_CONFIG[st]?.label ?? st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Evidence Tier *</label>
                      <select
                        value={updateExportForm.evidenceTier}
                        onChange={(e) => setUpdateExportForm({ ...updateExportForm, evidenceTier: e.target.value as any })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        {OUTCOME_EVIDENCE_TIERS.map((tier) => (
                          <option key={tier} value={tier}>
                            {tier.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg bg-surface border border-emerald-200 p-3 text-xs text-emerald-900 space-y-1">
                    <span className="font-bold flex items-center gap-1.5">
                      <Ship className="size-3.5" /> Separate Shipment from Proceeds Payment
                    </span>
                    <p className="text-[11px] leading-relaxed">
                      Marking as Shipped advances Export Journey to Stage 8. Proceeds settlement advances journey to Stage 10 upon cleared payment.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Value Shipped (Stage 8)</label>
                      <input
                        type="number"
                        placeholder="e.g. 60000"
                        value={updateExportForm.valueShipped}
                        onChange={(e) => setUpdateExportForm({ ...updateExportForm, valueShipped: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Shipment Date</label>
                      <input
                        type="datetime-local"
                        value={updateExportForm.shipmentDate}
                        onChange={(e) => setUpdateExportForm({ ...updateExportForm, shipmentDate: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Delivery Date (Stage 9)</label>
                      <input
                        type="datetime-local"
                        value={updateExportForm.deliveryDate}
                        onChange={(e) => setUpdateExportForm({ ...updateExportForm, deliveryDate: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink mb-1">Proceeds Settled (Stage 10)</label>
                      <input
                        type="number"
                        placeholder="e.g. 60000"
                        value={updateExportForm.valuePaid}
                        onChange={(e) => setUpdateExportForm({ ...updateExportForm, valuePaid: e.target.value })}
                        className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Payment Date</label>
                    <input
                      type="datetime-local"
                      value={updateExportForm.paymentDate}
                      onChange={(e) => setUpdateExportForm({ ...updateExportForm, paymentDate: e.target.value })}
                      className="w-full h-9 rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink mb-1">Transition Note / Bill of Lading</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. BL issued, Swift message MT103 received..."
                      value={updateExportForm.notes}
                      onChange={(e) => setUpdateExportForm({ ...updateExportForm, notes: e.target.value })}
                      className="w-full rounded-md border border-border p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button variant="secondary" type="button" onClick={() => setSelectedOutcomeForUpdate(null)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" loading={isSubmitting}>
                  Save Milestones
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Events Audit Trail Modal */}
      {selectedOutcomeForEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-border my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Outcome Audit History</h3>
                <p className="text-xs text-ink-2 mt-0.5">
                  {selectedOutcomeForEvents.kind === "financing"
                    ? selectedOutcomeForEvents.lenderName
                    : selectedOutcomeForEvents.buyerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOutcomeForEvents(null)}
                className="text-ink-3 hover:text-ink text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 mt-4 max-h-96 overflow-y-auto pr-1">
              {loadingEvents ? (
                <p className="text-xs text-ink-3">Loading history...</p>
              ) : eventsList.length === 0 ? (
                <p className="text-xs text-ink-3 italic">No status change events recorded.</p>
              ) : (
                eventsList.map((ev, idx) => (
                  <div key={ev.id} className="rounded-lg bg-canvas p-3 border border-border text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-ink">
                      <span>
                        {ev.previousStatus ? `${ev.previousStatus} → ` : ""}
                        {ev.newStatus}
                      </span>
                      <span className="text-[11px] text-ink-3 font-normal">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-canvas-2 px-2 py-0.5 text-[10px] font-semibold text-ink-2">
                        Evidence: {ev.evidenceTier}
                      </span>
                    </div>
                    {ev.notes && <p className="text-ink-2 pt-0.5">{ev.notes}</p>}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-border mt-4">
              <Button variant="secondary" onClick={() => setSelectedOutcomeForEvents(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
