"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, StatusBadge } from "@entrust/ui";
import type { CatalogueSme } from "@/lib/catalogue";
import { readiness } from "@/components/register/format";

// A card for each SME in a cohort, with a box that narrows the list as you type. The whole cohort is sent to the browser, which is
// fine for the few hundred businesses a pilot has.

const matches = (sme: CatalogueSme, needle: string) =>
  [sme.name, sme.contactName, sme.location, sme.product, sme.bank, sme.reference, sme.phone, sme.email].some((v) => v?.toLowerCase().includes(needle));

const phoneHref = (phone: string) => `tel:${phone.startsWith("+") ? phone : `+${phone}`}`;

function Card_({ sme, cohortNames }: { sme: CatalogueSme; cohortNames: Record<number, string> }) {
  const level = sme.cohort === 1 ? readiness(sme.readinessLevel) : null;
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="min-w-0">
        <h3 className="break-words font-display text-base font-bold text-ink">
          <Link
            href={sme.cohort === 1 ? `/register/${sme.id}` : `/register/applications/${sme.id}`}
            className="text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            {sme.name}
          </Link>
        </h3>
        <p className="text-sm text-ink-2">{sme.contactName ?? "No contact recorded"}</p>
        {sme.reference && <p className="text-xs text-ink-3">{sme.reference}</p>}
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-3">Where</dt>
          <dd className="min-w-0 break-words text-ink">{sme.location ?? "–"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-3">Makes</dt>
          <dd className="min-w-0 break-words text-ink">{sme.product ?? "–"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-3">Staff</dt>
          <dd className="min-w-0 break-words text-ink">{sme.employees ?? "–"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-3">Bank</dt>
          <dd className="min-w-0 break-words text-ink">{sme.bank ?? "–"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-3">Contact</dt>
          <dd className="min-w-0 break-words text-ink">
            {sme.phone ? (
              <a className="text-brand-600 underline-offset-4 hover:underline" href={phoneHref(sme.phone)}>
                {sme.phone}
              </a>
            ) : (
              "–"
            )}
            {sme.email && (
              <>
                <br />
                <a className="break-all text-brand-600 underline-offset-4 hover:underline" href={`mailto:${sme.email}`}>
                  {sme.email}
                </a>
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {level && <StatusBadge tone={level.tone}>{sme.readinessScore === null ? level.label : `${level.label} readiness · ${sme.readinessScore}/25`}</StatusBadge>}
        {sme.exportedBefore === true && <StatusBadge tone="ok">Has exported</StatusBadge>}
        {sme.wantsZemenFinancing === true && <StatusBadge tone="info">Wants Zemen financing</StatusBadge>}
        {sme.alsoInCohorts.map((n) => (
          <StatusBadge key={n} tone="product">{`Also in cohort ${n}${cohortNames[n] ? ` · ${cohortNames[n]}` : ""}`}</StatusBadge>
        ))}
      </div>
      <Link
        href={sme.cohort === 1 ? `/register/${sme.id}` : `/register/applications/${sme.id}`}
        className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        Open SME details
      </Link>
    </Card>
  );
}

export function CatalogueList({ smes, cohortNames }: { smes: CatalogueSme[]; cohortNames: Record<number, string> }) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => (needle ? smes.filter((s) => matches(s, needle)) : smes), [smes, needle]);

  return (
    <div className="space-y-4">
      <label className="flex max-w-md flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">Search this cohort</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, contact, place, product or bank"
          className="h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25"
        />
      </label>
      {needle && (
        <p role="status" className="text-sm text-ink-2">
          {shown.length} of {smes.length} {smes.length === 1 ? "SME" : "SMEs"}
        </p>
      )}
      {shown.length === 0 ? (
        <EmptyState title={needle ? "Nobody matches that" : "Nobody here yet"} description={needle ? "Try a different word, or clear the search." : undefined} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((sme) => (
            <li key={sme.key}>
              <Card_ sme={sme} cohortNames={cohortNames} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
