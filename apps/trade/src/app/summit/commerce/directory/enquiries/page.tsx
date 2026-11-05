import Link from "next/link";
import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { B2B_INTEREST_LABELS, when } from "@/lib/commerce";
import { HandledButton } from "@/components/commerce/directory-actions";
import { DataTable, FilterBar, PageTitle, Pager, cell } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS B2B enquiries" };

const LIMIT = 50;

export default async function B2bPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset) || 0);
  const status = sp.status === "new" || sp.status === "handled" ? sp.status : undefined;
  const list = await load("/summit/commerce/directory/enquiries", (api) =>
    ok(api.v1.summit.commerce.directory.enquiries.$get({ query: { limit: String(LIMIT), offset: String(offset), ...(status ? { status } : {}), ...(sp.q ? { q: sp.q } : {}) } })),
  );
  return (
    <div className="space-y-5">
      <Link href="/summit/commerce/directory" className="text-sm font-semibold text-brand-700 underline underline-offset-2">
        SME directory
      </Link>
      <PageTitle title="B2B enquiries" intro="Buyers, investors and partners asking to meet the selected businesses. The business's owners already have each message by email; use this list to help set up the meeting.">
        <span className="text-sm text-ink-2">{list.byStatus.new ?? 0} new · {list.byStatus.handled ?? 0} followed up</span>
      </PageTitle>
      <FilterBar selects={[{ name: "status", label: "All", options: [["new", "New"], ["handled", "Followed up"]] }]} placeholder="Business, sender, organisation or reference" />
      <DataTable head={["Reference", "For", "From", "Interest and message", "Received", ""]} empty="No enquiries yet.">
        {list.items.map((e) => (
          <tr key={e.id}>
            <td className={`${cell} whitespace-nowrap font-semibold`}>{e.number}</td>
            <td className={cell}>{e.businessName}</td>
            <td className={cell}>
              <span className="font-semibold text-ink">{e.fromName}</span>
              <br />
              {e.fromOrganisation}
              <br />
              <span className="text-ink-3">{e.fromEmail}</span>
            </td>
            <td className={`${cell} max-w-sm`}>
              <span className="text-xs font-bold tracking-wide text-ink-3 uppercase">{B2B_INTEREST_LABELS[e.interest]}</span>
              <br />
              {e.message}
              {e.handlingNote && <p className="mt-1 text-ink-3">Followed up: {e.handlingNote}</p>}
            </td>
            <td className={`${cell} whitespace-nowrap`}>{when(e.createdAt).slice(0, 10)}</td>
            <td className={cell}>{e.status === "new" ? <HandledButton id={e.id} /> : <span className="text-sm text-ok">{e.handledBy?.name ?? "Followed up"}</span>}</td>
          </tr>
        ))}
      </DataTable>
      <Pager total={list.total} limit={LIMIT} offset={offset} path="/summit/commerce/directory/enquiries" />
    </div>
  );
}
