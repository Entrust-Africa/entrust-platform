"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { enrolSmeAction, type ActionState } from "../actions";

export function EnrollSmeDialog({
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
    const res = await enrolSmeAction({ error: null }, formData);
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
        Enrol SME
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-lg bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <h2 className="font-display text-lg font-bold text-ink">Enrol SME Company</h2>
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
                <label className="block text-xs font-semibold text-ink">
                  Organisation ID
                </label>
                <p className="mt-0.5 text-xs text-ink-3">
                  Enter the registered organisation ID of the SME to admit them to this cohort.
                </p>
                <input
                  type="text"
                  name="organizationId"
                  required
                  placeholder="e.g. org_123456"
                  className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>

              <div className="rounded-md bg-canvas p-3 text-xs text-ink-2 space-y-1">
                <p className="font-semibold text-ink">Automatic TRADE access grant</p>
                <p>
                  Enrolling the SME will automatically grant their organisation access to the TRADE platform and add the enrolment record to their audit history.
                </p>
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
                  {pending ? "Enrolling..." : "Confirm Enrolment"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
