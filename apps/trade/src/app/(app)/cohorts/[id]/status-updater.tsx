"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import type { EnrollmentStatus } from "@/lib/types";
import { updateStatusAction, type ActionState } from "../actions";

const LABELS: Record<EnrollmentStatus, string> = {
  invited: "Invited",
  registered: "Registered",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  withdrawn: "Withdrawn",
};

// The moves the API allows by hand. A finished programme only reopens when a module's result changes, and only an
// administrator brings a withdrawn business back.
const NEXT: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  invited: ["registered", "active", "withdrawn"],
  registered: ["active", "paused", "withdrawn"],
  active: ["paused", "withdrawn"],
  paused: ["active", "withdrawn"],
  completed: [],
  withdrawn: ["active"],
};

export function StatusUpdater({
  enrollmentId,
  cohortId,
  currentStatus,
  isAdmin,
}: {
  enrollmentId: string;
  cohortId: string;
  currentStatus: EnrollmentStatus;
  isAdmin: boolean;
}) {
  const options = NEXT[currentStatus].filter((s) => currentStatus !== "withdrawn" || isAdmin);
  const [status, setStatus] = useState<EnrollmentStatus | "">(options[0] ?? "");
  const [isOpen, setIsOpen] = useState(false);
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

  if (options.length === 0) {
    return <span className="text-[11px] text-ink-3">{currentStatus === "completed" ? "Finished" : "No change available"}</span>;
  }
  const needsReason = status === "paused" || status === "withdrawn" || currentStatus === "withdrawn";

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
              <p className="text-xs text-ink-2">Now: {LABELS[currentStatus]}</p>
              <div>
                <label htmlFor={`status-${enrollmentId}`} className="block text-xs font-semibold text-ink">Change to</label>
                <select
                  id={`status-${enrollmentId}`}
                  name="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EnrollmentStatus)}
                  className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {options.map((value) => (
                    <option key={value} value={value}>
                      {LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`reason-${enrollmentId}`} className="block text-xs font-semibold text-ink">
                  {needsReason ? "Reason (required)" : "Reason or notes (optional)"}
                </label>
                <textarea
                  id={`reason-${enrollmentId}`}
                  name="reason"
                  rows={2}
                  required={needsReason}
                  placeholder={currentStatus === "withdrawn" ? "Why this business is coming back" : "Why the status is changing"}
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
