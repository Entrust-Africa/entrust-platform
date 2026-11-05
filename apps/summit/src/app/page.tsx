import { ArrowUpRight, Check, Handshake, Ticket } from "lucide-react";
import { OpenRegistration, RegistrationDialog } from "@/components/registration";
import { EVENT_LINE, HIGHLIGHTS, PASSES, SUPPORT_EMAIL } from "@/lib/content";
import { applicationsLine, applyUrl, countryNames, getPeriod, registrationUrl } from "@/lib/period";

// The application window changes when Entrust edits the period, so every visit asks the API.
export const dynamic = "force-dynamic";

const amberButton =
  "inline-flex h-14 items-center justify-center bg-amber px-8 text-sm font-semibold text-ink transition-[filter] hover:brightness-110";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">{children}</p>;
}

export default async function SummitLandingPage() {
  const period = await getPeriod();
  const apply = applyUrl();
  const statusLine = applicationsLine(period);
  const countries = period ? countryNames(period.countries) : [];

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[44rem] flex-col overflow-hidden bg-ink text-white lg:min-h-[53.5rem]">
        {/* Placeholder photo: the African Union Conference Centre sent by Entrust; swap for the event's own. */}
        <img
          src="/images/aicc.jpg"
          alt=""
          className="absolute inset-0 -z-30 size-full object-cover grayscale contrast-110"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-[linear-gradient(to_bottom,rgb(26_21_18/0.55)_0%,rgb(26_21_18/0.3)_28%,rgb(26_21_18/0.78)_55%,rgb(26_21_18/0.95)_100%)]"
        />
        <div aria-hidden className="halftone absolute inset-0 -z-10" />

        <header className="relative z-10 flex items-center justify-between gap-6 px-6 py-6 lg:px-16">
          <a href="#top" className="font-display text-2xl leading-none tracking-wide">
            DTS-26
          </a>
          <nav aria-label="Main" className="hidden items-center gap-10 md:flex">
            {[
              ["About", "#about"],
              ["Register", "#register"],
              ["Tickets", "#tickets"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="font-mono text-xs tracking-wide text-white/85 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
          <a href="#register" className="inline-flex h-10 items-center bg-amber px-5 text-xs font-semibold text-ink hover:brightness-110">
            Register
          </a>
        </header>

        <div id="top" className="relative z-10 mt-auto px-6 pb-16 lg:px-16 lg:pb-20">
          <p className="flex items-center gap-4 font-mono text-xs tracking-[0.2em] text-white/80 uppercase">
            <span aria-hidden className="h-px w-10 bg-amber" />
            {EVENT_LINE}
          </p>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(3rem,8vw,6rem)] leading-[0.98] uppercase">
            Where Black-owned business meets the world
          </h1>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#register" className={amberButton}>
              Reserve Your Seat
            </a>
            <a
              href="#about"
              className="inline-flex h-14 items-center justify-center border border-white/35 px-8 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/10"
            >
              View the Program
            </a>
          </div>
        </div>
      </section>

      {/* 01 Why this summit */}
      <section id="about" className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>01 — Why this summit</SectionLabel>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
            <h2 className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] uppercase">
              The global marketplace for Black-owned business
            </h2>
            <div>
              <p className="text-base leading-[1.8] text-ink/70">
                Diaspora Trade Summit connects buyers and sellers from Black-owned businesses across Africa and the
                global diaspora. Three days of structured trade meetings, market briefings and deal-making in Addis
                Ababa — built to move products, services and capital across borders.
              </p>
              <ul className="mt-8 space-y-6">
                {HIGHLIGHTS.map(({ title, text }) => (
                  <li key={title} className="flex gap-3">
                    <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-amber" />
                    <div>
                      <p className="text-sm font-semibold">{title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-ink/60">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 02 Tickets */}
      <section id="tickets" className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>02 — Tickets</SectionLabel>
          <p className="mt-8 max-w-xs text-sm leading-relaxed text-ink/70">
            All passes include full program access, catering and the welcome reception.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PASSES.map((pass) => (
              <article
                key={pass.id}
                className={
                  pass.featured
                    ? "flex flex-col border border-amber bg-ink text-white"
                    : "flex flex-col border border-line bg-white"
                }
              >
                <div className="p-8">
                  <p className="font-mono text-[11px] tracking-[0.2em] text-amber uppercase">{pass.name}</p>
                  <p className="mt-5 font-display text-6xl leading-none">{pass.price}</p>
                  <p className={pass.featured ? "mt-5 text-sm text-white/70" : "mt-5 text-sm text-ink/70"}>
                    {pass.audience}
                  </p>
                </div>
                <ul
                  className={
                    pass.featured
                      ? "flex-1 space-y-3 border-t border-white/15 px-8 py-6"
                      : "flex-1 space-y-3 border-t border-line px-8 py-6"
                  }
                >
                  {pass.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm">
                      <Check aria-hidden className="size-4 shrink-0 text-amber" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <OpenRegistration
                  pass={pass.id}
                  className={
                    pass.featured
                      ? "h-14 bg-amber text-sm font-semibold text-ink transition-[filter] hover:brightness-110"
                      : "h-14 bg-ink text-sm font-semibold text-white transition-colors hover:bg-ink-deep"
                  }
                >
                  Get {pass.name}
                </OpenRegistration>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 03 Register */}
      <section id="register" className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>03 — Register</SectionLabel>
          <div className="mt-8 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h2 className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] leading-[1.05] uppercase">
              Two ways to take part
            </h2>
            <p className="max-w-xs text-sm leading-relaxed text-ink/70">Choose how you&apos;ll join us in Addis Ababa.</p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <OpenRegistration className="group flex flex-col gap-3 bg-ink p-8 text-left text-white transition-colors hover:bg-ink-deep">
              <span className="flex items-center gap-3">
                <Ticket aria-hidden className="size-5 text-amber" />
                <span className="font-display text-2xl leading-none uppercase">Register as a participant</span>
              </span>
              <span className="text-sm text-white/70">Attend all three days with a ticket tier of your choice.</span>
            </OpenRegistration>

            <a
              href={apply}
              className="group flex flex-col gap-3 border border-amber bg-ink p-8 text-white transition-colors hover:bg-ink-deep"
            >
              <span className="flex items-center gap-3">
                <Handshake aria-hidden className="size-5 text-amber" />
                <span className="font-display text-2xl leading-none uppercase">Register as a buyer / seller</span>
              </span>
              <span className="text-sm text-white/70">Apply to the verified trade program. Free to apply — vetting required.</span>
            </a>
          </div>

          {(statusLine || countries.length > 0) && (
            <div className="mt-6 space-y-2 lg:ml-auto lg:max-w-[calc(50%-0.75rem)]">
              {statusLine && (
                <p className="font-mono text-[11px] tracking-[0.16em] text-amber-ink uppercase">
                  Buyer / seller applications: {statusLine.replace(/^Applications /, "")}
                </p>
              )}
              {countries.length > 0 && (
                <p className="text-xs leading-relaxed text-ink/60">Open to businesses in {countries.join(", ")}.</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Closing call to action */}
      <section className="relative isolate overflow-hidden px-6 py-28 text-center text-white lg:py-40">
        {/* Placeholder photo: the African Union Conference Centre, Addis Ababa (credit in the footer); swap for the event's own. */}
        <img
          src="/images/au-conference-centre.jpg"
          alt=""
          className="absolute inset-0 -z-30 size-full object-cover object-[50%_45%]"
        />
        <div aria-hidden className="absolute inset-0 -z-20 bg-[#152a2f]/55" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-ink/15" />
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.02] uppercase">
            Seats are limited. The network is not.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/80">
            Join buyers and sellers from Black-owned businesses across Africa and the diaspora — live in Addis Ababa this
            January.
          </p>
          <a href="#register" className={`${amberButton} mt-10`}>
            Register Now
          </a>
        </div>
      </section>

      <footer className="bg-ink-deep px-6 py-12 text-white lg:px-16">
        <div className="mx-auto flex max-w-[82rem] flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-display text-xl leading-none uppercase">Diaspora Trade Summit</p>
            <p className="mt-4 font-mono text-[11px] leading-relaxed tracking-wide text-white/55">
              © 2026 Diaspora Trade Summit · A PanAfrican Chamber of Commerce Event · Addis Ababa, Ethiopia
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] tracking-wide text-white/65">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">
              Contact
            </a>
            <a href={apply} className="hover:text-white">
              Applicant sign in
            </a>
          </nav>
        </div>
        <p className="mx-auto mt-10 max-w-[82rem] font-mono text-[10px] leading-relaxed tracking-wide text-white/40">
          Placeholder photos: African Union Conference Centre (hero, supplied by Entrust); African Union Conference Centre
          building by{" "}
          <a
            href="https://commons.wikimedia.org/wiki/File:African_Union_Conference_Centre_building.jpg"
            className="underline underline-offset-2 hover:text-white/70"
          >
            Andrew Moore
          </a>
          , CC BY-SA 2.0, via Wikimedia Commons.
        </p>
      </footer>

      <RegistrationDialog url={registrationUrl()} />
    </>
  );
}
