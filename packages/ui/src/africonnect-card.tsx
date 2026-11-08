import { ArrowUpRight, Handshake } from "lucide-react";
import { cn } from "./cn";

export interface AfriConnectCardProps {
  /** AfriConnect's address for this link (from `afriConnectBuyersUrl` in `@entrust/auth/africonnect`). */
  href: string;
  title?: string;
  description?: string;
  /** The button's words. */
  action?: string;
  /** `quiet` sits on a dashboard; `strong` marks the end of a journey, when the next step is to find a buyer. */
  emphasis?: "quiet" | "strong";
  className?: string;
}

/**
 * A way across to AfriConnect, where an exporter meets buyers. It opens in a new tab so nobody loses their place on the
 * platform they came from.
 */
export function AfriConnectCard({
  href,
  title = "Meet buyers on AfriConnect",
  description = "Show your products to buyers and answer their sourcing requests on the AfriConnect marketplace.",
  action = "Meet buyers",
  emphasis = "quiet",
  className,
}: AfriConnectCardProps) {
  const strong = emphasis === "strong";
  return (
    <section
      aria-label="AfriConnect"
      className={cn(
        "flex flex-col gap-4 rounded-lg px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5",
        strong ? "bg-linear-to-r from-night to-night-2 text-on-night sm:px-7 sm:py-5" : "border border-line bg-surface",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-md",
            strong ? "bg-white/10 text-on-night" : "bg-brand-50 text-brand-700",
          )}
        >
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className={cn("font-display font-bold", strong ? "text-lg text-white" : "text-base text-ink")}>{title}</h2>
          <p className={cn("mt-0.5 max-w-2xl text-sm", strong ? "text-on-night-muted" : "text-ink-2")}>{description}</p>
        </div>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors",
          strong ? "bg-white text-night hover:bg-white/90" : "bg-brand-600 text-white hover:bg-brand-700",
        )}
      >
        {action}
        <ArrowUpRight aria-hidden className="size-4" />
        <span className="sr-only">(opens AfriConnect in a new tab)</span>
      </a>
    </section>
  );
}
