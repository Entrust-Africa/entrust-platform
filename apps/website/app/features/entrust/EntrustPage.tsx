import { ParallaxImage } from "../../components/motion/ParallaxImage";
import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { AndinetPipeline } from "./AndinetPipeline";
import {
  ANDINET_COLOR,
  CHALLENGES,
  ENGAGEMENTS,
  ENTRUST_IMG,
  INSIDE_ENTRUST,
  SECTORS,
  SERVICES,
  STEPS,
} from "./data";
import { EntrustHero } from "./EntrustHero";
import { StaggerLi, StaggerList } from "./StaggerList";


function ArrowDown({ className = "" }: { className?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
      <path d="M10 4.5v11M4.5 10l5.5 5.5 5.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function EntrustPage() {
  return (
    <>
      <EntrustHero />

      {/* Inside Entrust: jump links to the parts of the business */}
      <nav aria-label="Inside Entrust" className="shell mt-8 lg:mt-10">
        <Stagger
          gap={0.1}
          className="grid overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-2"
        >
          {INSIDE_ENTRUST.map((item, i) => (
            <StaggerItem key={item.name} className={i > 0 ? "border-t border-line lg:border-l lg:border-t-0" : ""}>
              <a
                href={item.href}
                className="group/card flex h-full items-start gap-3 p-4 transition-colors duration-300 hover:bg-page focus-visible:-outline-offset-2 lg:p-6"
              >
                <svg
                  viewBox="0 0 14 44"
                  aria-hidden
                  className="h-10 w-3 shrink-0 transition-transform duration-500 ease-(--ease-out-expo) group-hover/card:-skew-x-6 group-hover/card:scale-y-110 lg:h-11 lg:w-3.5"
                >
                  <path d="M4 0H14L10 44H0Z" fill={item.color} />
                </svg>
                <span className="flex flex-1 flex-col gap-1">
                  <span className="text-xl font-semibold leading-7 text-ink">{item.name}</span>
                  <span className="text-base leading-6 text-muted">{item.text}</span>
                </span>
                <ArrowDown className="shrink-0 text-brand transition-transform duration-300 ease-(--ease-out-quart) group-hover/card:translate-y-1" />
              </a>
            </StaggerItem>
          ))}
        </Stagger>
      </nav>

      {/* Services */}
      <section id="services" className="shell mt-16 flex flex-col gap-3 lg:mt-24 lg:gap-8">
        <div className="flex max-w-[760px] flex-col gap-3">
          <SplitWords text="Services built for African growth." className="t-h2 text-ink" />
          <Reveal variant="fadeIn">
            <p className="mb-1 text-base leading-[26px] text-muted lg:mb-0">
              End-to-end strategy and execution for SMEs, financial institutions and investors.
            </p>
          </Reveal>
        </div>
        <Stagger gap={0.07} className="border-b border-line">
          {SERVICES.map((s, i) => (
            <StaggerItem
              key={s.name}
              className={`group/svc relative grid gap-1 border-t py-3.5 lg:grid-cols-3 lg:gap-8 lg:py-6 ${i === 0 ? "border-line-strong" : "border-line"}`}
            >
              <span
                aria-hidden
                className="absolute -left-4 bottom-3.5 top-3.5 hidden w-[3px] origin-top scale-y-0 rounded-full bg-brand-bright transition-transform duration-500 ease-(--ease-out-expo) group-hover/svc:scale-y-100 lg:-left-5 lg:bottom-6 lg:top-6 lg:block"
              />
              <h3 className="text-xl font-semibold leading-7 text-ink transition-transform duration-500 ease-(--ease-out-expo) lg:group-hover/svc:translate-x-2">
                {s.name}
              </h3>
              <p className="text-base leading-6 text-muted">{s.text}</p>
              <p className="hidden text-sm leading-[22px] text-muted transition-colors duration-300 group-hover/svc:text-brand-deep lg:block">
                {s.tags}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* How we work */}
      <section className="shell mt-16 grid gap-4 lg:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <div className="order-2 flex flex-col gap-4 lg:order-1 lg:gap-6">
          <SplitWords text="From ambition to impact, in four steps." className="t-h2 text-ink" />
          <Stagger gap={0.1} className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            {STEPS.map((s, i) => (
              <StaggerItem key={s.name} className="flex flex-col gap-0.5 lg:gap-1">
                <h3 className="text-xl font-semibold leading-7 text-brand">
                  {i + 1}. {s.name}
                </h3>
                <p className="text-base leading-6 text-muted">{s.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <ParallaxImage
          src={ENTRUST_IMG.advisory}
          alt="An Entrust advisor in conversation with clients"
          className="order-1 h-[280px] lg:order-2 lg:h-[480px]"
          sizes="(min-width: 1024px) 728px, 100vw"
          strength={30}
        />
      </section>

      {/* Selected engagements */}
      <section id="track-record" className="shell mt-16 lg:mt-24">
        <Reveal
          variant="scaleIn"
          amount={0.15}
          className="flex flex-col gap-5 rounded-lg bg-forest px-6 py-8 md:p-12 lg:gap-8 lg:p-[72px]"
        >
          <SplitWords text="Selected engagements." className="t-h2 text-on-forest" />
          <Stagger gap={0.12} className="grid gap-5 lg:grid-cols-[5fr_4fr_3fr] lg:gap-12">
            {ENGAGEMENTS.map((e) => (
              <StaggerItem key={e.name} className="group/eng relative flex flex-col gap-1.5 pt-3.5 lg:gap-2 lg:pt-4">
                <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-line-on-forest" />
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-px w-full origin-left scale-x-0 bg-brand-bright transition-transform duration-700 ease-(--ease-out-expo) group-hover/eng:scale-x-100"
                />
                <p className="text-sm leading-5 text-on-forest-muted">{e.region}</p>
                <h3 className="text-xl font-semibold leading-7 text-on-forest">{e.name}</h3>
                <p className="text-base leading-6 text-on-forest-muted">{e.text}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </Reveal>
      </section>

      {/* Sectors */}
      <section className="shell mt-12 flex flex-col gap-2 lg:mt-[72px] lg:gap-5">
        <Reveal variant="fadeIn">
          <h2 className="text-sm font-medium leading-5 text-muted">Sectors we serve</h2>
        </Reveal>
        <StaggerList gap={0.06} className="flex flex-col lg:flex-row lg:flex-wrap lg:gap-x-10">
          {SECTORS.map((s) => (
            <StaggerLi
              key={s}
              className="text-xl font-semibold leading-8 text-ink lg:text-[28px] lg:leading-10 lg:tracking-[-0.01em]"
            >
              {s}
            </StaggerLi>
          ))}
        </StaggerList>
      </section>

      {/* Andinet */}
      <section id="andinet" className="shell mt-16 lg:mt-24">
        <div className="grid gap-4 lg:grid-cols-[5fr_7fr] lg:gap-24">
          <div className="order-2 flex flex-col gap-4 lg:order-1 lg:gap-5">
            <Reveal variant="fadeIn">
              <p className="text-sm font-semibold leading-5" style={{ color: ANDINET_COLOR }}>
                Andinet, by Entrust
              </p>
            </Reveal>
            <SplitWords text="From connections to trade execution." className="t-h2 text-ink" />
            <Reveal>
              <p className="text-base leading-[26px] text-muted">
                Most engagements stop at introductions. SMEs still face practical challenges after meeting buyers, so
                many opportunities never become transactions:
              </p>
            </Reveal>
            <StaggerList gap={0.08} className="border-b border-line">
              {CHALLENGES.map((c, i) => (
                <StaggerLi
                  key={c}
                  className={`border-t py-3 text-base font-medium leading-6 text-ink ${i === 0 ? "border-line-strong" : "border-line"}`}
                >
                  {c}
                </StaggerLi>
              ))}
            </StaggerList>
          </div>
          <ParallaxImage
            src={ENTRUST_IMG.umoja}
            alt="Guests together at Andinet Umoja"
            className="order-1 h-[240px] lg:order-2 lg:h-[480px]"
            sizes="(min-width: 1024px) 728px, 100vw"
            strength={30}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3.5 lg:mt-[72px] lg:gap-8">
          <div className="flex max-w-[760px] flex-col gap-3.5 lg:gap-3">
            <SplitWords
              as="h3"
              text="A pipeline built to end in delivery."
              className="text-xl font-bold leading-7 text-ink lg:text-[28px] lg:leading-[34px] lg:tracking-[-0.01em]"
            />
            <Reveal variant="fadeIn">
              <p className="text-base leading-[26px] text-muted">
                By aligning embassies, financial institutions and private sector actors, trade gets completed, not only
                discussed.
              </p>
            </Reveal>
          </div>
          <AndinetPipeline />
          <Reveal className="grid gap-3.5 lg:grid-cols-[8fr_4fr] lg:items-center lg:gap-12 lg:border-t lg:border-line lg:pt-6">
            <p className="text-xl font-semibold leading-7 text-brand-deep lg:leading-[30px]">
              We measure success by transactions completed, not introductions made.
            </p>
            <div className="flex flex-col gap-3.5 lg:flex-row-reverse lg:justify-start lg:gap-3">
              <ButtonLink href="/contact" size="lg" className="w-full lg:h-11 lg:w-auto">
                Work with us
              </ButtonLink>
              <ButtonLink href="/events" variant="outline" size="lg" className="w-full lg:h-11 lg:w-auto">
                See past forums
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>

    </>
  );
}
