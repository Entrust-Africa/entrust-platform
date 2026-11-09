import Link from "next/link";
import { notFound } from "next/navigation";
import { B2bForm } from "@/components/b2b-form";
import { Qr } from "@/components/qr";
import { Page, SectionLabel } from "@/components/site";
import { getProfile } from "@/lib/commerce";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const profile = await getProfile((await params).slug);
  return { title: profile ? `${profile.name} · ADTIS 2027 African SMEs` : "African SMEs · ADTIS 2027" };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] tracking-[0.16em] text-amber-ink uppercase">{label}</dt>
      <dd className="mt-1.5 text-base leading-relaxed text-ink/85">{children}</dd>
    </div>
  );
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sme = await getProfile(slug);
  if (!sme) notFound();
  const c = sme.contact;
  return (
    <Page label={`${sme.countryName}${sme.city ? ` · ${sme.city}` : ""}`} title={sme.name} intro={sme.sector}>
      <section className="px-6 py-14 lg:px-16 lg:py-20">
        <div className="mx-auto grid max-w-[82rem] gap-12 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-10">
            <div className="flex flex-wrap gap-2 font-mono text-[11px] tracking-wide uppercase">
              <span className={sme.verification === "verified" ? "bg-ink px-3 py-1.5 text-white" : "bg-paper px-3 py-1.5 text-ink/70"}>{sme.verificationLabel}</span>
              {sme.seeksInvestment && <span className="bg-amber/20 px-3 py-1.5 text-amber-ink">Seeking investment</span>}
            </div>
            <div>
              <SectionLabel>About the business</SectionLabel>
              <p className="mt-4 whitespace-pre-line text-base leading-[1.8] text-ink/85">{sme.summary}</p>
            </div>
            <dl className="grid gap-8 sm:grid-cols-2">
              <Fact label="Products and services">
                <ul className="space-y-1">
                  {sme.productsServices.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Fact>
              {sme.targetMarkets.length > 0 && <Fact label="Target export markets">{sme.targetMarkets.join(", ")}</Fact>}
              {sme.productionCapacity && <Fact label="Production capacity">{sme.productionCapacity}</Fact>}
              {sme.exportReadiness && <Fact label="Export readiness">{sme.exportReadiness}</Fact>}
              {sme.investmentRequirements && <Fact label="Investment requirements">{sme.investmentRequirements}</Fact>}
              {(sme.website || c.name || c.email || c.phone) && (
                <Fact label="Contact">
                  {c.name && (
                    <p>
                      {c.name}
                      {c.position ? `, ${c.position}` : ""}
                    </p>
                  )}
                  {c.email && (
                    <p>
                      <a href={`mailto:${c.email}`} className="underline underline-offset-2">
                        {c.email}
                      </a>
                    </p>
                  )}
                  {c.phone && <p>{c.phone}</p>}
                  {sme.website && (
                    <p>
                      <a href={sme.website} rel="noopener noreferrer" className="underline underline-offset-2">
                        {sme.website}
                      </a>
                    </p>
                  )}
                </Fact>
              )}
            </dl>
            <p className="text-xs leading-relaxed text-ink/60">
              This profile shows what the business chose to share. It is not a guarantee of quality or performance. ADTIS does not publish assessment scores or financial figures.
            </p>
          </div>

          <aside className="space-y-8">
            <div className="border border-line bg-paper p-6">
              <p className="font-mono text-[11px] tracking-[0.16em] text-amber-ink uppercase">Profile QR code</p>
              <Qr value={sme.url} label={`QR code linking to the ${sme.name} profile`} className="mt-4 size-40 border border-line" />
              <p className="mt-3 text-xs break-all text-ink/60">{sme.url}</p>
            </div>
            <div id="enquire" className="border border-ink bg-white p-6">
              <h2 className="font-display text-2xl leading-none uppercase">Request B2B Matchmaking</h2>
              <p className="mt-3 mb-6 text-sm leading-relaxed text-ink/70">Buyer, investor, distributor or partner? Ask to be put in touch with {sme.name}.</p>
              <B2bForm slug={sme.slug} name={sme.name} />
            </div>
            <Link href="/smes" className="inline-block text-sm font-semibold underline underline-offset-2">
              All African SMEs
            </Link>
          </aside>
        </div>
      </section>
    </Page>
  );
}
