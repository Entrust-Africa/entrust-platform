import { Card } from "@entrust/ui";

export const metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Commercial Pipeline</h1>
        <p className="mt-1 text-sm text-ink-2">
          Track buyer inquiries, quotations, orders, and trade finance applications.
        </p>
      </div>

      <Card className="p-8 text-center max-w-xl mx-auto mt-6">
        <h2 className="font-display text-lg font-bold text-ink">No commercial deals recorded</h2>
        <p className="mt-2 text-sm text-ink-2">
          Opportunities identified during your trade program will be tracked here from inquiry to settlement.
        </p>
      </Card>
    </div>
  );
}
