"use client";

import { useEffect, useState } from "react";
import { Button } from "@entrust/ui";
import { countryName } from "@/lib/summit";
import type { RegistrySme, WaitingSme } from "@/lib/types";
import { enrolManyAction, searchSmesAction } from "../actions";

interface Candidate {
  organizationId: string;
  name: string;
  detail: string;
}

const fromWaiting = (s: WaitingSme): Candidate => ({
  organizationId: s.organizationId,
  name: s.legalName ?? s.organizationName,
  detail: [s.smeId, s.country ? countryName(s.country) : null, s.ownerEmail].filter(Boolean).join(" · "),
});

const fromRegistry = (s: RegistrySme): Candidate => ({
  organizationId: s.organizationId,
  name: s.legalName,
  detail: [s.smeId, countryName(s.country), s.tradingName ? `t/a ${s.tradingName}` : null].filter(Boolean).join(" · "),
});

/**
 * Staff enrol businesses in a cohort: the ones that have signed up and are waiting come first, and the SME registry
 * search finds any other (one already on CLEAR, say). Several can be enrolled at once.
 */
export function EnrollSmeDialog({
  cohortId,
  waiting,
  enrolledOrganizationIds,
}: {
  cohortId: string;
  waiting: WaitingSme[];
  enrolledOrganizationIds: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Map<string, Candidate>>(new Map());
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Candidate[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const enrolled = new Set(enrolledOrganizationIds);
  const waitingCandidates = waiting.map(fromWaiting);

  useEffect(() => {
    if (query.trim().length < 2) {
      setFound([]);
      setSearchError(null);
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const result = await searchSmesAction(query);
      if (!current) return;
      setFound(result.smes.map(fromRegistry));
      setSearchError(result.error);
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  function toggle(candidate: Candidate) {
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(candidate.organizationId)) next.delete(candidate.organizationId);
      else next.set(candidate.organizationId, candidate);
      return next;
    });
  }

  function selectAllWaiting() {
    setSelected((previous) => {
      const next = new Map(previous);
      for (const c of waitingCandidates) if (!enrolled.has(c.organizationId)) next.set(c.organizationId, c);
      return next;
    });
  }

  async function enrol() {
    setPending(true);
    setMessage(null);
    const result = await enrolManyAction(cohortId, [...selected.keys()]);
    setPending(false);
    if (result.failed.length === 0) {
      setSelected(new Map());
      setQuery("");
      setIsOpen(false);
      return;
    }
    const failedIds = new Set(result.failed.map((f) => f.organizationId));
    setSelected((previous) => new Map([...previous].filter(([id]) => failedIds.has(id))));
    const lines = result.failed.map((f) => `${selected.get(f.organizationId)?.name ?? f.organizationId}: ${f.error}`);
    setMessage({
      tone: "error",
      text: `${result.enrolled > 0 ? `Enrolled ${result.enrolled}. ` : ""}These weren't enrolled. ${lines.join(" ")}`,
    });
  }

  const row = (candidate: Candidate) => {
    const already = enrolled.has(candidate.organizationId);
    return (
      <li key={candidate.organizationId}>
        <label className={`flex items-start gap-3 px-3 py-2.5 ${already ? "opacity-50" : "cursor-pointer hover:bg-canvas"}`}>
          <input
            type="checkbox"
            className="mt-1"
            disabled={already}
            checked={selected.has(candidate.organizationId)}
            onChange={() => toggle(candidate)}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{candidate.name}</span>
            <span className="block truncate text-xs text-ink-3">{already ? "Already in this cohort" : candidate.detail}</span>
          </span>
        </label>
      </li>
    );
  };

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        Enrol SMEs
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="Enrol SMEs" className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg bg-surface p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h2 className="font-display text-lg font-bold text-ink">Enrol SMEs</h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Close" className="p-1 text-sm text-ink-2 hover:text-ink">
                ✕
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto">
              {message && (
                <p role="alert" className="rounded-md bg-danger-50 p-3 text-sm text-danger ring-1 ring-inset ring-danger/25">
                  {message.text}
                </p>
              )}

              <section aria-labelledby="waiting-heading">
                <div className="flex items-center justify-between">
                  <h3 id="waiting-heading" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                    Signed up, waiting to be enrolled ({waitingCandidates.length})
                  </h3>
                  {waitingCandidates.length > 0 && (
                    <button type="button" onClick={selectAllWaiting} className="text-xs font-semibold text-brand-600 hover:underline">
                      Select all
                    </button>
                  )}
                </div>
                {waitingCandidates.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-2">Nobody is waiting. A business appears here once its owner has signed up to TRADE and added the business.</p>
                ) : (
                  <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line">
                    {waitingCandidates.map(row)}
                  </ul>
                )}
              </section>

              <section aria-labelledby="find-heading">
                <h3 id="find-heading" className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                  Or find a business in the SME registry
                </h3>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, SME ID, TIN or registration number"
                  aria-label="Search the SME registry"
                  className="mt-2 w-full rounded-md border border-line-strong bg-surface px-3 h-10 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                {searchError && <p className="mt-2 text-sm text-danger">{searchError}</p>}
                {found.length > 0 && (
                  <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto rounded-md border border-line">
                    {found.map(row)}
                  </ul>
                )}
                {query.trim().length >= 2 && found.length === 0 && !searchError && (
                  <p className="mt-2 text-sm text-ink-2">No business matches that.</p>
                )}
              </section>

              <p className="rounded-md bg-canvas p-3 text-xs text-ink-2">
                Enrolling a business gives it access to TRADE, so it can fill in the onboarding diagnostic. It doesn't change the business's CLEAR access.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-xs text-ink-3">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="button" variant="primary" onClick={() => void enrol()} disabled={pending || selected.size === 0}>
                  {pending ? "Enrolling…" : `Enrol ${selected.size || ""}`.trim()}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
