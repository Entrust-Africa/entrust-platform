import * as React from "react";
import { AlertCircle, Calendar, Clock, User } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, Skeleton } from "./skeleton";
import { StatusBadge, type StatusTone } from "./status-badge";

export interface StepRowProps {
  name?: string;
  stepCode?: string;
  owner?: string;
  taskStatus?: { label: string; tone: StatusTone };
  dueDate?: string;
  isOverdue?: boolean;
  blockedReason?: string;
  notApplicableReason?: string;
  actionSlot?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function StepRow({
  name,
  stepCode,
  owner,
  taskStatus,
  dueDate,
  isOverdue = false,
  blockedReason,
  notApplicableReason,
  actionSlot,
  loading = false,
  error = null,
  onRetry,
  className,
}: StepRowProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading step"
        className={cn(
          "flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-24 rounded-sm" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    );
  }

  const isBlocked = Boolean(blockedReason) || taskStatus?.tone === "danger";
  const isNotApplicable = Boolean(notApplicableReason);

  return (
    <div
      className={cn(
        "group flex flex-col justify-between gap-3 rounded-lg border bg-surface p-4 transition-all sm:flex-row sm:items-center",
        isBlocked ? "border-danger/40 bg-danger-50/20" : isNotApplicable ? "border-line bg-canvas/60 opacity-80" : "border-line hover:border-line-strong",
        className,
      )}
    >
      {/* Left content: Step code, title, owner, and reasons */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {stepCode && (
            <span className="font-mono text-xs font-bold text-ink-3">
              {stepCode}
            </span>
          )}
          <span
            className={cn(
              "font-display text-sm font-semibold tracking-tight text-ink",
              isNotApplicable && "line-through text-ink-3",
            )}
          >
            {name}
          </span>
        </div>

        {/* Metadata row: Owner & Due date */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
          {owner && (
            <span className="inline-flex items-center gap-1">
              <User className="size-3.5" aria-hidden="true" />
              <span>{owner}</span>
            </span>
          )}

          {dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                isOverdue ? "font-semibold text-danger" : "text-ink-3",
              )}
            >
              {isOverdue ? (
                <Clock className="size-3.5 text-danger" aria-hidden="true" />
              ) : (
                <Calendar className="size-3.5" aria-hidden="true" />
              )}
              <span>{isOverdue ? `Overdue: ${dueDate}` : `Due: ${dueDate}`}</span>
            </span>
          )}
        </div>

        {/* Blocked or N/A Reason callouts */}
        {blockedReason && (
          <div className="mt-2.5 inline-flex items-start gap-1.5 rounded-sm bg-danger-50 px-2.5 py-1 text-xs font-medium text-danger">
            <AlertCircle className="size-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{blockedReason}</span>
          </div>
        )}

        {notApplicableReason && (
          <p className="mt-1.5 text-xs italic text-ink-3">
            Not applicable: {notApplicableReason}
          </p>
        )}
      </div>

      {/* Right actions: Status badge & action button slot */}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {taskStatus && (
          <StatusBadge tone={taskStatus.tone}>{taskStatus.label}</StatusBadge>
        )}
        {actionSlot}
      </div>
    </div>
  );
}
