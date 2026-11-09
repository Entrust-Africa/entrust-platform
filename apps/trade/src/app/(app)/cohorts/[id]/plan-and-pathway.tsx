"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

const PLAN_LABEL: Record<string, string> = {
  generated: "Plan ready",
  review_required: "Plan needs review",
  approved: "Plan approved",
  active: "Plan active",
  completed: "Plan completed",
};

/** What staff act on for a business: approving a plan that needs review, and confirming a provisional Pathway B. */
export function PlanAndPathway({
  enrollmentId,
  plan,
  pathway,
  canConfirmPathway,
}: {
  enrollmentId: string;
  plan: { id: string; status: string } | null;
  pathway: { pathway: string; status: string } | null;
  canConfirmPathway: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => ReturnType<typeof tradeFetch>) => {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setReason("");
    router.refresh();
  };

  if (!plan && !pathway) return <span className="text-ink-3">Not yet</span>;
  return (
    <div className="min-w-44 space-y-2">
      {pathway && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={pathway.status === "provisional" ? "warn" : "info"}>{`Pathway ${pathway.pathway}${pathway.status === "provisional" ? ", provisional" : ""}`}</StatusBadge>
        </div>
      )}
      {pathway?.status === "provisional" && canConfirmPathway && (
        <div className="space-y-1">
          <label className="block text-[11px] font-semibold text-ink-3">
            Why it's confirmed
            <input className="mt-1 w-full rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button type="button" size="sm" variant="ghost" disabled={busy || !reason.trim()} onClick={() => run(() => tradeFetch("POST", `/enrollments/${enrollmentId}/pathway`, { pathway: pathway.pathway, reason: reason.trim() }))}>
            Confirm Pathway {pathway.pathway}
          </Button>
        </div>
      )}
      {plan && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={plan.status === "review_required" ? "warn" : "ok"}>{PLAN_LABEL[plan.status] ?? plan.status}</StatusBadge>
          {plan.status === "review_required" && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => run(() => tradeFetch("POST", `/plans/${plan.id}/approve`, {}))}>
              Approve plan
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
