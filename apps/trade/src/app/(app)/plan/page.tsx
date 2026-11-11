import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { businessInView } from "@/lib/business";
import { tradeGet } from "@/lib/trade-api";
import type { CertificateView, EvidenceRecordView, LearningPlanRecord, ModuleExemptionView, ModuleProgressView, TradeEnrollmentSummary } from "@/lib/types";
import { PlanWorkspace } from "./plan-workspace";

export const metadata = { title: "Plan and exemptions" };

/**
 * A business's learning plan as a whole: each module's place and progress, the exemptions asked for, and the certificate.
 * The business asks for exemptions here. Entrust staff open it for a business they work with (?organizationId=), and act
 * on it as their role allows: change the plan's modules, decide exemptions, complete a module by override, revoke the
 * certificate. The API checks every one of those, whatever the page shows.
 */
export default async function PlanPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const { organizationId } = (await searchParams) ?? {};
  const business = await businessInView(me, organizationId);
  if (!business) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">Plan and exemptions</h1>
          <p className="mt-3 text-sm text-ink-2">{me.staffRole ? "Open a business's plan from its cohort." : "Choose your business using the switcher above."}</p>
        </Card>
      </div>
    );
  }

  const q = `organizationId=${encodeURIComponent(business.id)}`;
  const enrollments = await tradeGet<{ enrollments: TradeEnrollmentSummary[] }>(`/enrollments?${q}`);
  const enrollment =
    enrollments.data?.enrollments.find((e) => ["invited", "registered", "active", "paused"].includes(e.status)) ?? enrollments.data?.enrollments[0] ?? null;
  if (!enrollment) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-xl font-bold text-ink">{business.name}</h1>
          <p className="mt-3 text-sm text-ink-2">This business isn&apos;t enrolled in a cohort yet.</p>
        </Card>
      </div>
    );
  }
  const e = `enrollmentId=${encodeURIComponent(enrollment.id)}`;
  const [plans, progress, exemptions, certificate, evidence] = await Promise.all([
    tradeGet<{ items: LearningPlanRecord[] }>(`/plans?${e}`),
    tradeGet<{ items: ModuleProgressView[] }>(`/module-progress?${e}`),
    tradeGet<{ items: ModuleExemptionView[] }>(`/exemptions?${e}`),
    tradeGet<CertificateView>(`/enrollments/${encodeURIComponent(enrollment.id)}/certificate`),
    tradeGet<{ items: EvidenceRecordView[] }>(`/evidence?${q}`),
  ]);
  const plan = plans.data?.items.find((p) => p.status !== "superseded") ?? null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{enrollment.cohortName}</p>
        <h1 className="font-display text-2xl font-bold text-ink">{business.staffView ? `${business.name}: plan and exemptions` : "Plan and exemptions"}</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Every module in the plan, how far it has got, and any exemption asked for.{" "}
          {!business.staffView && (
            <>
              To ask for an exemption you need evidence of what you&apos;ve already done: add it on the <Link href="/evidence" className="font-semibold text-brand-600 hover:underline">Evidence</Link> page first.
            </>
          )}
        </p>
      </div>
      <PlanWorkspace
        enrollment={{ id: enrollment.id, status: enrollment.status }}
        plan={plan}
        progress={progress.data?.items ?? []}
        exemptions={exemptions.data?.items ?? []}
        certificate={certificate.data}
        evidence={(evidence.data?.items ?? []).filter((r) => r.status !== "not_submitted" && r.status !== "rejected")}
        role={me.staffRole ?? null}
        isMember={!business.staffView}
      />
    </div>
  );
}
