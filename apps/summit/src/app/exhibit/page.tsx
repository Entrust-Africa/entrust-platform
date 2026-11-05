import Link from "next/link";
import { Check } from "lucide-react";
import { NotOpen, Page, SectionLabel, amberButton } from "@/components/site";
import { availabilityNote, getCatalogue, taxLine, type Product } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Exhibit · Africa Diaspora Trade & Investment Summit 2027",
  description: "Book an exhibition booth at ADTIS 2027 in Addis Ababa and meet buyers, investors and diaspora partners.",
};

const STEPS = [
  ["Choose a package", "Pick the booth that suits your business."],
  ["Complete the application", "Tell us about your business and what you will show."],
  ["We review it", "The ADTIS team reviews and approves applications. Nothing is reserved yet."],
  ["Payment instructions", "Once approved, you receive the payment instructions by email."],
  ["Payment is verified", "We check your payment. Your booth is held from approval but confirmed only after this."],
  ["Booth confirmed", "We allocate your booth number and send your booking confirmation."],
] as const;

function PackageCard({ product, letter }: { product: Product; letter: string }) {
  const note = availabilityNote(product.availability);
  const soldOut = product.availability.soldOut;
  return (
    <article className="flex flex-col border border-line bg-white">
      <div className="p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">Package {letter}</p>
        <h3 className="mt-3 font-display text-3xl leading-none uppercase">{product.name}</h3>
        <p className="mt-5 font-display text-6xl leading-none">{product.price}</p>
        {product.attributes.boothSize && <p className="mt-3 font-mono text-xs tracking-wide text-ink/70">{product.attributes.boothSize}</p>}
        <p className="mt-4 text-sm leading-relaxed text-ink/70">{product.summary}</p>
        {note && <p className={`mt-4 inline-block px-2 py-1 font-mono text-[11px] tracking-wide uppercase ${soldOut ? "bg-ink text-white" : "bg-amber/20 text-amber-ink"}`}>{note}</p>}
      </div>
      <ul className="flex-1 space-y-3 border-t border-line px-8 py-6">
        {product.features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-amber" />
            {feature}
          </li>
        ))}
      </ul>
      {soldOut ? (
        <span className="inline-flex h-14 items-center justify-center bg-ink/10 text-sm font-semibold text-ink/50">Sold out</span>
      ) : (
        <Link href={`/exhibit/apply?package=${product.slug}`} className="inline-flex h-14 items-center justify-center bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink-deep">
          Book an Exhibition Booth
        </Link>
      )}
    </article>
  );
}

export default async function ExhibitPage() {
  const catalogue = await getCatalogue();
  const edition = catalogue?.edition;
  const packages = catalogue?.exhibition ?? [];
  return (
    <Page
      label="Exhibit"
      title="Show your business to the world"
      intro="Exhibit at ADTIS 2027 in Addis Ababa. Meet international buyers, diaspora investors, financial institutions and strategic partners across three days."
    >
      {!edition || packages.length === 0 ? (
        <NotOpen what="Exhibition booking" />
      ) : (
        <>
          <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
            <div className="mx-auto max-w-[82rem]">
              <SectionLabel>Exhibition packages</SectionLabel>
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink/70">
                All packages cover the three-day summit. {taxLine(edition)}
              </p>
              <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {packages.map((product, i) => (
                  <PackageCard key={product.id} product={product} letter={String.fromCharCode(65 + i)} />
                ))}
              </div>
            </div>
          </section>

          <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
            <div className="mx-auto max-w-[82rem]">
              <SectionLabel>Compare the packages</SectionLabel>
              <div className="mt-10 overflow-x-auto border border-line">
                <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Exhibition packages compared</caption>
                  <thead>
                    <tr className="bg-ink text-white">
                      <th scope="col" className="sticky left-0 bg-ink px-4 py-4 font-mono text-[11px] tracking-[0.16em] uppercase" />
                      {packages.map((p) => (
                        <th key={p.id} scope="col" className="px-4 py-4 align-bottom font-display text-lg leading-tight uppercase">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr>
                      <th scope="row" className="sticky left-0 bg-white px-4 py-4 font-semibold">
                        Price (USD)
                      </th>
                      {packages.map((p) => (
                        <td key={p.id} className="px-4 py-4 font-display text-2xl">
                          {p.price}
                        </td>
                      ))}
                    </tr>
                    {catalogue.comparisonRows.map((row) => (
                      <tr key={row.id}>
                        <th scope="row" className="sticky left-0 bg-white px-4 py-4 font-semibold">
                          {row.label}
                        </th>
                        {packages.map((p) => (
                          <td key={p.id} className="px-4 py-4 text-ink/80">
                            {p.attributes[row.id] || <span aria-label="Not included">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <th scope="row" className="sticky left-0 bg-white px-4 py-4 font-semibold">
                        Availability
                      </th>
                      {packages.map((p) => (
                        <td key={p.id} className="px-4 py-4 text-ink/80">
                          {availabilityNote(p.availability) ?? "Available"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
            <div className="mx-auto max-w-[82rem]">
              <SectionLabel onDark>How booking works</SectionLabel>
              <h2 className="mt-6 max-w-2xl font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">Approved, paid, then confirmed</h2>
              <ol className="mt-12 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-3">
                {STEPS.map(([title, text], i) => (
                  <li key={title} className="bg-ink p-6">
                    <span className="font-mono text-xs text-amber">{String(i + 1).padStart(2, "0")}</span>
                    <p className="mt-3 text-base font-semibold">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">{text}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-8 max-w-2xl text-sm leading-relaxed text-white/70">
                A booth is not reserved until the ADTIS team approves your application, and it is not confirmed until your payment has been verified. Allocations are subject to organising team approval.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link href="/exhibit/apply" className={amberButton}>
                  Book an Exhibition Booth
                </Link>
                <Link href="/sponsor#opportunities" className="inline-flex h-14 items-center justify-center border border-white/35 px-8 text-sm font-semibold text-white hover:border-white hover:bg-white/10">
                  Country and industry pavilions
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
