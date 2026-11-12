import Image from "next/image";
import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { IMG } from "../../lib/site";
import { InnerHero } from "../../components/site/InnerHero";
import { UpcomingEventsPanel } from "./UpcomingEventsPanel";
import { getUpcomingEvents } from "./upcoming";

type Photo = { src: string; alt: string };

const REMMOGO: { main: Photo; side: [Photo, Photo] } = {
  main: { src: IMG.remmogoSpeaker, alt: "A speaker at the podium at Andinet Remmogo" },
  side: [
    { src: IMG.remmogoPanel, alt: "Panel on stage at Andinet Remmogo" },
    { src: IMG.forumAudience, alt: "The audience at Andinet Remmogo" },
  ],
};

const UMOJA: { main: Photo; side: [Photo, Photo] } = {
  main: { src: "/images/3b87f2aecf3d87a7.png", alt: "Guests together at Andinet Umoja" },
  side: [
    { src: "/images/6367de64b885b88e.png", alt: "Two guests in conversation at Andinet Umoja" },
    { src: "/images/c37584d5e8882ac5.jpg", alt: "Guests talking around a table at Andinet Umoja" },
  ],
};

const REASONS = [
  { name: "Quality network", text: "Vetted business leaders, investors and policymakers." },
  { name: "Pan-African reach", text: "Events spanning multiple regions of the continent." },
  { name: "Curated agenda", text: "Structured sessions designed for real deals." },
  { name: "Lasting impact", text: "Partnerships that continue long after the event." },
];

/** One large photo and two small ones; the large one sits on `mainSide` from desktop up. */
function Gallery({ main, side, mainSide }: { main: Photo; side: [Photo, Photo]; mainSide: "left" | "right" }) {
  const left = mainSide === "left";
  return (
    <Stagger
      gap={0.12}
      amount={0.15}
      className={`grid grid-cols-2 gap-3 ${left ? "lg:grid-cols-[5fr_3fr]" : "lg:grid-cols-[3fr_5fr]"}`}
    >
      <StaggerItem
        variant="wipeUp"
        className={`zoom-frame relative col-span-2 h-[240px] md:h-[400px] lg:col-span-1 lg:row-span-2 lg:h-[452px] ${left ? "" : "lg:col-start-2 lg:row-start-1"}`}
      >
        <Image src={main.src} alt={main.alt} fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
      </StaggerItem>
      {side.map((p, i) => (
        <StaggerItem
          key={p.src}
          variant="wipeUp"
          className={`zoom-frame relative h-[130px] md:h-[220px] ${left ? "lg:col-start-2" : `lg:col-start-1 ${i === 0 ? "lg:row-start-1" : "lg:row-start-2"}`}`}
        >
          <Image src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 310px, 50vw" className="object-cover" />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

function ForumLabel({ children }: { children: string }) {
  return <p className="text-sm font-semibold leading-5 text-[#a43f2a]">{children}</p>;
}

export default async function EventsPage() {
  const events = await getUpcomingEvents();

  return (
    <>
      <InnerHero
        eyebrow="Events"
        title="Where Africa’s business leaders connect."
        lead="Forums that bring public and private sector actors together and push conversations toward execution."
        accent="#c8553d"
        horizon={["#c8553d", "#d9a033", "#c8553d"]}
      >
        <UpcomingEventsPanel events={events} />
      </InnerHero>

      {/* Andinet Remmogo */}
      <section className="shell mt-20 grid gap-4 md:mt-24 lg:grid-cols-[4fr_8fr] lg:gap-16">
        <Stagger className="flex flex-col gap-4">
          <StaggerItem>
            <ForumLabel>Latest forum</ForumLabel>
          </StaggerItem>
          <StaggerItem>
            <SplitWords text="Andinet Remmogo" className="t-h2 text-ink" />
          </StaggerItem>
          <StaggerItem>
            <p className="text-xl font-medium leading-7 text-ink">Ethiopia-Botswana Business Forum</p>
          </StaggerItem>
          <StaggerItem>
            <p className="text-base leading-[26px] text-muted">
              Our second forum brought public and private sector actors together to deepen trade relationships,
              strengthen corridor dialogue and push conversations toward execution.
            </p>
          </StaggerItem>
        </Stagger>
        <Gallery {...REMMOGO} mainSide="left" />
      </section>

      {/* Andinet Umoja */}
      <section className="shell mt-20 grid gap-4 md:mt-24 lg:grid-cols-[8fr_4fr] lg:gap-16">
        <Stagger className="flex flex-col gap-4 lg:order-2">
          <StaggerItem>
            <ForumLabel>Founding event</ForumLabel>
          </StaggerItem>
          <StaggerItem>
            <SplitWords text="Andinet Umoja" className="t-h2 text-ink" />
          </StaggerItem>
          <StaggerItem>
            <p className="text-base leading-[26px] text-muted">
              Our first forum laid the foundation for a more structured trade pipeline by convening decision-makers,
              SMEs and institutional partners around practical market opportunities.
            </p>
          </StaggerItem>
        </Stagger>
        <div className="lg:order-1">
          <Gallery {...UMOJA} mainSide="right" />
        </div>
      </section>

      {/* Why attend / sponsor */}
      <section className="shell mt-20 md:mt-24">
        <Reveal
          variant="scaleIn"
          amount={0.15}
          className="grid gap-6 rounded-lg bg-forest px-6 py-8 md:p-12 lg:grid-cols-[7fr_5fr] lg:gap-24 lg:p-[72px]"
        >
          <Stagger gap={0.1} className="order-2 grid gap-x-8 sm:grid-cols-2 lg:order-1 lg:gap-y-8 lg:self-start">
            {REASONS.map((r, i) => (
              <StaggerItem
                key={r.name}
                className={`group relative border-t border-line-on-forest py-5 ${i === REASONS.length - 1 ? "border-b sm:border-b-0" : ""}`}
              >
                <span
                  aria-hidden
                  className="absolute -left-4 bottom-5 top-5 w-[3px] origin-top scale-y-0 rounded-full bg-terracotta transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100"
                />
                <div className="flex flex-col gap-1 transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-2">
                  <h3 className="text-xl font-semibold leading-7 text-on-forest">{r.name}</h3>
                  <p className="text-base leading-6 text-on-forest-muted">{r.text}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <div className="order-1 flex flex-col items-start gap-4 lg:order-2 lg:gap-6">
            <SplitWords text="Sponsor or partner on a forum." className="t-h2 text-on-forest" />
            <p className="text-base leading-[26px] text-on-forest-muted">
              Get in touch about upcoming events, sponsorship or partnership.
            </p>
            <div className="hidden lg:block">
              <ButtonLink href="/contact" size="lg" arrow>
                Get in touch
              </ButtonLink>
            </div>
          </div>
          <ButtonLink href="/contact" size="lg" arrow className="order-3 w-full lg:hidden">
            Get in touch
          </ButtonLink>
        </Reveal>
      </section>
    </>
  );
}
