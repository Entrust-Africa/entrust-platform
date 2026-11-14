"use client";

import { useState } from "react";
import { Button, Card, Field, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

type Scalar = string | number | boolean | null;
export interface BusinessProfile {
  organizationId: string;
  smeId: string;
  country: string;
  [field: string]: Scalar;
}
export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  hsCode: string | null;
  archived: boolean;
}
export interface Shipment {
  id: string;
  transactionId: string | null;
  product: string;
  destination: string | null;
  buyerName: string | null;
  shipmentDate: string | null;
  evidenceStatus: "self_reported" | "document_supported" | "independently_verified";
  evidenceNote: string | null;
}
export interface ProfileChange {
  id: string;
  label: string;
  oldValue: string | null;
  newValue: string | null;
  material: boolean;
  changedBy: string | null;
  changedAt: string;
}
export interface BusinessRecordData {
  profile: BusinessProfile;
  products: Product[];
  shipments: Shipment[];
  history: ProfileChange[];
}

const TEXT_FIELDS: [string, string][] = [
  ["legalName", "Legal name"],
  ["tradingName", "Trading name"],
  ["registrationNumber", "Registration number"],
  ["tin", "Tax identification number"],
  ["sector", "Sector"],
  ["mainActivity", "Main activity"],
  ["ownershipType", "Ownership type"],
  ["businessEmail", "Business email"],
  ["businessPhone", "Business phone"],
  ["address", "Address"],
  ["website", "Website"],
  ["socialPages", "Social pages"],
  ["premises", "Premises"],
];
const NUMBER_FIELDS: [string, string][] = [
  ["yearEstablished", "Year established"],
  ["permanentEmployees", "Permanent employees"],
  ["temporaryEmployees", "Temporary employees"],
];
const EVIDENCE: Record<Shipment["evidenceStatus"], { label: string; tone: "idle" | "info" | "ok" }> = {
  self_reported: { label: "Self-reported", tone: "idle" },
  document_supported: { label: "Supported by documents", tone: "info" },
  independently_verified: { label: "Independently verified", tone: "ok" },
};
const select = "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink";

/** The business's own record: its profile and the history of changes to it, its products and its completed shipments. */
export function BusinessRecord({ initial, readOnly, isStaff }: { initial: BusinessRecordData; readOnly: boolean; isStaff: boolean }) {
  const orgId = initial.profile.organizationId;
  const q = `organizationId=${encodeURIComponent(orgId)}`;
  const [data, setData] = useState(initial);
  const [values, setValues] = useState<Record<string, Scalar>>(() => ({ ...initial.profile }));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [product, setProduct] = useState({ name: "", hsCode: "", category: "" });
  const [shipment, setShipment] = useState({ product: "", destination: "", buyerName: "", shipmentDate: "" });

  const reload = async () => {
    const [profile, products, shipments, history] = await Promise.all([
      tradeFetch<BusinessProfile>("GET", `/business-profile?${q}`),
      tradeFetch<{ items: Product[] }>("GET", `/products?${q}&includeArchived=true`),
      tradeFetch<{ items: Shipment[] }>("GET", `/export-history?${q}`),
      tradeFetch<{ items: ProfileChange[] }>("GET", `/business-profile/history?${q}`),
    ]);
    setData((d) => ({ profile: profile.data ?? d.profile, products: products.data?.items ?? d.products, shipments: shipments.data?.items ?? d.shipments, history: history.data?.items ?? d.history }));
    if (profile.data) setValues({ ...profile.data });
  };

  const run = async (action: () => Promise<{ ok: boolean; error: string | null }>, done: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setNotice(done);
    await reload();
  };

  const saveProfile = () => {
    const changes: Record<string, Scalar> = {};
    for (const [key] of [...TEXT_FIELDS, ...NUMBER_FIELDS]) {
      const now = values[key] === "" ? null : (values[key] ?? null);
      if (now !== (data.profile[key] ?? null)) changes[key] = now;
    }
    if (values.womanOwned !== (data.profile.womanOwned ?? null)) changes.womanOwned = values.womanOwned ?? null;
    if (Object.keys(changes).length === 0) return setNotice("Nothing has changed.");
    return run(() => tradeFetch("PATCH", "/business-profile", { organizationId: orgId, changes }), "Your details are saved.");
  };

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-ok-50 px-3 py-2 text-sm font-medium text-ok">{notice}</p>}

      <section aria-labelledby="profile" className="space-y-3">
        <h2 id="profile" className="font-display text-lg font-bold text-ink">Business details</h2>
        <Card className="p-4 sm:p-5">
          <p className="mb-4 text-xs text-ink-3">Business ID {data.profile.smeId} · {data.profile.country}. Changes to the legal name, registration number, tax number and sector are marked in the history below.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} value={String(values[key] ?? "")} disabled={readOnly} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
            ))}
            {NUMBER_FIELDS.map(([key, label]) => (
              <Field key={key} label={label} type="number" min={0} value={String(values[key] ?? "")} disabled={readOnly} onChange={(e) => setValues({ ...values, [key]: e.target.value === "" ? null : Number(e.target.value) })} />
            ))}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="woman-owned" className="text-sm font-semibold text-ink">Woman-owned</label>
              <select id="woman-owned" className={select} disabled={readOnly} value={values.womanOwned === null || values.womanOwned === undefined ? "" : String(values.womanOwned)} onChange={(e) => setValues({ ...values, womanOwned: e.target.value === "" ? null : e.target.value === "true" })}>
                <option value="">Not said</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
          {!readOnly && <Button className="mt-5" onClick={() => void saveProfile()} loading={busy}>Save details</Button>}
        </Card>
      </section>

      <section aria-labelledby="products" className="space-y-3">
        <h2 id="products" className="font-display text-lg font-bold text-ink">Products</h2>
        <Card className="divide-y divide-line">
          {data.products.length === 0 && <p className="p-4 text-sm text-ink-2">No products yet.</p>}
          {data.products.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className={`text-sm font-semibold ${p.archived ? "text-ink-3 line-through" : "text-ink"}`}>{p.name}</p>
                <p className="text-xs text-ink-3">{[p.category, p.hsCode && `HS ${p.hsCode}`].filter(Boolean).join(" · ") || "No category or HS code"}</p>
              </div>
              {!readOnly && (
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => tradeFetch("PATCH", `/products/${p.id}`, { archived: !p.archived }), p.archived ? "Product restored." : "Product archived.")}>
                  {p.archived ? "Restore" : "Archive"}
                </Button>
              )}
            </div>
          ))}
        </Card>
        {!readOnly && (
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Product name" value={product.name} onChange={(e) => setProduct({ ...product, name: e.target.value })} />
              <Field label="Category" value={product.category} onChange={(e) => setProduct({ ...product, category: e.target.value })} />
              <Field label="HS code" value={product.hsCode} onChange={(e) => setProduct({ ...product, hsCode: e.target.value })} />
            </div>
            <Button className="mt-4" disabled={!product.name.trim()} loading={busy} onClick={() => void run(async () => {
              const res = await tradeFetch("POST", "/products", { organizationId: orgId, name: product.name, category: product.category || null, hsCode: product.hsCode || null });
              if (res.ok) setProduct({ name: "", hsCode: "", category: "" });
              return res;
            }, "Product added.")}>
              Add product
            </Button>
          </Card>
        )}
      </section>

      <section aria-labelledby="shipments" className="space-y-3">
        <h2 id="shipments" className="font-display text-lg font-bold text-ink">Completed shipments</h2>
        <p className="max-w-2xl text-sm text-ink-2">Closing out an export transaction adds its shipment here. You can also add an earlier shipment. Everything you add is self-reported until Entrust has seen the documents.</p>
        <Card className="divide-y divide-line">
          {data.shipments.length === 0 && <p className="p-4 text-sm text-ink-2">No completed shipments recorded.</p>}
          {data.shipments.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold text-ink">{s.product}{s.destination ? ` to ${s.destination}` : ""}</p>
                <p className="text-xs text-ink-3">{[s.buyerName, s.shipmentDate, s.transactionId && "from a transaction"].filter(Boolean).join(" · ") || "No other details"}</p>
                {s.evidenceNote && <p className="mt-1 text-xs text-ink-2">{s.evidenceNote}</p>}
              </div>
              {isStaff && !readOnly ? (
                <select aria-label={`Evidence for ${s.product}`} className={`${select} max-w-56`} value={s.evidenceStatus} disabled={busy} onChange={(e) => void run(() => tradeFetch("PATCH", `/export-history/${s.id}`, { evidenceStatus: e.target.value }), "Evidence status saved.")}>
                  {Object.entries(EVIDENCE).map(([value, { label }]) => <option key={value} value={value}>{label}</option>)}
                </select>
              ) : (
                <StatusBadge tone={EVIDENCE[s.evidenceStatus].tone}>{EVIDENCE[s.evidenceStatus].label}</StatusBadge>
              )}
            </div>
          ))}
        </Card>
        {!readOnly && (
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="What was shipped" value={shipment.product} onChange={(e) => setShipment({ ...shipment, product: e.target.value })} />
              <Field label="Destination" value={shipment.destination} onChange={(e) => setShipment({ ...shipment, destination: e.target.value })} />
              <Field label="Buyer" value={shipment.buyerName} onChange={(e) => setShipment({ ...shipment, buyerName: e.target.value })} />
              <Field label="Shipment date" type="date" value={shipment.shipmentDate} onChange={(e) => setShipment({ ...shipment, shipmentDate: e.target.value })} />
            </div>
            <Button className="mt-4" disabled={!shipment.product.trim()} loading={busy} onClick={() => void run(async () => {
              const res = await tradeFetch("POST", "/export-history", { organizationId: orgId, product: shipment.product, destination: shipment.destination || null, buyerName: shipment.buyerName || null, shipmentDate: shipment.shipmentDate || null });
              if (res.ok) setShipment({ product: "", destination: "", buyerName: "", shipmentDate: "" });
              return res;
            }, "Shipment added as self-reported.")}>
              Add earlier shipment
            </Button>
          </Card>
        )}
      </section>

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="font-display text-lg font-bold text-ink">History of changes</h2>
        <Card className="divide-y divide-line">
          {data.history.length === 0 && <p className="p-4 text-sm text-ink-2">No changes yet.</p>}
          {data.history.map((h) => (
            <div key={h.id} className="p-4 text-sm">
              <p className="text-ink">
                <span className="font-semibold">{h.label}</span>: {h.oldValue ?? "empty"} → {h.newValue ?? "empty"} {h.material && <StatusBadge tone="warn">Material change</StatusBadge>}
              </p>
              <p className="text-xs text-ink-3">{h.changedBy ?? "Someone"} · {new Date(h.changedAt).toLocaleDateString()}</p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
