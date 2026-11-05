import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Qr } from "@/components/qr";
import { getBadge } from "@/lib/commerce";
import { SUPPORT_EMAIL } from "@/lib/content";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your ADTIS badge", robots: { index: false, follow: false } };

const countries = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string): string => {
  try {
    return countries.of(code) ?? code;
  } catch {
    return code;
  }
};

/** A delegate's badge: name, category, reference and a QR code. It says plainly whether it is valid yet. Print it or show it on a phone. */
export default async function BadgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const badge = await getBadge(token);
  if (!badge) notFound();

  return (
    <main className="min-h-dvh bg-paper px-4 py-10 print:bg-white print:py-0">
      <div className="mx-auto max-w-md">
        <p className="mb-4 text-center font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase print:hidden">ADTIS 2027 delegate badge</p>
        <div className="border-2 border-ink bg-white">
          <div className="bg-ink px-6 py-5 text-white">
            <p className="font-display text-2xl leading-none tracking-wide">ADTIS-27</p>
            <p className="mt-2 text-xs text-white/70">
              {badge.edition.name}
              <br />
              {badge.edition.venue} · {badge.edition.datesNote}
            </p>
          </div>
          <div className="px-6 py-8 text-center">
            <p className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">{badge.category}</p>
            <h1 className="mt-4 font-display text-[2.5rem] leading-[1.05] uppercase">{badge.fullName}</h1>
            <p className="mt-3 text-lg text-ink/80">{badge.organisation}</p>
            <p className="text-sm text-ink/60">{countryName(badge.country)}</p>
            <div className="mx-auto mt-8 flex justify-center">
              {badge.url ? <Qr value={badge.url} label="QR code for check-in" className="size-48" /> : null}
            </div>
            <p className="mt-4 font-mono text-sm tracking-[0.18em]">{badge.number}</p>
          </div>
          <div className={badge.valid ? "bg-ink px-6 py-3 text-center text-sm font-semibold text-white" : "bg-amber px-6 py-3 text-center text-sm font-semibold text-ink"}>
            {badge.valid ? "Valid for entry" : `Not valid yet: ${badge.reason ?? "please contact the ADTIS team"}`}
          </div>
        </div>
        <div className="mt-6 flex flex-col items-center gap-4 print:hidden">
          <PrintButton />
          <p className="text-center text-sm text-ink/70">
            Show this page, or the printed badge, at the registration desk. Problems with your badge? Write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline underline-offset-2">
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link href="/" className="text-sm font-semibold underline underline-offset-2">
            ADTIS home
          </Link>
        </div>
      </div>
    </main>
  );
}
