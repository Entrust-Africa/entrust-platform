import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { PracticeCase, PracticeEvent, PracticeScenarios } from "@/lib/practice";
import { PracticeWorkspace } from "@/components/practice/practice-workspace";

export const metadata = { title: "Export practice" };

export default async function PracticeCasePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { id } = await params;
  const path = `/practice-cases/${encodeURIComponent(id)}`;
  const [detail, events, scenarios] = await Promise.all([
    tradeGet<PracticeCase>(path),
    tradeGet<{ items: PracticeEvent[] }>(`${path}/events`),
    tradeGet<PracticeScenarios>("/practice-scenarios"),
  ]);
  if (!detail.data || !scenarios.data) notFound();

  return (
    <div className="space-y-4">
      <div className="mx-auto max-w-4xl">
        <Link href="/practice" className="text-sm font-semibold text-brand-600 hover:underline">
          ← Export practice
        </Link>
      </div>
      <PracticeWorkspace
        key={detail.data.id}
        initialCase={detail.data}
        initialEvents={events.data?.items ?? []}
        label={scenarios.data.label}
        title={scenarios.data.scenarios.find((s) => s.id === detail.data?.practiceScenario)?.title ?? "Practice case"}
        facts={scenarios.data.facts}
      />
    </div>
  );
}
