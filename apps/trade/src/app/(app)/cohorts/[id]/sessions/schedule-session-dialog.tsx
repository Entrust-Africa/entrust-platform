"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { createSessionAction, type ActionState } from "./actions";

export function ScheduleSessionDialog({
  cohortId,
}: {
  cohortId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<ActionState>({ error: null });
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({ error: null });
    const formData = new FormData(e.currentTarget);
    formData.append("cohortId", cohortId);
    const res = await createSessionAction({ error: null }, formData);
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
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        + Schedule Session
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="font-display text-lg font-bold text-ink">Schedule Live Workshop Session</h2>
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink">Session Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Workshop 1: Value Proposition & Export Readiness"
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Description (Optional)</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Agenda, prerequisites, or preparation instructions..."
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">
                  Covered Modules (Comma-separated)
                </label>
                <input
                  type="text"
                  name="moduleCodes"
                  placeholder="e.g. M01, M02"
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500 uppercase font-mono"
                />
                <p className="mt-0.5 text-[11px] text-ink-3">
                  The facilitator preparation view will link enrolled SMEs' progress in these modules.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="session-start" className="block text-xs font-semibold text-ink">Start (Addis Ababa time)</label>
                  <input
                    id="session-start"
                    type="datetime-local"
                    name="startTime"
                    required
                    className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label htmlFor="session-end" className="block text-xs font-semibold text-ink">End (Addis Ababa time)</label>
                  <input
                    id="session-end"
                    type="datetime-local"
                    name="endTime"
                    required
                    className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Venue or Meeting Link</label>
                <input
                  type="text"
                  name="venue"
                  placeholder="e.g. https://meet.google.com/xyz or Room 402, Addis Ababa"
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Recording URL (After session)</label>
                <input
                  type="url"
                  name="recordingUrl"
                  placeholder="https://..."
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
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
                  {pending ? "Scheduling..." : "Schedule Session"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
