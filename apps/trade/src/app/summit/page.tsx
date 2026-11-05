import { CalendarDays, CheckCircle2, FileText, Globe2, Lock, Send, UserPlus } from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe, serverApi } from "@/lib/api";
import { ok } from "@/lib/summit-api";
import { countryName, formatDateTime, type SummitPeriod } from "@/lib/summit";
import { LinkButton } from "@/components/summit/link-button";

export const metadata = { title: "Africa Diaspora Trade and Investment Summit" };

const REQUIREMENTS = [
  "Your business is registered, or it has a legal status that your country accepts.",
  "It is running now, or it is a documented venture that is ready to launch.",
  "You are allowed to apply for the business, for example as an owner or manager.",
  "You can tell us clearly what the business sells or offers.",
  "You accept the declaration and the data-use terms in the form.",
  "You can send the minimum supporting documents.",
];

const STEPS = [
  { icon: UserPlus, title: "Create your account", body: "Sign up with your email and confirm it. Then add your business." },
  { icon: FileText, title: "Fill in the form", body: "There are nine short parts. Your answers save as you go, so you can stop and come back." },
  { icon: Send, title: "Add documents and send", body: "Upload your files, check your answers and send. We tell you right away if you meet the requirements." },
  { icon: CheckCircle2, title: "We review", body: "Our team reviews every eligible application. Around 100 businesses will be selected. We email you the result." },
];

async function currentPeriod(): Promise<SummitPeriod | null> {
  try {
    return (await ok((await serverApi()).v1.summit.period.$get())).period;
  } catch {
    return null;
  }
}

function windowText(period: SummitPeriod | null): { badge: { tone: "ok" | "info" | "idle"; label: string }; line: string } {
  if (!period) return { badge: { tone: "idle", label: "Dates to come" }, line: "We will announce the application dates soon." };
  if (period.state === "open") return { badge: { tone: "ok", label: "Open now" }, line: `Applications close on ${formatDateTime(period.closesAt)}.` };
  if (period.state === "upcoming") {
    return { badge: { tone: "info", label: "Opens soon" }, line: `Applications open on ${formatDateTime(period.opensAt)} and close on ${formatDateTime(period.closesAt)}.` };
  }
  return { badge: { tone: "idle", label: "Closed" }, line: `Applications closed on ${formatDateTime(period.closesAt)}.` };
}

export default async function SummitPage() {
  const [me, period] = await Promise.all([getMe(), currentPeriod()]);
  const when = windowText(period);
  const closed = period?.state === "closed";

  // Someone who is signed in goes straight to their application. A visitor signs in first and comes back.
  const apply = me
    ? { href: "/summit/apply", label: closed ? "See my application" : "Go to my application" }
    : { href: "/sign-in?next=%2Fsummit%2Fapply", label: "Sign in or create an account to apply" };

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-8">
      <section className="overflow-hidden rounded-xl bg-night px-5 py-8 text-on-night sm:px-8 sm:py-12">
        <p className="text-sm font-bold tracking-[0.14em] text-on-night-muted uppercase">Entrust Africa</p>
        <h1 className="mt-3 font-display text-3xl font-extrabold leading-tight sm:text-4xl">
          Africa Diaspora Trade and Investment Summit
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-on-night-muted">
          A one-time event in late December or early January. It brings small and medium businesses from about 10 African countries together with
          buyers, investors and partners from the diaspora. About 100 businesses will be selected.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {!closed || me ? (
            <LinkButton href={apply.href} variant="on-night" className="w-full sm:w-auto">
              {apply.label}
            </LinkButton>
          ) : null}
        </div>
      </section>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <CalendarDays className="size-6 text-brand-600" aria-hidden="true" />
          <h2 className="font-display text-xl font-bold text-ink">When to apply</h2>
          <StatusBadge tone={when.badge.tone}>{when.badge.label}</StatusBadge>
        </div>
        <p className="mt-3 text-base leading-relaxed text-ink-2">{period ? `${period.name}. ${when.line}` : when.line}</p>
        {period && period.countries.length > 0 && (
          <div className="mt-4 flex items-start gap-3 border-t border-line pt-4">
            <Globe2 className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold text-ink">Businesses from these countries can apply</p>
              <p className="mt-1 text-base text-ink-2">
                {period.countries
                  .map(countryName)
                  .sort((a, b) => a.localeCompare(b))
                  .join(", ")}
                .
              </p>
            </div>
          </div>
        )}
      </Card>

      <section aria-labelledby="who" className="space-y-4">
        <h2 id="who" className="font-display text-2xl font-bold text-ink">
          Who can apply
        </h2>
        <p className="text-base text-ink-2">Your business needs to meet all of these. Each business can send one application.</p>
        <ul className="space-y-3">
          {REQUIREMENTS.map((text) => (
            <li key={text} className="flex items-start gap-3 text-base text-ink">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="font-display text-2xl font-bold text-ink">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card className="h-full p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-display text-base font-bold text-ink">
                    {i + 1}. {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-base leading-relaxed text-ink-2">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="trade" className="space-y-3">
        <h2 id="trade" className="font-display text-2xl font-bold text-ink">
          What is TRADE?
        </h2>
        <p className="text-base leading-relaxed text-ink-2">
          TRADE is Entrust Africa's platform for helping African businesses get ready to export. The Summit application lives here, so you use one account
          across Entrust platforms.
        </p>
      </section>

      <section className="flex items-start gap-3 rounded-lg border border-line bg-surface-2 p-4">
        <Lock className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden="true" />
        <p className="text-base leading-relaxed text-ink-2">
          Your information stays with Entrust. We do not share it with investors, buyers, banks or other partners without your permission.
        </p>
      </section>

      {(!closed || me) && (
        <div className="flex flex-col gap-3 border-t border-line pt-8 sm:flex-row sm:items-center">
          <LinkButton href={apply.href} className="w-full sm:w-auto">
            {apply.label}
          </LinkButton>
          {!me && <p className="text-sm text-ink-3">You will come back here after you sign in.</p>}
        </div>
      )}
    </div>
  );
}
