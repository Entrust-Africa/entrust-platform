import Link from "next/link";
import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { ENQUIRY_LOOK, PAYMENT_LOOK, usd, when } from "@/lib/commerce";
import { DataTable, FilterBar, PageTitle, Pager, Pill, Stat, cell } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS sponsors" };

const STATUSES: [string, string][] = Object.entries(ENQUIRY_LOOK).map(([k, v]) => [k, v.label]);
const LIMIT = 50;

export default async function SponsorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset) || 0);
  const status = STATUSES.some(([k]) => k === sp.status) ? sp.status : undefined;
  const kind = sp.kind === "sponsorship_level" || sp.kind === "opportunity" ? sp.kind : undefined;
  const list = await load("/summit/commerce/sponsors", (api) =>
    ok(api.v1.summit.commerce["sponsor-enquiries"].$get({ query: { limit: String(LIMIT), offset: String(offset), ...(status ? { status: status as never } : {}), ...(kind ? { kind } : {}), ...(sp.q ? { q: sp.q } : {}) } })),
  );
  const p = list.pipeline;
  return (
    <div className="space-y-5">
      <PageTitle title="Sponsors" intro="Sponsorship and opportunity enquiries, from the first message to a confirmed sponsor." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Open enquiries" value={p.openCount} note={usd(p.openValueCents)} />
        <Stat label="Confirmed sponsors" value={p.confirmedCount} note={usd(p.confirmedValueCents)} tone="ok" />
      </div>
      <FilterBar
        selects={[
          { name: "status", label: "All statuses", options: STATUSES },
          { name: "kind", label: "Levels and opportunities", options: [["sponsorship_level", "Sponsorship levels"], ["opportunity", "Additional opportunities"]] },
        ]}
        placeholder="Organisation, contact, email or reference"
      />
      <DataTable head={["Reference", "Organisation", "Interested in", "Status", "Payment", "Value", "Last change"]} empty="No enquiries match.">
        {list.items.map((e) => (
          <tr key={e.id}>
            <td className={`${cell} whitespace-nowrap`}>
              <Link href={`/summit/commerce/sponsors/${e.id}`} className="font-semibold text-brand-700 underline underline-offset-2">
                {e.number}
              </Link>
            </td>
            <td className={cell}>
              <span className="font-semibold text-ink">{e.organisationName}</span>
              <br />
              <span className="text-ink-3">{e.contactName}, {e.country}</span>
            </td>
            <td className={cell}>{e.productName}</td>
            <td className={cell}><Pill look={ENQUIRY_LOOK[e.status]} /></td>
            <td className={cell}>{e.paymentStatus ? <Pill look={PAYMENT_LOOK[e.paymentStatus]} /> : <span className="text-ink-3">None yet</span>}</td>
            <td className={cell}>{usd(e.valueCents)}</td>
            <td className={`${cell} whitespace-nowrap`}>{when(e.statusChangedAt).slice(0, 10)}</td>
          </tr>
        ))}
      </DataTable>
      <Pager total={list.total} limit={LIMIT} offset={offset} path="/summit/commerce/sponsors" />
    </div>
  );
}
