import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Card, EmptyState, StatusBadge } from "@entrust/ui";
import { getMe, listCohorts, listPrograms, listOrganizations } from "@/lib/api";
import { CreateCohortDialog } from "./create-cohort-dialog";

export const metadata = { title: "Cohorts" };

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

export default async function CohortsPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const isStaff = Boolean(me.staffRole);
  if (!isStaff) {
    redirect("/");
  }

  const [cohorts, programs, orgs] = await Promise.all([
    listCohorts(),
    listPrograms(),
    listOrganizations(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Program Cohorts</h1>
          <p className="mt-1 text-sm text-ink-2">
            Manage TRADE pilot programs, enrolled SMEs, and sponsor cohorts.
          </p>
        </div>
        <CreateCohortDialog programs={programs} sponsors={orgs} />
      </div>

      {cohorts.length === 0 ? (
        <Card className="p-12 text-center max-w-xl mx-auto mt-6">
          <h2 className="font-display text-lg font-bold text-ink">No cohorts active</h2>
          <p className="mt-2 text-sm text-ink-2">
            Create a cohort under an export readiness program to begin enrolling SMEs and scheduling training sessions.
          </p>
          <div className="mt-6">
            <CreateCohortDialog programs={programs} sponsors={orgs} />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cohorts.map((cohort) => (
            <Card key={cohort.id} className="flex flex-col justify-between p-5 hover:border-brand-500 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                    {cohort.programName}
                  </span>
                  <StatusBadge tone={getDeliveryModeTone(cohort.deliveryMode)}>
                    {formatDeliveryMode(cohort.deliveryMode)}
                  </StatusBadge>
                </div>

                <h3 className="mt-2 font-display text-lg font-bold text-ink">
                  {cohort.name}
                </h3>

                <div className="mt-4 space-y-1.5 text-xs text-ink-2">
                  <div className="flex items-center justify-between">
                    <span>Region / Language:</span>
                    <span className="font-medium text-ink uppercase">
                      {cohort.country} • {cohort.language}
                    </span>
                  </div>
                  {cohort.sponsorName && (
                    <div className="flex items-center justify-between">
                      <span>Sponsor:</span>
                      <span className="font-medium text-ink">{cohort.sponsorName}</span>
                    </div>
                  )}
                  {(cohort.startDate || cohort.endDate) && (
                    <div className="flex items-center justify-between">
                      <span>Timeline:</span>
                      <span className="font-medium text-ink">
                        {cohort.startDate ? new Date(cohort.startDate).toLocaleDateString() : "TBD"} –{" "}
                        {cohort.endDate ? new Date(cohort.endDate).toLocaleDateString() : "TBD"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t border-line">
                    <span>Enrolled SMEs:</span>
                    <span className="font-semibold text-brand-600">
                      {cohort.enrolledCount} {cohort.enrolledCount === 1 ? "company" : "companies"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-line">
                <Link
                  href={`/cohorts/${cohort.id}`}
                  className="inline-flex w-full items-center justify-center rounded-md bg-canvas py-2 text-xs font-semibold text-ink hover:bg-line transition-colors"
                >
                  View Enrolments & Details →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
