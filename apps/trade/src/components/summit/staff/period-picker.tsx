import Link from "next/link";
import { cn } from "@entrust/ui";

/** Which application period a screen shows, for staff who can see more than one. Each period is a link that keeps the page and changes `periodId`. */
export function PeriodPicker({ basePath, periods, currentId }: { basePath: string; periods: { id: string; name: string }[]; currentId: string | undefined }) {
  if (periods.length < 2) return null;
  return (
    <nav aria-label="Application period" className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-ink-2">Period</span>
      {periods.map((p) => (
        <Link
          key={p.id}
          href={`${basePath}?periodId=${p.id}`}
          aria-current={p.id === currentId ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1 font-semibold", p.id === currentId ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line-strong text-ink-2 hover:bg-surface-2")}
        >
          {p.name}
        </Link>
      ))}
    </nav>
  );
}
