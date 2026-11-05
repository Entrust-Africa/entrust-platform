import Link from "next/link";
import { NotOpen, Page } from "@/components/site";
import { DIRECTORY_PAGE, getCatalogue, getDirectory, type DirectoryCard } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "African SMEs · Africa Diaspora Trade & Investment Summit 2027",
  description: "Explore the African SMEs selected for ADTIS 2027: filter by country, industry, products, target markets and investment interests.",
};

const select = "mt-1.5 block h-12 w-full border border-ink/25 bg-white px-3 text-sm text-ink focus:border-amber";

function Card({ sme }: { sme: DirectoryCard }) {
  return (
    <article className="flex flex-col border border-line bg-white">
      <div className="flex-1 p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-amber-ink uppercase">
          {sme.countryName}
          {sme.city ? ` · ${sme.city}` : ""}
        </p>
        <h2 className="mt-3 font-display text-2xl leading-tight uppercase">
          <Link href={`/smes/${sme.slug}`} className="hover:text-amber-ink">
            {sme.name}
          </Link>
        </h2>
        <p className="mt-2 text-xs font-semibold text-ink/60">{sme.sector}</p>
        <p className="mt-4 text-sm leading-relaxed text-ink/75">{sme.summary}</p>
        {sme.productsServices.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Products and services">
            {sme.productsServices.slice(0, 4).map((p) => (
              <li key={p} className="bg-paper px-2 py-1 text-xs text-ink/80">
                {p}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] tracking-wide uppercase">
          {sme.seeksInvestment && <span className="bg-amber/20 px-2 py-1 text-amber-ink">Seeking investment</span>}
          <span className={sme.verification === "verified" ? "bg-ink px-2 py-1 text-white" : "bg-paper px-2 py-1 text-ink/70"}>{sme.verificationLabel}</span>
        </div>
      </div>
      <Link href={`/smes/${sme.slug}`} className="inline-flex h-12 items-center justify-center bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink-deep">
        View profile
      </Link>
    </article>
  );
}

export default async function SmesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const offset = Math.max(0, Number(sp.offset) || 0);
  const [directory, catalogue] = await Promise.all([getDirectory(sp, offset), getCatalogue()]);
  const selected = catalogue?.edition?.selectedSmes;

  const link = (to: number) => {
    const params = new URLSearchParams();
    for (const key of ["country", "sector", "market", "q", "investment"]) if (sp[key]) params.set(key, sp[key]!);
    if (to > 0) params.set("offset", String(to));
    const query = params.toString();
    return `/smes${query ? `?${query}` : ""}`;
  };
  const filtered = ["country", "sector", "market", "q", "investment"].some((k) => sp[k]);

  return (
    <Page
      label="African SMEs"
      title="Meet the selected businesses"
      intro={`${selected ? `${selected} African businesses` : "African businesses"} selected through a standard assessment, ready to meet buyers, investors and partners. Every profile was approved by the business.`}
    >
      {!directory ? (
        <NotOpen what="The SME directory" />
      ) : (
        <section className="bg-paper px-6 py-12 lg:px-16 lg:py-16">
          <div className="mx-auto max-w-[82rem]">
            <form method="get" className="grid gap-4 border border-line bg-white p-5 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filter the directory">
              <div className="lg:col-span-2">
                <label htmlFor="q" className="block text-sm font-semibold">
                  Search products and businesses
                </label>
                <input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Coffee, leather shoes…" className={`${select} placeholder:text-ink/40`} />
              </div>
              <div>
                <label htmlFor="country" className="block text-sm font-semibold">
                  Country
                </label>
                <select id="country" name="country" defaultValue={sp.country ?? ""} className={select}>
                  <option value="">All countries</option>
                  {directory.facets.countries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="sector" className="block text-sm font-semibold">
                  Industry
                </label>
                <select id="sector" name="sector" defaultValue={sp.sector ?? ""} className={select}>
                  <option value="">All industries</option>
                  {directory.facets.sectors.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.value} ({s.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="market" className="block text-sm font-semibold">
                  Target market
                </label>
                <select id="market" name="market" defaultValue={sp.market ?? ""} className={select}>
                  <option value="">All markets</option>
                  {directory.facets.markets.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.value} ({m.count})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="investment" className="block text-sm font-semibold">
                  Investment
                </label>
                <select id="investment" name="investment" defaultValue={sp.investment ?? ""} className={select}>
                  <option value="">Any</option>
                  <option value="true">Seeking investment ({directory.facets.investment})</option>
                </select>
              </div>
              <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-6">
                <button type="submit" className="inline-flex h-12 items-center bg-amber px-6 text-sm font-semibold text-ink hover:brightness-110">
                  Filter
                </button>
                {filtered && (
                  <Link href="/smes" className="inline-flex h-12 items-center px-4 text-sm font-semibold underline underline-offset-2">
                    Clear filters
                  </Link>
                )}
                <p className="ml-auto text-sm text-ink/70" aria-live="polite">
                  {directory.total} of {directory.facets.all} businesses
                </p>
              </div>
            </form>

            {directory.items.length === 0 ? (
              <p className="mt-10 border border-line bg-white p-8 text-base text-ink/75">
                {directory.facets.all === 0 ? "The businesses selected for ADTIS will appear here once their profiles are approved." : "No business matches those filters. Try clearing a filter."}
              </p>
            ) : (
              <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {directory.items.map((sme) => (
                  <Card key={sme.slug} sme={sme} />
                ))}
              </div>
            )}

            {directory.total > DIRECTORY_PAGE && (
              <nav aria-label="Pages" className="mt-10 flex items-center justify-between text-sm">
                <span className="text-ink/70">
                  {offset + 1} to {Math.min(offset + DIRECTORY_PAGE, directory.total)} of {directory.total}
                </span>
                <span className="flex gap-3">
                  {offset > 0 && (
                    <Link href={link(Math.max(0, offset - DIRECTORY_PAGE))} className="border border-ink/30 px-4 py-2 font-semibold hover:bg-white">
                      Previous
                    </Link>
                  )}
                  {offset + DIRECTORY_PAGE < directory.total && (
                    <Link href={link(offset + DIRECTORY_PAGE)} className="border border-ink/30 px-4 py-2 font-semibold hover:bg-white">
                      Next
                    </Link>
                  )}
                </span>
              </nav>
            )}
          </div>
        </section>
      )}
    </Page>
  );
}
