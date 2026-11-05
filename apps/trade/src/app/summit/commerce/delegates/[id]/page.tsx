import Link from "next/link";
import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { DELEGATE_LOOK, usd, when } from "@/lib/commerce";
import { DelegateActions } from "@/components/commerce/delegate-actions";
import { PaymentPanel } from "@/components/commerce/payment-panel";
import { KeyValues, PageTitle, Pill } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS delegate" };

export default async function DelegatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/summit/commerce/delegates/${id}`;
  const me = await requireUser(path);
  const d = await load(path, (api) => ok(api.v1.summit.commerce.delegates[":id"].$get({ param: { id } })));
  const edition = await load(path, async (api) => {
    const list = await ok(api.v1.summit.commerce.editions.$get());
    return list.items.find((x) => x.isCurrent) ?? list.items[0] ?? null;
  });
  const entrust = me.organizations?.find((o) => o.kind === "entrust")?.id ?? null;

  return (
    <div className="space-y-5">
      <Link href="/summit/commerce/delegates" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
        All delegates
      </Link>
      <PageTitle title={d.fullName} intro={`${d.number} · ${d.categoryName} · ${d.amountCents === 0 ? "Complimentary" : usd(d.amountCents)}`}>
        <Pill look={DELEGATE_LOOK[d.status]} />
      </PageTitle>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold text-ink">Details</h2>
            <KeyValues
              rows={[
                ["Organisation", d.organisation],
                ["Job title", d.jobTitle],
                ["Email", d.email],
                ["Telephone", d.phone],
                ["Country", d.country],
                ["Sector", d.sector],
                ["Selected SME application", d.application?.number],
                ["Needs", d.needs],
                ["Registered", when(d.createdAt)],
              ]}
            />
          </Card>
        </div>
        <div className="space-y-5">
          <DelegateActions delegate={d} />
          {d.payment && (
            <PaymentPanel payment={d.payment} methods={edition?.paymentMethods.map((m) => ({ id: m.id, label: m.label })) ?? []} entrustOrganizationId={entrust} isAdmin={me.staffRole === "admin"} />
          )}
        </div>
      </div>
    </div>
  );
}
