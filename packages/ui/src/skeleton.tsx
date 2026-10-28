import { cn } from "./cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded bg-line/60", className)}
      {...props}
    />
  );
}

export function LoadingShell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-label={label} className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger-50 px-4 py-3 text-sm text-danger",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <svg
          className="size-4 shrink-0 text-danger"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
          />
        </svg>
        <span>{message ?? "An error occurred while loading this component."}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold underline underline-offset-4 hover:text-danger-900 focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  className,
  actionSlot,
}: {
  title: string;
  description?: string;
  className?: string;
  actionSlot?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/50 px-6 py-10 text-center",
        className,
      )}
    >
      <p className="font-display text-sm font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-ink-3">{description}</p>}
      {actionSlot && <div className="mt-4">{actionSlot}</div>}
    </div>
  );
}
