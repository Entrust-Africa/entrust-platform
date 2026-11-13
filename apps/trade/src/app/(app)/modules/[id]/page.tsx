import { notFound, redirect } from "next/navigation";
import { ModuleResources } from "@/components/modules/module-resources";
import Link from "next/link";
import { AlertCircle, ArrowLeft, BookOpen, Clock } from "lucide-react";
import { afriConnectBuyersUrl } from "@entrust/auth/africonnect";
import { AfriConnectCard, Card, StatusBadge } from "@entrust/ui";
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
  // Administrators and facilitators reach this page from the course studio: it is how a module looks to a learner.
  const canEdit = me.staffRole === "admin" || me.staffRole === "facilitator";
  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];

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

  // A learner works on the version they were pinned to when they started the module, even after a newer one is approved.
  // A version named in the address is a preview; a finished module whose version was retired opens the newest instead.
  const wanted = version ?? progress?.contentVersion;
  let modRes = await tradeGet<ApiModuleDetail>(`/modules/${id}${wanted ? `?version=${encodeURIComponent(wanted)}` : ""}`);
  if (modRes.status === 404 && wanted && !version) modRes = await tradeGet<ApiModuleDetail>(`/modules/${id}`);

  if (modRes.status === 404 || !modRes.data) {
    notFound();
  }

  const moduleDetail = modRes.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={canEdit ? "/admin/modules" : "/modules"}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
        >
          <ArrowLeft className="size-3.5" /> {canEdit ? "Course studio" : "All modules"}
        </Link>
        {canEdit && (
          <Link
            href={`/admin/modules/${id}/editor?version=${encodeURIComponent(moduleDetail.content?.version ?? moduleDetail.latestVersion ?? "")}`}
            className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            Open in course studio
          </Link>
        )}
      </div>

      {id === "M08" && (
        <Card className="max-w-3xl border-l-4 border-l-brand-600 p-5">
          <p className="font-semibold text-ink">Practise a whole export</p>
          <p className="mt-1 text-sm text-ink-2">Run the ZEBU Coffee case or your own deal from first step to bank closure, on the same rules a real case follows.</p>
          <Link href="/practice" className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Open export practice →
          </Link>
          <p className="mt-3 text-sm text-ink-2">Running a live or planned export? Keep its record in your export transactions.</p>
          <Link href="/transactions" className="mt-1 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Open export transactions →
          </Link>
        </Card>
      )}

      {(id === "M06" || id === "M11" || id === "M12") && (
        <Card className="max-w-3xl border-l-4 border-l-brand-600 p-5">
          <p className="font-semibold text-ink">Pricing calculator</p>
          <p className="mt-1 text-sm text-ink-2">Work out a selling price from the full cost of an order, keeping markup and gross margin apart.</p>
          <Link href="/tools/pricing" className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Open the calculator →
          </Link>
        </Card>
      )}

      {id === "M09" && (
        <Card className="max-w-3xl border-l-4 border-l-brand-600 p-5">
          <p className="font-semibold text-ink">AI Practice Lab</p>
          <p className="mt-1 text-sm text-ink-2">Approved prompts to copy into whichever approved AI tool you use, with what to check before you use the answer.</p>
          <Link href="/ai-lab" className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Open the lab →
          </Link>
        </Card>
      )}

      {id === "M05" && (
        <Card className="max-w-3xl border-l-4 border-l-brand-600 p-5">
          <p className="font-semibold text-ink">Practise finding a buyer on AfriConnect</p>
          <p className="mt-1 text-sm text-ink-2">A short guided simulation: choose a market with Market Intelligence, then find and qualify businesses on the Marketplace. Everything in it is made up.</p>
          <Link href="/practice/buyer-search" className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline">
            Start the simulation →
          </Link>
        </Card>
      )}

      {id === "M05" && (
        <AfriConnectCard
          href={afriConnectBuyersUrl()}
          className="max-w-3xl"
          title="Find and research buyers on AfriConnect"
          description="Use AfriConnect's marketplace and market intelligence while you identify buyers. A listing doesn't prove a buyer is active or legitimate, so verify them before you commit."
          action="Open AfriConnect"
        />
      )}

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
      {moduleDetail.content && (
        <ModuleResources
          moduleId={id}
          canManage={me.staffRole === "admin" || me.staffRole === "facilitator"}
          entrustOrganizationId={me.organizations?.find((o) => o.kind === "entrust")?.id ?? null}
        />
      )}
    </div>
  );
}
