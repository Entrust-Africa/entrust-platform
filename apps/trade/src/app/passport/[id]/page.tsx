import type { Metadata } from "next";
import { headers } from "next/headers";
import { BadgeCheck, CheckCircle2, ShieldAlert, Star } from "lucide-react";
import { Card, StatusBadge } from "@entrust/ui";
import { Qr } from "@/components/passport/qr";
import { STANDING_LABEL, TIERS, countryName, passportAddress, passportDate, type PublicPassport } from "@/lib/passport";

// What the QR code on an Entrust Africa Verified SME Passport opens. Public: no sign-in. It shows only what staff published on the
// passport, and says plainly when a passport has lapsed or been withdrawn.

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verified SME Passport", robots: { index: false } };

async function load(id: string): Promise<{ passport: PublicPassport | null; notFound: boolean }> {
  const api = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${api}/v1/trade/passports/${encodeURIComponent(id)}/public`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.status === 404) return { passport: null, notFound: true };
    if (!res.ok) return { passport: null, notFound: false };
    return { passport: (await res.json()) as PublicPassport, notFound: false };
  } catch {
    return { passport: null, notFound: false };
  }
}

const withProtocol = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

function Heading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">{children}</h2>;
}

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${value ? "text-ink" : "font-normal text-ink-3"}`}>{value ?? "Not stated"}</dd>
    </div>
  );
}

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { passport, notFound } = await load(id);
  const address = passportAddress(await headers(), (passport?.passportId ?? id).toUpperCase());

  return (
    <div className="min-h-screen bg-canvas px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl space-y-5">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Entrust Africa · Verified SME Passport</p>

        {notFound ? (
          <Card className="space-y-3 border-red-200 bg-red-50/50 p-8 text-center">
            <ShieldAlert className="mx-auto size-12 text-red-500" aria-hidden />
            <h1 className="font-display text-xl font-bold text-ink">Passport not found</h1>
            <p className="mx-auto max-w-md text-sm text-ink-2">
              Entrust has not issued a passport numbered <span className="font-mono font-bold text-ink">{id.toUpperCase()}</span>. Check the number, or ask the business for its current passport.
            </p>
          </Card>
        ) : !passport ? (
          <Card className="p-8 text-center text-sm text-ink-2">We couldn&apos;t reach the Entrust verification service. Please try again in a moment.</Card>
        ) : (
          <PassportView passport={passport} address={address} />
        )}

        <p className="mx-auto max-w-2xl text-center text-xs leading-relaxed text-ink-3">
          A passport confirms the checks Entrust Africa listed, as at the date shown. It is not a guarantee of product quality, of a business&apos;s performance, or of any financing, insurance cover or contract.
        </p>
      </div>
    </div>
  );
}

function PassportView({ passport: p, address }: { passport: PublicPassport; address: string }) {
  const tier = TIERS[p.tier];
  const d = p.details;
  const live = p.standing === "active";

  return (
    <>
      <Card className="overflow-hidden p-0">
        <div className="space-y-3 p-5 sm:p-7">
          <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{p.displayName}</h1>
          {d?.tagline && <p className="text-sm text-ink-2">{d.tagline}</p>}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
              <BadgeCheck className="size-3.5" aria-hidden />
              Verified SME
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-ink-2">
              <Star className="size-3.5" aria-hidden />
              {tier.name} tier
            </span>
            <span className="text-ink-2">
              ID <span className="font-mono font-bold text-ink">{p.passportId}</span>
            </span>
          </div>
        </div>
        <div
          className={`flex flex-wrap items-center gap-x-6 gap-y-2 border-t px-5 py-3 text-sm sm:px-7 ${live ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          <span>
            Verified <strong>{passportDate(p.verifiedOn)}</strong>
          </span>
          <span>
            {p.standing === "expired" ? "Expired" : "Valid until"} <strong>{passportDate(p.validUntil)}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            {live ? <CheckCircle2 className="size-4" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />}
            Status: {STANDING_LABEL[p.standing]}
            <StatusBadge tone={live ? "ok" : "danger"}>{STANDING_LABEL[p.standing].toUpperCase()}</StatusBadge>
          </span>
        </div>
      </Card>

      {!d ? (
        <Card className="space-y-2 border-red-300 p-6 text-center">
          <h2 className="font-display text-lg font-bold text-ink">This passport is {p.standing === "revoked" ? "no longer valid" : "on hold"}</h2>
          <p className="mx-auto max-w-md text-sm text-ink-2">
            {p.standing === "revoked"
              ? "Entrust Africa has withdrawn this passport. Don't rely on it. Ask the business, or Entrust, for details."
              : "Entrust Africa has suspended this passport while it looks into it. Don't rely on it for now."}
          </p>
        </Card>
      ) : (
        <>
          {p.standing === "expired" && (
            <p role="status" className="rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
              This passport ran out on {passportDate(p.validUntil)}. The checks below were true at the time of verification and may have changed.
            </p>
          )}

          <Card className="p-0">
            <dl className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-6">
              <Fact label="Country" value={countryName(d.country)} />
              <Fact label="Sector" value={d.sector} />
              <Fact label="Established" value={d.established ? String(d.established) : null} />
              <Fact label="Employees" value={d.employeesRange} />
              <Fact label="Ownership" value={d.ownership} />
              <Fact label="Founder" value={d.founder} />
            </dl>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            {(d.headline || d.overview) && (
              <Card className="space-y-3 p-5">
                <Heading>Business overview</Heading>
                {d.headline && <p className="font-display text-lg font-bold text-ink">{d.headline}</p>}
                {d.overview?.split(/\n{2,}/).map((para, i) => (
                  <p key={i} className="text-sm leading-relaxed text-ink-2">
                    {para}
                  </p>
                ))}
              </Card>
            )}
            {d.products.length > 0 && (
              <Card className="space-y-3 p-5">
                <Heading>What {p.displayName} sells</Heading>
                <ul className="divide-y divide-line">
                  {d.products.map((item) => (
                    <li key={item.name} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.name}</p>
                        {item.detail && <p className="text-sm text-ink-2">{item.detail}</p>}
                      </div>
                      {item.code && <span className="shrink-0 text-xs text-ink-3">{item.code}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {(d.womenInTrade.length > 0 || d.targetMarkets.length > 0 || d.seeking) && (
            <div className="grid gap-5 md:grid-cols-2">
              {d.womenInTrade.length > 0 && (
                <Card className="space-y-3 p-5">
                  <Heading>Women in trade</Heading>
                  <ul className="space-y-2 text-sm text-ink">
                    {d.womenInTrade.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                        {line}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {(d.targetMarkets.length > 0 || d.seeking) && (
                <Card className="space-y-3 p-5">
                  <Heading>Growth markets</Heading>
                  {d.targetMarkets.length > 0 && (
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Target markets</p>
                      {d.targetMarkets.map((m) => (
                        <p key={m.label} className="text-ink-2">
                          <strong className="text-ink">{m.label}:</strong> {m.places.join(" · ")}
                        </p>
                      ))}
                    </div>
                  )}
                  {d.seeking && (
                    <div className="space-y-1 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Seeking</p>
                      <p className="text-ink-2">{d.seeking}</p>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-[1fr_1fr_1fr]">
            <Card className="space-y-3 p-5">
              <Heading>Entrust checks</Heading>
              {d.checks.length === 0 ? (
                <p className="text-sm text-ink-3">No checks are listed.</p>
              ) : (
                <ul className="space-y-2 text-sm text-ink">
                  {d.checks.map((check) => (
                    <li key={check} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                      {check}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="space-y-3 p-5">
              <Heading>Scan to verify</Heading>
              <Qr value={address} label={`QR code that opens this page, passport ${p.passportId}`} />
              <p className="break-all text-xs text-ink-3">{address}</p>
            </Card>
            {(d.website || d.email || d.phones.length > 0 || d.address) && (
              <Card className="space-y-3 p-5 text-sm">
                <Heading>Contact</Heading>
                {d.website && (
                  <p>
                    <span className="block text-xs text-ink-3">Website</span>
                    <a href={withProtocol(d.website)} rel="noopener noreferrer" className="font-semibold text-brand-700 underline-offset-4 hover:underline">
                      {d.website}
                    </a>
                  </p>
                )}
                {d.email && (
                  <p>
                    <span className="block text-xs text-ink-3">Email</span>
                    <a href={`mailto:${d.email}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                      {d.email}
                    </a>
                  </p>
                )}
                {d.phones.length > 0 && (
                  <p>
                    <span className="block text-xs text-ink-3">Telephone</span>
                    {d.phones.map((phone) => (
                      <a key={phone} href={telHref(phone)} className="block font-semibold text-ink">
                        {phone}
                      </a>
                    ))}
                  </p>
                )}
                {d.address && (
                  <p>
                    <span className="block text-xs text-ink-3">Address</span>
                    <span className="font-semibold text-ink">{d.address}</span>
                  </p>
                )}
              </Card>
            )}
          </div>
        </>
      )}

      <p className="text-center text-xs text-ink-3">
        <span className={p.tier === "bronze" ? "font-bold text-ink" : ""}>Bronze · legitimate</span> | <span className={p.tier === "silver" ? "font-bold text-ink" : ""}>Silver · trade-ready</span> |{" "}
        <span className={p.tier === "gold" ? "font-bold text-ink" : ""}>Gold · export-capable</span>
      </p>
    </>
  );
}
