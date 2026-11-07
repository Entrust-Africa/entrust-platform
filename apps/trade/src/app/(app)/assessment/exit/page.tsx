import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, TrendingUp, Award, BarChart3, CheckCircle2 } from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe, listEnrollments } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { AssessmentIndexPage } from "@/components/assessment/assessment-page";
import type { ExitAssessmentReportView } from "@/lib/types";

export const metadata = { title: "Exit Assessment & Capability Report" };

export default async function ExitAssessmentPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];

  const enrollments = activeOrg ? await listEnrollments({ organizationId: activeOrg.id }) : [];
  const currentEnrollment = enrollments[0];

  if (!currentEnrollment) {
    return (
      <div className="mx-auto max-w-xl py-12 text-center space-y-4">
        <p className="text-sm text-ink-3">No active enrollment found for this organization.</p>
        <Link href="/" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Go to Home
        </Link>
      </div>
    );
  }

  // Check if exit assessment report is available
  const reportRes = await tradeGet<ExitAssessmentReportView>(
    `/enrollments/${currentEnrollment.id}/exit-report`
  );

  const report = reportRes.data;

  // If exit assessment has not been submitted yet, show the assessment runner / start page
  if (!report || !report.exitAssessmentId) {
    return <AssessmentIndexPage kind="exit" />;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-3 hover:text-ink mb-2"
          >
            <ArrowLeft className="size-3.5" />
            Back to My Plan
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-ink">Capability Growth Report</h1>
            <StatusBadge tone="ok">EXIT ASSESSMENT SCORED</StatusBadge>
          </div>
          <p className="text-sm text-ink-3">
            Comparison between your placement baseline and your exit assessment scores across the 6 core trade domains.
          </p>
        </div>

        <Link
          href="/certificate"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm transition-colors"
        >
          <Award className="size-4" />
          View Certificate
        </Link>
      </div>

      {/* Summary Card */}
      <Card className="p-6 bg-gradient-to-r from-brand-50/50 to-emerald-50/40 border-brand-200 space-y-3">
        <div className="flex items-center gap-2 text-brand-800 font-semibold text-sm">
          <TrendingUp className="size-4" />
          Program Impact & Capability Advancement
        </div>
        <p className="text-xs text-ink-2 leading-relaxed">
          The exit assessment repeats sections B through G of the diagnostic to objectively measure capability progression.
          Your responses reflect demonstrated skills gained across all modules without altering your completed learning plan.
        </p>
      </Card>

      {/* Domain-by-Domain Comparative Grid */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink-3">Domain Capability Comparisons</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.comparisons.map((c) => {
            const delta = c.deltaScore;
            const isPositive = delta !== null && delta > 0;
            return (
              <Card key={c.domainId} className="p-5 space-y-4 border border-border">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-ink">{c.domainTitle}</h3>
                  {delta !== null && (
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded-full ${
                        isPositive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-canvas text-ink-3 border border-border"
                      }`}
                    >
                      {isPositive ? `+${delta}%` : `${delta}%`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">Placement Baseline</span>
                    <div className="text-lg font-bold text-ink">
                      {c.placementScore !== null ? `${c.placementScore}%` : "–"}
                    </div>
                    {c.placementBandLabel && (
                      <span className="text-xs text-ink-3 block capitalize">{c.placementBandLabel}</span>
                    )}
                  </div>

                  <div className="space-y-1 border-l border-border/60 pl-3">
                    <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wider">Exit Score</span>
                    <div className="text-lg font-bold text-emerald-700">
                      {c.exitScore !== null ? `${c.exitScore}%` : "–"}
                    </div>
                    {c.exitBandLabel && (
                      <span className="text-xs font-semibold text-emerald-800 block capitalize">{c.exitBandLabel}</span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
