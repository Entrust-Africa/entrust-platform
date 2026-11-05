import Link from "next/link";
import { HOST } from "@/lib/content";
import { Page, SectionLabel, amberButton } from "@/components/site";
import { PARTNERS } from "@/lib/info";

export const metadata = { title: "Partners · Africa Diaspora Trade & Investment Summit 2027" };

export default function PartnersPage() {
  return (
    <Page label="Partners" title="Organisers, sponsors and supporting institutions" intro="Partner names, institutional roles and sponsors are published after formal confirmation.">
      <section className="bg-white px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem] space-y-14">
          <div>
            <SectionLabel>Host</SectionLabel>
            <a href={HOST.url} className="mt-6 inline-flex items-center gap-5 border border-line p-4 hover:border-amber">
              <img src="/images/pan-african-chamber-logo.png" alt="" width={300} height={300} className="size-24" />
              <span className="font-display text-2xl leading-tight uppercase">{HOST.name}</span>
            </a>
          </div>
          <div>
            <SectionLabel>Confirmed partners</SectionLabel>
            {PARTNERS.length === 0 ? (
              <p className="mt-6 max-w-2xl border border-line bg-paper p-8 text-base leading-relaxed text-ink/75">Sponsors, institutional partners and supporting organisations will be listed here once they are confirmed.</p>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {PARTNERS.map((p) => (
                  <li key={p.name} className="flex flex-col border border-line p-6">
                    {p.logo && <img src={p.logo} alt="" className="mb-4 h-16 object-contain object-left" />}
                    <p className="font-semibold">{p.url ? <a href={p.url} className="underline underline-offset-2">{p.name}</a> : p.name}</p>
                    <p className="text-sm text-ink/70">{p.role}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link href="/sponsor" className={amberButton}>
            Become a Sponsor or Institutional Partner
          </Link>
        </div>
      </section>
    </Page>
  );
}
