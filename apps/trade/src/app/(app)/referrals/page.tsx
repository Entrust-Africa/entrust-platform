import { redirect } from "next/navigation";
import { ReferralBoard } from "@/components/referrals/referral-board";
import type { Referral } from "@/components/referrals/referral-types";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Partner referrals" };

export default async function ReferralsPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string; organizationName?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (!me.staffRole) redirect("/business");
  const { organizationId, organizationName } = (await searchParams) ?? {};
  const referrals = await tradeGet<{ items: Referral[] }>("/referrals");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Partner referrals</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">Refer a business to a bank, an insurer or a service provider. The business decides what is shared, with whom and why, and can take its consent back at any time.</p>
      </div>
      <ReferralBoard initial={referrals.data?.items ?? []} canWrite={me.staffRole !== "reviewer"} forBusiness={organizationId ? { id: organizationId, name: organizationName ?? "this business" } : null} />
    </div>
  );
}
