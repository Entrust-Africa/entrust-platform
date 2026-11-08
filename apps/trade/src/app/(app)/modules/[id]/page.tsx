import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, BookOpen, Clock } from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import { getMe, listEnrollments } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type {
  LearningPlanRecord,
  ModuleItemSummary,
  ModuleProgressView,
} from "@/lib/types";
import {
  type LearnerModuleData,
  ModuleViewer,
} from "@/components/modules/module-viewer";

interface ModuleDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    version?: string;
    lesson?: string;
    enrollmentId?: string;
  }>;
}

interface ApiModuleDetail extends ModuleItemSummary {
  content: LearnerModuleData | null;
  aiAssistantEnabled: boolean;
}

export async function generateMetadata({ params }: ModuleDetailPageProps) {
  const { id } = await params;
  return { title: `Module ${id}` };
}

export default async function ModuleDetailPage({
  params,
  searchParams,
}: ModuleDetailPageProps) {
  const { id } = await params;
  const { version, lesson, enrollmentId: queryEnrollmentId } = await searchParams;

  const me = await getMe();
  if (!me) redirect("/sign-in");

  const isStaff = Boolean(me.staffRole);
  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];

  const versionQuery = version ? `?version=${encodeURIComponent(version)}` : "";
  const modRes = await tradeGet<ApiModuleDetail>(`/modules/${id}${versionQuery}`);

  if (modRes.status === 404 || !modRes.data) {
    notFound();
  }

  const moduleDetail = modRes.data;

  // Resolve relevant enrollment
  let enrollmentId = queryEnrollmentId;
  if (!enrollmentId && activeOrg) {
    const enrollments = await listEnrollments({ organizationId: activeOrg.id });
    const current =
      enrollments.find((e) => e.status === "active" || e.status === "registered") ?? enrollments[0];
    enrollmentId = current?.id;
  }

  // Check learning plan assignment and progress
  let isAssigned = false;
  let progress: ModuleProgressView | null = null;

  if (enrollmentId) {
    const [plansRes, progRes] = await Promise.all([
      tradeGet<{ items: LearningPlanRecord[] }>(`/plans?enrollmentId=${enrollmentId}`),
      tradeGet<{ items: ModuleProgressView[] }>(`/module-progress?enrollmentId=${enrollmentId}&moduleId=${id}`),
    ]);

    const activePlan = plansRes.data?.items.find((p) => p.status !== "superseded");
    if (activePlan) {
      isAssigned = activePlan.modules.some((a) => a.moduleId === id);
    }
    progress = progRes.data?.items?.[0] ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/modules"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
        >
          <ArrowLeft className="size-3.5" /> All modules
        </Link>
      </div>

      {/* When content is still in production */}
      {(!moduleDetail.content || moduleDetail.contentStatus === "in_production") && (
        <div className="space-y-6 max-w-3xl">
          <Card className="p-8 space-y-6">
            <div className="flex items-center gap-2">
              <span className="rounded bg-brand-50 px-2.5 py-1 font-mono text-sm font-bold text-brand-700">
                {moduleDetail.id}
              </span>
              <StatusBadge tone="idle">Coming soon</StatusBadge>
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold text-ink">{moduleDetail.title}</h1>
              <p className="mt-2 text-sm text-ink-2">
                <strong className="text-ink">Deliverable:</strong> {moduleDetail.deliverable}
              </p>
            </div>

            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900 flex items-start gap-3">
              <AlertCircle className="size-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <div className="font-bold">This module isn't open yet</div>
                <div className="mt-0.5 leading-relaxed">
                  The lessons and exercises are still being written. You can see below what it will cover and what you'll hand in.
                </div>
              </div>
            </div>

            {moduleDetail.objectives.length > 0 && (
              <div className="border-t border-line pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  What this module will cover
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-ink-2">
                  {moduleDetail.objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-brand-600 font-bold">•</span>
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </Card>
        </div>
      )}

      {/* When content is available */}
      {moduleDetail.content && (
        <ModuleViewer
          module={moduleDetail.content}
          enrollmentId={enrollmentId}
          isAssignedInPlan={isAssigned}
          isReadOnly={isStaff}
          initialProgress={progress}
          initialLessonId={lesson}
          aiAssistantEnabled={moduleDetail.aiAssistantEnabled}
          organizationId={activeOrg?.id}
        />
      )}
    </div>
  );
}
