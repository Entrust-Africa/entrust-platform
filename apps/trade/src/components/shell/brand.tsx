import Image from "next/image";
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
      <Image src="/logo.png" alt="" width={36} height={36} className="size-9 object-contain" priority />
      <span className="font-display text-base font-extrabold tracking-tight text-ink">TRADE</span>
    </Link>
  );
}
