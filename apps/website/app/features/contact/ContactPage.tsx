import { Reveal, Stagger, StaggerItem } from "../../components/motion/Reveal";
import { SplitWords } from "../../components/motion/SplitWords";
import { ContactDetails } from "./ContactDetails";
import { ContactForm } from "./ContactForm";
import { AUDIENCES } from "./contact-data";
import { FormHero } from "../../components/site/FormHero";

export default function ContactPage() {
  return (
    <>
      <FormHero
        eyebrow="Contact"
        title="Tell us what you’re trying to move."
        lead="Get in touch about services, partnerships and trade-focused collaboration."
        accent="#19954f"
        horizon={["#19954f", "#157642", "#19954f"]}
        copyPaddingClass="lg:pb-[144px]"
        panel={<ContactForm />}
      >
        <div className="hidden lg:block">
          <ContactDetails tone="dark" />
        </div>
      </FormHero>

      {/* On phones the details move below the hero, as a ruled list. */}
      <section aria-label="Contact details" className="shell mt-12 lg:hidden">
        <Reveal>
          <ContactDetails tone="light" />
        </Reveal>
      </section>

      <section className="shell mt-12 flex flex-col gap-4 lg:mt-[72px] lg:gap-6">
        <SplitWords text="A structured way in, whoever you are." className="t-h2 text-ink" />
        <Stagger gap={0.1} className="grid gap-4 md:grid-cols-3 md:gap-8">
          {AUDIENCES.map((a, i) => (
            <StaggerItem key={a.title} className="group relative flex flex-col gap-1 pt-3.5 md:gap-1.5 md:pt-4">
              {/* Hairline on top, with a green rule that grows across it on hover. */}
              <span aria-hidden className={`absolute inset-x-0 top-0 h-px ${i === 0 ? "bg-line-strong" : "bg-line md:bg-line-strong"}`} />
              <span
                aria-hidden
                className="absolute left-0 top-0 h-[3px] w-full origin-left -translate-y-px scale-x-0 bg-brand-bright transition-transform duration-700 ease-(--ease-out-expo) group-hover:scale-x-100"
              />
              <h3 className="text-xl font-semibold leading-7 text-ink">{a.title}</h3>
              <p className="text-base leading-6 text-muted">{a.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </>
  );
}
