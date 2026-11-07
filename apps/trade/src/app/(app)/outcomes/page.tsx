import { redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { OutcomesDashboard } from "@/components/outcomes/outcomes-dashboard";
import type { OutcomeView } from "@/lib/types";

export const metadata = { title: "Financing & Export Outcomes" };

interface OutcomesPageProps {
  searchParams?: Promise<{ organizationId?: string }>;
}

export default async function OutcomesPage({ searchParams }: OutcomesPageProps) {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const { organizationId: queryOrgId } = (await searchParams) ?? {};
  const activeOrg =
    (queryOrgId ? me.organizations?.find((o) => o.id === queryOrgId) : null) ??
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ??
    me.organizations?.[0];

  if (!activeOrg) {
    redirect("/");
  }

  const res = await tradeGet<{ items: OutcomeView[] }>(
    `/outcomes?organizationId=${encodeURIComponent(activeOrg.id)}`
  );

  const outcomes = res.data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Financing & Export Outcomes</h1>
        <p className="mt-1 text-sm text-ink-2">
          Track trade financing applications and verify export fulfillment shipments and foreign exchange proceeds.
        </p>
      </div>

      <OutcomesDashboard
        initialOutcomes={outcomes}
        organizationId={activeOrg.id}
      />
    </div>
  );
}
