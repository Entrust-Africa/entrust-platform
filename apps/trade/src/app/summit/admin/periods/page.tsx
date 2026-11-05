import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { LinkButton } from "@/components/summit/link-button";
import { PeriodsAdmin } from "@/components/summit/periods-admin";

export const metadata = { title: "Summit application periods" };

export default async function PeriodsPage() {
  const path = "/summit/admin/periods";
  const me = await requireUser(path);

  if (me.staffRole !== "admin") {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Only for Entrust administrators</h1>
          <p className="text-base text-ink-2">You need an Entrust administrator account to set application periods.</p>
          <LinkButton href="/summit">Back to the Summit</LinkButton>
        </Card>
      </div>
    );
  }

  const { items } = await load(path, (api) => ok(api.v1.summit.periods.$get()));
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Summit</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-ink">Application periods</h1>
        <p className="mt-2 text-base text-ink-2">Set when businesses can apply and which countries can take part.</p>
      </div>
      <PeriodsAdmin periods={items} />
    </div>
  );
}
