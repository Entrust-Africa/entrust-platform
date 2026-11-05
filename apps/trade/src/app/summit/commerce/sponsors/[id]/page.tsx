import Link from "next/link";
import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { ENQUIRY_LOOK, usd, when } from "@/lib/commerce";
import { EnquiryActions } from "@/components/commerce/enquiry-actions";
import { PaymentPanel } from "@/components/commerce/payment-panel";
import { KeyValues, PageTitle, Pill } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS sponsorship enquiry" };

export default async function SponsorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/summit/commerce/sponsors/${id}`;
  const me = await requireUser(path);
  const e = await load(path, (api) => ok(api.v1.summit.commerce["sponsor-enquiries"][":id"].$get({ param: { id } })));
  const edition = await load(path, async (api) => {
    const list = await ok(api.v1.summit.commerce.editions.$get());
    const current = list.items.find((x) => x.isCurrent) ?? list.items[0];
    return current ?? null;
  });
  const entrust = me.organizations?.find((o) => o.kind === "entrust")?.id ?? null;

  return (
    <div className="space-y-5">
      <Link href="/summit/commerce/sponsors" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
        All sponsors
      </Link>
      <PageTitle title={e.organisationName} intro={`${e.number} · ${e.productName} · ${usd(e.valueCents)}`}>
        <Pill look={ENQUIRY_LOOK[e.status]} />
      </PageTitle>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold text-ink">Enquiry</h2>
            <KeyValues
              rows={[
                ["Contact", `${e.contactName}, ${e.position}`],
                ["Email", e.email],
                ["Telephone", e.phone],
                ["Country", e.country],
                ["Sector", e.sector],
                ["Received", when(e.createdAt)],
              ]}
            />
            <KeyValues rows={[["Sponsorship objectives", e.objectives], ["Additional requirements", e.requirements]]} />
          </Card>
          <Card className="space-y-3 p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold text-ink">History</h2>
            {e.history.length === 0 ? (
              <p className="text-sm text-ink-3">No moves yet.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {e.history.map((h, i) => (
                  <li key={i} className="rounded-md bg-surface-2 px-3 py-2">
                    <span className="font-semibold text-ink">{ENQUIRY_LOOK[h.to]?.label ?? h.to}</span>
                    <span className="text-ink-2"> · {h.by ?? "Platform"} · {when(h.at)}</span>
                    {h.note && <p className="mt-0.5 text-ink-2">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <EnquiryActions enquiry={e} />
          {e.payment ? (
            <PaymentPanel payment={e.payment} methods={edition?.paymentMethods.map((m) => ({ id: m.id, label: m.label })) ?? []} entrustOrganizationId={entrust} isAdmin={me.staffRole === "admin"} />
          ) : (
            <Card className="p-4 text-sm text-ink-2">A payment is opened when the sponsorship is confirmed.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
