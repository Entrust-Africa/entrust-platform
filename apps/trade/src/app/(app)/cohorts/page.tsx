import { Card } from "@entrust/ui";

export const metadata = { title: "Cohorts" };

export default function CohortsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Program Cohorts</h1>
        <p className="mt-1 text-sm text-ink-2">
          Manage TRADE pilot programs, enrolled SMEs, and sponsor cohorts.
        </p>
      </div>

      <Card className="p-8 text-center max-w-xl mx-auto mt-6">
        <h2 className="font-display text-lg font-bold text-ink">No cohorts active</h2>
        <p className="mt-2 text-sm text-ink-2">
          Active cohorts and their SME enrolments will appear here once program sessions begin.
        </p>
      </Card>
    </div>
  );
}
