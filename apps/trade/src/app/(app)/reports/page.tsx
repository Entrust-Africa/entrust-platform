import { Card } from "@entrust/ui";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Reports & Insights</h1>
        <p className="mt-1 text-sm text-ink-2">
          Cohort readiness benchmarks, capability gap closure, and outcome metrics.
        </p>
      </div>

      <Card className="p-8 text-center max-w-xl mx-auto mt-6">
        <h2 className="font-display text-lg font-bold text-ink">No aggregate reports yet</h2>
        <p className="mt-2 text-sm text-ink-2">
          Reporting data will populate automatically as enrolled SMEs complete assessments and milestones.
        </p>
      </Card>
    </div>
  );
}
