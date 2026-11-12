import { ParallaxImage } from "../../components/motion/ParallaxImage";
import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/ui/icons";
import { PLATFORM_URLS } from "../../lib/site";
import { ForestPanel } from "../platforms/ForestPanel";
import { PlatformHero } from "../platforms/PlatformHero";
import { NEW_TAB, PLATFORM_THEME } from "../platforms/theme";
import { TradeRoadmap } from "./TradeRoadmap";

const theme = PLATFORM_THEME.trade;

const FORUM_PHOTO = "/images/a0416268cb30a730.jpg";

const PROGRAM_STEPS = [
  "Practical, applied training sessions",
  "Assessment and scoring",
  "Gap identification",
  "Targeted support to close those gaps",
];

const PILLARS = [
  { name: "Business and financial readiness", text: "Costing, pricing and financial structure." },
  { name: "Legal and compliance", text: "Registration, contracts and regulatory alignment." },
  { name: "AfCFTA and market access", text: "Trade rules, tariffs and country requirements." },
  { name: "Product readiness", text: "Packaging, labeling and export standards." },
  { name: "Digital and systems setup", text: "ERP, e-tax and operational systems." },
  { name: "Logistics and fulfillment", text: "Shipping, documentation and delivery." },
  { name: "Finance and credit readiness", text: "Preparing SMEs to access bank and development finance." },
];

const FEEDBACK = [
  { title: "“We now understand export requirements clearly.”", text: "SME participant" },
  { title: "“The training helped us structure our pricing and costs.”", text: "SME participant" },
];

export default function TradePage() {
  return (
    <>
      <PlatformHero
        theme={theme}
        eyebrow="The TRADE Program"
        title="From local operations to export-ready."
        lead="Training for Regional Access and Development through Exports. Practical training, structured assessment, system setup and direct market alignment."
      >
        <div className="rounded-lg bg-surface px-6 pb-3 pt-6 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]">
          <h2 className="mb-3 text-xl font-semibold leading-7 text-ink">How the program moves you forward</h2>
          <Stagger role="list" gap={0.08} delay={0.7}>
            {PROGRAM_STEPS.map((s, i) => (
              <StaggerItem
                key={s}
                role="listitem"
                variant="fadeIn"
                className="group/step flex gap-3 border-t border-line py-3"
              >
                <span className="w-6 shrink-0 origin-left text-base font-semibold leading-6 text-brand tabular-nums transition-transform duration-500 ease-(--ease-out-expo) group-hover/step:scale-125">
                  {i + 1}
                </span>
                <span className="text-base font-medium leading-6 text-ink">{s}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <ButtonLink href={PLATFORM_URLS.trade} size="lg" arrow="external" className="w-full" {...NEW_TAB}>
          Apply to the TRADE Program
        </ButtonLink>
      </PlatformHero>

      {/* The problem */}
      <section className="shell mt-20 grid gap-8 md:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <Reveal className="flex flex-col gap-6">
          <SplitWords text="The issue isn’t ambition. It’s structure." className="t-h2 text-ink" />
          <p className="text-base leading-[26px] text-muted">
            Many SMEs want to export. Very few are ready. Across Ethiopia and the region, businesses produce quality
            goods but struggle with documentation, compliance, financing and market access.
          </p>
          <p className="text-base leading-[26px] text-muted">
            The focus here is not just learning. It is preparing businesses to actually trade across borders.
          </p>
        </Reveal>
        <ParallaxImage
          src={FORUM_PHOTO}
          alt="Forum participants listening to a session"
          className="h-[240px] md:h-[420px]"
          sizes="(min-width: 1024px) 728px, 100vw"
        />
      </section>

      {/* The 7 pillars */}
      <section id="pillars" className="shell mt-20 flex flex-col gap-8 md:mt-24">
        <SplitWords text="The 7 pillars of export readiness" className="t-h2 text-ink" />
        <Stagger
          gap={0.06}
          className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 lg:grid-cols-4"
        >
          {PILLARS.map((p, i) => (
            <StaggerItem
              key={p.name}
              variant="fadeIn"
              className="group relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 bg-surface p-4 md:flex md:min-h-[176px] md:flex-col md:gap-2 md:p-6"
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-x-100"
                style={{ backgroundColor: theme.accent }}
              />
              <span className="text-sm font-semibold leading-5 text-brand tabular-nums md:leading-5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col gap-1 md:gap-2">
                <h3 className="text-base font-semibold leading-6 text-ink md:text-xl md:leading-7">{p.name}</h3>
                <p className="text-sm leading-5 text-muted md:text-base md:leading-6">{p.text}</p>
              </span>
            </StaggerItem>
          ))}
          <StaggerItem
            variant="fadeIn"
            className="hidden min-h-[176px] flex-col justify-between gap-6 bg-forest p-6 md:flex"
          >
            <p className="text-xl font-semibold leading-7 text-on-forest">
              Move from potential exporter to active participant in African trade.
            </p>
            <a
              href={PLATFORM_URLS.trade}
              {...NEW_TAB}
              className="group/apply inline-flex min-h-11 items-center gap-1.5 self-start font-semibold text-on-forest"
            >
              <span className="underline decoration-1 underline-offset-4 transition-colors duration-300 group-hover/apply:decoration-transparent">
                Apply now
              </span>
              <ArrowUpRight className="transition-transform duration-300 group-hover/apply:-translate-y-0.5 group-hover/apply:translate-x-0.5" />
            </a>
          </StaggerItem>
        </Stagger>
      </section>

      {/* Roadmap */}
      <section id="how-it-works" className="shell mt-20 flex flex-col gap-8 md:mt-24">
        <SplitWords
          text="Your roadmap from local production to regional trade."
          className="t-h2 max-w-[760px] text-ink"
        />
        <TradeRoadmap />
      </section>

      <ForestPanel
        title="Capital for SMEs exists. It often doesn’t reach them."
        body="Banks and development partners need businesses that are structured, compliant and ready to absorb funding. TRADE builds that pipeline."
        actions={[
          { label: "Apply as an SME", href: PLATFORM_URLS.trade, external: true },
          { label: "Partner with us", href: "/partners" },
        ]}
        items={FEEDBACK}
        itemStyle="quote"
        listSide="right"
        accent={theme.accent}
      />
    </>
  );
}
