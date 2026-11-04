import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { getCohort, getMe } from "@/lib/api";
import type { EnrollmentStatus } from "@/lib/types";
import { EnrollSmeDialog } from "./enroll-sme-dialog";
import { StatusUpdater } from "./status-updater";

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

export default async function CohortDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const isStaff = Boolean(me.staffRole);
  if (!isStaff) {
    redirect("/");
  }

  const { id } = await props.params;
  const cohort = await getCohort(id);
  if (!cohort) {
    notFound();
  }

  return (
    <div className="space-y-6">
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
          <EnrollSmeDialog cohortId={cohort.id} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
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
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink">
            Enrolled SMEs ({cohort.enrolments.length})
          </h2>
        </div>

        {cohort.enrolments.length === 0 ? (
          <Card className="p-8 text-center max-w-xl mx-auto">
            <h3 className="font-display font-bold text-ink">No SMEs enrolled yet</h3>
            <p className="mt-1 text-sm text-ink-2">
              Add SMEs to this cohort to grant them TRADE platform access and begin tracking their training milestones.
            </p>
            <div className="mt-4">
              <EnrollSmeDialog cohortId={cohort.id} />
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
