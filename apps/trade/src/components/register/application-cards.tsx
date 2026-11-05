import Link from "next/link";
import { APPLICATION_QUESTIONS, isYes, type ApplicationQuestionKey } from "@entrust/trade-engine";
import { Card, StatusBadge } from "@entrust/ui";
import type { ApplicationItem } from "@/lib/register";
import { applicationPhoneHref, formatDay } from "./format";

// One card a response, so long free-text answers read well on a phone. The facts staff look at first are up top; the rest of the
// answers are under "All answers". Only responses from Ethiopia ever get here: the API doesn't send the others.

const FACTS: ApplicationQuestionKey[] = ["category", "mainProducts", "employees", "yearEstablished", "revenue", "exportedBefore", "exportMarkets", "bank", "zemenInterest", "supportNeeded"];
const LABEL = Object.fromEntries(APPLICATION_QUESTIONS.map((q) => [q.key, q.label])) as Record<ApplicationQuestionKey, string>;
const REST = APPLICATION_QUESTIONS.map((q) => q.key).filter((k) => !FACTS.includes(k));

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">{children}</dd>
    </div>
  );
}

export function ApplicationCards({ items }: { items: ApplicationItem[] }) {
  return (
    <ul className="grid gap-4 lg:grid-cols-2">
      {items.map((a) => {
        const rest = REST.filter((k) => a.answers[k]);
        return (
          <li key={a.id}>
            <Card className="h-full space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words font-display text-lg font-bold text-ink">
                    <Link href={`/register/applications/${a.id}`} className="text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500">
                      {a.businessName}
                    </Link>
                  </h3>
                  <p className="text-sm text-ink-2">{a.contactName ?? "No contact given"}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-xs text-ink-3">Applied {formatDay(a.submittedAt)}</span>
                  {a.timesApplied > 1 && <StatusBadge tone="info">{`Applied ${a.timesApplied} times`}</StatusBadge>}
                </div>
              </div>

              <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                <Fact label="Location">{a.location ?? "–"}</Fact>
                <Fact label="Phone">
                  {a.phone ? (
                    <a className="text-brand-600 underline-offset-4 hover:underline" href={applicationPhoneHref(a.phone)}>
                      {a.phone}
                    </a>
                  ) : (
                    "–"
                  )}
                </Fact>
                <Fact label="Email">
                  <a className="break-all text-brand-600 underline-offset-4 hover:underline" href={`mailto:${a.email}`}>
                    {a.email}
                  </a>
                </Fact>
                {FACTS.map((key) => (
                  <Fact key={key} label={LABEL[key]}>
                    {key === "zemenInterest" && a.answers[key] ? (
                      <StatusBadge tone={isYes(a.answers[key]) ? "ok" : "idle"}>{isYes(a.answers[key]) ? "Yes" : "No"}</StatusBadge>
                    ) : (
                      (a.answers[key] ?? "–")
                    )}
                  </Fact>
                ))}
              </dl>

              {rest.length > 0 && (
                <details className="group rounded-md border border-line bg-canvas">
                  <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-brand-500">
                    All answers ({rest.length})
                  </summary>
                  <dl className="space-y-3 border-t border-line px-3 py-3">
                    {rest.map((key) => (
                      <Fact key={key} label={LABEL[key]}>
                        {a.answers[key]}
                      </Fact>
                    ))}
                  </dl>
                </details>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
