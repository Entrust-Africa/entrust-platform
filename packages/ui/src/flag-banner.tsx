import * as React from "react";
import { AlertOctagon, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, Skeleton } from "./skeleton";
import { StatusBadge, type StatusTone } from "./status-badge";

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
      <div
        aria-busy="true"
        aria-label="Loading flag banner"
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
      </div>
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

  const severityBadgeTones: Record<FlagSeverity, StatusTone> = {
    critical: "danger",
    high: "warn",
    medium: "info",
  };

  const statusBadgeTones: Record<FlagStatus, StatusTone> = {
    open: "danger",
    waived: "idle",
    resolved: "ok",
  };

  return (
    <div
      role="alert"
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
            <StatusBadge tone={severityBadgeTones[severity]}>
              {severity.toUpperCase()}
            </StatusBadge>
            {status !== "open" && (
              <StatusBadge tone={statusBadgeTones[status]}>
                {status.toUpperCase()}
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
