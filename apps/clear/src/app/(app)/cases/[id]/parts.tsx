import Link from "next/link";
import { Circle, CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleMinus, Clock, Lock } from "lucide-react";
import { cn } from "@entrust/ui";
import type { Step } from "./view";

/** A step's status as an icon, next to the label that carries the meaning. */
export function StepIcon({ step, className }: { step: Step; className?: string }) {
  const props = { "aria-hidden": true, className: cn("size-5 shrink-0", className) };
  switch (step.status) {
    case "completed":
      return <CircleCheck {...props} className={cn(props.className, "text-ok")} />;
    case "not_applicable":
      return <CircleMinus {...props} className={cn(props.className, "text-ink-3")} />;
    case "blocked":
      return step.derived && !step.heldBy.length ? (
        <Lock {...props} className={cn(props.className, "text-ink-3")} />
      ) : (
        <CircleAlert {...props} className={cn(props.className, "text-danger")} />
      );
    case "undetermined":
      return <CircleDashed {...props} className={cn(props.className, "text-ink-3")} />;
    case "in_progress":
      return <CircleDot {...props} className={cn(props.className, "text-info")} />;
    case "not_started":
      return <Circle {...props} className={cn(props.className, "text-line-strong")} />;
    default:
      return <Clock {...props} className={cn(props.className, "text-warn")} />;
  }
}

/** Filter links over a list, with how many each one keeps. */
export function FilterChips({
  label,
  options,
  current,
}: {
  label: string;
  options: { id: string; label: string; count: number; href: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1">
      <ul className="inline-flex gap-0.5 rounded-lg bg-surface-2 p-1">
        {options.map((o) => (
          <li key={o.id}>
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.id === current ? "true" : undefined}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-sm font-semibold transition-colors duration-150",
                o.id === current ? "bg-surface text-ink shadow-xs" : "text-ink-2 hover:text-ink",
              )}
            >
              {o.label}
              <span className="font-normal text-ink-3">{o.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A card's heading row, with an optional link to where the rest is. */
export function CardHeading({ title, link }: { title: string; link?: { href: string; label: string } }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
      <h3 className="text-base font-bold">{title}</h3>
      {link && (
        <Link href={link.href} scroll={false} className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** A small uppercase label over a group in the step panel. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <h3 className="font-sans text-xs font-bold tracking-wider text-ink-3 uppercase">{children}</h3>;
}
