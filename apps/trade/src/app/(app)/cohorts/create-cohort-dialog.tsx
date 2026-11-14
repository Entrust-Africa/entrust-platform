"use client";

import { useState } from "react";
import { Button, Card, Field } from "@entrust/ui";
import type { TradeProgram } from "@/lib/types";
import { createCohortAction, createProgramAction, type ActionState } from "./actions";

export function CreateCohortDialog({
  programs,
  sponsors,
}: {
  programs: TradeProgram[];
  sponsors: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showNewProgram, setShowNewProgram] = useState(programs.length === 0);
  const [state, setState] = useState<ActionState>({ error: null });
  const [pending, setPending] = useState(false);

  async function handleProgramSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({ error: null });
    const formData = new FormData(e.currentTarget);
    const res = await createProgramAction({ error: null }, formData);
    setPending(false);
    if (res.error) {
      setState(res);
    } else {
      setShowNewProgram(false);
      setState({ error: null });
    }
  }

  async function handleCohortSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({ error: null });
    const formData = new FormData(e.currentTarget);
    const res = await createCohortAction({ error: null }, formData);
    setPending(false);
    if (res.error) {
      setState(res);
    } else {
      setIsOpen(false);
      setState({ error: null });
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        Create Cohort
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="font-display text-lg font-bold text-ink">Create New Cohort</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-ink-2 hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            {state.error && (
              <div className="mt-4 rounded-md bg-danger-50 p-3 text-sm text-danger ring-1 ring-inset ring-danger/25">
                {state.error}
              </div>
            )}

            {showNewProgram ? (
              <form onSubmit={handleProgramSubmit} className="mt-4 space-y-4">
                <div className="rounded-md bg-canvas p-3 text-xs text-ink-2">
                  No programs exist yet or you chose to create a new program. First define the program, then create cohorts within it.
                </div>
                <div>
                  <label htmlFor="cohorts-create-cohort-dialog-1" className="block text-xs font-semibold text-ink">Programme name</label>
                  <input id="cohorts-create-cohort-dialog-1"
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Export Readiness Pilot"
                    className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="cohorts-create-cohort-dialog-2" className="block text-xs font-semibold text-ink">Description (Optional)</label>
                  <textarea id="cohorts-create-cohort-dialog-2"
                    name="description"
                    rows={3}
                    placeholder="Programme goals, target SME profile or curriculum details…"
                    className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  {programs.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowNewProgram(false)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button type="submit" variant="primary" disabled={pending}>
                    {pending ? "Creating…" : "Save programme"}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCohortSubmit} className="mt-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="cohorts-create-cohort-dialog-3" className="block text-xs font-semibold text-ink">Programme</label>
                    <button
                      type="button"
                      onClick={() => setShowNewProgram(true)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      + New programme
                    </button>
                  </div>
                  <select id="cohorts-create-cohort-dialog-3"
                    name="programId"
                    required
                    className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="cohorts-create-cohort-dialog-4" className="block text-xs font-semibold text-ink">Cohort Name</label>
                  <input id="cohorts-create-cohort-dialog-4"
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Cohort 2026-A (Oromia Agro-processors)"
                    className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cohorts-create-cohort-dialog-5" className="block text-xs font-semibold text-ink">Delivery Mode</label>
                    <select id="cohorts-create-cohort-dialog-5"
                      name="deliveryMode"
                      defaultValue="self_paced"
                      className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="self_paced">Self-paced</option>
                      <option value="live">Live</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cohorts-create-cohort-dialog-6" className="block text-xs font-semibold text-ink">Country</label>
                    <input id="cohorts-create-cohort-dialog-6"
                      type="text"
                      name="country"
                      defaultValue="ET"
                      maxLength={2}
                      className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cohorts-create-cohort-dialog-7" className="block text-xs font-semibold text-ink">Start Date (Optional)</label>
                    <input id="cohorts-create-cohort-dialog-7"
                      type="date"
                      name="startDate"
                      className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="cohorts-create-cohort-dialog-8" className="block text-xs font-semibold text-ink">End Date (Optional)</label>
                    <input id="cohorts-create-cohort-dialog-8"
                      type="date"
                      name="endDate"
                      className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cohorts-create-cohort-dialog-9" className="block text-xs font-semibold text-ink">Sponsor Organisation (Optional)</label>
                  <select id="cohorts-create-cohort-dialog-9"
                    name="sponsorOrganizationId"
                    defaultValue=""
                    className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">None (Entrust Direct)</option>
                    {sponsors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-line">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={pending}>
                    {pending ? "Creating..." : "Create Cohort"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
