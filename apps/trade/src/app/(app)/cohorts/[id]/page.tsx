import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { getCohort, getCohortStaff, getMe, listDiagnostics, listPlacements, listSessions, listWaitingSmes } from "@/lib/api";
import type { EnrollmentStatus, StaffAssessmentRow } from "@/lib/types";
import { CohortStaffPanel } from "./cohort-staff-panel";
import { EnrollSmeDialog } from "./enroll-sme-dialog";
import { PlanAndPathway } from "./plan-and-pathway";
import { StatusUpdater } from "./status-updater";
import { ScheduleSessionDialog } from "./sessions/schedule-session-dialog";

export const metadata = { title: "Cohort Details" };

function getStatusTone(status: EnrollmentStatus): "ok" | "info" | "warn" | "danger" | "idle" | "product" {
  switch (status) {
    case "active":
      return "ok";
    case "registered":
      return "info";
    case "completed":
      return "product";
    case "paused":
      return "warn";
    case "withdrawn":
      return "danger";
    case "invited":
    default:
      return "idle";
  }
}

function getDeliveryModeTone(mode: string): "info" | "idle" | "product" {
  switch (mode) {
    case "live":
      return "info";
    case "hybrid":
      return "product";
    default:
      return "idle";
  }
}

function formatDeliveryMode(mode: string): string {
  switch (mode) {
    case "live":
      return "Live Facilitated";
    case "hybrid":
      return "Hybrid";
    default:
      return "Self-paced";
  }
}

/** What a business's onboarding diagnostic looks like to staff: not started, in progress, or submitted with its avenue. */
function DiagnosticCell({ row }: { row: StaffAssessmentRow | undefined }) {
  if (!row) return <span className="text-ink-3">Not started</span>;
  if (row.status === "draft") return <StatusBadge tone="warn">In progress</StatusBadge>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge tone="ok">Submitted</StatusBadge>
      {row.pathway && (
        <StatusBadge tone={row.pathway === "B" ? "product" : "info"}>
          {`Pathway ${row.pathway}${row.pathwayStatus === "provisional" ? " (provisional)" : ""}`}
        </StatusBadge>
      )}
      <Link href={`/diagnostic/${row.id}`} className="font-semibold text-brand-600 hover:underline">
        View
      </Link>
    </div>
  );
}

/** What a business's placement assessment looks like to staff: not started, in progress, or scored with a link to its report. */
function PlacementCell({ row }: { row: StaffAssessmentRow | undefined }) {
  if (!row) return <span className="text-ink-3">Not started</span>;
  if (row.status === "draft") return <StatusBadge tone="warn">In progress</StatusBadge>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge tone={row.status === "review_required" ? "warn" : "ok"}>{row.status === "review_required" ? "Needs review" : "Scored"}</StatusBadge>
      <Link href={`/assessment/${row.id}/report`} className="font-semibold text-brand-600 hover:underline">
        Report
      </Link>
    </div>
  );
}

export default async function CohortDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  const canEnrol = me?.staffRole === "admin" || me?.staffRole === "facilitator";
  if (!me) redirect("/sign-in");

  const isStaff = Boolean(me.staffRole);
  if (!isStaff) {
    redirect("/");
  }

  const { id } = await props.params;
  const cohortStaff = me.staffRole === "admin" ? await getCohortStaff(id) : null;
  const [cohort, waiting, diagnostics, placements, sessions] = await Promise.all([
    getCohort(id),
    listWaitingSmes(),
    listDiagnostics(),
    listPlacements(),
    listSessions(id),
  ]);
  if (!cohort) {
    notFound();
  }
  const diagnosticOf = new Map<string, StaffAssessmentRow>();
  for (const row of diagnostics) if (!diagnosticOf.has(row.enrollmentId)) diagnosticOf.set(row.enrollmentId, row);
  const placementOf = new Map<string, StaffAssessmentRow>();
  for (const row of placements) if (!placementOf.has(row.enrollmentId)) placementOf.set(row.enrollmentId, row);
  const enrolledOrganizationIds = cohort.enrolments.map((e) => e.organizationId);
  const submitted = cohort.enrolments.filter((e) => {
    const d = diagnosticOf.get(e.enrollmentId);
    return d && d.status !== "draft";
  }).length;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/cohorts"
          className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Back to cohorts
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                {cohort.programName}
              </span>
              <StatusBadge tone={getDeliveryModeTone(cohort.deliveryMode)}>
                {formatDeliveryMode(cohort.deliveryMode)}
              </StatusBadge>
            </div>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">{cohort.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ScheduleSessionDialog cohortId={cohort.id} />
            {canEnrol && <EnrollSmeDialog cohortId={cohort.id} waiting={waiting} enrolledOrganizationIds={enrolledOrganizationIds} />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Delivery Mode</span>
          <p className="mt-1 text-sm font-semibold text-ink">
            {formatDeliveryMode(cohort.deliveryMode)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Region & Language</span>
          <p className="mt-1 text-sm font-semibold text-ink uppercase">
            {cohort.country} • {cohort.language}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Timeline</span>
          <p className="mt-1 text-sm font-semibold text-ink">
            {cohort.startDate ? new Date(cohort.startDate).toLocaleDateString() : "TBD"} –{" "}
            {cohort.endDate ? new Date(cohort.endDate).toLocaleDateString() : "TBD"}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Sponsor</span>
          <p className="mt-1 text-sm font-semibold text-ink">
            {cohort.sponsorName ?? "None (Entrust Direct)"}
          </p>
        </Card>
        <Card className="p-4">
          <span className="text-xs text-ink-3 font-medium">Attendance Requirement</span>
          <p className="mt-1 text-sm font-semibold text-ink">
            {cohort.attendanceRequired !== false ? "Recorded, doesn't affect completion" : "Optional"}
          </p>
        </Card>
      </div>

      {cohortStaff && <CohortStaffPanel cohortId={cohort.id} staff={cohortStaff} />}

      {/* Live Sessions & Workshops Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">
              Live Sessions & Workshops ({sessions.length})
            </h2>
            <p className="mt-0.5 text-xs text-ink-2">
              Interactive sessions scheduled for this cohort, with facilitator preparation and attendance sheets.
            </p>
          </div>
          <ScheduleSessionDialog cohortId={cohort.id} />
        </div>

        {sessions.length === 0 ? (
          <Card className="p-6 text-center text-sm text-ink-2 max-w-lg mx-auto">
            No live workshops scheduled for this cohort yet. Click &quot;Schedule Session&quot; to plan a session.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((sess) => (
              <Card key={sess.id} className="flex flex-col justify-between p-5 hover:border-brand-500 transition-colors">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-3">
                      {new Date(sess.startTime).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-ink-3 font-mono">
                      {new Date(sess.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-base font-bold text-ink">{sess.title}</h3>
                  {sess.description && (
                    <p className="mt-1 text-xs text-ink-2 line-clamp-2">{sess.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1">
                    {sess.moduleCodes.map((code) => (
                      <span
                        key={code}
                        className="rounded bg-canvas px-1.5 py-0.5 text-[11px] font-mono font-semibold text-brand-700"
                      >
                        {code}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-ink-2">
                    {sess.venue ? (
                      <span className="truncate block font-mono text-[11px] text-brand-600">
                        📍 {sess.venue}
                      </span>
                    ) : (
                      <span className="text-ink-3">Venue TBD</span>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-line">
                  <Link
                    href={`/cohorts/${cohort.id}/sessions/${sess.id}`}
                    className="inline-flex w-full items-center justify-center rounded-md bg-canvas py-1.5 text-xs font-semibold text-ink hover:bg-line transition-colors"
                  >
                    Attendance & Facilitator Prep →
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Enrolled SMEs Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">
            Enrolled SMEs ({cohort.enrolments.length})
          </h2>
          {cohort.enrolments.length > 0 && (
            <p className="text-xs text-ink-2">
              {submitted} of {cohort.enrolments.length} have submitted the onboarding diagnostic
            </p>
          )}
        </div>

        {cohort.enrolments.length === 0 ? (
          <Card className="p-8 text-center max-w-xl mx-auto">
            <h3 className="font-display font-bold text-ink">No SMEs enrolled yet</h3>
            <p className="mt-1 text-sm text-ink-2">
              Add SMEs to this cohort to grant them TRADE platform access and begin tracking their training milestones.
            </p>
            <div className="mt-4">
              {canEnrol && <EnrollSmeDialog cohortId={cohort.id} waiting={waiting} enrolledOrganizationIds={enrolledOrganizationIds} />}
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-canvas border-b border-line text-xs font-semibold text-ink-2">
                  <tr>
                    <th className="px-4 py-3">Company / Organisation</th>
                    <th className="px-4 py-3">Legal Name</th>
                    <th className="px-4 py-3">Enrolled On</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Onboarding diagnostic</th>
                    <th className="px-4 py-3">Placement assessment</th>
                    <th className="px-4 py-3">Plan and pathway</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {cohort.enrolments.map((enr) => (
                    <tr key={enr.enrollmentId} className="hover:bg-canvas/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{enr.organizationName}</div>
                        <div className="font-mono text-ink-3 text-[11px]">{enr.organizationId}</div>
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        {enr.legalName ?? "—"}
                        {enr.tradingName && (
                          <div className="text-[11px] text-ink-3">t/a {enr.tradingName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-ink-2">
                        {new Date(enr.enrolledAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={getStatusTone(enr.status)}>
                          {enr.status.charAt(0).toUpperCase() + enr.status.slice(1)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <DiagnosticCell row={diagnosticOf.get(enr.enrollmentId)} />
                      </td>
                      <td className="px-4 py-3">
                        <PlacementCell row={placementOf.get(enr.enrollmentId)} />
                      </td>
                      <td className="px-4 py-3">
                        <PlanAndPathway enrollmentId={enr.enrollmentId} plan={enr.plan} pathway={enr.pathway} canConfirmPathway={me.staffRole !== "reviewer"} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <StatusUpdater
                          enrollmentId={enr.enrollmentId}
                          cohortId={cohort.id}
                          currentStatus={enr.status}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
