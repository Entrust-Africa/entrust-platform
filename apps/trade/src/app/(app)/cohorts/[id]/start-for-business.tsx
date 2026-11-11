"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { tradeFetch } from "@/lib/trade-client";

/**
 * Starts a business's onboarding diagnostic or placement assessment for staff to fill in with it (an administrator or a
 * facilitator; the API refuses a reviewer), and opens it.
 */
export function StartForBusiness({ kind, enrollmentId, organizationName }: { kind: "diagnostic" | "placement"; enrollmentId: string; organizationName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = kind === "diagnostic" ? "/diagnostic" : "/assessment";

  async function start() {
    setBusy(true);
    setError(null);
    const result = await tradeFetch<{ id: string }>("POST", "/assessments", { kind, enrollmentId });
    if (result.data) {
      router.push(`${route}/${result.data.id}`);
      return;
    }
    setBusy(false);
    setError(result.error ?? "It couldn't be started. Try again.");
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-ink-3">Not started</span>
      <button
        type="button"
        onClick={() => void start()}
        disabled={busy}
        aria-label={`Start the ${kind === "diagnostic" ? "onboarding diagnostic" : "placement assessment"} for ${organizationName}`}
        className="text-[11px] font-semibold text-brand-600 underline-offset-4 hover:underline disabled:opacity-60"
      >
        {busy ? "Starting…" : "Start with the business"}
      </button>
      {error && (
        <span role="alert" className="text-[11px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
