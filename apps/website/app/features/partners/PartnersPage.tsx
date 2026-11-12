import Image from "next/image";
import { AccentRule, Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ButtonLink } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/ui/icons";
import { IMG, PARTNER_LOGOS, PLATFORM_COLOR, PLATFORM_URLS } from "../../lib/site";
import { InnerHero } from "../../components/site/InnerHero";

const ROUTES = [
  { name: "Embassies", text: "Host country-specific forums that introduce SMEs to new markets." },
  { name: "Financial institutions", text: "Reach businesses that are structured, compliant and ready for funding." },
  { name: "Development partners", text: "Back a pipeline of export-ready SMEs through the TRADE Program." },
  { name: "Private sector buyers", text: "Source from verified suppliers in structured sessions." },
];

const logo = (name: (typeof PARTNER_LOGOS)[number]["name"]) => PARTNER_LOGOS.find((p) => p.name === name)!.src;

/**
 * The partner wall. `short` is the caption on phones, where the design uses shorter names.
 * One logo has no confirmed name yet, so it shows without a caption.
 */
const PARTNERS: { name?: string; short?: string; alt: string; src?: string }[] = [
  { name: "Zemen Bank", alt: "Zemen Bank", src: logo("Zemen Bank") },
  {
    name: "Embassy of the Republic of Botswana",
    short: "Embassy of Botswana",
    alt: "Embassy of the Republic of Botswana",
    src: logo("Embassy of Botswana"),
  },
  { name: "Equatorial Business Group", alt: "Equatorial Business Group", src: logo("Equatorial Business Group") },
  { name: "Eco Green Liquid Fertilizer", short: "Eco Green", alt: "Eco Green Liquid Fertilizer", src: logo("Eco Green") },
  { name: "Wegeret Construction", alt: "Wegeret Construction", src: logo("Wegeret Construction") },
  { alt: "Partner logo", src: logo("Partner") },
  { name: "Ale Hig", alt: "Ale Hig", src: logo("Ale Hig") },
  { name: "BALBBIYS Trading PLC", alt: "BALBBIYS Trading PLC" },
];

const cell =
  "group flex flex-col items-center justify-center gap-3 bg-surface p-4 text-center md:h-[192px] md:p-5";
const logoMotion =
  "transition duration-500 ease-(--ease-out-expo) group-hover:-translate-y-1 group-hover:scale-[1.04]";

export default function PartnersPage() {
  return (
    <>
      <InnerHero
        eyebrow="Partners"
        title="Trade gets done with the right people at the table."
        lead="We align embassies, financial institutions, development partners and private sector buyers around SMEs that are ready to trade."
        accent={PLATFORM_COLOR.clear}
        horizon={["#2b9d8f", "#19954f", "#d9a033"]}
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-lg bg-surface px-4 pb-2 pt-5 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)] lg:px-6 lg:pt-6">
            <h2 className="mb-3 text-xl font-semibold leading-7 text-ink">How would you work with us?</h2>
            <ul>
              {ROUTES.map((r) => (
                <li key={r.name} className="group relative border-t border-line py-3">
                  <span
                    aria-hidden
                    className="absolute -left-4 bottom-3 top-3 w-[3px] origin-top scale-y-0 rounded-full bg-teal transition-transform duration-500 ease-(--ease-out-expo) group-hover:scale-y-100 lg:-left-6"
                  />
                  <div className="flex flex-col gap-0.5 transition-transform duration-500 ease-(--ease-out-expo) group-hover:translate-x-1.5">
                    <h3 className="text-base font-semibold leading-[22px] text-ink">{r.name}</h3>
                    <p className="text-sm leading-5 text-muted">{r.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <ButtonLink href="/contact" size="lg" arrow className="w-full">
            Become a partner
          </ButtonLink>
        </div>
      </InnerHero>

      {/* Partner wall */}
      <section className="shell mt-20 flex flex-col gap-6 md:mt-24 md:gap-8">
        <SplitWords text="Trusted partners across our regional ecosystem." className="t-h2 text-ink" />
        <Stagger
          gap={0.06}
          amount={0.1}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3"
        >
          <StaggerItem variant="fadeIn" className="col-span-2 flex md:col-span-1">
            <a
              href={PLATFORM_URLS.afriConnect}
              target="_blank"
              rel="noopener noreferrer"
              className={`${cell} h-[112px] w-full flex-row gap-4 md:flex-col md:gap-3`}
            >
              <Image
                src={IMG.afriConnectMark}
                alt=""
                width={200}
                height={104}
                className={`h-16 w-auto object-contain md:h-[104px] ${logoMotion}`}
              />
              <span className="inline-flex items-center gap-1 text-xl font-semibold leading-7 text-ink md:text-sm md:leading-5">
                <span className="link-grow">AfriConnect</span>
                <ArrowUpRight
                  size={16}
                  className="text-brand opacity-0 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
                <span className="sr-only">(opens in a new tab)</span>
              </span>
            </a>
          </StaggerItem>
          {PARTNERS.map((p) => (
            <StaggerItem key={p.alt} variant="fadeIn" className={`${cell} min-h-[150px]`}>
              {p.src ? (
                <>
                  <Image
                    src={p.src}
                    alt={p.alt}
                    width={200}
                    height={104}
                    className={`h-16 w-[128px] object-contain md:h-[104px] md:w-[200px] ${logoMotion}`}
                  />
                  {p.name && (
                    <span className="text-sm leading-5 text-muted transition-colors duration-300 group-hover:text-ink">
                      {p.short ? (
                        <>
                          <span className="md:hidden">{p.short}</span>
                          <span className="hidden md:inline">{p.name}</span>
                        </>
                      ) : (
                        p.name
                      )}
                    </span>
                  )}
                </>
              ) : (
                <span className={`text-base font-semibold leading-6 text-ink md:text-xl md:leading-7 ${logoMotion}`}>
                  {p.name}
                </span>
              )}
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Client quote */}
      <section className="shell mt-20 grid gap-5 md:mt-24 lg:grid-cols-[8fr_4fr] lg:gap-24">
        <figure className="flex flex-col gap-4 lg:gap-5">
          <AccentRule />
          <SplitWords
            as="blockquote"
            text="“The session was highly professional, insightful, and directly applicable to our strategic decision-making.”"
            className="text-[28px] font-semibold leading-9 tracking-[-0.02em] text-ink lg:text-[40px] lg:leading-[50px]"
          />
          <Reveal variant="fadeIn" delay={0.3}>
            <figcaption className="text-sm leading-5 text-muted md:text-base md:leading-6">
              Equatorial Business Group, on our Finance for Non-Finance training
            </figcaption>
          </Reveal>
        </figure>
        <Reveal delay={0.2} className="lg:self-end">
          <ButtonLink href="/contact" size="lg" arrow className="w-full lg:w-60">
            Start a conversation
          </ButtonLink>
        </Reveal>
      </section>
    </>
  );
}
