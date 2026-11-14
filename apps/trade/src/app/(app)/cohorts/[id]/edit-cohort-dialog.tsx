"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

interface CohortDetails {
  id: string;
  name: string;
  deliveryMode: string;
  startDate: string | null;
  endDate: string | null;
  sponsorOrganizationId: string | null;
}

/**
 * Corrects a cohort: its name, how it's delivered and its dates, which decide when it stops taking businesses. Only an
 * administrator changes the sponsor, which decides who reads the cohort's reports.
 */
export function EditCohortDialog({ cohort, sponsors, isAdmin }: { cohort: CohortDetails; sponsors: { id: string; name: string }[]; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: cohort.name,
    deliveryMode: cohort.deliveryMode,
    startDate: cohort.startDate ?? "",
    endDate: cohort.endDate ?? "",
    sponsorOrganizationId: cohort.sponsorOrganizationId ?? "",
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await tradeFetch("PATCH", `/cohorts/${cohort.id}`, {
      name: form.name.trim(),
      deliveryMode: form.deliveryMode,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      ...(isAdmin ? { sponsorOrganizationId: form.sponsorOrganizationId || null } : {}),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setOpen(false);
    router.refresh();
  }

  const select = "mt-1 block h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink";
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Edit cohort
      </Button>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-cohort-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={save} className="w-full max-w-lg space-y-4 rounded-lg bg-surface p-6 shadow-xl">
            <h2 id="edit-cohort-title" className="font-display text-lg font-bold text-ink">
              Edit cohort
            </h2>
            <Field label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
            <label className="block text-sm font-semibold text-ink">
              Delivery
              <select className={select} value={form.deliveryMode} onChange={(e) => setForm({ ...form, deliveryMode: e.target.value })}>
                <option value="self_paced">Self-paced</option>
                <option value="live">Live</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Starts" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Field label="Ends" type="date" hint="After this day it takes no new businesses." value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            {isAdmin && (
              <label className="block text-sm font-semibold text-ink">
                Sponsor bank
                <select className={select} value={form.sponsorOrganizationId} onChange={(e) => setForm({ ...form, sponsorOrganizationId: e.target.value })}>
                  <option value="">None (Entrust direct)</option>
                  {sponsors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t border-line pt-3">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Save
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
