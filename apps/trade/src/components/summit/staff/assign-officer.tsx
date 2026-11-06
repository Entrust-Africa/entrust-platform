"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import type { Officers } from "@/lib/summit-staff";
import { Outcome, useAction } from "./use-action";

/** An administrator hands an application to an assessment officer. The officer opens only the applications assigned to them. */
export function AssignOfficer({ applicationId, officers, currentUserId }: { applicationId: string; officers: Officers["items"]; currentUserId: string | null }) {
  const [officer, setOfficer] = useState(currentUserId ?? "");
  const { busy, error, done, run } = useAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Assessment officer"
          value={officer}
          onChange={(e) => setOfficer(e.target.value)}
          className="h-9 max-w-52 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
        >
          <option value="" disabled>
            Choose an officer
          </option>
          {officers.map((o) => (
            <option key={o.userId} value={o.userId}>
              {o.name} ({o.assigned})
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="secondary"
          loading={busy}
          disabled={!officer || officer === currentUserId}
          onClick={() => run(() => ok(browserApi().v1.summit.applications[":id"].officer.$put({ param: { id: applicationId }, json: { officerUserId: officer } })), "Assigned.")}
        >
          {currentUserId ? "Reassign" : "Assign"}
        </Button>
      </div>
      <Outcome error={error} done={done} />
    </div>
  );
}
