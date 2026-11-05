import Link from "next/link";
import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { PROFILE_LOOK } from "@/lib/commerce";
import { PrefillButton } from "@/components/commerce/directory-actions";
import { DataTable, FilterBar, NoEdition, PageTitle, Pill, Stat, cell } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS SME directory" };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const status = sp.status === "draft" || sp.status === "published" ? sp.status : undefined;
  const [list, editions] = await Promise.all([
    load("/summit/commerce/directory", (api) => ok(api.v1.summit.commerce.directory.profiles.$get({ query: { ...(status ? { status } : {}), ...(sp.q ? { q: sp.q } : {}) } }))),
    load("/summit/commerce/directory", (api) => ok(api.v1.summit.commerce.editions.$get())),
  ]);
  if (editions.items.length === 0) return <NoEdition />;
  return (
    <div className="space-y-5">
      <PageTitle title="SME directory" intro="A public page for each selected SME. A profile goes live only after the business has approved it.">
        <Link href="/summit/commerce/directory/enquiries" className="inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface-2">
          B2B enquiries
        </Link>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Published" value={list.byStatus.published ?? 0} tone="ok" />
        <Stat label="Drafts" value={list.byStatus.draft ?? 0} />
        <Stat label="Selected, no profile yet" value={list.selectedWithoutProfile} tone={list.selectedWithoutProfile > 0 ? "warn" : undefined} />
      </div>
      <PrefillButton missing={list.selectedWithoutProfile} />
      <FilterBar selects={[{ name: "status", label: "All profiles", options: [["draft", "Drafts"], ["published", "Published"]] }]} placeholder="Name, industry or application number" />
      <DataTable head={["Business", "Application", "Country", "Industry", "Status", "Business approved", "B2B enquiries"]} empty="No profiles yet. Make drafts once the committee's final list is approved.">
        {list.items.map((p) => (
          <tr key={p.id}>
            <td className={cell}>
              <Link href={`/summit/commerce/directory/${p.id}`} className="font-semibold text-brand-700 underline underline-offset-2">
                {p.displayName}
              </Link>
            </td>
            <td className={cell}>{p.applicationNumber}</td>
            <td className={cell}>{p.country}</td>
            <td className={cell}>{p.sector}</td>
            <td className={cell}><Pill look={PROFILE_LOOK[p.status]} /></td>
            <td className={cell}>{p.businessApproved ? "Yes" : "Not yet"}</td>
            <td className={cell}>{p.enquiries}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
