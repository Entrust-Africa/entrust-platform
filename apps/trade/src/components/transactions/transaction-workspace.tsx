"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

type Text = string | null;

export interface TransactionItem {
  id: string;
  reference: string;
  isPractice: boolean;
  stage: string;
  product: string;
  clearCase: { id: string; reference: string; status: string } | null;
  [key: string]: unknown;
}

export interface TransactionData {
  organizationId: string;
  items: TransactionItem[];
  clearCases: { id: string; reference: string; status: string }[];
}

const STAGES = [
  ["enquiry", "Enquiry"],
  ["quoted", "Quoted"],
  ["order_confirmed", "Order confirmed"],
  ["in_production", "In production"],
  ["shipped", "Shipped"],
  ["delivered", "Delivered"],
  ["closed", "Closed"],
  ["cancelled", "Cancelled"],
] as const;

// FR-10's list, grouped the way the transaction runs.
const GROUPS: readonly { title: string; fields: readonly (readonly [string, string, boolean?])[] }[] = [
  { title: "Product and buyer", fields: [["product", "Product and specification", true], ["quantity", "Quantity"], ["destination", "Destination market"], ["buyerName", "Buyer identity"], ["buyerStatus", "Buyer qualification status"], ["orderDocument", "Buyer enquiry or purchase order", true]] },
  { title: "Commercial terms", fields: [["agreedPrice", "Agreed price"], ["currency", "Currency"], ["incoterm", "Incoterms® rule"], ["namedPlace", "Named place"], ["costingAndMargin", "Costing and expected margin", true], ["paymentTerms", "Payment terms", true], ["paymentRisk", "Payment-risk assessment", true]] },
  { title: "Fulfilment and shipment", fields: [["productionStatus", "Production and fulfilment status", true], ["documentChecklist", "Export documentation checklist", true], ["logistics", "Logistics and shipment information", true], ["customsStatus", "Customs and clearance status", true], ["insuranceStatus", "Insurance status"]] },
  { title: "Control and closeout", fields: [["exceptions", "Exceptions and corrective actions", true], ["outstandingActions", "Outstanding actions", true], ["responsible", "Responsible person"], ["paymentStatus", "Payment status"], ["actualCosts", "Actual transaction costs", true], ["closeout", "Transaction completion and closeout", true]] },
];

const field = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";

export function TransactionWorkspace({ initial, organizationId, readOnly }: { initial: TransactionData; organizationId: string; readOnly: boolean }) {
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState({ product: "", isPractice: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(initial.items[0]?.id ?? null);

  const reload = async () => {
    const res = await tradeFetch<TransactionData>("GET", `/transactions?organizationId=${encodeURIComponent(organizationId)}`);
    if (res.data) setData(res.data);
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await tradeFetch<TransactionItem>("POST", "/transactions", { organizationId, product: draft.product, isPractice: draft.isPractice });
    setBusy(false);
    if (!res.ok || !res.data) return setError(res.error);
    setDraft({ product: "", isPractice: false });
    setOpen(res.data.id);
    await reload();
  };

  const save = async (id: string, change: Record<string, unknown>) => {
    setError(null);
    const res = await tradeFetch("PATCH", `/transactions/${id}`, change);
    if (!res.ok) return setError(res.error);
    await reload();
  };

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {!readOnly && (
        <Card className="space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-ink">Start a transaction</h2>
          <label className="block text-xs font-semibold text-ink-3">
            Product
            <input className={field} value={draft.product} onChange={(e) => setDraft({ ...draft, product: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" checked={draft.isPractice} onChange={(e) => setDraft({ ...draft, isPractice: e.target.checked })} />
            This is a practice transaction, not a live order
          </label>
          <Button type="button" disabled={busy || !draft.product.trim()} onClick={create}>
            Start
          </Button>
        </Card>
      )}
      {data.items.length === 0 && <Card className="p-5 text-sm text-ink-2">No transactions yet.</Card>}
      {data.items.map((item) => (
        <Card key={item.id} className="space-y-3 p-5">
          <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
            <span className="min-w-0 break-words font-semibold text-ink">
              {item.reference}: {item.product}
            </span>
            <span className="flex flex-wrap gap-2">
              {item.isPractice && <StatusBadge tone="info">Practice</StatusBadge>}
              <StatusBadge tone="idle">{STAGES.find(([value]) => value === item.stage)?.[1] ?? item.stage}</StatusBadge>
            </span>
          </button>
          {open === item.id && (
            <div className="space-y-5 border-t border-line pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-ink-3">
                  Stage
                  <select className={field} disabled={readOnly} value={item.stage} onChange={(e) => void save(item.id, { stage: e.target.value })}>
                    {STAGES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-ink-3">
                  CLEAR case
                  <select className={field} disabled={readOnly || data.clearCases.length === 0} value={item.clearCase?.id ?? ""} onChange={(e) => void save(item.id, { clearCaseId: e.target.value || null })}>
                    <option value="">{data.clearCases.length ? "Not linked" : "No CLEAR cases yet"}</option>
                    {data.clearCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.reference}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {item.clearCase && (
                <p className="text-sm text-ink-2">
                  Linked to CLEAR case {item.clearCase.reference}, status {item.clearCase.status.replaceAll("_", " ")}.
                </p>
              )}
              {GROUPS.map((group) => (
                <fieldset key={group.title} className="space-y-3">
                  <legend className="font-display text-base font-bold text-ink">{group.title}</legend>
                  {group.fields.map(([key, label, long]) => {
                    const value = (item[key] as Text) ?? "";
                    const commit = (next: string) => {
                      if (next !== value && (key !== "product" || next.trim())) void save(item.id, { [key]: next.trim() || null });
                    };
                    return (
                      <label key={key} className="block text-xs font-semibold text-ink-3">
                        {label}
                        {long ? (
                          <textarea className={field} disabled={readOnly} defaultValue={value} onBlur={(e) => commit(e.target.value)} />
                        ) : (
                          <input className={field} disabled={readOnly} defaultValue={value} onBlur={(e) => commit(e.target.value)} />
                        )}
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
