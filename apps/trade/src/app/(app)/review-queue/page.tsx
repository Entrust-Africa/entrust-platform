import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  Filter,
  Inbox,
  Layers,
} from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type { ModuleSubmissionView } from "@/lib/types";

export const metadata = { title: "Assessor Review Queue" };

interface ReviewQueuePageProps {
  searchParams: Promise<{
    status?: string;
    moduleId?: string;
    cohortId?: string;
  }>;
}

export default async function ReviewQueuePage({ searchParams }: ReviewQueuePageProps) {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const isStaff = Boolean(me.staffRole);
  const { status = "submitted", moduleId, cohortId } = await searchParams;

  const queryParams = new URLSearchParams();
  if (status) queryParams.set("status", status);
  if (moduleId) queryParams.set("moduleId", moduleId);
  if (cohortId) queryParams.set("cohortId", cohortId);

  const res = await tradeGet<{ items: ModuleSubmissionView[] }>(
    `/module-submissions?${queryParams.toString()}`
  );

  const items = res.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Assessor Workspace</h1>
          <p className="mt-1 text-sm text-ink-2">
            Module practical deliverable submissions queued for facilitator and assessor evaluation.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 bg-canvas p-1 rounded-lg border border-line text-xs font-medium">
          <Link
            href="/review-queue?status=submitted"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              status === "submitted" ? "bg-brand-600 text-white font-bold" : "text-ink hover:text-ink-2"
            }`}
          >
            Pending Review
          </Link>
          <Link
            href="/review-queue?status=revision_required"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              status === "revision_required" ? "bg-brand-600 text-white font-bold" : "text-ink hover:text-ink-2"
            }`}
          >
            Revision Required
          </Link>
          <Link
            href="/review-queue?status=passed"
            className={`px-3 py-1.5 rounded-md transition-colors ${
              status === "passed" ? "bg-brand-600 text-white font-bold" : "text-ink hover:text-ink-2"
            }`}
          >
            Passed
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center max-w-xl mx-auto space-y-3">
          <Inbox className="size-10 text-ink-3 mx-auto" />
          <h2 className="font-display text-lg font-bold text-ink">Queue is clear</h2>
          <p className="text-xs text-ink-2">
            No submissions currently match the active filter criteria. Newly submitted practical deliverables will appear here sorted by waiting time.
          </p>
        </Card>
      ) : (
        <div className="divide-y divide-line rounded-xl border border-line bg-surface overflow-hidden">
          {items.map((sub) => {
            const waitingHours = sub.waitingTimeHours ?? 0;
            const isLongWait = waitingHours > 24;

            return (
              <div
                key={sub.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-canvas/50 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded border border-brand-200">
                      {sub.moduleId}
                    </span>
                    <span className="text-xs text-ink-3">• v{sub.version} attempt</span>
                    <StatusBadge
                      tone={
                        sub.status === "passed"
                          ? "ok"
                          : sub.status === "revision_required"
                          ? "danger"
                          : "warn"
                      }
                    >
                      {sub.status === "passed"
                        ? "Passed"
                        : sub.status === "revision_required"
                        ? "Revision Required"
                        : "Submitted"}
                    </StatusBadge>
                  </div>

                  <div className="text-sm font-semibold text-ink">
                    {sub.organizationName ?? sub.organizationId}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-3">
                    {sub.cohortName && (
                      <span className="flex items-center gap-1">
                        <Layers className="size-3" /> {sub.cohortName}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 font-medium ${isLongWait ? "text-amber-700" : ""}`}>
                      <Clock className="size-3" /> {waitingHours} hours waiting
                    </span>
                    <span>Submitted: {new Date(sub.submittedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {sub.officialScore && (
                    <div className="text-right text-xs">
                      <div className="font-bold text-ink">
                        {sub.officialScore.totalPoints}/{sub.officialScore.maxPoints} pts ({sub.officialScore.percentage}%)
                      </div>
                      <div className="text-ink-3">{sub.officialScore.band}</div>
                    </div>
                  )}

                  <Link
                    href={`/review-queue/${sub.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                  >
                    {isStaff ? "Evaluate Rubric" : "View Submission"} <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
