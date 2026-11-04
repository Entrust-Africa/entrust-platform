import { Card } from "@entrust/ui";

export const metadata = { title: "Review Queue" };

export default function ReviewQueuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Review Queue</h1>
        <p className="mt-1 text-sm text-ink-2">
          Submissions and assessments requiring Entrust facilitator or staff review.
        </p>
      </div>

      <Card className="p-8 text-center max-w-xl mx-auto mt-6">
        <h2 className="font-display text-lg font-bold text-ink">Review queue is clear</h2>
        <p className="mt-2 text-sm text-ink-2">
          Assessments with provisional pathways or pending evidence verifications will queue here for review.
        </p>
      </Card>
    </div>
  );
}
