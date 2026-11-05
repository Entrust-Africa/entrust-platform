import { redirect } from "next/navigation";
import { Card } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";
import { ConsentManager, type ConsentData } from "./consent-manager";

export const metadata = { title: "What you share" };

export default async function ConsentPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const organizationId = me.activeOrganizationId ?? me.organizations?.[0]?.id;
  const result = await tradeGet<ConsentData>(organizationId ? `/consents?organizationId=${encodeURIComponent(organizationId)}` : "/consents");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">What you share</h1>
        <p className="mt-1 text-sm text-ink-2">
          The bank or partner that sponsors your cohort sees figures about the whole cohort, with no names. They see your business by name only for what you turn on here. You can turn it off at any time, and they lose access at once.
        </p>
      </div>
      {result.data && result.data.sponsors.length > 0 ? (
        <ConsentManager initial={result.data} />
      ) : (
        <Card className="p-8 text-center">
          <h2 className="font-display text-lg font-bold text-ink">Nothing is shared</h2>
          <p className="mt-2 text-sm text-ink-2">
            {result.data
              ? "Your cohort has no sponsor, so nobody outside Entrust can see your business."
              : (result.error ?? "We couldn't load this page. Switch to your business using the switcher above, then try again.")}
          </p>
        </Card>
      )}
    </div>
  );
}
