import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, CheckCircle2, Circle, Clock, PlayCircle } from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { getMe, listEnrollments, listSessions } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { CreateOrganisation } from "@/components/summit/create-organisation";
import { AFRICAN_COUNTRIES } from "@/lib/summit-business";
import type {
  EnrollmentStatus,
  LearningPlanRecord,
  ModuleItemSummary,
  ModuleProgressView,
} from "@/lib/types";

export const metadata = { title: "My plan" };

function getStatusTone(status: string): "ok" | "info" | "warn" | "danger" | "idle" | "product" {
  switch (status) {
    case "active":
    case "passed":
    case "exempted":
      return "ok";
    case "registered":
    case "submitted":
      return "info";
    case "completed":
      return "product";
    case "paused":
    case "in_progress":
      return "warn";
    case "withdrawn":
    case "needs_revision":
      return "danger";
    case "not_started":
    case "invited":
    default:
      return "idle";
  }
}

interface TradeHomePageProps {
  searchParams?: Promise<{ enrollmentId?: string }>;
}

export default async function TradeHomePage({ searchParams }: TradeHomePageProps) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  // A member of the Summit's selection committee has no learning plan: their work is the committee's screens.
  if (me.summitCommittee && !me.staffRole) redirect("/summit/committee");

  const { enrollmentId: queryEnrollmentId } = (await searchParams) ?? {};

  const activeOrg =
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ?? me.organizations?.[0];
  const isStaff = Boolean(me.staffRole);
  const hasTradeAccess = isStaff || (activeOrg?.platforms.includes("trade") ?? false);

  // An organisation that has the Summit and not TRADE has nothing here: send it to the Summit instead of an empty plan.
  if (!hasTradeAccess && activeOrg?.platforms.includes("summit")) redirect("/summit/apply");

  // Someone who has signed up and has no business yet: they add it here, then Entrust enrols it in a cohort.
  if (!isStaff && (me.organizations?.length ?? 0) === 0) {
    return (
      <div className="mx-auto max-w-xl py-8">
        <h1 className="font-display text-2xl font-bold text-ink">Add your business</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-2">
          Tell us which business you are signing up for. Entrust then enrols it in the TRADE training, and you can fill in the onboarding diagnostic.
        </p>
        <Card className="mt-6 p-6">
          <CreateOrganisation countries={[...AFRICAN_COUNTRIES]} platform="trade" />
        </Card>
      </div>
    );
  }

  if (!hasTradeAccess) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">
            You aren't enrolled in a TRADE program
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Your current organisation does not currently have access to the TRADE platform. If your organisation has been admitted to a cohort or pilot program, switch to that organisation using the switcher above, or contact your Entrust facilitator or support team at info@entrustafrica.com.
          </p>
          <p className="mt-4 text-sm text-ink-2">
            Applying to the Africa Diaspora Trade and Investment Summit?{" "}
            <Link href="/summit" className="font-semibold text-brand-600 hover:underline">
              Go to the Summit application
            </Link>
            .
          </p>
        </Card>
      </div>
    );
  }

  // Staff landing overview when not viewing a specific learner
  if (isStaff && !queryEnrollmentId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Staff Overview</h1>
          <p className="mt-1 text-sm text-ink-2">
            Entrust administrator and facilitator portal for TRADE cohorts, learning plans, and progress.
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
            <p className="mt-1 text-sm text-ink-2">Evaluate assessments, learning plans, and evidence submissions.</p>
            <Link href="/review-queue" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
              Open queue →
            </Link>
          </Card>
          <Card className="p-6">
            <h2 className="font-display font-bold text-ink">Curriculum Modules</h2>
            <p className="mt-1 text-sm text-ink-2">Inspect module lessons, worksheets, and rubric packages.</p>
            <Link href="/modules" className="mt-4 inline-block text-xs font-semibold text-brand-600 hover:underline">
              Explore modules →
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

  // Learner (or Staff inspecting learner) View
  const [list, enrollments, modulesRes] = await Promise.all([
    activeOrg
      ? tradeGet<{ items: AssessmentSummary[] }>(`/assessments?organizationId=${encodeURIComponent(activeOrg.id)}`)
      : Promise.resolve(null),
    activeOrg
      ? listEnrollments({ organizationId: activeOrg.id })
      : Promise.resolve([]),
    tradeGet<{ items: ModuleItemSummary[] }>("/modules"),
  ]);

  const live = (kind: "diagnostic" | "placement") =>
    list?.data?.items.find((item) => item.kind === kind && item.status !== "superseded");
  const diagnostic = live("diagnostic");
  const placement = live("placement");
  const pathway = diagnostic?.pathway ?? null;

  const currentEnrollment = queryEnrollmentId
    ? { id: queryEnrollmentId, cohortId: "", cohortName: "Learner View", programName: "TRADE Program", status: "active" as EnrollmentStatus, enrolledAt: new Date().toISOString(), completedAt: null }
    : enrollments.find((e) => e.status === "active" || e.status === "registered") ?? enrollments[0];

  const sessions = currentEnrollment?.cohortId ? await listSessions(currentEnrollment.cohortId) : [];

  // Fetch active learning plan and progress
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

  // Compute ordered plan modules & progress stats
  const allModules = modulesRes.data?.items ?? [];
  const assignments = activePlan?.modules ?? [];
  const assignedModules = assignments
    .map((a) => {
      const summary = allModules.find((m) => m.id === a.moduleId);
      const prog = progressMap.get(a.moduleId);
      const progStatus = prog?.status ?? a.status ?? "not_started";
      return {
        ...a,
        title: summary?.title ?? a.moduleId,
        deliverable: summary?.deliverable ?? "",
        contentStatus: summary?.contentStatus ?? "ready",
        currentStatus: progStatus,
        lastLessonId: (prog?.lessonProgress as { lastLessonId?: string })?.lastLessonId,
        completedLessonsCount:
          (prog?.lessonProgress as { completedLessons?: string[] })?.completedLessons?.length ?? 0,
      };
    })
    .sort((a, b) => a.sequence - b.sequence);

  const totalAssigned = assignedModules.length;
  const completedAssigned = assignedModules.filter((m) =>
    ["passed", "exempted", "completed"].includes(m.currentStatus)
  ).length;
  const planProgressPercent =
    totalAssigned > 0 ? Math.round((completedAssigned / totalAssigned) * 100) : 0;

  // Identify current module and next module
  const currentModule =
    assignedModules.find((m) => !["passed", "exempted"].includes(m.currentStatus)) ??
    assignedModules[assignedModules.length - 1];

  const currentIndex = currentModule ? assignedModules.indexOf(currentModule) : -1;
  const nextModule = currentIndex >= 0 ? assignedModules[currentIndex + 1] : undefined;

  return (
    <div className="space-y-6">
      {/* Staff Inspection Banner */}
      {isStaff && queryEnrollmentId && (
        <div className="rounded-md border border-sky-300 bg-sky-50 p-4 text-xs font-medium text-sky-900 flex items-center justify-between">
          <span>Viewing learner's active plan and progress as staff (read-only mode).</span>
          <Link href="/" className="font-semibold text-sky-700 hover:underline">
            Return to Staff Overview
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">My Learning Plan</h1>
          <p className="mt-1 text-sm text-ink-2">
            Tailored capability roadmap for {activeOrg?.name ?? "your organisation"}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentEnrollment && (
            <StatusBadge tone={getStatusTone(currentEnrollment.status)}>
              {`${currentEnrollment.cohortName} (${currentEnrollment.status})`}
            </StatusBadge>
          )}
          {pathway && (
            <StatusBadge tone="info">
              {`Pathway ${pathway}: ${PATHWAY_NAMES[pathway]}${diagnostic?.pathwayStatus === "provisional" ? " (provisional)" : ""}`}
            </StatusBadge>
          )}
        </div>
      </div>

      {!currentEnrollment && (
        <Card className="border-l-4 border-l-amber-500 bg-surface p-4">
          <div className="font-display text-base font-bold text-ink">Waiting for Entrust to enrol your business</div>
          <p className="mt-1 text-sm text-ink-2">
            {activeOrg?.name ?? "Your business"} is registered on TRADE. Once Entrust enrols it in a training cohort, your onboarding diagnostic opens.
          </p>
        </Card>
      )}

      {/* Active Learning Plan Progress & Next Step (Issue #62) */}
      {assignedModules.length > 0 && (
        <div className="space-y-6">
          {/* Progress Summary Card */}
          <Card className="p-6 border-l-4 border-l-brand-600 bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  Overall Learning Progress
                </span>
                <h2 className="font-display text-xl font-bold text-ink">
                  {completedAssigned} of {totalAssigned} Modules Completed ({planProgressPercent}%)
                </h2>
                <p className="mt-0.5 text-xs text-ink-2">
                  Tailored sequence under Pathway {activePlan?.pathway ?? "A"}. Progress automatically saves as you complete lessons.
                </p>
              </div>

              {currentModule && (
                <div>
                  <Link
                    href={`/modules/${currentModule.moduleId}${
                      currentModule.lastLessonId ? `?lesson=${encodeURIComponent(currentModule.lastLessonId)}` : ""
                    }`}
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-5 text-sm font-semibold text-white shadow-xs hover:bg-brand-700"
                  >
                    <span>{currentModule.currentStatus === "in_progress" ? "Resume Current Module" : "Start Next Module"}</span>
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-brand-600 transition-all duration-300"
                style={{ width: `${planProgressPercent}%` }}
              />
            </div>

            {/* Current Module & What's Next Details */}
            {currentModule && (
              <div className="mt-6 grid gap-4 pt-4 border-t border-line/60 sm:grid-cols-2">
                <div className="rounded-lg bg-canvas p-4 border border-line">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                    Current Module (Step {currentModule.sequence})
                  </div>
                  <div className="mt-1 font-display text-base font-bold text-ink">
                    {currentModule.moduleId}: {currentModule.title}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-2 truncate">
                    Deliverable: {currentModule.deliverable}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <StatusBadge tone={getStatusTone(currentModule.currentStatus)}>
                      {currentModule.currentStatus.replace("_", " ").toUpperCase()}
                    </StatusBadge>
                    <Link
                      href={`/modules/${currentModule.moduleId}${
                        currentModule.lastLessonId ? `?lesson=${encodeURIComponent(currentModule.lastLessonId)}` : ""
                      }`}
                      className="font-semibold text-brand-600 hover:underline"
                    >
                      Pick up where you stopped →
                    </Link>
                  </div>
                </div>

                {nextModule ? (
                  <div className="rounded-lg bg-canvas p-4 border border-line">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                      What Comes Next (Step {nextModule.sequence})
                    </div>
                    <div className="mt-1 font-display text-base font-bold text-ink">
                      {nextModule.moduleId}: {nextModule.title}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-2 truncate">
                      Deliverable: {nextModule.deliverable}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-ink-3">Upcoming in plan</span>
                      <Link href={`/modules/${nextModule.moduleId}`} className="text-ink-2 hover:underline">
                        Preview module →
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-canvas p-4 border border-line flex flex-col justify-center text-center">
                    <CheckCircle2 className="size-6 text-emerald-600 mx-auto" />
                    <div className="mt-1 font-display text-sm font-bold text-ink">Final Module in Plan</div>
                    <div className="text-xs text-ink-2">You are on the last assigned module of your roadmap!</div>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Active Learning Plan Modules in Order */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Prescribed Modules in Order</h2>
                <p className="text-xs text-ink-2">
                  Follow the sequence below to build export capability systematically.
                </p>
              </div>
              <Link href="/modules" className="text-xs font-semibold text-brand-600 hover:underline">
                View all curriculum modules →
              </Link>
            </div>

            <div className="divide-y divide-line rounded-lg border border-line bg-surface">
              {assignedModules.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-canvas/50 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                      Step {m.sequence}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-ink">{m.moduleId}: {m.title}</span>
                      </div>
                      <div className="text-xs text-ink-2 mt-0.5 truncate">
                        Deliverable: {m.deliverable}
                      </div>
                      {m.reasonCodes.length > 0 && (
                        <div className="mt-1 text-[11px] text-ink-3">
                          Why in plan: <span className="font-medium text-ink-2">{m.reasonCodes.join(", ").replace(/_/g, " ")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge tone={getStatusTone(m.currentStatus)}>
                      {m.currentStatus.replace("_", " ").toUpperCase()}
                    </StatusBadge>
                    <Link
                      href={`/modules/${m.moduleId}${
                        m.lastLessonId ? `?lesson=${encodeURIComponent(m.lastLessonId)}` : ""
                      }`}
                      className="inline-flex h-8 items-center rounded-md border border-line bg-surface px-3 text-xs font-semibold text-ink hover:bg-canvas"
                    >
                      {m.currentStatus === "passed" || m.currentStatus === "exempted"
                        ? "Review"
                        : m.currentStatus === "in_progress"
                        ? "Resume"
                        : "Open"}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Live Sessions Card */}
      {sessions.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-ink">Upcoming Live Sessions & Workshops</h2>
              <p className="mt-0.5 text-xs text-ink-2">
                Live sessions for your cohort. Attendance is recorded by your facilitator.
              </p>
            </div>
            <StatusBadge tone="info">{`${sessions.length} scheduled`}</StatusBadge>
          </div>
          <div className="mt-4 divide-y divide-line/60">
            {sessions.map((sess) => (
              <div key={sess.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                <div>
                  <div className="font-semibold text-ink text-sm">{sess.title}</div>
                  <div className="text-ink-2 mt-0.5">
                    {new Date(sess.startTime).toLocaleString()} –{" "}
                    {new Date(sess.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {sess.moduleCodes.length > 0 && (
                    <div className="mt-1 flex gap-1">
                      {sess.moduleCodes.map((c) => (
                        <span key={c} className="rounded bg-canvas px-1.5 py-0.5 text-[10px] font-mono text-brand-700">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  {sess.venue ? (
                    sess.venue.startsWith("http") ? (
                      <a
                        href={sess.venue}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded bg-brand-50 px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-100"
                      >
                        Join Meeting ↗
                      </a>
                    ) : (
                      <span className="font-medium text-ink">📍 {sess.venue}</span>
                    )
                  ) : (
                    <span className="text-ink-3">Venue TBD</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Diagnostics & Placement Tasks */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6 md:col-span-2">
          <h2 className="font-display text-lg font-bold text-ink">Diagnostics & Assessments</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Two short forms place you on the right learning path. Your answers save as you go, so you can stop and come back.
          </p>
          <ul className="mt-4 divide-y divide-line">
            <Task title="Onboarding diagnostic" detail="Tell us about your business. This sets your learning path." href="/diagnostic" assessment={diagnostic} />
            <Task title="Placement assessment" detail="Check where your business stands today. This decides which modules you start with." href="/assessment" assessment={placement} />
          </ul>
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
              <span className={`size-2 rounded-full ${diagnostic && diagnostic.status !== "draft" ? "bg-brand-600" : "bg-line"}`} />
              <span>Onboarding diagnostic</span>
            </li>
            <li className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${placement && placement.status !== "draft" ? "bg-brand-600" : "bg-line"}`} />
              <span>Placement assessment</span>
            </li>
            <li className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${assignedModules.length > 0 ? "bg-brand-600" : "bg-line"}`} />
              <span>Learning plan prescribed</span>
            </li>
            <li className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${completedAssigned > 0 ? "bg-brand-600" : "bg-line"}`} />
              <span>Module execution ({completedAssigned}/{totalAssigned})</span>
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

interface AssessmentSummary {
  kind: "diagnostic" | "placement";
  status: string;
  pathway: "A" | "B" | null;
  pathwayStatus: "provisional" | "confirmed" | null;
}

const PATHWAY_NAMES = { A: "Export Entry and Readiness", B: "Export Execution and Scale" } as const;

function Task({ title, detail, href, assessment }: { title: string; detail: string; href: string; assessment: AssessmentSummary | undefined }) {
  const done = assessment !== undefined && assessment.status !== "draft";
  const label = !assessment ? "Start" : done ? "View" : "Continue";
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink-2">{detail}</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge tone={done ? "ok" : assessment ? "warn" : "idle"}>{done ? "Done" : assessment ? "In progress" : "Not started"}</StatusBadge>
        <Link href={href} className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas">
          {label}
        </Link>
      </div>
    </li>
  );
}
