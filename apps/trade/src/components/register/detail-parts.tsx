import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "@entrust/ui";

// The pieces the two business pages are made of: a card of labelled facts, one fact, and the link back to the list.

export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
      ← {children}
    </Link>
  );
}

/** A label and what it says. A long answer, or one with several lines, takes the whole row. */
export function Fact({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

/** Text that is long enough to read better across the whole card. */
export const isLong = (text: string | null | undefined): boolean => !!text && (text.length > 60 || text.includes("\n"));

export function Section({ id, title, children, wide = false }: { id: string; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <Card className={`p-4 sm:p-5 ${wide ? "lg:col-span-2" : ""}`}>
      <section aria-labelledby={id}>
        <h2 id={id} className="font-display text-lg font-bold text-ink">
          {title}
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">{children}</dl>
      </section>
    </Card>
  );
}

export const linkClass = "text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500";
