import * as React from "react";
import { AlertOctagon, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, LoadingShell, Skeleton } from "./skeleton";
import { StatusBadge } from "./status-badge";
import { FLAG_SEVERITIES, FLAG_STATUSES } from "./statuses";

export type FlagSeverity = "critical" | "high" | "medium";
export type FlagStatus = "open" | "waived" | "resolved";

export interface FlagBannerProps {
  code?: string;
  title?: string;
  severity?: FlagSeverity;
  status?: FlagStatus;
  description?: string;
  actionSlot?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function FlagBanner({
  code,
  title,
  severity = "high",
  status = "open",
  description,
  actionSlot,
  loading = false,
  error = null,
  onRetry,
  className,
}: FlagBannerProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (loading) {
    return (
      <LoadingShell
        label="Loading flag banner"
        className={cn(
          "flex items-start gap-3 rounded-lg border border-line bg-surface p-4",
          className,
        )}
      >
        <Skeleton className="size-5 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
        </div>
      </LoadingShell>
    );
  }

  const isResolved = status === "resolved";
  const isWaived = status === "waived";

  const severityStyles: Record<
    FlagSeverity,
    { border: string; bg: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    critical: {
      border: "border-danger/35",
      bg: "bg-danger-50/20",
      iconColor: "text-danger",
      Icon: AlertOctagon,
    },
    high: {
      border: "border-warn/35",
      bg: "bg-warn-50/25",
      iconColor: "text-warn",
      Icon: AlertTriangle,
    },
    medium: {
      border: "border-info/35",
      bg: "bg-info-50/20",
      iconColor: "text-info",
      Icon: Info,
    },
  };

  const currentConfig = severityStyles[severity];
  const IconComponent = isResolved ? CheckCircle : currentConfig.Icon;

  const severityInfo = FLAG_SEVERITIES[severity] ?? FLAG_SEVERITIES.medium;
  const statusInfo = FLAG_STATUSES[status] ?? FLAG_STATUSES.open;

  const role =
    status === "open" && severity === "critical"
      ? "alert"
      : status === "open"
        ? "status"
        : undefined;

  return (
    <div
      role={role}
      className={cn(
        "flex flex-col justify-between gap-3 rounded-lg border p-4 transition-all sm:flex-row sm:items-start",
        isResolved
          ? "border-ok/30 bg-ok-50/15"
          : isWaived
            ? "border-line bg-canvas/70 opacity-75"
            : cn(currentConfig.border, currentConfig.bg),
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <IconComponent
          className={cn(
            "size-5 shrink-0 mt-0.5",
            isResolved ? "text-ok" : isWaived ? "text-ink-3" : currentConfig.iconColor,
          )}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {code && (
              <span className="font-mono text-xs font-bold text-ink-3">
                {code}
              </span>
            )}
            <h4
              className={cn(
                "font-display text-sm font-bold text-ink",
                isWaived && "line-through text-ink-3",
              )}
            >
              {title}
            </h4>
            <StatusBadge tone={severityInfo.tone}>
              {severityInfo.label}
            </StatusBadge>
            {status !== "open" && (
              <StatusBadge tone={statusInfo.tone}>
                {statusInfo.label}
              </StatusBadge>
            )}
          </div>

          {description && (
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              {description}
            </p>
          )}
        </div>
      </div>

      {actionSlot && <div className="flex shrink-0 items-center gap-2 pt-0.5">{actionSlot}</div>}
    </div>
  );
}
