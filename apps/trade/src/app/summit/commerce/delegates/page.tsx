import Link from "next/link";
import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { PAYMENT_LOOK, usd, when } from "@/lib/commerce";
import { DataTable, FilterBar, PageTitle, Pager, Stat, cell } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS delegates" };

const LIMIT = 50;
const PAYMENTS: [string, string][] = Object.entries(PAYMENT_LOOK).map(([k, v]) => [k, v.label]);

export default async function DelegatesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset) || 0);
  const paymentStatus = PAYMENTS.some(([k]) => k === sp.paymentStatus) ? sp.paymentStatus : undefined;
  const status = sp.status === "registered" || sp.status === "cancelled" ? sp.status : undefined;
  const checkedIn = sp.checkedIn === "true" || sp.checkedIn === "false" ? sp.checkedIn : undefined;
  const list = await load("/summit/commerce/delegates", (api) =>
    ok(
      api.v1.summit.commerce.delegates.$get({
        query: { limit: String(LIMIT), offset: String(offset), ...(paymentStatus ? { paymentStatus: paymentStatus as never } : {}), ...(status ? { status } : {}), ...(checkedIn ? { checkedIn } : {}), ...(sp.q ? { q: sp.q } : {}) },
      }),
    ),
  );
  const t = list.totals;
  return (
    <div className="space-y-5">
      <PageTitle title="Delegates" intro="Everyone registered to attend. A paid delegate's badge becomes valid when you verify their payment." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Registered" value={t.registered} />
        <Stat label="Paid or free" value={t.paymentConfirmed} tone="ok" />
        <Stat label="Payment pending" value={t.paymentPending} tone={t.paymentPending > 0 ? "warn" : undefined} />
        <Stat label="Checked in" value={t.checkedIn} />
        <Stat label="Cancelled" value={t.cancelled} />
      </div>
      <FilterBar
        selects={[
          { name: "paymentStatus", label: "Any payment", options: PAYMENTS },
          { name: "status", label: "Any registration", options: [["registered", "Registered"], ["cancelled", "Cancelled"]] },
          { name: "checkedIn", label: "Arrival", options: [["true", "Checked in"], ["false", "Not yet arrived"]] },
        ]}
        placeholder="Name, organisation, email or reference"
      />
      <DataTable head={["Reference", "Name", "Organisation", "Category", "Payment", "Amount", "Registered"]} empty="No delegates match.">
        {list.items.map((d) => (
          <tr key={d.id}>
            <td className={`${cell} whitespace-nowrap`}>
              <Link href={`/summit/commerce/delegates/${d.id}`} className="font-semibold text-brand-700 underline underline-offset-2">
                {d.number}
              </Link>
            </td>
            <td className={cell}>
              <span className="font-semibold text-ink">{d.fullName}</span>
              {d.status === "cancelled" && <span className="ml-2 text-xs font-semibold text-ink-3">Cancelled</span>}
              {d.checkedInAt && <span className="ml-2 text-xs font-semibold text-info">Checked in</span>}
              <br />
              <span className="text-ink-3">{d.email}</span>
            </td>
            <td className={cell}>
              {d.organisation}
              <br />
              <span className="text-ink-3">{d.country}</span>
            </td>
            <td className={cell}>
              {d.categoryName}
              {d.selectedSme && <span className="ml-1 text-xs text-ink-3">(selected SME)</span>}
            </td>
            <td className={cell}>{d.paymentStatus ? PAYMENT_LOOK[d.paymentStatus]?.label : ""}</td>
            <td className={cell}>{d.amountCents === 0 ? "Free" : usd(d.amountCents)}</td>
            <td className={`${cell} whitespace-nowrap`}>{when(d.createdAt).slice(0, 10)}</td>
          </tr>
        ))}
      </DataTable>
      <Pager total={list.total} limit={LIMIT} offset={offset} path="/summit/commerce/delegates" />
    </div>
  );
}
