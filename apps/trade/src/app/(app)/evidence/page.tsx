import { redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { businessInView } from "@/lib/business";
import { tradeGet } from "@/lib/trade-api";
import type { EvidenceRecordView } from "@/lib/types";
import { EvidenceWorkspace } from "./evidence-workspace";

export const metadata = { title: "Evidence" };

/**
 * What backs a business's answers and requests: documents it sends, and what Entrust asks it for. The business adds evidence
 * and answers requests here; staff open it for a business they work with (?organizationId=) to ask for evidence and review it.
 */
export default async function EvidencePage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { organizationId } = (await searchParams) ?? {};
  const business = await businessInView(me, organizationId);
  if (!business) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Evidence</h1>
          <p className="mt-3 text-sm text-ink-2">{me.staffRole ? "Open a business's evidence from its cohort." : "Choose your business using the switcher above."}</p>
        </Card>
      </div>
    );
  }
  const records = await tradeGet<{ items: EvidenceRecordView[] }>(`/evidence?organizationId=${encodeURIComponent(business.id)}`);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{business.staffView ? `${business.name}: evidence` : "Evidence"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          {business.staffView
            ? "What the business has sent to back its answers, and what you've asked it for. Review what has come in."
            : "Documents that back your answers, and anything Entrust has asked you for. Entrust reviews what you send."}
        </p>
      </div>
      <EvidenceWorkspace organizationId={business.id} initial={records.data?.items ?? []} role={me.staffRole ?? null} isMember={!business.staffView} />
    </div>
  );
}
