import { Card } from "@entrust/ui";

export const metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Evidence Portfolio</h1>
        <p className="mt-1 text-sm text-ink-2">
          Verified company records, export documentation, and compliance evidence.
        </p>
      </div>

      <Card className="p-8 text-center max-w-xl mx-auto mt-6">
        <h2 className="font-display text-lg font-bold text-ink">Portfolio is empty</h2>
        <p className="mt-2 text-sm text-ink-2">
          As you progress through your learning plan, submit evidence records here for staff verification.
        </p>
      </Card>
    </div>
  );
}
