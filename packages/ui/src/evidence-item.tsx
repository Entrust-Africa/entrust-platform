import * as React from "react";
import { Download, FileText, MessageSquare } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, Skeleton } from "./skeleton";
import { StatusBadge, type StatusTone } from "./status-badge";

export interface EvidenceFile {
  name: string;
  sizeBytes?: number;
  url?: string;
  uploadedAt?: string;
}

export interface EvidenceItemProps {
  documentType?: string;
  status?: { label: string; tone: StatusTone };
  file?: EvidenceFile;
  reviewerNote?: string;
  actionSlot?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function EvidenceItem({
  documentType,
  status,
  file,
  reviewerNote,
  actionSlot,
  loading = false,
  error = null,
  onRetry,
  className,
}: EvidenceItemProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading evidence item"
        className={cn("flex flex-col gap-3 rounded-lg border border-line bg-surface p-4", className)}
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-24 rounded-sm" />
        </div>
        <Skeleton className="h-4 w-56" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 transition-all hover:border-line-strong",
        className,
      )}
    >
      {/* Top Header: Document Type, Status Badge, and Action Slot */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <FileText className="size-4.5 shrink-0 text-brand-600" aria-hidden="true" />
          <h4 className="font-display text-sm font-bold text-ink">
            {documentType}
          </h4>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          {status && <StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
          {actionSlot}
        </div>
      </div>

      {/* File attachment link and metadata if provided */}
      {file && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line/60 bg-canvas/70 px-3 py-2 text-xs text-ink-2">
          <span className="font-medium truncate max-w-xs">{file.name}</span>
          {file.sizeBytes && (
            <span className="text-ink-3">({formatBytes(file.sizeBytes)})</span>
          )}
          {file.uploadedAt && (
            <span className="text-ink-3">· {file.uploadedAt}</span>
          )}
          {file.url && (
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Download className="size-3.5" aria-hidden="true" />
              <span>Download</span>
            </a>
          )}
        </div>
      )}

      {/* Reviewer Note Callout */}
      {reviewerNote && (
        <div className="flex items-start gap-2 rounded-md bg-warn-50/60 border border-warn/25 p-3 text-xs text-ink">
          <MessageSquare className="size-4 shrink-0 mt-0.5 text-warn" aria-hidden="true" />
          <div className="min-w-0">
            <span className="font-semibold block text-warn">Reviewer feedback</span>
            <p className="mt-0.5 text-ink-2 leading-relaxed">{reviewerNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}
