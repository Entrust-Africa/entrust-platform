import { Card } from "@entrust/ui";

export const metadata = { title: "Modules" };

export default function ModulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Modules</h1>
        <p className="mt-1 text-sm text-ink-2">
          Practical curriculum designed to build your company's export execution capability.
        </p>
      </div>

      <Card className="p-8 text-center max-w-xl mx-auto mt-6">
        <h2 className="font-display text-lg font-bold text-ink">No modules active yet</h2>
        <p className="mt-2 text-sm text-ink-2">
          Your learning plan will prescribe ordered modules based on your placement diagnostic assessment.
        </p>
      </Card>
    </div>
  );
}
