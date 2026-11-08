import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { PracticeScenarios, PracticeSummary } from "@/lib/practice";
import { StartPractice } from "@/components/practice/start-practice";

export const metadata = { title: "Export practice" };

export default async function PracticePage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const [scenarios, cases] = await Promise.all([
    tradeGet<PracticeScenarios>("/practice-scenarios"),
    tradeGet<{ items: PracticeSummary[] }>("/practice-cases"),
  ]);

  if (!scenarios.data) {
    return (
      <Card className="mx-auto mt-6 max-w-xl p-8 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Export practice isn't open for your account</h1>
        <p className="mt-2 text-sm text-ink-2">It opens when your organisation joins TRADE.</p>
      </Card>
    );
  }

  const organizationId = me.activeOrganizationId ?? me.organizations?.[0]?.id;
  const started = cases.data?.items ?? [];
  const titleOf = (id: string | null) => scenarios.data?.scenarios.find((s) => s.id === id)?.title ?? "Practice case";
  const startedIds = new Set(started.map((c) => c.practiceScenario));
  const toStart = scenarios.data.scenarios.filter((s) => !startedIds.has(s.id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Export practice</h1>
        <p className="mt-1 text-sm text-ink-2">Module M08: run a whole export from first step to bank closure, on the same rules a real case follows. You take every party's turn, so you see the whole journey.</p>
      </div>
      <p role="note" className="rounded-md bg-warn-50 px-4 py-2.5 text-sm font-semibold text-warn">
        {scenarios.data.label}
      </p>

      {started.length > 0 && (
        <section aria-labelledby="continue" className="space-y-3">
          <h2 id="continue" className="font-display text-lg font-bold text-ink">
            Carry on
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {started.map((c) => (
              <li key={c.id}>
                <Link href={`/practice/${c.id}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-brand-500">
                  <Card className="h-full p-5 transition-colors hover:border-brand-500">
                    <p className="font-semibold text-ink">{titleOf(c.practiceScenario)}</p>
                    <p className="mt-1 text-sm text-ink-2">
                      {c.reference} · Phase {c.currentPhase}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {toStart.length > 0 && (
        <section aria-labelledby="start" className="space-y-3">
          <h2 id="start" className="font-display text-lg font-bold text-ink">
            Start a practice
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {toStart.map((scenario) => (
              <li key={scenario.id}>
                <StartPractice scenario={scenario} facts={scenarios.data!.facts} organizationId={organizationId} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
