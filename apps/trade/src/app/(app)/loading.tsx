/** Shown while a page's data loads, so a slow answer looks like loading rather than a frozen screen. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4 py-6">
      <span className="sr-only">Loading…</span>
      <div className="h-7 w-64 animate-pulse rounded-md bg-surface-2" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-2" />
      <div className="h-40 w-full animate-pulse rounded-lg bg-surface-2" />
    </div>
  );
}
