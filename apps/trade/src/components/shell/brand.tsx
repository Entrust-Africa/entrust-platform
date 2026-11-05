import Link from "next/link";

/** The TRADE mark and name, linking home. */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      aria-label="TRADE Platform"
      onClick={onNavigate}
      className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand-500"
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-brand-600 font-display text-sm font-black text-white shadow-xs">TR</span>
      <span className="font-display text-base font-extrabold tracking-tight text-ink">TRADE</span>
    </Link>
  );
}
