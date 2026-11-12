import Image from "next/image";
import { ParallaxImage } from "../../components/motion/ParallaxImage";
import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { IMG, PLATFORM_COLOR } from "../../lib/site";
import { InnerHero } from "../../components/site/InnerHero";

const STORY_PHOTO = "/images/c37584d5e8882ac5.jpg";

const LEADERS = [
  {
    name: "Thomas Lorato",
    role: "Founder & CEO",
    bio: "Over two decades of international manufacturing experience. Bridges banks and SME clients through deal structuring and pipeline development. Also leads our trade pipeline and digital gateway work.",
    photo: IMG.thomas,
    framed: false,
  },
  {
    name: "Mikias Melak Birhanie",
    role: "Managing Director, Advisory & Transactions",
    bio: "Licensed attorney leading investment structuring, regulatory compliance and cross-border deal execution.",
    photo: IMG.mikias,
    framed: true,
  },
  {
    name: "Fekadu Welde",
    role: "Chief Legal & Regulatory Affairs Officer",
    bio: "Leads legal structuring and regulatory advisory, supporting cross-border transactions, investment compliance and institutional engagements.",
    photo: "/images/39a8494841f27a65.jpg",
    framed: true,
  },
  {
    name: "Thomas Seyoum Kassaye",
    role: "Digital Governance Advisor",
    bio: "Over 20 years across international organizations including UNHCR, UNICEF and UNECA, in digital transformation and information governance.",
    photo: "/images/9069efdfc77d0dd9.jpg",
    framed: false,
  },
];

export default function AboutPage() {
  return (
    <>
      <InnerHero
        eyebrow="About Entrust Africa"
        title="Hands-on, from concept to execution."
        lead="A strategy and execution firm working with SMEs, financial institutions and investors across African markets."
        accent={PLATFORM_COLOR.entrust}
        horizon={["#19954f", "#d9a033", "#c8553d", "#2b9d8f"]}
      >
        <div className="rounded-lg bg-surface px-4 py-5 lg:p-6">
          <div className="flex flex-col gap-2 pb-4 lg:pb-5">
            <h2 className="text-xl font-semibold leading-7 text-ink">Our mission</h2>
            <p className="text-base leading-6 text-muted">
              To unlock Africa’s potential by supporting businesses, fostering innovation and building a collaborative
              ecosystem for sustainable growth.
            </p>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-4 lg:pt-5">
            <h2 className="text-xl font-semibold leading-7 text-ink">Our vision</h2>
            <p className="text-base leading-6 text-muted">
              A connected Africa where businesses, communities and partners work together to create lasting impact and
              shared prosperity.
            </p>
          </div>
        </div>
      </InnerHero>

      {/* Our story */}
      <section className="shell mt-20 grid gap-4 md:mt-24 lg:grid-cols-[5fr_7fr] lg:gap-24">
        <Stagger className="flex flex-col gap-4 lg:gap-6">
          <StaggerItem>
            <SplitWords text="World-class advisory for African businesses." className="t-h2 text-ink" />
          </StaggerItem>
          <StaggerItem>
            <p className="text-base leading-[26px] text-muted">
              Entrust Africa was founded on the belief that African businesses deserve world-class strategic advisory.
              We work at the intersection of strategy, finance and operations.
            </p>
          </StaggerItem>
          <StaggerItem>
            <p className="text-base leading-[26px] text-muted">
              <span className="lg:hidden">
                From go-to-market strategies to investor readiness, we walk alongside our clients from concept to
                execution.
              </span>
              <span className="hidden lg:inline">
                From designing go-to-market strategies to structuring financials for investor readiness, we walk
                alongside our clients from concept to execution.
              </span>
            </p>
          </StaggerItem>
        </Stagger>
        <ParallaxImage
          src={STORY_PHOTO}
          alt="Guests in conversation around a table at an Entrust Africa forum"
          className="h-[300px] md:h-[440px]"
          sizes="(min-width: 1024px) 728px, 100vw"
        />
      </section>

      {/* Leadership */}
      <section className="shell mt-20 flex flex-col gap-6 md:mt-24 md:gap-8">
        <SplitWords text="Leadership" className="t-h2 text-ink" />
        <Stagger gap={0.12} className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {LEADERS.map((l) => (
            <StaggerItem key={l.name} className="group">
              <article className="flex flex-col gap-3 md:gap-2">
                <div className="flex items-center gap-4 md:flex-col md:items-stretch md:gap-2">
                  <div
                    className={`zoom-frame relative h-[120px] w-24 shrink-0 md:mb-2 md:h-[340px] md:w-full ${l.framed ? "border border-line" : ""}`}
                  >
                    <Image
                      src={l.photo}
                      alt={`${l.name}, ${l.role}`}
                      fill
                      sizes="(min-width: 1024px) 310px, (min-width: 768px) 50vw, 96px"
                      className="object-cover"
                    />
                    {/* Green rule that draws across the foot of the photo on hover. */}
                    <span
                      aria-hidden
                      className="absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-brand-bright transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-x-100"
                    />
                  </div>
                  <div className="flex flex-col gap-1 md:gap-2">
                    <h3 className="text-xl font-semibold leading-7 text-ink transition-colors duration-300 group-hover:text-brand-deep">
                      {l.name}
                    </h3>
                    <p className="text-sm font-medium leading-5 text-brand-deep">{l.role}</p>
                  </div>
                </div>
                <p className="text-base leading-6 text-muted">{l.bio}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Connect */}
      <section className="shell mt-20 md:mt-24">
        <Reveal
          variant="scaleIn"
          amount={0.3}
          className="grid gap-4 rounded-lg bg-forest px-6 py-8 md:p-12 lg:grid-cols-[7fr_5fr] lg:items-center lg:gap-24 lg:px-[72px] lg:py-14"
        >
          <SplitWords text="Ready to connect?" className="t-h2 mb-2 text-on-forest lg:mb-0" />
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-3 lg:justify-end">
            <ButtonLink href="/contact" size="lg" className="w-full sm:w-auto">
              Contact us
            </ButtonLink>
            <ButtonLink href="/community" size="lg" variant="outline-light" className="w-full sm:w-auto">
              Join the community
            </ButtonLink>
          </div>
        </Reveal>
      </section>
    </>
  );
}
