import Image from "next/image";
import { ParallaxImage } from "../../components/motion/ParallaxImage";
import { AccentRule, Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/ui/icons";
import { IMG, PARTNER_LOGOS, PLATFORM_URLS } from "../../lib/site";
import { HomeHero } from "./HomeHero";
import { PipelineStages } from "./PipelineStages";

const LEADERS = [
  {
    name: "Thomas Lorato",
    role: "Founder & CEO",
    bio: "Over two decades of international manufacturing and business leadership, focused on building scalable, bankable African businesses.",
    photo: IMG.thomas,
  },
  {
    name: "Mikias Melak Birhanie",
    role: "Managing Director, Advisory & Transactions",
    bio: "Licensed attorney and legal consultant, leading investment structuring, regulatory compliance and cross-border deal execution.",
    photo: IMG.mikias,
  },
];

/** Press coverage. Add `url` to a story to link it to the original article. */
const NEWS: { source: string; date: string; title: string; summary?: string; url?: string; cta?: string }[] = [
  {
    source: "Ethiopian News Agency",
    date: "10 June 2025",
    title: "AU calls for deeper integration as Botswana and Ethiopia strengthen business ties",
    summary:
      "Coverage of Andinet – Remmogo, the business networking event held with the Embassy of Botswana in Addis Ababa.",
    cta: "Read on ENA",
  },
  {
    source: "The Big Talk Africa",
    date: "18 June 2025",
    title: "AU urges stronger integration as Botswana and Ethiopia forge closer business ties",
  },
];

const PARTNER_TYPES = [
  { name: "Embassies", text: "Host country-specific forums that introduce SMEs to new markets." },
  { name: "Financial institutions", text: "Reach businesses that are structured, compliant and ready for funding." },
  { name: "Development partners", text: "Back a pipeline of export-ready SMEs through the TRADE Program." },
  { name: "Private sector buyers", text: "Source from verified suppliers in structured sessions." },
];

function StoryLink({ url, children, className = "" }: { url?: string; children: React.ReactNode; className?: string }) {
  if (!url) return <div className={className}>{children}</div>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

export default function HomePage() {
  const [lead, ...more] = NEWS;

  return (
    <>
      <HomeHero />

      {/* Partner logos */}
      <section className="shell mt-10 flex flex-col gap-4">
        <Reveal variant="fadeIn">
          <p className="text-sm font-medium text-muted">We work with</p>
        </Reveal>
        <Stagger
          gap={0.05}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 lg:grid-cols-8"
        >
          <StaggerItem variant="fadeIn" className="flex h-[104px] items-center justify-center gap-1.5 bg-surface p-3">
            <a
              href={PLATFORM_URLS.afriConnect}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 transition-transform duration-500 ease-(--ease-out-expo) hover:scale-105"
            >
              <Image src={IMG.afriConnectMark} alt="" width={36} height={34} />
              <span className="text-sm font-bold text-ink">AfriConnect</span>
            </a>
          </StaggerItem>
          {PARTNER_LOGOS.map((p) => (
            <StaggerItem
              key={p.name}
              variant="fadeIn"
              className="group flex h-[104px] items-center justify-center bg-surface p-4"
            >
              <Image
                src={p.src}
                alt={p.name}
                width={128}
                height={72}
                className="h-[72px] w-32 object-contain opacity-85 grayscale-[35%] transition duration-500 ease-(--ease-out-expo) group-hover:scale-105 group-hover:opacity-100 group-hover:grayscale-0"
              />
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Pipeline */}
      <section className="shell mt-20 grid gap-10 md:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <Reveal className="flex flex-col items-start gap-6">
          <SplitWords text="Introductions don’t close deals." className="t-h2 text-ink" />
          <p className="text-base leading-[26px] text-muted">
            Across Africa, most business engagements stop at the first meeting. Deals then stall on pricing,
            compliance, financing and execution. Our pipeline takes an SME through each of those gaps, one stage at a
            time.
          </p>
          <p className="t-lead font-semibold text-brand-deep">
            We measure success by transactions completed, not introductions made.
          </p>
          <div className="hidden lg:block mt-2"><ButtonLink href="/entrust#services" variant="outline" arrow>See how it works</ButtonLink></div>
        </Reveal>
        <PipelineStages />
        <ButtonLink href="/entrust#services" variant="outline" arrow className="w-full lg:hidden">
          See how it works
        </ButtonLink>
      </section>

      {/* Events */}
      <section className="shell mt-20 grid gap-8 md:mt-24 lg:grid-cols-[7fr_5fr] lg:gap-16">
        <figure className="flex flex-col gap-3">
          <ParallaxImage
            src={IMG.remmogoSpeaker}
            alt="A speaker at the podium at Andinet Remmogo"
            className="h-[288px] md:h-[500px]"
            sizes="(min-width: 1024px) 728px, 100vw"
          />
          <Reveal variant="fadeIn" delay={0.3}>
            <figcaption className="text-sm text-muted">Andinet Remmogo, the Ethiopia-Botswana Business Forum</figcaption>
          </Reveal>
        </figure>
        <Stagger className="flex flex-col items-start gap-6 lg:pb-8">
          <StaggerItem>
            <SplitWords text="Ethiopia and Botswana, in one room." className="t-h2 text-ink" />
          </StaggerItem>
          <StaggerItem>
            <p className="text-base leading-[26px] text-muted">
              Andinet Remmogo brought public and private sector actors together to deepen trade relationships and push
              corridor talks toward execution. It followed Andinet Umoja, our founding event for decision-makers, SMEs
              and institutional partners.
            </p>
          </StaggerItem>
          <StaggerItem className="hidden w-full lg:block">
            <div className="zoom-frame relative h-[180px] w-full">
              <Image src={IMG.forumAudience} alt="The forum audience" fill sizes="520px" className="object-cover" />
            </div>
          </StaggerItem>
          <StaggerItem className="w-full lg:w-auto">
            <ButtonLink href="/events" variant="outline" arrow className="w-full lg:w-auto">
              Register for events
            </ButtonLink>
          </StaggerItem>
        </Stagger>
      </section>

      {/* Leadership */}
      <section className="shell mt-20 grid gap-10 md:mt-36 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <div className="flex flex-col items-start gap-10">
          <SplitWords text="Who you’ll work with." className="t-h2 text-ink" />
          <Reveal className="order-last flex flex-col gap-4 lg:order-none">
            <AccentRule />
            <blockquote className="text-xl font-medium leading-[30px] text-ink">
              “The session was highly professional, insightful, and directly applicable to our strategic
              decision-making.”
            </blockquote>
            <p className="text-sm text-muted">Equatorial Business Group, on our Finance for Non-Finance training</p>
          </Reveal>
          <div className="hidden lg:block"><ButtonLink href="/about" variant="outline" arrow>Meet the team</ButtonLink></div>
        </div>
        <Stagger gap={0.15} className="grid gap-10 sm:grid-cols-2">
          {LEADERS.map((l) => (
            <StaggerItem key={l.name} className="group flex flex-col gap-2">
              <div className="zoom-frame relative mb-2 aspect-[4/5] w-full border border-line sm:aspect-auto sm:h-[400px]">
                <Image src={l.photo} alt={`${l.name}, ${l.role}`} fill sizes="(min-width: 1024px) 335px, 50vw" className="object-cover object-top" />
              </div>
              <h3 className="text-xl font-semibold leading-7 text-ink">{l.name}</h3>
              <p className="text-sm font-medium text-brand-deep">{l.role}</p>
              <p className="text-base leading-6 text-muted">{l.bio}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <ButtonLink href="/about" variant="outline" arrow className="w-full lg:hidden">
          Meet the team
        </ButtonLink>
      </section>

      {/* News */}
      <section className="shell mt-20 flex flex-col gap-8 md:mt-24">
        <SplitWords text="Latest in the news" className="t-h2 text-ink" />
        <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:gap-16">
          <Reveal>
            <StoryLink url={lead.url} className="group flex flex-col gap-3">
              <div className="zoom-frame relative mb-2 h-[240px] w-full md:h-[360px]">
                <Image src={IMG.remmogoPanel} alt="Panel at Andinet Remmogo" fill sizes="(min-width: 1024px) 728px, 100vw" className="object-cover" />
              </div>
              <p className="text-sm font-medium text-muted">
                {lead.source} · {lead.date}
              </p>
              <h3 className="t-h3 text-ink transition-colors duration-300 group-hover:text-brand-deep">{lead.title}</h3>
              <p className="text-base leading-[26px] text-muted">{lead.summary}</p>
              {lead.url && (
                <span className="inline-flex h-11 items-center gap-1.5 font-semibold text-brand">
                  <span className="link-grow">{lead.cta}</span>
                  <ArrowUpRight className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              )}
            </StoryLink>
          </Reveal>
          <Stagger className="flex flex-col gap-3">
            {more.map((s) => (
              <StaggerItem key={s.title}>
                <StoryLink url={s.url} className="group flex items-start gap-4 border-b border-line pb-5">
                  <span className="flex flex-1 flex-col gap-2">
                    <span className="text-sm font-medium text-muted">
                      {s.source} · {s.date}
                    </span>
                    <span className="text-xl font-semibold leading-7 text-ink transition-colors duration-300 group-hover:text-brand-deep">
                      {s.title}
                    </span>
                  </span>
                  {s.url && (
                    <ArrowUpRight
                      size={20}
                      className="mt-1 shrink-0 text-brand transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    />
                  )}
                </StoryLink>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Partner band */}
      <section className="shell mt-20 md:mt-24">
        <Reveal
          variant="scaleIn"
          amount={0.15}
          className="grid gap-10 rounded-lg bg-forest p-6 py-10 md:p-12 lg:grid-cols-[7fr_5fr] lg:gap-24 lg:p-[72px]"
        >
          <Stagger className="order-2 lg:order-1" gap={0.1}>
            <div>
              {PARTNER_TYPES.map((t, i) => (
                <StaggerItem
                  key={t.name}
                  className={`group relative border-t border-line-on-forest py-5 ${i === PARTNER_TYPES.length - 1 ? "border-b" : ""}`}
                >
                  <span
                    aria-hidden
                    className="absolute -left-4 top-5 bottom-5 w-[3px] origin-top scale-y-0 rounded-full bg-brand-bright transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100 md:-left-6"
                  />
                  <div className="transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-2">
                    <h3 className="text-xl font-semibold leading-7 text-on-forest">{t.name}</h3>
                    <p className="mt-1 text-base leading-6 text-on-forest-muted">{t.text}</p>
                  </div>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
          <div className="order-1 flex flex-col items-start gap-6 lg:order-2">
            <SplitWords text="Partner with us on the next trade corridor." className="t-h2 text-on-forest" />
            <p className="text-base leading-[26px] text-on-forest-muted">
              Tell us which market or sector you are working on, and we’ll show you where the pipeline can help.
            </p>
            <div className="hidden lg:block"><ButtonLink href="/partners" size="lg" arrow>Become a partner</ButtonLink></div>
          </div>
          <ButtonLink href="/partners" size="lg" arrow className="order-3 w-full lg:hidden">
            Become a partner
          </ButtonLink>
        </Reveal>
      </section>
    </>
  );
}
