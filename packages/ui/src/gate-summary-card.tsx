import * as React from "react";
import { AlertCircle, CheckCircle2, Lock, ShieldCheck } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, LoadingShell, Skeleton } from "./skeleton";
import { StatusBadge } from "./status-badge";
import { GATE_STATUSES } from "./statuses";

export interface RemainingItem {
  title: string;
  type?: "task" | "evidence" | "flag";
  linkHref?: string;
}

export interface GateSummaryCardProps {
  phaseNumber?: number;
  phaseTitle?: string;
  gateStatus?: "open" | "ready" | "locked";
  completedSteps?: number;
  totalSteps?: number;
  remainingItems?: RemainingItem[];
  signOffSlot?: React.ReactNode;
  lockedDetails?: { signedBy: string; signedAt: string };
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function GateSummaryCard({
  phaseNumber,
  phaseTitle,
  gateStatus = "open",
  completedSteps = 0,
  totalSteps = 0,
  remainingItems = [],
  signOffSlot,
  lockedDetails,
  loading = false,
  error = null,
  onRetry,
  className,
}: GateSummaryCardProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (loading) {
    return (
      <LoadingShell
        label="Loading gate summary"
        className={cn("flex flex-col gap-4 rounded-xl border border-line bg-surface p-6", className)}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-6 w-24 rounded-sm" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
      </LoadingShell>
    );
  }

  const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const isLocked = gateStatus === "locked";
  const isReady = gateStatus === "ready";
  const currentStatus = GATE_STATUSES[gateStatus] ?? GATE_STATUSES.open;

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all shadow-xs",
        isLocked
          ? "border-ok/30 bg-ok-50/15"
          : isReady
            ? "border-product/40 bg-product-50/20"
            : "border-line bg-surface",
        className,
      )}
    >
      {/* Header: Phase number, Title & Gate status */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <span className="font-mono text-xs font-bold text-ink-3">
            Milestone Gate {phaseNumber !== undefined && `· Phase ${phaseNumber}`}
          </span>
          <h3 className="mt-0.5 font-display text-lg font-bold text-ink">
            {phaseTitle ?? "Phase Gate Summary"}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge tone={currentStatus.tone}>{currentStatus.label}</StatusBadge>
          {signOffSlot}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
          <span>
            {completedSteps} of {totalSteps} steps completed
          </span>
          <span>{percentage}%</span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line/60">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              isLocked ? "bg-ok" : isReady ? "bg-product-600" : "bg-brand-600",
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Body: Locked details, Ready prompt, or Remaining blocking items */}
      {isLocked ? (
        <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-ok/25 bg-ok-50/40 p-3.5 text-xs text-ink-2">
          <ShieldCheck className="size-5 shrink-0 text-ok" aria-hidden="true" />
          <div>
            <span className="font-bold text-ok">Signed off and locked</span>
            <p className="mt-0.5 text-ink-3">
              {lockedDetails
                ? `Signed by ${lockedDetails.signedBy} on ${lockedDetails.signedAt}. Phase cannot be modified without formal amendment.`
                : "Phase has been signed off and locked. Cannot be modified without formal amendment."}
            </p>
          </div>
        </div>
      ) : isReady ? (
        <div className="mt-5 flex items-center gap-2 rounded-lg bg-product-50/50 border border-product/30 p-3 text-xs text-ink">
          <CheckCircle2 className="size-4 shrink-0 text-product-600" aria-hidden="true" />
          <span>All requirements in this phase are fulfilled. Ready for final milestone sign-off.</span>
        </div>
      ) : remainingItems.length > 0 ? (
        <div className="mt-5 border-t border-line/60 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-3">
            What&apos;s left before this phase can close:
          </p>
          <ul className="mt-2.5 space-y-2">
            {remainingItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-ink-2"
              >
                <AlertCircle
                  className="size-4 shrink-0 mt-0.5 text-warn"
                  aria-hidden="true"
                />
                {item.linkHref ? (
                  <a
                    href={item.linkHref}
                    className="underline underline-offset-2 hover:text-brand-600 font-medium"
                  >
                    {item.title}
                  </a>
                ) : (
                  <span>{item.title}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-5 border-t border-line/60 pt-4 text-xs text-ink-3">
          In progress. Awaiting remaining steps and evidence approvals before milestone sign-off.
        </div>
      )}
    </div>
  );
}
