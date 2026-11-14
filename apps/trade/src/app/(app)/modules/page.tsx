import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, Clock } from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { getMe, listEnrollments } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import type {
  LearningPlanRecord,
  ModuleItemSummary,
  ModuleProgressView,
} from "@/lib/types";

export const metadata = { title: "Modules" };

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  passed: "Passed",
  needs_revision: "Needs revision",
  exempted: "Exempted",
};
const statusLabel = (status: string) => STATUS_LABELS[status] ?? status.replace(/_/g, " ");

function getStatusTone(status: string): "ok" | "info" | "warn" | "danger" | "idle" {
  switch (status) {
    case "passed":
    case "exempted":
      return "ok";
    case "submitted":
      return "info";
    case "in_progress":
      return "warn";
    case "needs_revision":
      return "danger";
    case "not_started":
    default:
      return "idle";
  }
}

export default async function ModulesPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];

  const isStaff = Boolean(me.staffRole);
  // Administrators and facilitators have the course studio, which lists the same modules and opens each as a learner sees it.
  if (me.staffRole === "admin" || me.staffRole === "facilitator") redirect("/admin/modules");

  const [modulesRes, enrollments] = await Promise.all([
    tradeGet<{ items: ModuleItemSummary[] }>("/modules"),
    activeOrg ? listEnrollments({ organizationId: activeOrg.id }) : Promise.resolve([]),
  ]);

  const allModules = modulesRes.data?.items ?? [];
  const currentEnrollment =
    enrollments.find((e) => e.status === "active" || e.status === "registered") ?? enrollments[0];

  let activePlan: LearningPlanRecord | null = null;
  let progressMap = new Map<string, ModuleProgressView>();

  if (currentEnrollment) {
    const [plansRes, progRes] = await Promise.all([
      tradeGet<{ items: LearningPlanRecord[] }>(`/plans?enrollmentId=${currentEnrollment.id}`),
      tradeGet<{ items: ModuleProgressView[] }>(`/module-progress?enrollmentId=${currentEnrollment.id}`),
    ]);

    activePlan = plansRes.data?.items.find((p) => p.status !== "superseded") ?? null;
    if (progRes.data?.items) {
      for (const p of progRes.data.items) {
        progressMap.set(p.moduleId, p);
      }
    }
  }

  const assignedMap = new Map<string, { sequence: number; reasonCodes: string[]; status: string }>();
  if (activePlan) {
    for (const a of activePlan.modules) {
      assignedMap.set(a.moduleId, {
        sequence: a.sequence,
        reasonCodes: a.reasonCodes,
        status: a.status,
      });
    }
  }

  // Split into plan modules and others
  const planModules = allModules
    .filter((m) => assignedMap.has(m.id))
    .sort((a, b) => (assignedMap.get(a.id)?.sequence ?? 0) - (assignedMap.get(b.id)?.sequence ?? 0));

  const otherModules = allModules.filter((m) => !assignedMap.has(m.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Modules</h1>
        <p className="mt-1 text-sm text-ink-2">
          Practical modules that build your export capability: lessons, worksheets and a deliverable for each.
        </p>
      </div>

      {/* Section 1: Assigned Learning Plan Modules */}
      {planModules.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">In your learning plan</h2>
              <p className="text-xs text-ink-2">
                Chosen for your pathway, in the order we suggest you take them.
              </p>
            </div>
            <StatusBadge tone="info">{`${planModules.length} assigned`}</StatusBadge>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planModules.map((m) => {
              const assigned = assignedMap.get(m.id);
              const progress = progressMap.get(m.id);
              const currentStatus = progress?.status ?? assigned?.status ?? "not_started";
              const isInProduction = m.contentStatus === "in_production";

              return (
                <Card key={m.id} className="flex flex-col justify-between p-5 border-l-4 border-l-brand-600">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                        Step {assigned?.sequence}: {m.id}
                      </span>
                      <StatusBadge tone={isInProduction ? "idle" : getStatusTone(currentStatus)}>
                        {isInProduction ? "Coming soon" : statusLabel(currentStatus)}
                      </StatusBadge>
                    </div>

                    <div>
                      <h3 className="font-display text-base font-bold leading-snug text-ink">{m.title}</h3>
                      <p className="mt-1 text-xs text-ink-2">
                        <strong className="text-ink">Deliverable:</strong> {m.deliverable}
                      </p>
                    </div>

                    {assigned?.reasonCodes && assigned.reasonCodes.length > 0 && (
                      <div className="text-[11px] text-ink-3">
                        Why in plan: <span className="font-medium text-ink-2">{assigned.reasonCodes.join(", ").replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
                    <span className="text-[11px] text-ink-3">
                      {isInProduction ? "Not open yet" : progress?.completedAt ? "Completed" : progress?.startedAt ? "In progress" : "Not started"}
                    </span>
                    <Link
                      href={`/modules/${m.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                    >
                      {isInProduction ? "See what it covers →" : "Open module →"}
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 2: Elective & Additional Curriculum Modules */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              {planModules.length > 0 ? "Other modules" : "All modules"}
            </h2>
            <p className="text-xs text-ink-2">
              {planModules.length > 0
                ? "Not in your learning plan. You can read them, but you can't submit work for them."
                : "The twelve TRADE capability modules."}
            </p>
          </div>
          <span className="text-xs text-ink-3">{otherModules.length} modules</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {otherModules.map((m) => {
            const isInProduction = m.contentStatus === "in_production";

            return (
              <Card key={m.id} className="flex flex-col justify-between p-5">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded bg-canvas px-2 py-0.5 font-mono text-xs font-semibold text-ink-2">
                      {m.id}
                    </span>
                    {isInProduction && <StatusBadge tone="idle">Coming soon</StatusBadge>}
                  </div>

                  <div>
                    <h3 className="font-display text-base font-bold leading-snug text-ink">{m.title}</h3>
                    <p className="mt-1 text-xs text-ink-2">
                      <strong className="text-ink">Deliverable:</strong> {m.deliverable}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between">
                  <span className="text-[11px] text-ink-3">
                    {isInProduction ? "Not open yet" : planModules.length > 0 ? "Not in your plan" : "Open to read"}
                  </span>
                  <Link
                    href={`/modules/${m.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    {isInProduction ? "See what it covers →" : "Read →"}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
