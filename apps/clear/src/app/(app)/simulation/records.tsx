import type { DeadlineClock } from "@entrust/gate-engine";
import { Card, StatusBadge } from "@entrust/ui";
import { CLOCK_STATES } from "@/lib/statuses";
import { evidenceIssuer, evidenceName, LOG_KINDS, simDate } from "./parts";
import type { Simulation } from "./use-simulation";
import { ViewLink, type View } from "./view";

const stepLink = "inline-flex min-h-6 items-center font-mono text-xs font-semibold text-brand-600 underline-offset-4 hover:underline";

/** The documents tab: every document on file, in the order the steps filed them. */
export function DocumentsTab({ sim, view }: { sim: Simulation; view: View }) {
  const filed = sim.run.evidence;
  return (
    <>
      <h2 className="text-lg font-bold">Documents on file</h2>
      <p className="mt-0.5 text-sm text-ink-3">
        {filed.length ? `${filed.length} approved so far. ` : ""}A step is not done until the evidence it asks for is approved.
      </p>
      <Card className="mt-4 overflow-hidden">
        {filed.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink-2">Nothing is on file yet. Documents appear here as the steps put them there.</p>
        ) : (
          <ol>
            {filed.map((e) => (
              <li
                key={`${e.type}-${e.stepId}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-line px-4 py-3 text-sm first:border-t-0 sm:px-5 md:grid-cols-[minmax(0,1fr)_9rem_6rem_7rem]"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{evidenceName(e.type)}</span>
                  <span className="block text-xs text-ink-3">
                    {evidenceIssuer(e.type)}
                    {e.validUntil && <> · valid to {simDate(e.validUntil)}</>}
                  </span>
                </span>
                <span className="hidden font-mono text-xs text-ink-2 md:block">{e.reference ?? ""}</span>
                <ViewLink to={{ ...view, step: e.stepId }} mode="push" className={`${stepLink} justify-self-end md:justify-self-start`}>
                  {e.stepId}
                </ViewLink>
                <span className="hidden text-ink-2 md:block">{e.issuedOn && simDate(e.issuedOn)}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}

const moment = (due: DeadlineClock["due"]) => (due ? simDate("day" in due ? due.day : due.at) : null);

/** The deadlines tab: the clocks CLEAR runs on the case, worked out by the same engine as a real one. */
export function DeadlinesTab({ sim, view }: { sim: Simulation; view: View }) {
  const applying = sim.deadlines.filter((c) => c.state !== "not_applicable");
  const out = sim.deadlines.filter((c) => c.state === "not_applicable");
  return (
    <>
      <h2 className="text-lg font-bold">Deadlines</h2>
      <p className="mt-0.5 text-sm text-ink-3">A clock starts when the step it runs from is done.</p>
      <Card className="mt-4 overflow-hidden">
        <ul>
          {applying.map((clock) => (
            <li key={clock.id} className="border-t border-line px-4 py-3.5 text-sm first:border-t-0 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <h3 className="font-sans text-sm font-bold">{clock.label}</h3>
                <StatusBadge tone={CLOCK_STATES[clock.state].tone}>{CLOCK_STATES[clock.state].label}</StatusBadge>
              </div>
              <p className="mt-1 text-ink-2">
                {clock.startedAt ? (
                  <>
                    Runs from {simDate(clock.startedAt)} · due {moment(clock.due)}
                    {clock.closedAt && <> · met {simDate(clock.closedAt)}</>}
                  </>
                ) : (
                  "Not started: the date it runs from is not recorded yet."
                )}
              </p>
              <p className="mt-1 text-xs text-ink-3">
                {clock.source.title}, {clock.clause} ·{" "}
                <ViewLink to={{ ...view, step: clock.stepId }} mode="push" className={stepLink}>
                  {clock.stepId}
                </ViewLink>
              </p>
            </li>
          ))}
        </ul>
        {out.length > 0 && (
          <p className="border-t border-line px-4 py-3 text-sm text-ink-3 sm:px-5">
            Not running on this order: {out.map((c) => c.label).join(", ")}.
          </p>
        )}
      </Card>
    </>
  );
}

/** The activity tab: everything that has happened, newest first. */
export function ActivityTab({ sim, view }: { sim: Simulation; view: View }) {
  const log = sim.run.log.toReversed();
  return (
    <>
      <h2 className="text-lg font-bold">Activity</h2>
      <p className="mt-0.5 text-sm text-ink-3">
        {log.length === 1 ? "1 entry" : `${log.length} entries`}, newest first. Dates are on the simulated calendar.
      </p>
      <Card className="mt-4 overflow-hidden">
        <ol>
          {log.map((entry) => (
            <li key={entry.n} className="border-t border-line px-4 py-3 text-sm first:border-t-0 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <StatusBadge tone={LOG_KINDS[entry.kind].tone}>{LOG_KINDS[entry.kind].label}</StatusBadge>
                <span className="text-ink-3">{simDate(entry.at)}</span>
                {entry.stepId && (
                  <ViewLink to={{ ...view, step: entry.stepId }} mode="push" className={stepLink}>
                    {entry.stepId}
                  </ViewLink>
                )}
              </div>
              <p className="mt-1.5 font-semibold">{entry.title}</p>
              <p className="mt-0.5 text-ink-2">{entry.detail}</p>
              <p className="mt-0.5 text-xs text-ink-3">{entry.actor}</p>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
