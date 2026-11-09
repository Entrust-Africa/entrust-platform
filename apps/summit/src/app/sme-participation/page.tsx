import Link from "next/link";
import { Page, SectionLabel, amberButton, outlineButton } from "@/components/site";
import { PARTNERSHIP_PACK } from "@/lib/content";
import { ASSESSMENT_AREAS, ASSESSMENT_OUTCOMES, SECTORS } from "@/lib/info";
import { applicationsLine, applyUrl, countryNames, getPeriod } from "@/lib/period";

export const dynamic = "force-dynamic";
export const metadata = { title: "SME participation · Africa Diaspora Trade & Investment Summit 2027", description: "How African SMEs are assessed and selected for ADTIS 2027." };

export default async function SmeParticipationPage() {
  const period = await getPeriod();
  const line = applicationsLine(period);
  const countries = period ? countryNames(period.countries) : [];
  return (
    <Page label="SME participation" title="Selected through assessment, not open entry" intro="About 300 to 400 SMEs from 10 African countries are assessed, and 100 businesses are selected to take part in the summit's structured business engagement programme.">
      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[82rem] gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionLabel>The assessment framework</SectionLabel>
            <h2 className="mt-6 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">Seven areas</h2>
            <ol className="mt-8 space-y-3">
              {ASSESSMENT_AREAS.map((area, i) => (
                <li key={area} className="flex gap-4 border-t border-line pt-3 text-base">
                  <span className="font-mono text-xs text-amber-ink">{String(i + 1).padStart(2, "0")}</span>
                  {area}
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm leading-relaxed text-ink/70">
              The assessment considers supporting documentation, business operations, products and services, market opportunities, financial information and the enterprise&apos;s capacity to work with international partners. Financial information is given as figures the business types in: financial records do not need to be submitted.
            </p>
          </div>
          <div>
            <SectionLabel>What it produces</SectionLabel>
            <ul className="mt-6 space-y-3">
              {ASSESSMENT_OUTCOMES.map((o) => (
                <li key={o} className="flex gap-3 text-base leading-relaxed text-ink/80">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 bg-amber" />
                  {o}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-ink/70">
              Selected SMEs present their businesses and take part in structured engagement with relevant international stakeholders. Basic participation is complimentary; an exhibition booth is optional and bought separately. Confidential assessment scores and the financial figures a business gives are never made public.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>Target sectors</SectionLabel>
          <ul className="mt-8 flex flex-wrap gap-2">
            {SECTORS.map((s) => (
              <li key={s} className="border border-line bg-white px-3 py-2 text-sm">
                {s}
              </li>
            ))}
          </ul>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-ink/60">Sector participation depends on the quality of SME applications, commercial opportunities and the interests of participating buyers and investors.</p>
        </div>
      </section>

      <section className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel onDark>Apply</SectionLabel>
          <h2 className="mt-6 max-w-3xl font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">SME registration is separate from general summit registration</h2>
          {line && <p className="mt-5 font-mono text-xs tracking-[0.16em] text-amber uppercase">{line}</p>}
          {countries.length > 0 && <p className="mt-2 text-sm text-white/70">Open to businesses in {countries.join(", ")}.</p>}
          <div className="mt-10 flex flex-wrap gap-4">
            <a href={applyUrl()} className={amberButton}>
              Register as an SME
            </a>
            <Link href="/smes" className="inline-flex h-14 items-center justify-center border border-white/35 px-8 text-sm font-semibold text-white hover:border-white hover:bg-white/10">
              Explore African SMEs
            </Link>
          </div>
          <p className="mt-6 text-sm">
            <a href={PARTNERSHIP_PACK.href} target="_blank" rel="noopener" className="font-semibold text-amber underline underline-offset-2 hover:text-white">
              Download the Institutional Partnership Pack ({PARTNERSHIP_PACK.size})
            </a>{" "}
            <span className="text-white/60">for the recruitment brief, the selection framework and the sponsorship cost.</span>
          </p>
          <p className="mt-6 max-w-xl text-xs leading-relaxed text-white/55">Already selected? Register for free as a Selected SME Delegate with your application number, and book an exhibition booth if you want one.</p>
          <Link href="/participate/register?category=selected-sme" className={`${outlineButton} mt-6 border-white/35 text-white hover:border-white hover:bg-white/10`}>
            Selected SME registration
          </Link>
        </div>
      </section>
    </Page>
  );
}
