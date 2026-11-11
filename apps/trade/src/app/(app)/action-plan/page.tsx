import { redirect } from "next/navigation";
import { ActionPlanBoard, type ActionPlan } from "@/components/action-plan/action-plan-board";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { businessInView } from "@/lib/business";

export const metadata = { title: "90-day action plan" };

export default async function ActionPlanPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const { organizationId } = (await searchParams) ?? {};
  // Staff open a business by its id in the address; a member gets their own.
  const activeOrg = await businessInView(me, organizationId);
  if (!activeOrg) redirect("/");

  const plan = await tradeGet<ActionPlan>(`/action-plan?organizationId=${encodeURIComponent(activeOrg.id)}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">90-day action plan</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Your working plan from M12: what you will do, who owns it and by when. It stays here after your certificate, so keep it up to date and review it at 30, 60 and 90 days.
        </p>
      </div>
      {plan.data ? (
        <ActionPlanBoard initial={plan.data} organizationId={activeOrg.id} readOnly={me.staffRole === "reviewer"} />
      ) : (
        <p className="text-sm text-ink-2">{plan.error ?? "Your action plan isn't available yet."}</p>
      )}
    </div>
  );
}
