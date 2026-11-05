import Link from "next/link";
import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { BOOKING_LOOK, usd, when } from "@/lib/commerce";
import { BookingActions } from "@/components/commerce/booking-actions";
import { PaymentPanel } from "@/components/commerce/payment-panel";
import { KeyValues, PageTitle, Pill } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS exhibitor" };

export default async function ExhibitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/summit/commerce/exhibitors/${id}`;
  const me = await requireUser(path);
  const b = await load(path, (api) => ok(api.v1.summit.commerce["exhibitor-bookings"][":id"].$get({ param: { id } })));
  const edition = await load(path, async (api) => {
    const list = await ok(api.v1.summit.commerce.editions.$get());
    const current = list.items.find((e) => e.isCurrent) ?? list.items[0];
    return current ? ok(api.v1.summit.commerce.editions[":id"].$get({ param: { id: current.id } })) : null;
  });
  const entrust = me.organizations?.find((o) => o.kind === "entrust")?.id ?? null;

  return (
    <div className="space-y-5">
      <Link href="/summit/commerce/exhibitors" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
        All exhibitors
      </Link>
      <PageTitle title={b.companyName} intro={`${b.number} · ${b.packageName} · ${usd(b.amountCents)}`}>
        <Pill look={BOOKING_LOOK[b.status]} />
      </PageTitle>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <Card className="space-y-4 p-4 sm:p-5">
            <h2 className="font-display text-xl font-bold text-ink">Application</h2>
            <KeyValues
              rows={[
                ["Contact", `${b.contactName}, ${b.position}`],
                ["Email", b.email],
                ["Telephone / WhatsApp", b.phone],
                ["Country", b.country],
                ["Sector", b.sector],
                ["Business registration", b.registrationDetails],
                ["Website", b.website],
                ["Preferred zone", b.preferredZone],
                ["Applied", when(b.createdAt)],
                ["Decided", b.decidedBy ? `${b.decidedBy.name}, ${when(b.decidedAt)}` : null],
              ]}
            />
            <KeyValues rows={[["Products and services", b.productsServices], ["Special booth requirements", b.boothRequirements], ["Comments", b.comments], ["Decision note", b.decisionNote]]} />
          </Card>
        </div>
        <div className="space-y-5">
          <BookingActions booking={b} zones={edition?.exhibitionZones ?? []} />
          {b.payment && (
            <PaymentPanel payment={b.payment} methods={edition?.paymentMethods.map((m) => ({ id: m.id, label: m.label })) ?? []} entrustOrganizationId={entrust} isAdmin={me.staffRole === "admin"} />
          )}
          {!b.payment && <Card className="p-4 text-sm text-ink-2">A payment is opened when the application is approved.</Card>}
        </div>
      </div>
    </div>
  );
}
