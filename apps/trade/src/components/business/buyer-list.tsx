import { Card, StatusBadge } from "@entrust/ui";

export interface Buyer {
  id: string;
  name: string;
  country: string;
  website: string | null;
  verificationStatus: "unverified" | "identity_checked" | "commercially_relevant" | "qualified_opportunity";
  opportunities: number;
  transactions: number;
}

const STATUS: Record<Buyer["verificationStatus"], { label: string; tone: "idle" | "info" | "ok" | "product" }> = {
  unverified: { label: "Not verified", tone: "idle" },
  identity_checked: { label: "Identity checked", tone: "info" },
  commercially_relevant: { label: "Commercially relevant", tone: "info" },
  qualified_opportunity: { label: "Qualified opportunity", tone: "ok" },
};

/** The business's one record of each buyer, which its pipeline and its export transactions share. */
export function BuyerList({ items }: { items: Buyer[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="buyers" className="space-y-3">
      <h2 id="buyers" className="font-display text-lg font-bold text-ink">Buyers</h2>
      <p className="max-w-2xl text-sm text-ink-2">Each buyer is recorded once, however many opportunities or transactions it has with you. A buyer is not treated as verified because it has a website; Entrust checks that.</p>
      <Card className="divide-y divide-line">
        {items.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">{b.name}{b.country ? <span className="font-normal text-ink-3"> · {b.country}</span> : null}</p>
              <p className="text-xs text-ink-3">{b.opportunities} {b.opportunities === 1 ? "opportunity" : "opportunities"} · {b.transactions} {b.transactions === 1 ? "transaction" : "transactions"}</p>
            </div>
            <StatusBadge tone={STATUS[b.verificationStatus].tone}>{STATUS[b.verificationStatus].label}</StatusBadge>
          </div>
        ))}
      </Card>
    </section>
  );
}
