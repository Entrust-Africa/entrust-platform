import Link from "next/link";
import { Page, SectionLabel, amberButton, outlineButton } from "@/components/site";
import { getCatalogue } from "@/lib/commerce";
import { BRAIN_GAIN } from "@/lib/info";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diaspora engagement · Africa Diaspora Trade & Investment Summit 2027", description: "Invest, partner and contribute expertise: Brain Gain at ADTIS 2027." };

export default async function DiasporaPage() {
  const catalogue = await getCatalogue();
  const category = catalogue?.delegates.find((d) => d.slug === "diaspora-business");
  return (
    <Page label="Diaspora engagement" title="Invest, partner and bring your expertise home" intro="Diaspora entrepreneurs, investors and professionals hold capital, market knowledge and international networks that African businesses need.">
      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[82rem] gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionLabel>Investment and partnerships</SectionLabel>
            <p className="mt-6 text-base leading-[1.8] text-ink/75">
              ADTIS creates opportunities for diaspora investors, investment groups, family offices and business associations to identify and engage with viable, assessed African businesses, and to build trade, distribution and strategic partnerships with them.
            </p>
          </div>
          <div>
            <SectionLabel>Brain Gain</SectionLabel>
            <ul className="mt-6 space-y-3">
              {BRAIN_GAIN.map((b) => (
                <li key={b} className="flex gap-3 text-base leading-relaxed text-ink/80">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-amber" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>Diaspora business delegate</SectionLabel>
          {category ? (
            <>
              <p className="mt-6 font-display text-6xl leading-none">{category.price}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {category.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm leading-relaxed text-ink/80">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-amber" />
                    {f}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-6 text-sm text-ink/70">Registration for diaspora delegates opens soon.</p>
          )}
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/participate/register?category=diaspora-business" className={amberButton}>
              Participate as a Diaspora Partner
            </Link>
            <Link href="/sponsor" className={outlineButton}>
              Become a sponsor or institutional partner
            </Link>
          </div>
        </div>
      </section>
    </Page>
  );
}
