import Image from "next/image";
import { ParallaxImage } from "../../components/motion/ParallaxImage";
import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { buttonClasses } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/ui/icons";
import { LINKEDIN_PROFILES } from "../../lib/site";
import { FormHero } from "../../components/site/FormHero";
import { NewsletterPanel } from "./NewsletterPanel";

const PHOTOS = {
  conversation: { src: "/images/3153726f2794f23e.png", alt: "Guests talking at an Entrust Africa community evening" },
  table: { src: "/images/c37584d5e8882ac5.jpg", alt: "Community members laughing together around a table" },
  tableTalk: { src: "/images/6367de64b885b88e.png", alt: "Two guests in conversation at a community table" },
};

const BENEFITS = ["Event updates", "Partnership opportunities", "Ways to collaborate across our platforms"];

export default function CommunityPage() {
  return (
    <>
      <FormHero
        eyebrow="Community"
        title="Join the Entrust Africa community."
        lead="Stay connected to African professionals, entrepreneurs and diaspora communities."
        accent="#d9a033"
        horizon={["#19954f", "#d9a033", "#2b9d8f"]}
        panel={<NewsletterPanel />}
      />

      {/* What you get */}
      <section className="shell mt-12 grid gap-4 md:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <div className="flex flex-col gap-4 lg:gap-6">
          <SplitWords text="Stay close to the people moving trade." className="t-h2 text-ink" />
          <Stagger gap={0.1} className="flex flex-col">
            {BENEFITS.map((b, i) => (
              <StaggerItem
                key={b}
                className={`group relative border-t py-3 lg:py-4 ${i === 0 ? "border-line-strong" : "border-line"} ${i === BENEFITS.length - 1 ? "border-b border-b-line" : ""}`}
              >
                {/* Ochre marker slides in and the label steps right on hover. */}
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 origin-center scale-y-0 rounded-full bg-ochre transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100"
                />
                <p className="text-xl font-semibold leading-7 text-ink transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-3">
                  {b}
                </p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        <div className="mt-0 grid gap-3 lg:grid-cols-[3fr_4fr]">
          <ParallaxImage
            src={PHOTOS.conversation.src}
            alt={PHOTOS.conversation.alt}
            className="h-[320px] lg:h-[420px]"
            sizes="(min-width: 1024px) 300px, 100vw"
            strength={24}
          />
          <Stagger gap={0.15} className="hidden flex-col gap-3 lg:flex">
            {[PHOTOS.table, PHOTOS.tableTalk].map((p) => (
              <StaggerItem key={p.src} variant="wipeUp" className="zoom-frame relative h-[204px]">
                <Image src={p.src} alt={p.alt} fill sizes="400px" className="object-cover" />
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* LinkedIn band */}
      <section className="shell mt-12 md:mt-24">
        <Reveal
          variant="scaleIn"
          amount={0.3}
          className="grid gap-6 rounded-lg bg-forest px-6 py-8 md:p-12 lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-24 lg:px-[72px] lg:py-14"
        >
          <SplitWords text="Follow along on LinkedIn." className="t-h2 max-w-[400px] text-on-forest" />
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            {LINKEDIN_PROFILES.map((p) => (
              <a
                key={p.href}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline-light", "lg", "w-full sm:w-auto")}
              >
                <span>{p.label}</span>
                <span className="sr-only"> on LinkedIn (opens in a new tab)</span>
                <ArrowUpRight className="-mr-1 transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
              </a>
            ))}
          </div>
        </Reveal>
      </section>
    </>
  );
}
