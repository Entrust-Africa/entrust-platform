import Link from "next/link";
import { NotOpen, Page, SectionLabel } from "@/components/site";
import { availabilityNote, getCatalogue, taxLine, type Product } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sponsor · Africa Diaspora Trade & Investment Summit 2027",
  description: "Sponsorship levels and commercial opportunities at ADTIS 2027 in Addis Ababa.",
};

function LevelCard({ product, featured }: { product: Product; featured: boolean }) {
  const note = availabilityNote(product.availability);
  const soldOut = product.availability.soldOut;
  return (
    <article className={featured ? "flex flex-col border border-amber bg-ink text-white" : "flex flex-col border border-line bg-white"}>
      <div className="p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-amber uppercase">{product.name}</p>
        <p className="mt-5 font-display text-6xl leading-none">{product.price}</p>
        <p className={featured ? "mt-5 text-sm leading-relaxed text-white/70" : "mt-5 text-sm leading-relaxed text-ink/70"}>{product.summary}</p>
        {note && <p className={`mt-4 inline-block px-2 py-1 font-mono text-[11px] tracking-wide uppercase ${soldOut ? "bg-white text-ink" : "bg-amber/25 text-amber"}`}>{note}</p>}
      </div>
      <dl className={featured ? "flex-1 space-y-4 border-t border-white/15 px-8 py-6" : "flex-1 space-y-4 border-t border-line px-8 py-6"}>
        {product.benefits.map((b) => (
          <div key={b.area}>
            <dt className={featured ? "font-mono text-[11px] tracking-[0.14em] text-amber uppercase" : "font-mono text-[11px] tracking-[0.14em] text-amber-ink uppercase"}>{b.label}</dt>
            <dd className="mt-1 text-sm leading-relaxed">{b.text}</dd>
          </div>
        ))}
      </dl>
      {soldOut ? (
        <span className={featured ? "inline-flex h-14 items-center justify-center bg-white/10 text-sm font-semibold text-white/60" : "inline-flex h-14 items-center justify-center bg-ink/10 text-sm font-semibold text-ink/50"}>
          No longer available
        </span>
      ) : (
        <Link
          href={`/sponsor/enquire?package=${product.slug}`}
          className={featured ? "inline-flex h-14 items-center justify-center bg-amber text-sm font-semibold text-ink transition-[filter] hover:brightness-110" : "inline-flex h-14 items-center justify-center bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink-deep"}
        >
          Become a Sponsor
        </Link>
      )}
    </article>
  );
}

export default async function SponsorPage() {
  const catalogue = await getCatalogue();
  const edition = catalogue?.edition;
  const levels = catalogue?.sponsorship ?? [];
  const opportunities = catalogue?.opportunities ?? [];
  return (
    <Page
      label="Sponsor"
      title="Partner with ADTIS"
      intro="Put your organisation in front of buyers, investors, financial institutions and diaspora leaders. Choose a sponsorship level, or a specific opportunity such as a pavilion or a sponsored session."
    >
      {!edition || (levels.length === 0 && opportunities.length === 0) ? (
        <NotOpen what="Sponsorship" />
      ) : (
        <>
          {levels.length > 0 && (
            <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
              <div className="mx-auto max-w-[82rem]">
                <SectionLabel>Sponsorship levels</SectionLabel>
                <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink/70">
                  {taxLine(edition)} Benefits, and any category exclusivity, are confirmed in a signed sponsorship agreement.
                </p>
                <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {levels.map((product, i) => (
                    <LevelCard key={product.id} product={product} featured={i === 0} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {levels.length > 0 && (
            <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
              <div className="mx-auto max-w-[82rem]">
                <SectionLabel>Compare the levels</SectionLabel>
                <div className="mt-10 overflow-x-auto border border-line">
                  <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
                    <caption className="sr-only">Sponsorship levels compared</caption>
                    <thead>
                      <tr className="bg-ink text-white">
                        <th scope="col" className="sticky left-0 bg-ink px-4 py-4" />
                        {levels.map((p) => (
                          <th key={p.id} scope="col" className="px-4 py-4 align-bottom font-display text-lg leading-tight uppercase">
                            {p.name}
                            <span className="mt-1 block font-sans text-sm font-normal normal-case text-amber">{p.price}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {catalogue.benefitAreas.map((area) => (
                        <tr key={area.id} className="align-top">
                          <th scope="row" className="sticky left-0 w-48 bg-white px-4 py-4 font-semibold">
                            {area.label}
                          </th>
                          {levels.map((p) => {
                            const text = p.benefits.find((b) => b.area === area.id)?.text;
                            return (
                              <td key={p.id} className="px-4 py-4 text-ink/80">
                                {text ?? <span aria-label="Not included">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {opportunities.length > 0 && (
            <section id="opportunities" className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
              <div className="mx-auto max-w-[82rem]">
                <SectionLabel onDark>Additional commercial opportunities</SectionLabel>
                <h2 className="mt-6 max-w-3xl font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">Pavilions, sessions and more</h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">
                  Country and industry pavilions let institutions, trade promotion organisations, associations and countries showcase their businesses and investment opportunities.
                </p>
                <div className="mt-12 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-3">
                  {opportunities.map((p) => (
                    <article key={p.id} className="flex flex-col bg-ink p-8">
                      <h3 className="font-display text-2xl leading-tight uppercase">{p.name}</h3>
                      <p className="mt-4 font-display text-5xl leading-none text-amber">{p.price}</p>
                      <p className="mt-4 flex-1 text-sm leading-relaxed text-white/70">{p.summary}</p>
                      {p.availability.soldOut ? (
                        <span className="mt-6 inline-flex h-12 items-center justify-center bg-white/10 text-sm font-semibold text-white/60">No longer available</span>
                      ) : (
                        <Link href={`/sponsor/enquire?package=${p.slug}`} className="mt-6 inline-flex h-12 items-center justify-center border border-white/35 text-sm font-semibold text-white hover:border-white hover:bg-white/10">
                          Enquire about {p.name}
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </Page>
  );
}
