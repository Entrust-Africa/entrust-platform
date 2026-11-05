import Link from "next/link";
import { APPLICATION_QUESTIONS, isYes, type ApplicationQuestionKey } from "@entrust/trade-engine";
import { Card, StatusBadge } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { BackLink, Fact, Section, isLong, linkClass } from "@/components/register/detail-parts";
import { applicationPhoneHref, formatDay } from "@/components/register/format";

export const metadata = { title: "Application details" };

const LABEL = Object.fromEntries(APPLICATION_QUESTIONS.map((q) => [q.key, q.label])) as Record<ApplicationQuestionKey, string>;

// The form's questions, grouped the way staff read them. A group with no answers is left out.
const GROUPS: { id: string; title: string; keys: ApplicationQuestionKey[] }[] = [
  { id: "business", title: "The business", keys: ["produces", "category", "mainProducts", "capacity", "employees", "yearEstablished", "sellsWhere", "revenue", "challenges"] },
  { id: "exporting", title: "Exporting", keys: ["exportedBefore", "documents", "standards", "exportMarkets", "constraint", "canIncreaseProduction", "supportNeeded"] },
  { id: "finance", title: "Banking and finance", keys: ["hasBankAccount", "bank", "hadLoan", "zemenInterest"] },
  { id: "programme", title: "The programme", keys: ["whyJoin", "expectations", "availability", "heardFrom", "additional"] },
];
const KNOWN = new Set<string>(GROUPS.flatMap((g) => g.keys));

/** One response to a programme's application form, from a business in Ethiopia, with every answer as typed. Staff only. */
export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/register/applications/${id}`;
  const me = await requireUser(path);
  if (!me.staffRole) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for Entrust staff</h1>
          <p className="mt-3 text-sm text-ink-2">It holds what a business said when it applied to a programme.</p>
        </Card>
      </div>
    );
  }

  const a = await load(path, (api) => ok(api.v1.trade.applications[":id"].$get({ param: { id } })));
  const others = Object.keys(a.answers).filter((k) => !KNOWN.has(k) && a.answers[k]);

  return (
    <div className="space-y-6">
      <BackLink href="/register?view=applications">Applications</BackLink>

      <header>
        <h1 className="break-words font-display text-2xl font-bold text-ink">{a.businessName}</h1>
        <p className="mt-1 text-sm text-ink-2">{a.contactName ?? "No contact given"}</p>
        <p className="mt-1 text-sm text-ink-3">
          Applied {formatDay(a.submittedAt)} · {a.program}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {a.timesApplied > 1 && <StatusBadge tone="info">{`Applied ${a.timesApplied} times`}</StatusBadge>}
          {a.answers.zemenInterest && <StatusBadge tone={isYes(a.answers.zemenInterest) ? "ok" : "idle"}>{isYes(a.answers.zemenInterest) ? "Wants Zemen financing" : "Not asking for Zemen financing"}</StatusBadge>}
          {isYes(a.answers.exportedBefore) && <StatusBadge tone="ok">Has exported</StatusBadge>}
        </div>
      </header>

      {(a.alsoInRegister.length > 0 || a.otherResponses.length > 0) && (
        <Card className="space-y-4 p-4 sm:p-5">
          {a.alsoInRegister.length > 0 && (
            <section aria-labelledby="in-register">
              <h2 id="in-register" className="font-display text-lg font-bold text-ink">
                In the SME register
              </h2>
              <p className="mt-1 text-sm text-ink-2">A business with the same phone number or email address.</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {a.alsoInRegister.map((r) => (
                  <li key={r.id}>
                    <Link href={`/register/${r.id}`} className={`font-semibold ${linkClass}`}>
                      {r.companyName}
                    </Link>
                    <span className="text-ink-3"> · {r.code}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {a.otherResponses.length > 0 && (
            <section aria-labelledby="other-responses">
              <h2 id="other-responses" className="font-display text-lg font-bold text-ink">
                Other responses from this business
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {a.otherResponses.map((o) => (
                  <li key={o.id}>
                    <Link href={`/register/applications/${o.id}`} className={`font-semibold ${linkClass}`}>
                      Applied {formatDay(o.submittedAt)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </Card>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Section id="contact" title="Contact">
          <Fact label="Location">{a.location ?? "–"}</Fact>
          <Fact label="Phone">{a.phone ? <a className={linkClass} href={applicationPhoneHref(a.phone)}>{a.phone}</a> : "–"}</Fact>
          <Fact label="Email">
            <a className={`break-all ${linkClass}`} href={`mailto:${a.email}`}>
              {a.email}
            </a>
          </Fact>
        </Section>

        {GROUPS.map((group) => {
          const keys = group.keys.filter((k) => a.answers[k]);
          if (keys.length === 0) return null;
          return (
            <Section key={group.id} id={group.id} title={group.title}>
              {keys.map((k) => (
                <Fact key={k} label={LABEL[k]} wide={isLong(a.answers[k])}>
                  {a.answers[k]}
                </Fact>
              ))}
            </Section>
          );
        })}

        {others.length > 0 && (
          <Section id="other-answers" title="Other answers" wide>
            {others.map((k) => (
              <Fact key={k} label={k} wide={isLong(a.answers[k])}>
                {a.answers[k]}
              </Fact>
            ))}
          </Section>
        )}
      </div>

      <p className="text-xs text-ink-3">Answers are shown as the business typed them. Only Entrust staff see this page; a sponsor sees none of it unless the business agrees to share it.</p>
    </div>
  );
}
