import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";

export const metadata = { title: "My plan" };

export default async function TradeHomePage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];
  const isStaff = Boolean(me.staffRole);
  const hasTradeAccess = isStaff || (activeOrg?.platforms.includes("trade") ?? false);

  if (!hasTradeAccess) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            You aren't enrolled in a TRADE program
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Your current organisation does not currently have access to the TRADE platform. If your organisation has been admitted to a cohort or pilot program, switch to that organisation using the switcher above, or contact your Entrust facilitator or support team at support@entrust-africa.com.
          </p>
        </Card>
      </div>
    );
  }

  if (isStaff) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Staff Overview</h1>
          <p className="mt-1 text-sm text-ink-2">
            Entrust administrator and facilitator portal for TRADE cohorts and reviews.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink">Cohorts</h2>
            <p className="mt-1 text-sm text-ink-2">Review pilot cohorts and enrolled SMEs.</p>
            <Link href="/cohorts" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
              View cohorts →
            </Link>
          </Card>
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink">Review queue</h2>
            <p className="mt-1 text-sm text-ink-2">Evaluate assessments and pending approvals.</p>
            <Link href="/review-queue" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
              Open queue →
            </Link>
          </Card>
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink">Reports</h2>
            <p className="mt-1 text-sm text-ink-2">Program performance and export readiness metrics.</p>
            <Link href="/reports" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
              View reports →
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  if (activeOrg?.kind === "sponsor") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Sponsor Dashboard</h1>
          <p className="mt-1 text-sm text-ink-2">
            Welcome, {activeOrg.name}. Track aggregate capability development for your sponsored cohorts.
          </p>
        </div>
        <Card className="p-8 text-center max-w-xl mx-auto mt-6">
          <h2 className="font-display text-lg font-bold text-ink">Sponsored Cohort Metrics</h2>
          <p className="mt-2 text-sm text-ink-2">
            Aggregate reports and readiness benchmarks for your sponsored cohorts will appear here.
          </p>
          <div className="mt-6">
            <Link
              href="/reports"
              className="inline-flex h-9 items-center rounded-md bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700"
            >
              View cohort reports
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // SME User View: My Plan
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">My Learning Plan</h1>
          <p className="mt-1 text-sm text-ink-2">
            Tailored capability roadmap for {activeOrg?.name ?? "your organisation"}.
          </p>
        </div>
        <StatusBadge tone="info">Pathway A: Export Readiness</StatusBadge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-2">
          <h2 className="font-display text-lg font-bold text-ink">Placement Diagnostic</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Complete the 7-section diagnostic assessment to score your company's export execution, identify capability gaps, and unlock priority learning modules.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/modules"
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Explore modules
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas"
            >
              Upload records
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-base font-bold text-ink">Milestones</h2>
          <ul className="mt-4 space-y-3 text-sm text-ink-2">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand-600" />
              <span>Diagnostic assessment</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-line" />
              <span>Foundational modules (M01-M03)</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-line" />
              <span>Evidence submission</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-line" />
              <span>Export deal simulation (M08)</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
