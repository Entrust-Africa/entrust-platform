import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getFacilitatorRoster, getMe } from "@/lib/api";
import { RosterSheet } from "./roster-sheet";
import { sessionWhen } from "@/lib/trade-time";

export const metadata = { title: "Session & Attendance" };

export default async function SessionDetailsPage(props: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const isStaff = Boolean(me.staffRole);
  if (!isStaff) {
    redirect("/");
  }

  const { id: cohortId, sessionId } = await props.params;
  const roster = await getFacilitatorRoster(sessionId);
  if (!roster) {
    notFound();
  }

  const { session } = roster;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/cohorts/${cohortId}`}
          className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Back to {session.cohortName}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">
              {session.programName} • {session.cohortName}
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">{session.title}</h1>
            {session.description && (
              <p className="mt-1 text-sm text-ink-2 max-w-2xl">{session.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Schedule</span>
          <p className="mt-1 text-sm font-semibold text-ink">
            {sessionWhen(session.startTime, session.endTime)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Venue / Meeting Link</span>
          <p className="mt-1 text-sm font-semibold text-ink truncate">
            {session.venue ? (
              session.venue.startsWith("http") ? (
                <a
                  href={session.venue}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  Join Meeting Link ↗
                </a>
              ) : (
                session.venue
              )
            ) : (
              "TBD"
            )}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Covered Modules</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {session.moduleCodes.length > 0 ? (
              session.moduleCodes.map((code) => (
                <span
                  key={code}
                  className="rounded bg-brand-50 px-2 py-0.5 text-xs font-mono font-semibold text-brand-700"
                >
                  {code}
                </span>
              ))
            ) : (
              <span className="text-xs text-ink-3">General session</span>
            )}
          </div>
        </Card>
      </div>

      {session.facilitatorMaterials && session.facilitatorMaterials.length > 0 && (
        <Card className="border-l-4 border-l-brand-600 bg-canvas p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700">
            Facilitator Guide & Staff Materials
          </h3>
          <ul className="mt-2 space-y-1 text-xs">
            {session.facilitatorMaterials.map((mat, i) => (
              <li key={i}>
                <a
                  href={mat.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-600 hover:underline"
                >
                  📄 {mat.title} ↗
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Roster & Attendance Form */}
      <RosterSheet roster={roster} />
    </div>
  );
}
