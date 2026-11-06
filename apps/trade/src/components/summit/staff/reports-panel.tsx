"use client";

import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { apiUrl, errorText } from "@/lib/summit-api";
import type { ReportCatalogue } from "@/lib/summit-staff";

type Format = "xlsx" | "csv" | "pdf";
const FORMATS: { id: Format; label: string }[] = [
  { id: "xlsx", label: "Excel" },
  { id: "csv", label: "CSV" },
  { id: "pdf", label: "PDF" },
];
const SCOPES: Record<string, string> = {
  all: "Every application",
  assigned: "Only the applications assigned to you",
  committee: "Only the applications the committee can open",
  aggregate: "The period's figures, no single application",
};
const CLASSES: Record<string, string> = { internal: "Internal", confidential: "Confidential", restricted: "Restricted", external_approved: "Approved for outside use" };

/** The twelve reports of the spec's section 11, each as Excel, CSV and PDF. What a download holds depends on the person's role; every export is logged. */
export function ReportsPanel({ catalogue, periodId }: { catalogue: ReportCatalogue["items"]; periodId: string | undefined }) {
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  async function download(id: string, format: Format) {
    const key = `${id}.${format}`;
    setBusy(key);
    setError(undefined);
    try {
      const query = new URLSearchParams({ format, ...(periodId ? { periodId } : {}), ...(country.trim().length === 2 ? { country: country.trim().toUpperCase() } : {}) });
      const response = await fetch(`${apiUrl}/v1/summit/reports/${id}?${query}`, { credentials: "include" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The report could not be made. Try again.");
      }
      const blob = await response.blob();
      const named = /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") ?? "")?.[1];
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = named ?? `summit-${id}.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <label className="flex flex-wrap items-center gap-3 text-sm font-semibold text-ink">
          Only one country (optional)
          <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={2} placeholder="KE" className="h-9 w-20 rounded-md border border-line-strong bg-surface px-2 text-sm font-normal uppercase" />
        </label>
      </Card>
      {error && (
        <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <ul className="grid gap-3 lg:grid-cols-2">
        {catalogue.map((r) => (
          <li key={r.id}>
            <Card className="flex h-full flex-col justify-between gap-3 p-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-3">Report {r.number}</span>
                  <StatusBadge tone={r.classification === "restricted" ? "danger" : r.classification === "confidential" ? "warn" : "idle"}>{CLASSES[r.classification] ?? r.classification}</StatusBadge>
                </div>
                <h3 className="font-display text-base font-bold text-ink">{r.title}</h3>
                <p className="text-sm text-ink-2">{r.purpose}</p>
                <p className="text-xs text-ink-3">{SCOPES[r.scope] ?? r.scope}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <Button key={f.id} size="sm" variant="secondary" loading={busy === `${r.id}.${f.id}`} onClick={() => download(r.id, f.id)}>
                    {f.label}
                  </Button>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
