"use client";

import { useEffect, useState } from "react";
import { Button, Field, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

interface TxEvent {
  id: string;
  type: string;
  summary: string;
  occurredAt: string;
}
interface TxDocument {
  id: string;
  kind: string;
  name: string;
  notes: string | null;
}
interface TxCost {
  id: string;
  category: string;
  basis: "quoted" | "expected" | "actual";
  amount: string;
  currency: string;
  note: string | null;
  createdAt: string;
}
interface Costs {
  revisions: TxCost[];
  current: TxCost[];
  totals: { basis: string; currency: string; total: string }[];
}

const select = "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink";
const CATEGORIES = ["production", "materials", "packaging", "inspection", "inland_transport", "freight", "insurance", "customs", "finance", "other"];
const DOCUMENT_KINDS = ["purchase_order", "proforma_invoice", "commercial_invoice", "packing_list", "transport_document", "insurance", "certificate", "payment_proof", "other"];
const words = (value: string) => value.replaceAll("_", " ");
const BASES = [["quoted", "Quoted"], ["expected", "Expected"], ["actual", "Actual"]] as const;

/**
 * What sits under a transaction: its timeline, its costs as quoted, expected and actual figures (a new figure is a revision, and the
 * newest counts) and its documents. It records what the business says; it doesn't approve a shipment or certify a cost.
 */
export function TransactionRecords({ transactionId, readOnly }: { transactionId: string; readOnly: boolean }) {
  const base = `/transactions/${transactionId}`;
  const [events, setEvents] = useState<TxEvent[]>([]);
  const [documents, setDocuments] = useState<TxDocument[]>([]);
  const [costs, setCosts] = useState<Costs>({ revisions: [], current: [], totals: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState({ type: "note", summary: "" });
  const [cost, setCost] = useState({ category: "production", basis: "quoted", amount: "", currency: "USD", note: "" });
  const [doc, setDoc] = useState({ kind: "commercial_invoice", name: "" });
  const [showRevisions, setShowRevisions] = useState(false);

  const reload = async () => {
    const [e, d, c] = await Promise.all([
      tradeFetch<{ items: TxEvent[] }>("GET", `${base}/events`),
      tradeFetch<{ items: TxDocument[] }>("GET", `${base}/documents`),
      tradeFetch<Costs>("GET", `${base}/costs`),
    ]);
    if (e.data) setEvents(e.data.items);
    if (d.data) setDocuments(d.data.items);
    if (c.data) setCosts(c.data);
  };
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactionId]);

  const run = async (action: () => Promise<{ ok: boolean; error: string | null }>) => {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    await reload();
  };

  return (
    <div className="space-y-6 border-t border-line pt-4">
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}

      <section aria-label="Costs" className="space-y-3">
        <h3 className="font-display text-base font-bold text-ink">Costs</h3>
        {costs.totals.length === 0 ? (
          <p className="text-sm text-ink-2">No cost figures yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {BASES.map(([basis, label]) => (
              <div key={basis} className="rounded-md border border-line p-3">
                <p className="text-xs font-semibold text-ink-3">{label}</p>
                {costs.totals.filter((t) => t.basis === basis).map((t) => (
                  <p key={t.currency} className="text-sm font-semibold text-ink">{t.currency} {Number(t.total).toLocaleString()}</p>
                ))}
                {!costs.totals.some((t) => t.basis === basis) && <p className="text-sm text-ink-3">None yet</p>}
              </div>
            ))}
          </div>
        )}
        {costs.current.length > 0 && (
          <ul className="divide-y divide-line text-sm">
            {costs.current.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-ink">{words(c.category)} <StatusBadge tone={c.basis === "actual" ? "ok" : c.basis === "quoted" ? "info" : "idle"}>{c.basis}</StatusBadge>{c.note ? <span className="ml-2 text-ink-3">{c.note}</span> : null}</span>
                <span className="font-semibold text-ink">{c.currency} {Number(c.amount).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        {costs.revisions.length > costs.current.length && (
          <button type="button" className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline" onClick={() => setShowRevisions(!showRevisions)}>
            {showRevisions ? "Hide earlier figures" : `Show earlier figures (${costs.revisions.length - costs.current.length})`}
          </button>
        )}
        {showRevisions && (
          <ul className="divide-y divide-line text-xs text-ink-2">
            {costs.revisions.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 py-1">
                <span>{new Date(c.createdAt).toLocaleDateString()} · {words(c.category)} · {c.basis}{c.note ? ` · ${c.note}` : ""}</span>
                <span>{c.currency} {Number(c.amount).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="text-xs font-semibold text-ink-3">Cost<select className={select} value={cost.category} onChange={(e) => setCost({ ...cost, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{words(c)}</option>)}</select></label>
            <label className="text-xs font-semibold text-ink-3">Figure<select className={select} value={cost.basis} onChange={(e) => setCost({ ...cost, basis: e.target.value })}>{BASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <Field label="Amount" type="number" min={0} value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} />
            <Field label="Currency" maxLength={3} value={cost.currency} onChange={(e) => setCost({ ...cost, currency: e.target.value.toUpperCase() })} />
            <Field label="Note" value={cost.note} onChange={(e) => setCost({ ...cost, note: e.target.value })} />
            <div className="sm:col-span-5">
              <Button size="sm" disabled={!cost.amount || cost.currency.length !== 3} loading={busy} onClick={() => void run(async () => {
                const res = await tradeFetch("POST", `${base}/costs`, { category: cost.category, basis: cost.basis, amount: Number(cost.amount), currency: cost.currency, note: cost.note || null });
                if (res.ok) setCost({ ...cost, amount: "", note: "" });
                return res;
              })}>
                Record figure
              </Button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Documents" className="space-y-3">
        <h3 className="font-display text-base font-bold text-ink">Documents</h3>
        {documents.length === 0 ? <p className="text-sm text-ink-2">No documents listed yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="text-ink">{d.name} <span className="text-ink-3">({words(d.kind)})</span></span>
                {!readOnly && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => tradeFetch("DELETE", `${base}/documents/${d.id}`))}>Remove</Button>}
              </li>
            ))}
          </ul>
        )}
        {!readOnly && (
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-semibold text-ink-3">Kind<select className={select} value={doc.kind} onChange={(e) => setDoc({ ...doc, kind: e.target.value })}>{DOCUMENT_KINDS.map((k) => <option key={k} value={k}>{words(k)}</option>)}</select></label>
            <Field label="Name or reference" value={doc.name} onChange={(e) => setDoc({ ...doc, name: e.target.value })} />
            <div className="flex items-end">
              <Button size="sm" disabled={!doc.name.trim()} loading={busy} onClick={() => void run(async () => {
                const res = await tradeFetch("POST", `${base}/documents`, { kind: doc.kind, name: doc.name });
                if (res.ok) setDoc({ ...doc, name: "" });
                return res;
              })}>
                Add document
              </Button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Timeline" className="space-y-3">
        <h3 className="font-display text-base font-bold text-ink">Timeline</h3>
        {!readOnly && (
          <div className="grid gap-3 sm:grid-cols-4">
            <label className="text-xs font-semibold text-ink-3">Add<select className={select} value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}><option value="note">A note</option><option value="exception">An exception</option><option value="payment">A payment</option></select></label>
            <div className="sm:col-span-2"><Field label="What happened" value={note.summary} onChange={(e) => setNote({ ...note, summary: e.target.value })} /></div>
            <div className="flex items-end">
              <Button size="sm" disabled={!note.summary.trim()} loading={busy} onClick={() => void run(async () => {
                const res = await tradeFetch("POST", `${base}/events`, { type: note.type, summary: note.summary });
                if (res.ok) setNote({ ...note, summary: "" });
                return res;
              })}>
                Add
              </Button>
            </div>
          </div>
        )}
        {events.length === 0 ? <p className="text-sm text-ink-2">Nothing yet.</p> : (
          <ol className="space-y-2 text-sm">
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-3">
                <span className="text-xs text-ink-3">{new Date(e.occurredAt).toLocaleString()}</span>
                <span className="text-ink">{e.summary}</span>
                {e.type !== "stage_change" && <StatusBadge tone={e.type === "exception" ? "warn" : "idle"}>{words(e.type)}</StatusBadge>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
