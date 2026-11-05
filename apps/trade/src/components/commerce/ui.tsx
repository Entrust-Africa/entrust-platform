"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, StatusBadge, cn } from "@entrust/ui";
import { textInput } from "@/components/form-runner/styles";
import { errorText } from "@/lib/summit-api";
import type { Look } from "@/lib/commerce";

// The small pieces every ADTIS commercial screen is made of.

const TABS = [
  ["/summit/commerce", "Dashboard"],
  ["/summit/commerce/exhibitors", "Exhibitors"],
  ["/summit/commerce/sponsors", "Sponsors"],
  ["/summit/commerce/delegates", "Delegates"],
  ["/summit/commerce/check-in", "Check-in"],
  ["/summit/commerce/directory", "SME directory"],
  ["/summit/commerce/reports", "Reports"],
  ["/summit/commerce/settings", "Settings"],
] as const;

/** The sections of the ADTIS screens. On a phone the strip scrolls sideways instead of wrapping. */
export function CommerceTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="ADTIS sections" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {TABS.map(([href, label]) => {
          const active = href === "/summit/commerce" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-semibold transition-colors",
                  active ? "border-brand-600 text-brand-900" : "border-transparent text-ink-2 hover:text-ink",
                )}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function PageTitle({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {intro && <p className="mt-1 max-w-2xl text-base text-ink-2">{intro}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Pill({ look }: { look: Look | undefined }) {
  return look ? <StatusBadge tone={look.tone}>{look.label}</StatusBadge> : null;
}

export function Stat({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: "ok" | "warn" }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-bold sm:text-3xl", tone === "ok" ? "text-ok" : tone === "warn" ? "text-warn" : "text-ink")}>{value}</p>
      {note && <p className="mt-1 text-xs text-ink-3">{note}</p>}
    </Card>
  );
}

/** A table that scrolls sideways on a narrow screen instead of squeezing its columns. */
export function DataTable({ head, children, empty, compact = false }: { head: string[]; children: React.ReactNode; empty?: string; compact?: boolean }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={cn("w-full border-collapse text-left text-sm", compact ? "min-w-0" : "min-w-[40rem]")}>
        <thead className="bg-surface-2 text-xs font-bold tracking-wide text-ink-2 uppercase">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-3 py-2.5 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {rows === 0 && <p className="px-4 py-8 text-center text-sm text-ink-3">{empty ?? "Nothing here yet."}</p>}
    </div>
  );
}

export const cell = "px-3 py-2.5 align-top";

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
        {hint && <p className="text-sm text-ink-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function Labeled({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export function TextBox({ id, label, hint, value, onChange, placeholder, type = "text", required }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <Labeled label={label} hint={hint} htmlFor={id}>
      <input id={id} type={type} value={value} required={required} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={textInput(false)} />
    </Labeled>
  );
}

export function AreaBox({ id, label, hint, value, onChange, rows = 3 }: { id: string; label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <Labeled label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600/25 focus-visible:outline-none"
      />
    </Labeled>
  );
}

/**
 * Runs something against the API, then refreshes the page so it shows the result. It keeps one error at a time, and says
 * which action is running so the right button spins.
 */
export function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [, startTransition] = useTransition();

  async function run(name: string, action: () => Promise<unknown>, done?: string): Promise<boolean> {
    setBusy(name);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      if (done) setNotice(done);
      startTransition(() => router.refresh());
      return true;
    } catch (e) {
      setError(errorText(e));
      return false;
    } finally {
      setBusy(null);
    }
  }
  return { run, busy, error, notice, setError };
}

export function Feedback({ error, notice }: { error?: string | undefined; notice?: string | undefined }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">
        {error}
      </p>
    );
  }
  return notice ? (
    <p role="status" className="rounded-md bg-ok-50 px-3 py-2 text-sm font-medium text-ok">
      {notice}
    </p>
  ) : null;
}

/** A filter bar: a search box and selects that put their choices in the address, so the server page reads them. */
export function FilterBar({ selects, search = true, placeholder = "Search" }: { selects?: { name: string; label: string; options: [string, string][] }[]; search?: boolean; placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");

  function go(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    query.delete("offset");
    router.push(`${pathname}${query.size ? `?${query}` : ""}`);
  }

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
      onSubmit={(event) => {
        event.preventDefault();
        go({ q: text.trim() });
      }}
    >
      {search && (
        <div className="flex gap-2 sm:w-72">
          <label htmlFor="filter-q" className="sr-only">
            {placeholder}
          </label>
          <input id="filter-q" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className={cn(textInput(false), "h-10")} />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
      )}
      {selects?.map((s) => (
        <div key={s.name}>
          <label htmlFor={`filter-${s.name}`} className="sr-only">
            {s.label}
          </label>
          <select
            id={`filter-${s.name}`}
            value={params.get(s.name) ?? ""}
            onChange={(e) => go({ [s.name]: e.target.value })}
            className="h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink sm:w-auto"
          >
            <option value="">{s.label}</option>
            {s.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </form>
  );
}

export function Pager({ total, limit, offset, path }: { total: number; limit: number; offset: number; path: string }) {
  const params = useSearchParams();
  if (total <= limit) return null;
  const link = (to: number) => {
    const query = new URLSearchParams(params.toString());
    if (to > 0) query.set("offset", String(to));
    else query.delete("offset");
    return `${path}${query.size ? `?${query}` : ""}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-ink-2">
      <span>
        {offset + 1} to {Math.min(offset + limit, total)} of {total}
      </span>
      <span className="flex gap-2">
        {offset > 0 && (
          <Link href={link(Math.max(0, offset - limit))} className="rounded-md border border-line-strong px-3 py-1.5 font-semibold hover:bg-surface-2">
            Previous
          </Link>
        )}
        {offset + limit < total && (
          <Link href={link(offset + limit)} className="rounded-md border border-line-strong px-3 py-1.5 font-semibold hover:bg-surface-2">
            Next
          </Link>
        )}
      </span>
    </div>
  );
}

export function KeyValues({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-bold tracking-wide text-ink-3 uppercase">{k}</dt>
            <dd className="mt-0.5 text-base break-words text-ink">{v}</dd>
          </div>
        ))}
    </dl>
  );
}
