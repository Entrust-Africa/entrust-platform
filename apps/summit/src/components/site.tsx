import Link from "next/link";
import { HOST, SUPPORT_EMAIL } from "@/lib/content";
import { signInUrl } from "@/lib/period";

// The frame every ADTIS page shares: the header with EXHIBIT | SPONSOR | PARTICIPATE, the host's credit and the footer.

export { amberButton, darkButton, outlineButton, outlineOnDark } from "@/lib/styles";

export function SectionLabel({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return <p className={`font-mono text-[11px] tracking-[0.2em] uppercase ${onDark ? "text-amber" : "text-amber-ink"}`}>{children}</p>;
}

const COMMERCE_LINKS = [
  ["Exhibit", "/exhibit"],
  ["Sponsor", "/sponsor"],
  ["Participate", "/participate"],
] as const;

/**
 * The header. On the home page it sits over the hero photo; on other pages it is a dark bar. The commercial section is one
 * nav item, "EXHIBIT | SPONSOR | PARTICIPATE", each word a link.
 */
export function SiteHeader({ overHero = false }: { overHero?: boolean }) {
  return (
    <header className={overHero ? "relative z-10 px-6 py-6 lg:px-16" : "bg-ink px-6 py-5 text-white lg:px-16"}>
      <div className="mx-auto flex max-w-[82rem] flex-wrap items-center justify-between gap-x-8 gap-y-4 text-white">
        <Link href="/" className="font-display text-2xl leading-none tracking-wide">
          ADTIS-27
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full flex-wrap items-center gap-x-8 gap-y-3 font-mono text-xs tracking-wide md:order-none md:w-auto">
          <Link href="/#about" className="text-white/85 hover:text-white">
            About
          </Link>
          <span className="flex items-center gap-2" role="group" aria-label="Exhibit, sponsor or participate">
            {COMMERCE_LINKS.map(([label, href], i) => (
              <span key={href} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-white/35">
                    |
                  </span>
                )}
                <Link href={href} className="font-semibold text-amber uppercase hover:text-white">
                  {label}
                </Link>
              </span>
            ))}
          </span>
          <Link href="/smes" className="text-white/85 hover:text-white">
            African SMEs
          </Link>
        </nav>
        <Link href="/participate/register" className="inline-flex h-10 items-center bg-amber px-5 text-xs font-semibold text-ink hover:brightness-110">
          Register
        </Link>
      </div>
    </header>
  );
}

/** The host's logo on a white plate, since the logo's red and green only read on a light ground. */
export function HostedBy({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-3 ${className}`}>
      <span className="font-mono text-[11px] tracking-[0.2em] text-white/70 uppercase">Hosted by</span>
      <a href={HOST.url} className="bg-white p-2 transition-[filter] hover:brightness-95" aria-label={`${HOST.name} (opens their website)`}>
        <img src="/images/pan-african-chamber-logo.png" alt={HOST.name} width={300} height={300} className="size-24 sm:size-28" />
      </a>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink-deep px-6 py-12 text-white lg:px-16">
      <div className="mx-auto flex max-w-[82rem] flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-display text-xl leading-none uppercase">Africa Diaspora Trade &amp; Investment Summit</p>
          <p className="mt-4 font-mono text-[11px] leading-relaxed tracking-wide text-white/55">
            © 2026 ADTIS · Addis Ababa, Ethiopia · January 2027
          </p>
          <HostedBy className="mt-6" />
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[11px] tracking-wide text-white/65">
          <Link href="/exhibit" className="hover:text-white">
            Exhibit
          </Link>
          <Link href="/sponsor" className="hover:text-white">
            Sponsor
          </Link>
          <Link href="/participate" className="hover:text-white">
            Participate
          </Link>
          <Link href="/smes" className="hover:text-white">
            African SMEs
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white">
            Contact
          </a>
          <a href={signInUrl()} className="hover:text-white">
            Applicant sign in
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** A page's title block on the dark bar under the header. */
export function PageHero({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="bg-ink px-6 pt-4 pb-14 text-white lg:px-16 lg:pb-20">
      <div className="mx-auto max-w-[82rem]">
        <SectionLabel onDark>{label}</SectionLabel>
        <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-[1] uppercase">{title}</h1>
        {children && <div className="mt-6 max-w-2xl text-base leading-relaxed text-white/75">{children}</div>}
      </div>
    </section>
  );
}

/** A normal page: header, a title, the content and the footer. */
export function Page({ label, title, intro, children }: { label: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <PageHero label={label} title={title}>
        {intro}
      </PageHero>
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}

/** Shown when the API can't be reached, or no edition is set up yet. */
export function NotOpen({ what }: { what: string }) {
  return (
    <section className="px-6 py-20 lg:px-16">
      <div className="mx-auto max-w-2xl border border-line bg-paper p-8">
        <h2 className="font-display text-3xl leading-none uppercase">{what} opens soon</h2>
        <p className="mt-4 text-base leading-relaxed text-ink/75">
          The organising team is still setting this up. Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2">
            {SUPPORT_EMAIL}
          </a>{" "}
          and we will tell you as soon as it is ready.
        </p>
      </div>
    </section>
  );
}
