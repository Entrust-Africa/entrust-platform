"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@entrust/ui";
import { assignCohortStaffAction, removeCohortStaffAction } from "../actions";

export interface CohortStaff {
  assigned: { userId: string; name: string; email: string }[];
  available: { userId: string; name: string; email: string; role: string }[];
}

/**
 * An administrator chooses who works on a cohort. A facilitator or reviewer reaches only the businesses in the cohorts
 * they're on, including when scoring their work.
 */
export function CohortStaffPanel({ cohortId, staff }: { cohortId: string; staff: CohortStaff }) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: () => Promise<{ error: string | null }>) =>
    start(async () => {
      const result = await action();
      setError(result.error);
      if (!result.error) setSelected("");
    });

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Facilitators and assessors</h2>
        <p className="mt-1 text-sm text-ink-2">They can only see and score the businesses in the cohorts they're on. Administrators see every cohort.</p>
      </div>
      {staff.assigned.length === 0 ? (
        <p className="text-sm text-ink-2">Nobody is on this cohort yet, so only administrators can score its work.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line">
          {staff.assigned.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 break-words text-ink">
                {person.name} <span className="text-ink-3">{person.email}</span>
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeCohortStaffAction(cohortId, person.userId))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {staff.available.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="cohort-staff" className="sr-only">
            Add a facilitator or assessor
          </label>
          <select
            id="cohort-staff"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            <option value="">Choose someone to add</option>
            {staff.available.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.name} ({person.role})
              </option>
            ))}
          </select>
          <Button type="button" disabled={pending || !selected} onClick={() => run(() => assignCohortStaffAction(cohortId, selected))}>
            Add
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </Card>
  );
}
