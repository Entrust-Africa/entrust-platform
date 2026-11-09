import { redirect } from "next/navigation";
import { PricingCalculator } from "@/components/tools/pricing-calculator";
import { getMe } from "@/lib/api";

export const metadata = { title: "Pricing calculator" };

export default async function PricingPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Pricing calculator</h1>
        <p className="mt-1 text-sm text-ink-2">
          Work out a selling price from the full cost of an order, and see the difference between markup and gross margin. Nothing here is saved: put your final figures in your worksheet.
        </p>
      </div>
      <PricingCalculator />
    </div>
  );
}
