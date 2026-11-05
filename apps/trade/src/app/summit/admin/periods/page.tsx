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
        <p className="mt-2 text-base text-ink-2">Set when businesses can apply to the Summit and which countries can take part.</p>
      </div>
      <Card className="space-y-3 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-ink">What this page does</h2>
        <p className="text-base text-ink-2">
          Businesses can apply to the Summit only while an application period is open. A period is a name, the time it opens, the time it closes and the countries whose businesses may apply. Outside a period,
          the Summit page shows "Dates to come" or "Closed" and nobody can start or send an application.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-base text-ink-2">
          <li>Once the dates are decided, fill in the form below and open the period. The name and dates are what businesses see on the Summit page.</li>
          <li>You can change a period's dates or countries later, for example to extend the deadline. Periods can't overlap.</li>
          <li>A period uses the latest published application form and approved scoring rules at the moment it is opened.</li>
          <li>Opening a period doesn't email anyone. Reviewing the applications that come in is a separate step.</li>
        </ul>
      </Card>
      <PeriodsAdmin periods={items} />
    </div>
  );
}
