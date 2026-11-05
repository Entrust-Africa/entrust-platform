import { Card } from "@entrust/ui";
import { requireUser } from "@/lib/summit-server";
import { canHandleCommerce } from "@/lib/commerce";
import { LinkButton } from "@/components/summit/link-button";
import { CommerceTabs } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS commercial" };

/** The ADTIS commercial screens: Entrust administrators and facilitators only. */
export default async function CommerceLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser("/summit/commerce");
  if (!canHandleCommerce(me)) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="space-y-3 p-6">
          <h1 className="font-display text-2xl font-bold text-ink">Only for the ADTIS team</h1>
          <p className="text-base text-ink-2">You need an Entrust administrator or facilitator account to manage exhibitors, sponsors and delegates.</p>
          <LinkButton href="/summit">Back to the Summit</LinkButton>
        </Card>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">ADTIS commercial</p>
      </div>
      <CommerceTabs />
      {children}
    </div>
  );
}
