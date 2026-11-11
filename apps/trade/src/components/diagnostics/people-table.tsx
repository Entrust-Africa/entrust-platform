"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@entrust/ui";
import type { PublicDiagnosticPerson, PublicDiagnosticSession } from "@/lib/types";

// Fixed to Addis Ababa, where staff are, so the server and the browser print the same text.
const ZONE = "Africa/Addis_Ababa";
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: ZONE });
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONE });

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** How much of the form an unsubmitted session has answered. */
function Meter({ progress }: { progress: NonNullable<PublicDiagnosticSession["progress"]> }) {
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label={`${progress.answered} of ${progress.total} questions answered`}
        className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="text-xs tabular-nums text-ink-3">{progress.percent}%</span>
    </div>
  );
}

const statusBadge = (status: "draft" | "submitted") => (
  <StatusBadge tone={status === "submitted" ? "ok" : "warn"}>{status === "submitted" ? "Submitted" : "In progress"}</StatusBadge>
);

const avenue = (x: { pathway: "A" | "B" | null; pathwayProvisional: boolean | null; liveOrder: boolean | null }) =>
  x.pathway ? (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={x.pathway === "B" ? "product" : "info"}>{`Pathway ${x.pathway}${x.pathwayProvisional ? " (self-reported)" : ""}`}</StatusBadge>
      {x.liveOrder && <StatusBadge tone="warn">Live order</StatusBadge>}
    </div>
  ) : (
    <span className="text-ink-3">—</span>
  );

/**
 * The forms worth showing for a person. People often start the form more than once (another device, a lost link), and
 * the attempts they left behind only get in the way: once one form is submitted, only submitted forms show; until then,
 * only the one that got furthest (the newest, on a tie). Every form is still stored, and each still opens by its address.
 */
export function shownSessions(person: PublicDiagnosticPerson): PublicDiagnosticSession[] {
  const submitted = person.sessions.filter((s) => s.status === "submitted");
  if (submitted.length > 0) return submitted;
  // Sessions come newest first, so on a tie the first one met stays.
  const furthest = person.sessions.reduce<PublicDiagnosticSession | null>((best, s) => (!best || (s.progress?.percent ?? 0) > (best.progress?.percent ?? 0) ? s : best), null);
  return furthest ? [furthest] : [];
}

/** The line under a person's name when more than one of their forms shows: how many were submitted. */
function formsSummary(shown: PublicDiagnosticSession[]): string {
  return `${plural(shown.length, "form")} submitted`;
}

function PersonRows({ person }: { person: PublicDiagnosticPerson }) {
  const [open, setOpen] = useState(false);
  const shown = shownSessions(person);
  const many = shown.length > 1;
  const only = shown[0]!;
  // For a person who has not submitted, how far their furthest form got, and whether that form's email was proven.
  const furthest = person.status === "draft" ? only.progress : null;
  const proven = person.status === "draft" ? only.emailVerified : person.emailVerified;
  const latest = only.submittedAt ?? only.startedAt;
  const name = (many ? person.businessName : only.businessName) ?? person.businessName ?? "No name yet";
  const regionId = `forms-${person.email}`;

  return (
    <>
      <tr className="hover:bg-canvas/50">
        <td className="px-4 py-3">
          {many ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={regionId}
              className="-mx-1 flex w-full items-start gap-1.5 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <ChevronRight aria-hidden="true" className={`mt-0.5 size-4 shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`} />
              <span>
                <span className="block font-semibold text-ink">{name}</span>
                <span className="block text-xs text-ink-3">{person.email}</span>
                {person.phone && <span className="block text-xs text-ink-3">{person.phone}</span>}
                <span className="mt-0.5 block text-xs text-amber-700">{formsSummary(shown)}</span>
              </span>
            </button>
          ) : (
            <>
              <div className="font-semibold text-ink">{name}</div>
              <div className="text-xs text-ink-3">{person.email}</div>
              {person.phone && <div className="text-xs text-ink-3">{person.phone}</div>}
            </>
          )}
        </td>
        <td className="px-4 py-3">
          {statusBadge(person.status)}
          {!proven && <StatusBadge tone="danger">Email not proven</StatusBadge>}
          {furthest && <Meter progress={furthest} />}
        </td>
        <td className="px-4 py-3">{avenue(person)}</td>
        <td className="whitespace-nowrap px-4 py-3 text-ink-2">{formatDate(latest)}</td>
        <td className="px-4 py-3 text-ink-2">{person.organization ? person.organization.name : <span className="text-ink-3">Not yet</span>}</td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          {many ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={regionId}
              className="font-semibold text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              {open ? "Hide forms" : "Show forms"}
            </button>
          ) : (
            <Link href={`/diagnostics/${only.id}`} className="font-semibold text-brand-600 hover:underline">
              View
            </Link>
          )}
        </td>
      </tr>
      {many &&
        open &&
        shown.map((s, i) => (
          <tr key={s.id} id={i === 0 ? regionId : undefined} className="bg-canvas/60">
            <td className="border-l-2 border-line-strong py-2.5 pl-10 pr-4">
              <div className="text-sm font-medium text-ink">{s.businessName ?? "No name yet"}</div>
              <div className="text-xs text-ink-3">Started {formatDateTime(s.startedAt)}</div>
            </td>
            <td className="px-4 py-2.5">
              {statusBadge(s.status)}
              {!s.emailVerified && <StatusBadge tone="danger">Email not proven</StatusBadge>}
              {s.progress && <Meter progress={s.progress} />}
            </td>
            <td className="px-4 py-2.5">{avenue(s)}</td>
            <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{formatDate(s.submittedAt ?? s.startedAt)}</td>
            <td className="px-4 py-2.5" />
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <Link href={`/diagnostics/${s.id}`} className="font-semibold text-brand-600 hover:underline">
                View
              </Link>
            </td>
          </tr>
        ))}
    </>
  );
}

/** The staff list of the onboarding diagnostic: one line per email address, and each person's forms a click away. */
export function PeopleTable({ people }: { people: PublicDiagnosticPerson[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-line bg-canvas text-xs font-semibold text-ink-2">
        <tr>
          <th className="min-w-[13rem] px-4 py-3">Business</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Avenue</th>
          <th className="px-4 py-3">Latest</th>
          <th className="px-4 py-3">On TRADE</th>
          <th className="px-4 py-3 text-right">
            <span className="sr-only">Open</span>
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {people.map((person) => (
          <PersonRows key={person.email} person={person} />
        ))}
      </tbody>
    </table>
  );
}
