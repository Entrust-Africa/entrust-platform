import { Page, SectionLabel } from "@/components/site";
import { BACKGROUND, MISSION, OBJECTIVES, THEMES, VISION } from "@/lib/info";

export const metadata = { title: "About · Africa Diaspora Trade & Investment Summit 2027", description: "Why ADTIS exists, its vision, mission, objectives and themes." };

export default function AboutPage() {
  return (
    <Page label="About ADTIS" title="Building a global Africa–Diaspora business and investment platform" intro="ADTIS 2027 is the first major event of a permanent platform for Africa–Diaspora trade and investment.">
      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[82rem] gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
          <div>
            <SectionLabel>Background and rationale</SectionLabel>
            <h2 className="mt-6 font-display text-[clamp(2rem,4vw,3rem)] leading-[1.05] uppercase">Resources exist. The connections are fragmented.</h2>
          </div>
          <div className="space-y-5 text-base leading-[1.8] text-ink/75">
            {BACKGROUND.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-6 py-20 text-white lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[82rem] gap-px bg-white/15 lg:grid-cols-2">
          <div className="bg-ink p-8 lg:p-12">
            <SectionLabel onDark>Vision</SectionLabel>
            <p className="mt-6 text-lg leading-relaxed">{VISION}</p>
          </div>
          <div className="bg-ink p-8 lg:p-12">
            <SectionLabel onDark>Mission</SectionLabel>
            <p className="mt-6 text-lg leading-relaxed">{MISSION}</p>
          </div>
        </div>
      </section>

      <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>Strategic objectives</SectionLabel>
          <ol className="mt-10 grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {OBJECTIVES.map(([title, text], i) => (
              <li key={title} className="bg-white p-6">
                <span className="font-mono text-xs text-amber-ink">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-3 text-base font-semibold">{title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink/70">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <SectionLabel>Key summit themes</SectionLabel>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {THEMES.map(([letter, title, text]) => (
              <div key={letter} className="border-t border-line pt-5">
                <dt className="font-display text-2xl leading-tight uppercase">
                  <span className="mr-3 font-mono text-sm text-amber-ink">{letter}</span>
                  {title}
                </dt>
                <dd className="mt-3 text-sm leading-relaxed text-ink/70">{text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </Page>
  );
}
