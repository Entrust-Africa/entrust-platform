import Link from "next/link";
import { HOST, PARTNERSHIP_PACK, SUPPORT_EMAIL } from "@/lib/content";
import { Page, SectionLabel, amberButton } from "@/components/site";
import { PARTNERS, PARTNERSHIP_KINDS, PARTNERSHIP_LIMITS, STRATEGIC_PARTNER_PROFILES } from "@/lib/info";

export const metadata = { title: "Partners · Africa Diaspora Trade & Investment Summit 2027" };

export default function PartnersPage() {
  return (
    <Page label="Partners" title="Organisers, sponsors and supporting institutions" intro="Partner names, institutional roles and sponsors are published after formal confirmation.">
      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem] space-y-14">
          <div>
            <SectionLabel>Host</SectionLabel>
            <a href={HOST.url} className="mt-6 inline-flex items-center gap-5 border border-line p-4 hover:border-amber">
              <img src="/images/pan-african-chamber-logo.png" alt="" width={300} height={300} className="size-24" />
              <span className="font-display text-2xl leading-tight uppercase">{HOST.name}</span>
            </a>
          </div>
          <div>
            <SectionLabel>Confirmed partners</SectionLabel>
            {PARTNERS.length === 0 ? (
              <p className="mt-6 max-w-2xl border border-line bg-paper p-8 text-base leading-relaxed text-ink/75">Sponsors, institutional partners and supporting organisations will be listed here once they are confirmed.</p>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {PARTNERS.map((p) => (
                  <li key={p.name} className="flex flex-col border border-line p-6">
                    {p.logo && <img src={p.logo} alt="" className="mb-4 h-16 object-contain object-left" />}
                    <p className="font-semibold">{p.url ? <a href={p.url} className="underline underline-offset-2">{p.name}</a> : p.name}</p>
                    <p className="text-sm text-ink/70">{p.role}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/sponsor" className={amberButton}>
            Become a Sponsor or Institutional Partner
          </Link>
        </div>
      </section>

      <section className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel onDark>Country Recruitment Partners</SectionLabel>
          <h2 className="mt-6 max-w-3xl font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">Help recruit businesses from your country</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/75">
            The Pan-African Chamber of Commerce invites national institutions to nominate SMEs and share the registration link. The pack has the invitation, the recruitment brief, the selection framework, the partner&apos;s role and the indicative sponsorship cost.
          </p>
          <a href={PARTNERSHIP_PACK.href} target="_blank" rel="noopener" className={`${amberButton} mt-10`}>
            Download the Institutional Partnership Pack ({PARTNERSHIP_PACK.size})
          </a>
        </div>
      </section>

      <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem] space-y-16">
          <div>
            <SectionLabel>Sponsor or strategic partner</SectionLabel>
            <h2 className="mt-6 max-w-3xl font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">You can buy sponsorship. Strategic partnership is qualified.</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {PARTNERSHIP_KINDS.map((k) => (
                <article key={k.name} className="border border-line bg-white p-8">
                  <h3 className="font-display text-3xl leading-tight uppercase">{k.name}</h3>
                  <dl className="mt-6 space-y-4 text-sm leading-relaxed">
                    <div>
                      <dt className="font-mono text-[11px] tracking-[0.14em] text-amber-ink uppercase">Gives</dt>
                      <dd className="mt-1">{k.gives}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] tracking-[0.14em] text-amber-ink uppercase">Receives</dt>
                      <dd className="mt-1">{k.receives}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[11px] tracking-[0.14em] text-amber-ink uppercase">How</dt>
                      <dd className="mt-1">{k.how}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <SectionLabel>Who we would like to work with</SectionLabel>
              <ul className="mt-6 space-y-3 text-base leading-relaxed">
                {STRATEGIC_PARTNER_PROFILES.map((p) => (
                  <li key={p} className="border-t border-line pt-3">
                    {p}
                  </li>
                ))}
              </ul>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("ADTIS 2027 strategic partnership")}`}
                className={`${amberButton} mt-8`}
              >
                Discuss strategic partnership
              </a>
            </div>
            <div>
              <SectionLabel>What sponsorship and partnership do not include</SectionLabel>
              <ul className="mt-6 space-y-3 text-sm leading-relaxed text-ink/80">
                {PARTNERSHIP_LIMITS.map((l) => (
                  <li key={l} className="border-t border-line pt-3">
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </Page>
  );
}
