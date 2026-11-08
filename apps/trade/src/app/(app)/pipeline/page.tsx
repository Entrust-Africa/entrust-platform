import { redirect } from "next/navigation";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { PipelineDashboard } from "@/components/pipeline/pipeline-dashboard";
import type { ExportJourneyStageView, OpportunityView } from "@/lib/types";

export const metadata = { title: "Commercial pipeline" };

interface PipelinePageProps {
  searchParams?: Promise<{ organizationId?: string }>;
}

export default async function PipelinePage({ searchParams }: PipelinePageProps) {
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

  const [oppsRes, journeyRes] = await Promise.all([
    tradeGet<{ items: OpportunityView[] }>(`/pipeline?organizationId=${encodeURIComponent(activeOrg.id)}`),
    tradeGet<ExportJourneyStageView>(`/pipeline/journey?organizationId=${encodeURIComponent(activeOrg.id)}`),
  ]);

  const opportunities = oppsRes.data?.items ?? [];
  const journey: ExportJourneyStageView = journeyRes.data ?? {
    stageNumber: 2,
    title: "Target Market Selected",
    description: "Target market identified and compliance requirements mapped.",
    furthestOpportunityId: null,
    activeOpportunitiesCount: opportunities.length,
    m05DeliverableStatus: {
      isEligible: false,
      verifiedCount: 0,
      missingCount: 5,
    },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Commercial pipeline</h1>
        <p className="mt-1 text-sm text-ink-2">
          Keep track of the buyers you are talking to, score each lead, and see how far you are on your export journey.
        </p>
      </div>

      <PipelineDashboard
        initialOpportunities={opportunities}
        initialJourney={journey}
        organizationId={activeOrg.id}
        organizationName={activeOrg.name}
        readOnly={me.staffRole === "reviewer"}
        actingAsStaff={me.staffRole === "admin" || me.staffRole === "facilitator"}
      />
    </div>
  );
}
