import { redirect } from "next/navigation";
import { afriConnectBuyersUrl, afriConnectMarketIntelligenceUrl } from "@entrust/auth/africonnect";
import { BuyerSearchSimulation } from "@/components/practice/buyer-search-simulation";
import { getMe } from "@/lib/api";

export const metadata = { title: "Find a buyer on AfriConnect" };

export default async function BuyerSearchPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Find a buyer on AfriConnect</h1>
        <p className="mt-1 text-sm text-ink-2">
          A guided practice for M05: use AfriConnect's Market Intelligence to choose a market, then its Marketplace to find and qualify businesses. Every market, figure and company here is made up. You can repeat it as often as you like, and it isn't assessed.
        </p>
      </div>
      <BuyerSearchSimulation marketIntelligenceUrl={afriConnectMarketIntelligenceUrl()} marketplaceUrl={afriConnectBuyersUrl()} />
    </div>
  );
}
