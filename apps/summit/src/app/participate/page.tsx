import Link from "next/link";
import { Check } from "lucide-react";
import { NotOpen, Page, SectionLabel, amberButton, outlineOnDark } from "@/components/site";
import { availabilityNote, getCatalogue, taxLine, type Product } from "@/lib/commerce";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Participate · Africa Diaspora Trade & Investment Summit 2027",
  description: "Register as a delegate for ADTIS 2027 in Addis Ababa: business, premium, diaspora and investor or buyer delegate categories.",
};

function DelegateCard({ product, featured }: { product: Product; featured: boolean }) {
  const note = availabilityNote(product.availability);
  const soldOut = product.availability.soldOut;
  return (
    <article className={featured ? "flex flex-col border border-amber bg-ink text-white" : "flex flex-col border border-line bg-white"}>
      <div className="p-8">
        <p className="font-mono text-[11px] tracking-[0.2em] text-amber uppercase">{product.name}</p>
        <p className={`mt-5 font-display leading-none ${product.complimentary ? "text-4xl sm:text-5xl" : "text-6xl"}`}>{product.price}</p>
        <p className={featured ? "mt-5 text-sm leading-relaxed text-white/70" : "mt-5 text-sm leading-relaxed text-ink/70"}>{product.summary}</p>
        {note && <p className={`mt-4 inline-block px-2 py-1 font-mono text-[11px] tracking-wide uppercase ${soldOut ? "bg-white text-ink" : "bg-amber/25 text-amber"}`}>{note}</p>}
      </div>
      <ul className={featured ? "flex-1 space-y-3 border-t border-white/15 px-8 py-6" : "flex-1 space-y-3 border-t border-line px-8 py-6"}>
        {product.features.map((f) => (
          <li key={f} className="flex items-start gap-3 text-sm leading-relaxed">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-amber" />
            {f}
          </li>
        ))}
        {product.attributes.note && <li className="pt-1 text-xs leading-relaxed opacity-70">{product.attributes.note}</li>}
      </ul>
      {soldOut ? (
        <span className="inline-flex h-14 items-center justify-center bg-ink/10 text-sm font-semibold text-ink/50">Sold out</span>
      ) : (
        <Link
          href={`/participate/register?category=${product.slug}`}
          className={featured ? "inline-flex h-14 items-center justify-center bg-amber text-sm font-semibold text-ink transition-[filter] hover:brightness-110" : "inline-flex h-14 items-center justify-center bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink-deep"}
        >
          Register as a Delegate
        </Link>
      )}
    </article>
  );
}

export default async function ParticipatePage() {
  const catalogue = await getCatalogue();
  const edition = catalogue?.edition;
  const delegates = catalogue?.delegates ?? [];
  return (
    <Page
      label="Participate"
      title="Join the summit"
      intro="Three days of conference sessions, networking and structured business meetings in Addis Ababa. Choose the delegate category that fits you."
    >
      {!edition || delegates.length === 0 ? (
        <NotOpen what="Delegate registration" />
      ) : (
        <>
          <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
            <div className="mx-auto max-w-[82rem]">
              <SectionLabel>Delegate categories</SectionLabel>
              <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink/70">
                All paid delegate packages cover the three-day summit. {taxLine(edition)}
              </p>
              <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {delegates.map((product, i) => (
                  <DelegateCard key={product.id} product={product} featured={i === delegates.length - 1} />
                ))}
              </div>
            </div>
          </section>

          <section className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
            <div className="mx-auto grid max-w-[82rem] gap-12 lg:grid-cols-2">
              <div>
                <SectionLabel onDark>Are you a business owner?</SectionLabel>
                <h2 className="mt-6 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">Apply to be one of the 100 selected African SMEs</h2>
                <p className="mt-4 text-sm leading-relaxed text-white/70">
                  Selected SMEs take part free, with no second application: register as a Selected SME Delegate with your application number. SME assessment is separate from delegate registration.
                </p>
              </div>
              <div className="flex flex-col gap-4 lg:items-end lg:justify-center">
                <Link href="/#register" className={amberButton}>
                  Register as an SME
                </Link>
                <Link href="/smes" className={outlineOnDark}>
                  Explore African SMEs
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </Page>
  );
}
