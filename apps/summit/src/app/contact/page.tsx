import { SUPPORT_EMAIL } from "@/lib/content";
import { Page, SectionLabel } from "@/components/site";

export const metadata = { title: "Contact · Africa Diaspora Trade & Investment Summit 2027" };

export default function ContactPage() {
  return (
    <Page label="Contact" title="The ADTIS secretariat" intro="Questions about exhibiting, sponsoring, registering or the SME programme? Write to us.">
      <section className="px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto grid max-w-[82rem] gap-10 md:grid-cols-2">
          <div className="border border-line bg-paper p-8">
            <SectionLabel>Email</SectionLabel>
            <p className="mt-4 text-xl">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-4">
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">Please include your reference number (EXH-, SPN-, DEL- or SUM-) if you have one.</p>
          </div>
          <div className="border border-line bg-paper p-8">
            <SectionLabel>The summit</SectionLabel>
            <p className="mt-4 text-xl">Addis Ababa, Ethiopia</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/70">January 2027. The exact dates are to be announced.</p>
          </div>
        </div>
      </section>
    </Page>
  );
}
