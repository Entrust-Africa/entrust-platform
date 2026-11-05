import Link from "next/link";
import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { BOOKING_LOOK, PAYMENT_LOOK, usd, when } from "@/lib/commerce";
import { DataTable, FilterBar, PageTitle, Pager, Pill, cell } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS exhibitors" };

const STATUSES: [string, string][] = Object.entries(BOOKING_LOOK).map(([k, v]) => [k, v.label]);
const LIMIT = 50;

export default async function ExhibitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset) || 0);
  const status = STATUSES.some(([k]) => k === sp.status) ? (sp.status as keyof typeof BOOKING_LOOK) : undefined;
  const list = await load("/summit/commerce/exhibitors", (api) =>
    ok(api.v1.summit.commerce["exhibitor-bookings"].$get({ query: { limit: String(LIMIT), offset: String(offset), ...(status ? { status: status as never } : {}), ...(sp.q ? { q: sp.q } : {}) } })),
  );
  return (
    <div className="space-y-5">
      <PageTitle title="Exhibitors" intro="Applications for exhibition space. Approve one to hold a booth and send the payment instructions; confirm it once the payment is verified.">
        <span className="text-sm text-ink-2">
          {Object.entries(list.byStatus).map(([k, n]) => `${n} ${BOOKING_LOOK[k]?.label.toLowerCase() ?? k}`).join(" · ")}
        </span>
      </PageTitle>
      <FilterBar selects={[{ name: "status", label: "All statuses", options: STATUSES }]} placeholder="Company, contact, email or reference" />
      <DataTable head={["Reference", "Company", "Package", "Status", "Payment", "Booth", "Amount", "Applied"]} empty="No applications match.">
        {list.items.map((b) => (
          <tr key={b.id}>
            <td className={`${cell} whitespace-nowrap`}>
              <Link href={`/summit/commerce/exhibitors/${b.id}`} className="font-semibold text-brand-700 underline underline-offset-2">
                {b.number}
              </Link>
            </td>
            <td className={cell}>
              <span className="font-semibold text-ink">{b.companyName}</span>
              <br />
              <span className="text-ink-3">{b.contactName}, {b.country}</span>
            </td>
            <td className={cell}>{b.packageName}</td>
            <td className={cell}><Pill look={BOOKING_LOOK[b.status]} /></td>
            <td className={cell}>{b.paymentStatus ? <Pill look={PAYMENT_LOOK[b.paymentStatus]} /> : <span className="text-ink-3">None yet</span>}</td>
            <td className={cell}>{b.boothNumber ?? ""}{b.zone ? ` (${b.zone})` : ""}</td>
            <td className={cell}>{usd(b.amountCents)}</td>
            <td className={`${cell} whitespace-nowrap`}>{when(b.createdAt).slice(0, 10)}</td>
          </tr>
        ))}
      </DataTable>
      <Pager total={list.total} limit={LIMIT} offset={offset} path="/summit/commerce/exhibitors" />
    </div>
  );
}
