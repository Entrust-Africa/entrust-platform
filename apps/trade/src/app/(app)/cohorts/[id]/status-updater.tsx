"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import type { EnrollmentStatus } from "@/lib/types";
import { updateStatusAction, type ActionState } from "../actions";

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: "invited", label: "Invited" },
  { value: "registered", label: "Registered" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "withdrawn", label: "Withdrawn" },
];

export function StatusUpdater({
  enrollmentId,
  cohortId,
  currentStatus,
}: {
  enrollmentId: string;
  cohortId: string;
  currentStatus: EnrollmentStatus;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<EnrollmentStatus>(currentStatus);
  const [state, setState] = useState<ActionState>({ error: null });
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setState({ error: null });
    const formData = new FormData(e.currentTarget);
    formData.append("enrollmentId", enrollmentId);
    formData.append("cohortId", cohortId);
    const res = await updateStatusAction({ error: null }, formData);
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
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-brand-600 hover:text-brand-700 font-medium underline"
      >
        Update Status
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-line">
              <h3 className="font-display text-sm font-bold text-ink">Update Enrolment Status</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-ink-2 hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            {state.error && (
              <div className="mt-3 rounded-md bg-danger-50 p-2.5 text-xs text-danger ring-1 ring-inset ring-danger/25">
                {state.error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink">Status</label>
                <select
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink">Reason / Notes (Optional)</label>
                <textarea
                  name="reason"
                  rows={2}
                  placeholder="Reason for graduation, withdrawal, or milestone update..."
                  className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsOpen(false)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={pending}>
                  {pending ? "Saving..." : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
