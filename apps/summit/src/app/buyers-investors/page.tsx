import Link from "next/link";
import { Page, SectionLabel, amberButton, outlineButton } from "@/components/site";
import { getCatalogue } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const metadata = { title: "Buyers & investors · Africa Diaspora Trade & Investment Summit 2027", description: "Meet assessed African businesses through structured B2B matchmaking at ADTIS 2027." };

const WAYS = [
  ["Browse the selected businesses", "Every selected SME has a digital profile: products, capacity, export readiness, target markets and investment needs, approved by the business."],
  ["Request B2B matchmaking", "Ask to meet a business from its profile. The business, and the ADTIS team, follow up."],
  ["Meet at the summit", "Buyer and distributor engagement sessions, investor presentations, structured B2B meetings and targeted investor–SME meetings across days two and three."],
  ["Move to a deal", "Trade and distribution partnership discussions and, where agreed, MoU and partnership announcements on day three."],
] as const;

export default async function BuyersInvestorsPage() {
  const catalogue = await getCatalogue();
  const category = catalogue?.delegates.find((d) => d.slug === "investor-buyer");
  return (
    <Page label="Buyers & investors" title="Find credible African businesses, assessed in advance" intro="Meet selected, assessed and investment-ready businesses with real commercial opportunities, in one place and over three days.">
      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>How you engage</SectionLabel>
          <ol className="mt-10 grid gap-px bg-line sm:grid-cols-2">
            {WAYS.map(([title, text], i) => (
              <li key={title} className="bg-white p-8">
                <span className="font-mono text-xs text-amber-ink">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-lg font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel onDark>Investor / international buyer delegate</SectionLabel>
          {category ? (
            <>
              <p className="mt-6 font-display text-6xl leading-none text-amber">{category.price}</p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-2">
                {category.features.map((f) => (
                  <li key={f} className="flex gap-3 text-sm leading-relaxed text-white/80">
                    <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-amber" />
                    {f}
                  </li>
                ))}
              </ul>
              {catalogue?.edition && <p className="mt-6 max-w-xl text-xs leading-relaxed text-white/55">{catalogue.edition.taxNote}</p>}
            </>
          ) : (
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/70">Registration for investors and international buyers opens soon.</p>
          )}
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/participate/register?category=investor-buyer" className={amberButton}>
              Register as a Buyer or Investor
            </Link>
            <Link href="/smes" className={`${outlineButton} border-white/35 text-white hover:border-white hover:bg-white/10`}>
              Explore African SMEs
            </Link>
          </div>
        </div>
      </section>
    </Page>
  );
}
