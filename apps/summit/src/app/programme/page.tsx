import { Page, SectionLabel } from "@/components/site";
import { DAYS } from "@/lib/info";

export const metadata = { title: "Programme · Africa Diaspora Trade & Investment Summit 2027", description: "The three-day structure of ADTIS 2027." };

export default function ProgrammePage() {
  return (
    <Page label="Programme" title="Three days, from dialogue to deals" intro="High-level dialogue, business presentations, investment engagement and structured matchmaking, in Addis Ababa in January 2027.">
      <section className="bg-paper px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          <p className="max-w-2xl border-l-2 border-amber pl-4 text-sm leading-relaxed text-ink/75">
            This is the proposed structure. The detailed programme, speakers, participating countries and session timings will be announced as arrangements are finalised. The exact dates are to be announced.
          </p>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {DAYS.map((d) => (
              <article key={d.day} className="flex flex-col border border-line bg-white">
                <div className="bg-ink p-8 text-white">
                  <SectionLabel onDark>{d.day}</SectionLabel>
                  <h2 className="mt-4 font-display text-3xl leading-[1.05] uppercase">{d.title}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-white/70">{d.focus}</p>
                </div>
                <ul className="flex-1 space-y-3 p-8">
                  {d.activities.map((a) => (
                    <li key={a} className="flex gap-3 text-sm leading-relaxed text-ink/80">
                      <span aria-hidden className="mt-2 size-1.5 shrink-0 bg-amber" />
                      {a}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    </Page>
  );
}
