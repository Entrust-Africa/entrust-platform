import { redirect } from "next/navigation";
import { BusinessRecord, type BusinessProfile, type BusinessRecordData, type ProfileChange, type Product, type Shipment } from "@/components/business/business-record";
import { ReadinessProfiles, type ReadinessData } from "@/components/readiness/readiness-profiles";
import { ReferralConsent } from "@/components/referrals/referral-consent";
import type { Referral } from "@/components/referrals/referral-types";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "My business" };

export default async function BusinessPage({ searchParams }: { searchParams?: Promise<{ organizationId?: string }> }) {
  const me = await getMe();
  if (!me) redirect("/sign-in");

  const { organizationId } = (await searchParams) ?? {};
  const activeOrg =
    (organizationId ? me.organizations?.find((o) => o.id === organizationId) : null) ??
    me.organizations?.find((o) => o.id === me.activeOrganizationId) ??
    me.organizations?.[0];
  if (!activeOrg) redirect("/");

  const q = `organizationId=${encodeURIComponent(activeOrg.id)}`;
  const [profile, products, shipments, history, referrals, readiness] = await Promise.all([
    tradeGet<BusinessProfile>(`/business-profile?${q}`),
    tradeGet<{ items: Product[] }>(`/products?${q}&includeArchived=true`),
    tradeGet<{ items: Shipment[] }>(`/export-history?${q}`),
    tradeGet<{ items: ProfileChange[] }>(`/business-profile/history?${q}`),
    tradeGet<{ items: Referral[] }>(`/referrals?${q}`),
    tradeGet<ReadinessData>(`/readiness-profiles?${q}`),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">My business</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">Your business's details, what it sells and the shipments it has completed. Correct anything that is wrong; every change is kept in the history.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="text-ink-3">Download your business report:</span>
          {(["pdf", "xlsx", "csv"] as const).map((format) => (
            <a key={format} href={`/business/report?organizationId=${encodeURIComponent(activeOrg.id)}&format=${format}`} className="font-semibold text-brand-600 underline-offset-4 hover:underline">
              {format === "xlsx" ? "Excel" : format.toUpperCase()}
            </a>
          ))}
        </div>
      </div>
      {profile.data ? (
        <>
          {readiness.data && <ReadinessProfiles data={readiness.data} />}
          <ReferralConsent initial={referrals.data?.items ?? []} isOwner={activeOrg.role === "owner"} />
          <BusinessRecord
          initial={{ profile: profile.data, products: products.data?.items ?? [], shipments: shipments.data?.items ?? [], history: history.data?.items ?? [] } satisfies BusinessRecordData}
          readOnly={me.staffRole === "reviewer"}
          isStaff={Boolean(me.staffRole)}
          />
        </>
      ) : (
        <p className="text-sm text-ink-2">{profile.error ?? "This business's details aren't available."}</p>
      )}
    </div>
  );
}
