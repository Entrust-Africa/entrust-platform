"use client";

import { useState } from "react";
import { Button, Card, Field, StatusBadge } from "@entrust/ui";
import { STANDING_LABEL, TIERS, passportDate, type PassportContent, type PassportEditorData, type PassportListItem, type PassportPrefill, type PassportSource, type PassportSuggestion, type PassportTier } from "@/lib/passport";
import { tradeFetch } from "@/lib/trade-client";

const select = "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink";
const area = "min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-ink";

interface Form {
  passportId: string;
  tier: PassportTier;
  status: PassportContent["status"];
  statusReason: string;
  verifiedOn: string;
  validUntil: string;
  displayName: string;
  tagline: string;
  country: string;
  sector: string;
  established: string;
  employeesRange: string;
  ownership: string;
  founder: string;
  headline: string;
  overview: string;
  products: string;
  womenInTrade: string;
  targetMarkets: string;
  seeking: string;
  checks: string[];
  website: string;
  email: string;
  phones: string;
  address: string;
}

/** What a new passport is made from: a business on the platform or an application in the register. */
type Link = { smeId?: string; applicationId?: string };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const NUMBER = /^EA-[A-Z]{3}-\d{4}$/i;
const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const orNull = (text: string) => (text.trim() ? text.trim() : null);
const today = () => new Date().toISOString().slice(0, 10);
const yearLater = () => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

const EMPTY_SUGGESTION: PassportSuggestion = { displayName: "", country: "ET", sector: null, established: null, employeesRange: null, ownership: null, founder: null, website: null, email: null, phones: [], address: null };

function formFrom(p: PassportContent | null, s: PassportSuggestion): Form {
  return {
    passportId: p?.passportId ?? "",
    tier: p?.tier ?? "bronze",
    status: p?.status ?? "active",
    statusReason: p?.statusReason ?? "",
    verifiedOn: p?.verifiedOn ?? today(),
    validUntil: p?.validUntil ?? yearLater(),
    displayName: p?.displayName ?? s.displayName,
    tagline: p?.tagline ?? "",
    country: p?.country ?? s.country,
    sector: p?.sector ?? s.sector ?? "",
    established: String(p?.established ?? s.established ?? ""),
    employeesRange: p ? (p.employeesRange ?? "") : (s.employeesRange ?? ""),
    ownership: p?.ownership ?? s.ownership ?? "",
    founder: p?.founder ?? s.founder ?? "",
    headline: p?.headline ?? "",
    overview: p?.overview ?? "",
    products: (p?.products ?? []).map((x) => [x.name, x.detail ?? "", x.code ?? ""].join(" | ").replace(/( \| )+$/, "")).join("\n"),
    womenInTrade: (p?.womenInTrade ?? []).join("\n"),
    targetMarkets: (p?.targetMarkets ?? []).map((m) => `${m.label}: ${m.places.join(", ")}`).join("\n"),
    seeking: p?.seeking ?? "",
    checks: p?.checks ?? [],
    website: p?.website ?? s.website ?? "",
    email: p?.email ?? s.email ?? "",
    phones: (p?.phones ?? s.phones).join("\n"),
    address: p?.address ?? s.address ?? "",
  };
}

function bodyFrom(f: Form, link: Link | null) {
  return {
    ...(link?.smeId ? { smeId: link.smeId } : {}),
    ...(link?.applicationId ? { applicationId: link.applicationId } : {}),
    tier: f.tier,
    status: f.status,
    statusReason: f.status === "active" ? null : orNull(f.statusReason),
    verifiedOn: f.verifiedOn,
    validUntil: f.validUntil,
    displayName: f.displayName.trim(),
    tagline: orNull(f.tagline),
    country: f.country.trim(),
    sector: orNull(f.sector),
    established: f.established.trim() ? Number(f.established) : null,
    employeesRange: orNull(f.employeesRange),
    ownership: orNull(f.ownership),
    founder: orNull(f.founder),
    headline: orNull(f.headline),
    overview: orNull(f.overview),
    products: lines(f.products).map((line) => {
      const [name = "", detail = "", code = ""] = line.split("|").map((x) => x.trim());
      return { name, detail: detail || null, code: code || null };
    }),
    womenInTrade: lines(f.womenInTrade),
    targetMarkets: lines(f.targetMarkets).map((line) => {
      const at = line.indexOf(":");
      return at < 0 ? { label: line, places: [] } : { label: line.slice(0, at).trim(), places: line.slice(at + 1).split(",").map((x) => x.trim()).filter(Boolean) };
    }),
    seeking: orNull(f.seeking),
    checks: f.checks,
    website: orNull(f.website),
    email: orNull(f.email),
    phones: lines(f.phones),
    address: orNull(f.address),
  };
}

/** The staff screen for passports: the ones issued, and a form to issue or change one from a business's SME ID. */
export function PassportManager({ items: initial, canIssue, checks, loadError }: { items: PassportListItem[]; canIssue: boolean; checks: string[]; loadError: string | null }) {
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{ passport: PassportContent | null; source: PassportSource | null; suggestion: PassportSuggestion } | null>(null);
  const [link, setLink] = useState<Link | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(loadError);
  const [notice, setNotice] = useState<string | null>(null);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => (f ? { ...f, [key]: value } : f));
  const text = (key: keyof Form, label: string, hint?: string) => (
    <Field label={label} hint={hint} value={String(form?.[key] ?? "")} disabled={!canIssue} onChange={(e) => set(key, e.target.value as never)} />
  );

  const show = (next: { passport: PassportContent | null; source: PassportSource | null; suggestion: PassportSuggestion }) => {
    setData(next);
    setForm(formFrom(next.passport, next.suggestion));
    setLink(next.passport ? null : next.source?.smeId ? { smeId: next.source.smeId } : next.source?.applicationId ? { applicationId: next.source.applicationId } : null);
  };
  const clear = (message: string | null) => {
    setData(null);
    setForm(null);
    setError(message);
  };
  const openNumber = async (number: string) => {
    const res = await tradeFetch<PassportEditorData>("GET", `/passports/${encodeURIComponent(number.trim())}`);
    if (!res.ok || !res.data) return clear(res.status === 404 ? "No passport has that number." : res.error);
    show({ passport: res.data.passport, source: res.data.source, suggestion: EMPTY_SUGGESTION });
  };
  /** Opens what the box holds: a passport number, a register application (its id or its link) or a business's SME ID. */
  const lookup = async (input: string) => {
    const value = input.trim();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (NUMBER.test(value)) await openNumber(value);
    else {
      const application = value.match(UUID)?.[0];
      const res = await tradeFetch<PassportPrefill>("GET", `/passports/prefill?${application ? `applicationId=${application.toLowerCase()}` : `smeId=${encodeURIComponent(value)}`}`);
      if (!res.ok || !res.data) clear(res.status === 404 ? "Nothing was found for that. Use an SME ID, an application link or a passport number." : res.error);
      else if (res.data.existingPassportId) await openNumber(res.data.existingPassportId);
      else show({ passport: null, source: res.data.source, suggestion: res.data.suggestion });
    }
    setBusy(false);
  };

  const save = async () => {
    if (!data || !form) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const number = (data.passport?.passportId ?? form.passportId).trim().toUpperCase();
    const res = await tradeFetch<PassportContent>("PUT", `/passports/${encodeURIComponent(number)}`, bodyFrom(form, data.passport ? null : link));
    if (!res.ok || !res.data) {
      setBusy(false);
      return setError(res.error);
    }
    const list = await tradeFetch<{ items: PassportListItem[] }>("GET", "/passports");
    if (list.data) setItems(list.data.items);
    await openNumber(res.data.passportId);
    setBusy(false);
    setNotice(`Saved. The public page for ${res.data.passportId} is live.`);
  };

  const isNew = data !== null && !data.passport;

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}
      {notice && <p role="status" className="rounded-md bg-ok-50 px-3 py-2 text-sm font-medium text-ok">{notice}</p>}

      <Card className="divide-y divide-line">
        {items.length === 0 && <p className="p-4 text-sm text-ink-2">No passports have been issued yet.</p>}
        {items.map((item) => (
          <div key={item.passportId} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">
                {item.displayName} <span className="font-mono text-xs font-normal text-ink-3">{item.passportId}</span>
              </p>
              <p className="text-xs text-ink-3">
                {TIERS[item.tier].name} · verified {passportDate(item.verifiedOn)} · valid until {passportDate(item.validUntil)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <StatusBadge tone={item.standing === "active" ? "ok" : "danger"}>{STANDING_LABEL[item.standing]}</StatusBadge>
              <a href={`/passport/${item.passportId}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">View page</a>
              <a href={`/passport/${item.passportId}/qr.svg`} download={`${item.passportId}-qr.svg`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">QR code (SVG)</a>
              <Button variant="secondary" size="sm" disabled={busy} onClick={() => void lookup(item.passportId)}>{canIssue ? "Edit" : "Open"}</Button>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) void lookup(query);
          }}
        >
          <Field
            className="min-w-64 flex-1"
            label="Business"
            hint="An SME ID (ET-SME-000001), a link or id of an application in the SME register, or a passport number (EA-ETH-0002)."
            placeholder="ET-SME-000001, or paste the application link"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Button type="submit" loading={busy} disabled={!query.trim()}>Open</Button>
        </form>
      </Card>

      {data && form && (
        <Card className="space-y-6 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{data.passport?.displayName ?? data.source?.label ?? "New passport"}</h2>
            <p className="text-xs text-ink-3">
              {data.source ? `${data.source.kind === "business" ? `Business ${data.source.smeId}` : "Application in the SME register"}: ${data.source.label}. ` : ""}
              {isNew ? "No passport yet. The details below are suggestions from what is held; none is public until you save." : `Passport ${data.passport?.passportId}`}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Passport number" placeholder="EA-ETH-0002" value={form.passportId} disabled={!canIssue || !isNew} hint={isNew ? "Three letters for the country, then four digits. It can't change." : undefined} onChange={(e) => set("passportId", e.target.value.toUpperCase())} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pp-tier" className="text-sm font-semibold text-ink">Tier</label>
              <select id="pp-tier" className={select} disabled={!canIssue} value={form.tier} onChange={(e) => set("tier", e.target.value as PassportTier)}>
                {(Object.keys(TIERS) as PassportTier[]).map((t) => <option key={t} value={t}>{TIERS[t].name} · {TIERS[t].meaning}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pp-status" className="text-sm font-semibold text-ink">Status</label>
              <select id="pp-status" className={select} disabled={!canIssue} value={form.status} onChange={(e) => set("status", e.target.value as Form["status"])}>
                <option value="active">Active</option>
                <option value="suspended">Suspended (page shows it is on hold)</option>
                <option value="revoked">Revoked (page shows it is withdrawn)</option>
              </select>
            </div>
            <Field label="Verified on" type="date" value={form.verifiedOn} disabled={!canIssue} onChange={(e) => set("verifiedOn", e.target.value)} />
            <Field label="Valid until" type="date" value={form.validUntil} disabled={!canIssue} onChange={(e) => set("validUntil", e.target.value)} />
            {form.status !== "active" && <Field label="Reason (staff only)" value={form.statusReason} disabled={!canIssue} onChange={(e) => set("statusReason", e.target.value)} />}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {text("displayName", "Name on the passport")}
            {text("tagline", "Line under the name", "For example: Specialty Ethiopian Arabica · Roaster & Café · Addis Ababa")}
            {text("country", "Country (two letters)")}
            {text("sector", "Sector")}
            {text("established", "Year established")}
            {text("employeesRange", "Employees (range)", data.suggestion.employeesRange ? `Suggested from what the business told Entrust: ${data.suggestion.employeesRange}. Confirm it before it goes public.` : "No headcount is held for this business. Leave blank to show \"Not stated\".")}
            {text("ownership", "Ownership", "For example: 100% women-owned")}
            {text("founder", "Founder")}
            {text("seeking", "Seeking")}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              {text("headline", "Overview headline")}
              <label htmlFor="pp-overview" className="mt-3 text-sm font-semibold text-ink">Business overview</label>
              <textarea id="pp-overview" className={area} disabled={!canIssue} value={form.overview} onChange={(e) => set("overview", e.target.value)} />
              <p className="text-sm text-ink-3">A blank line starts a new paragraph.</p>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pp-products" className="text-sm font-semibold text-ink">What it sells</label>
                <textarea id="pp-products" className={area} disabled={!canIssue} value={form.products} onChange={(e) => set("products", e.target.value)} />
                <p className="text-sm text-ink-3">One per line: name | detail | HS code. For example: Green coffee | Specialty Arabica · Sidama | HS 0901.11</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pp-women" className="text-sm font-semibold text-ink">Women in trade</label>
                <textarea id="pp-women" className={area} disabled={!canIssue} value={form.womenInTrade} onChange={(e) => set("womenInTrade", e.target.value)} />
                <p className="text-sm text-ink-3">One line per point.</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pp-markets" className="text-sm font-semibold text-ink">Target markets</label>
                <textarea id="pp-markets" className={area} disabled={!canIssue} value={form.targetMarkets} onChange={(e) => set("targetMarkets", e.target.value)} />
                <p className="text-sm text-ink-3">One line per group: Global: USA, Europe, China</p>
              </div>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-ink">Checks Entrust has completed</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[...checks, ...form.checks.filter((c) => !checks.includes(c))].map((check) => (
                <label key={check} className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" className="size-4" disabled={!canIssue} checked={form.checks.includes(check)} onChange={(e) => set("checks", e.target.checked ? [...form.checks, check] : form.checks.filter((c) => c !== check))} />
                  {check}
                </label>
              ))}
            </div>
            <p className="text-sm text-ink-3">Tick only the checks that were done. The public page lists exactly these.</p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            {text("website", "Website")}
            {text("email", "Email")}
            {text("address", "Address")}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pp-phones" className="text-sm font-semibold text-ink">Telephone numbers</label>
              <textarea id="pp-phones" className={`${area} min-h-16`} disabled={!canIssue} value={form.phones} onChange={(e) => set("phones", e.target.value)} />
              <p className="text-sm text-ink-3">One per line.</p>
            </div>
          </div>

          {canIssue ? (
            <Button loading={busy} onClick={() => void save()}>{isNew ? "Issue passport" : "Save passport"}</Button>
          ) : (
            <p className="text-sm text-ink-3">Only an Entrust administrator can issue or change a passport.</p>
          )}
        </Card>
      )}
    </div>
  );
}
