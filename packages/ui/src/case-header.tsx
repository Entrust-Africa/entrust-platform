import * as React from "react";
import { ArrowRight, Package } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, LoadingShell, Skeleton } from "./skeleton";
import { StatusBadge, type StatusTone } from "./status-badge";

export interface CaseHeaderProps {
  reference?: string;
  exporterName?: string;
  buyerName?: string;
  product?: string;
  terms?: string;
  status?: { label: string; tone: StatusTone };
  headingLevel?: "h1" | "h2" | "h3";
  actionSlot?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function CaseHeader({
  reference,
  exporterName,
  buyerName,
  product,
  terms,
  status,
  headingLevel = "h1",
  actionSlot,
  loading = false,
  error = null,
  onRetry,
  className,
}: CaseHeaderProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (loading) {
    return (
      <LoadingShell
        label="Loading case header"
        className={cn(
          "flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-xs",
          className,
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-4 w-32 font-mono" />
          <Skeleton className="h-6 w-20 rounded-sm" />
        </div>
        <Skeleton className="h-8 w-3/4 max-w-md" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      </LoadingShell>
    );
  }

  const HeadingTag = headingLevel;

  return (
    <div
      className={cn(
        "flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface p-6 shadow-xs sm:flex-row sm:items-start",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {/* Top Reference & Status */}
        <div className="flex flex-wrap items-center gap-3">
          {reference && (
            <span className="font-mono text-xs font-bold tracking-wider text-ink-3">
              {reference}
            </span>
          )}
          {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
        </div>

        {/* Exporter -> Buyer Trade Title */}
        <HeadingTag className="mt-2 font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
          <span>
            {exporterName ? (
              exporterName
            ) : (
              <span className="font-normal text-ink-3">Not recorded</span>
            )}
          </span>
          <span className="mx-2 inline-flex items-center" aria-hidden="true">
            <ArrowRight className="size-5 text-ink-3" />
          </span>
          <span className="sr-only"> to </span>
          <span>
            {buyerName ? (
              buyerName
            ) : (
              <span className="font-normal text-ink-3">Not recorded</span>
            )}
          </span>
        </HeadingTag>

        {/* Product & Terms metadata */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2">
          {product && (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Package className="size-3.5 text-brand-600" aria-hidden="true" />
              <span>{product}</span>
            </span>
          )}

          {terms && (
            <span className="border-l border-line pl-4 text-ink-3">
              {terms}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons slot */}
      {actionSlot && <div className="flex shrink-0 items-center gap-2 pt-1">{actionSlot}</div>}
    </div>
  );
}
