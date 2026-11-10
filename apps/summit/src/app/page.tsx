import Link from "next/link";
import { ArrowUpRight, Handshake, Landmark, Ticket, Users } from "lucide-react";
import { HostedBy, SectionLabel, SiteFooter, SiteHeader, amberButton, outlineOnDark } from "@/components/site";
import { getCatalogue, type Product } from "@/lib/commerce";
import { EVENT_LINE, HEADLINE, INTRO, OBJECTIVES, WHO, WHY } from "@/lib/content";
import { joinOptions, type JoinKey } from "@/lib/join";
import { applicationsLine, getPeriod, openToLine } from "@/lib/period";

// The application window and the prices change when Entrust edits them, so every visit asks the API.
export const dynamic = "force-dynamic";

/** "From $250", the lowest price among products, or null if there are none. */
function fromPrice(products: Product[]): string | null {
  const priced = products.filter((p) => !p.complimentary);
  if (priced.length === 0) return null;
  const lowest = priced.reduce((min, p) => (p.priceCents < min.priceCents ? p : min));
  // A product with an approved range shows its range as its price; "From" needs the lowest figure alone.
  return `From ${lowest.attributes.priceRange ? `$${(lowest.priceCents / 100).toLocaleString("en-US")}` : lowest.price}`;
}

export default async function SummitLandingPage() {
  const [period, catalogue] = await Promise.all([getPeriod(), getCatalogue()]);
  const statusLine = applicationsLine(period);
  const openTo = period ? openToLine(period.countries) : null;

  const tiles = [
    { href: "/exhibit", label: "Exhibit", text: "Book a booth and show your products to buyers and investors.", price: fromPrice(catalogue?.exhibition ?? []) },
    { href: "/sponsor", label: "Sponsor", text: "Partner with ADTIS, or sponsor a pavilion, a session or the investor reception.", price: fromPrice([...(catalogue?.sponsorship ?? []), ...(catalogue?.opportunities ?? [])]) },
    { href: "/participate", label: "Participate", text: "Register as a business, premium, diaspora or investor and buyer delegate.", price: fromPrice(catalogue?.delegates ?? []) },
  ];

  const icons: Record<JoinKey, typeof Handshake> = { sme: Handshake, "buyer-investor": Landmark, diaspora: Users, sponsor: Ticket };
  const actions = joinOptions();

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[44rem] flex-col overflow-hidden bg-ink text-white lg:min-h-[53.5rem]">
        {/* Placeholder photo: the African Union Conference Centre sent by Entrust; swap for the event's own. */}
        <img src="/images/aicc.jpg" alt="" className="absolute inset-0 -z-30 size-full object-cover grayscale contrast-110" />
        {/* Two scrims keep the white type readable on the bright buildings: one heavy under the text column on the left that
            fades out toward the flags, and one under the nav and the foot of the hero. */}
        <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(to_right,rgb(26_21_18/0.92)_0%,rgb(26_21_18/0.82)_38%,rgb(26_21_18/0.5)_72%,rgb(26_21_18/0.3)_100%)]" />
        <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,rgb(26_21_18/0.65)_0%,rgb(26_21_18/0)_22%,rgb(26_21_18/0)_60%,rgb(26_21_18/0.85)_100%)]" />
        <div aria-hidden className="halftone absolute inset-0 -z-10" />

        <SiteHeader overHero />

        <div id="top" className="relative z-10 mt-auto px-6 pb-16 lg:px-16 lg:pb-20">
          <div className="mx-auto max-w-[82rem]">
            <p className="flex items-center gap-4 font-mono text-xs tracking-[0.2em] text-white/90 uppercase">
              <span aria-hidden className="h-px w-10 shrink-0 bg-amber" />
              {EVENT_LINE}
            </p>
            <h1 className="mt-6 max-w-4xl font-display text-[clamp(2.25rem,5.4vw,4.5rem)] leading-[1.02] uppercase">{HEADLINE}</h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/90">{INTRO}</p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/participate/register" className={amberButton}>
                Register as a Delegate
              </Link>
              <Link href="/smes" className={outlineOnDark}>
                Explore African SMEs
              </Link>
            </div>
            <HostedBy className="mt-12" />
          </div>
        </div>
      </section>

      {/* 01 What it is and why it matters */}
      <section id="about" className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>01 — Why ADTIS matters</SectionLabel>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
            <h2 className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] uppercase">A practical bridge between African businesses and the world</h2>
            <div className="space-y-5 text-base leading-[1.8] text-ink/70">
              {WHY.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
          <ul className="mt-14 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {OBJECTIVES.map(({ title, text }) => (
              <li key={title} className="bg-white p-6">
                <ArrowUpRight aria-hidden className="size-4 text-amber" />
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/60">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 02 Who should take part */}
      <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>02 — Who should take part</SectionLabel>
          <h2 className="mt-8 max-w-3xl font-display text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] uppercase">From Africa, the Caribbean, Europe, North America, the Middle East and beyond</h2>
          <ul className="mt-12 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {WHO.map((who) => (
              <li key={who} className="flex gap-3 border-t border-line pt-3 text-sm leading-relaxed text-ink/80">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-amber" />
                {who}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 03 Exhibit, sponsor, participate */}
      <section id="tickets" className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel onDark>03 — Commercial opportunities</SectionLabel>
          <h2 className="mt-8 font-display text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] uppercase">Exhibit | Sponsor | Participate</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {tiles.map((t) => (
              <Link key={t.href} href={t.href} className="group flex flex-col border border-white/20 p-8 transition-colors hover:border-amber hover:bg-white/5">
                <span className="font-display text-4xl leading-none uppercase">{t.label}</span>
                <span className="mt-4 flex-1 text-sm leading-relaxed text-white/70">{t.text}</span>
                {t.price && <span className="mt-6 font-mono text-xs tracking-wide text-amber uppercase">{t.price} · USD</span>}
                <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
                  See the options <ArrowUpRight aria-hidden className="size-4 text-amber" />
                </span>
              </Link>
            ))}
          </div>
          {catalogue?.edition && <p className="mt-8 max-w-2xl text-xs leading-relaxed text-white/55">{catalogue.edition.taxNote}</p>}
        </div>
      </section>

      {/* 04 Four ways to take part */}
      <section id="register" className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>04 — Take part</SectionLabel>
          <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] uppercase">How would you like to join us?</h2>
            <p className="max-w-xs text-sm leading-relaxed text-ink/70">SME registration and assessment is separate from general summit registration.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {actions.map((a) => {
              const Icon = icons[a.key];
              return (
                <a key={a.key} href={a.href} className="group flex flex-col gap-3 bg-ink p-8 text-white transition-colors hover:bg-ink-deep">
                  <span className="flex items-center gap-3">
                    <Icon aria-hidden className="size-5 shrink-0 text-amber" />
                    <span className="font-display text-2xl leading-tight uppercase">{a.title}</span>
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-white/70">{a.text}</span>
                  <span className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                    <span className="border-b border-amber pb-0.5 group-hover:text-amber">{a.cta}</span>
                    <ArrowUpRight aria-hidden className="size-4 text-amber transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </a>
              );
            })}
          </div>
          {(statusLine || openTo) && (
            <div className="mt-6 space-y-2">
              {statusLine && <p className="font-mono text-[11px] tracking-[0.16em] text-amber-ink uppercase">SME applications: {statusLine.replace(/^Applications /, "")}</p>}
              {openTo && <p className="text-xs leading-relaxed text-ink/60">{openTo}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="relative isolate overflow-hidden px-6 py-28 text-center text-white lg:py-40">
        {/* Placeholder photo: the African Union Conference Centre, Addis Ababa (credit in the footer); swap for the event's own. */}
        <img src="/images/au-conference-centre.jpg" alt="" className="absolute inset-0 -z-30 size-full object-cover object-[50%_45%]" />
        <div aria-hidden className="absolute inset-0 -z-20 bg-[#152a2f]/55" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-ink/15" />
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02] uppercase">Seats are limited. The network is not.</h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/80">
            Join buyers, investors and businesses from across Africa and the diaspora, live in Addis Ababa in January 2027.
          </p>
          <Link href="/participate/register" className={`${amberButton} mt-10`}>
            Register Now
          </Link>
        </div>
      </section>

      <SiteFooter />
      <p className="bg-ink-deep px-6 pb-10 font-mono text-[10px] leading-relaxed tracking-wide text-white/40 lg:px-16">
        <span className="mx-auto block max-w-[82rem]">
          Placeholder photos: African Union Conference Centre (hero, supplied by Entrust); African Union Conference Centre building by{" "}
          <a href="https://commons.wikimedia.org/wiki/File:African_Union_Conference_Centre_building.jpg" className="underline underline-offset-2 hover:text-white/70">
            Andrew Moore
          </a>
          , CC BY-SA 2.0, via Wikimedia Commons.
        </span>
      </p>
    </>
  );
}
