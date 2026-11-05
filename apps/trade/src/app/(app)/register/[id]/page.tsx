import Link from "next/link";
import { READINESS_SCORES } from "@entrust/trade-engine";
import { Card, StatusBadge } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { BackLink, Fact, Section, isLong, linkClass } from "@/components/register/detail-parts";
import { PRIORITY, amount, formatDay, orDash, readiness, registerPhoneHref, yesNo } from "@/components/register/format";

export const metadata = { title: "SME details" };

/** One business in the SME register: everything Entrust recorded about it, with the figures worked out. Staff only. */
export default async function RegisterRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/register/${id}`;
  const me = await requireUser(path);
  if (!me.staffRole) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-ink">This page is for Entrust staff</h1>
          <p className="mt-3 text-sm text-ink-2">It holds what Entrust recorded about a business in the pilot.</p>
        </Card>
      </div>
    );
  }

  const sme = await load(path, (api) => ok(api.v1.trade.register[":id"].$get({ param: { id } })));
  const level = readiness(sme.financeReadinessLevel);
  const priority = sme.financePriority ? PRIORITY[sme.financePriority] : null;

  return (
    <div className="space-y-6">
      <BackLink href="/register">SME register</BackLink>

      <header>
        <h1 className="break-words font-display text-2xl font-bold text-ink">{sme.companyName}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {sme.participantName ?? "No contact recorded"} · <span className="font-mono text-ink-3">{sme.code}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone={level.tone}>{sme.exportReadinessScore === null ? level.label : `${level.label} readiness · ${sme.exportReadinessScore}/25`}</StatusBadge>
          {priority && <StatusBadge tone={priority.tone}>{priority.label}</StatusBadge>}
        </div>
      </header>

      {sme.alsoApplied.length > 0 && (
        <Card className="p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold text-ink">Also applied to a programme</h2>
          <p className="mt-1 text-sm text-ink-2">A response from the same phone number or email address.</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {sme.alsoApplied.map((a) => (
              <li key={a.id}>
                <Link href={`/register/applications/${a.id}`} className={`font-semibold ${linkClass}`}>
                  {a.businessName}
                </Link>
                <span className="text-ink-3">
                  {" "}
                  · {a.program} · {formatDay(a.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section id="contact" title="Contact and business">
          <Fact label="Location">{orDash(sme.location)}</Fact>
          <Fact label="Year established">{orDash(sme.yearEstablished)}</Fact>
          <Fact label="Phone">{sme.phone ? <a className={linkClass} href={registerPhoneHref(sme.phone)}>{sme.phone}</a> : "–"}</Fact>
          <Fact label="Email">{sme.email ? <a className={`break-all ${linkClass}`} href={`mailto:${sme.email}`}>{sme.email}</a> : "–"}</Fact>
          <Fact label="Staff">{orDash(sme.employees)}</Fact>
          <Fact label="Export licence">{yesNo(sme.exportLicence)}</Fact>
          <Fact label="Main product" wide={isLong(sme.mainProduct)}>{orDash(sme.mainProduct)}</Fact>
          <Fact label="Markets now">{orDash(sme.currentMarkets)}</Fact>
          <Fact label="Target export market">{orDash(sme.targetExportMarket)}</Fact>
        </Section>

        <Section id="trading" title="Production and trading">
          <Fact label="Monthly production capacity">{amount(sme.monthlyProductionCapacity)}</Fact>
          <Fact label="Average monthly revenue (ETB)">{amount(sme.averageMonthlyRevenue)}</Fact>
          <Fact label="Largest order completed (ETB)">{amount(sme.largestOrderCompleted)}</Fact>
          <Fact label="Monthly operating cost (ETB)">{amount(sme.monthlyOperatingCost)}</Fact>
          <Fact label="Estimated monthly profit (ETB)">{amount(sme.estimatedMonthlyProfit)}</Fact>
        </Section>

        <Section id="finance" title="Finance">
          <Fact label="Bank">{orDash(sme.currentBank)}</Fact>
          <Fact label="Cash flow">{orDash(sme.cashflowStability)}</Fact>
          <Fact label="Existing loan">
            {yesNo(sme.existingLoan)}
            {sme.existingLoan && sme.loanAmount !== null && ` · ${amount(sme.loanAmount)} ETB`}
          </Fact>
          <Fact label="Bank opportunity" wide={isLong(sme.bankOpportunity)}>{orDash(sme.bankOpportunity)}</Fact>
          <Fact label="Working capital gap (ETB)">{amount(sme.workingCapitalGap)}</Fact>
          <Fact label="Equipment investment needed (ETB)">{amount(sme.equipmentInvestmentNeeded)}</Fact>
          <Fact label="Export logistics gap (ETB)">{amount(sme.exportLogisticsGap)}</Fact>
          <Fact label="Total capital gap (ETB)">
            <span className="font-semibold">{amount(sme.totalCapitalGap)}</span>
          </Fact>
        </Section>

        <Card className="p-4 sm:p-5">
          <section aria-labelledby="readiness">
            <h2 id="readiness" className="font-display text-lg font-bold text-ink">
              Export readiness
            </h2>
            <ul className="mt-3 space-y-2.5">
              {READINESS_SCORES.map(({ key, label }) => {
                const score = sme[key];
                return (
                  <li key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-2">{label}</span>
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} className={`h-2 w-5 rounded-sm ${score !== null && n <= score ? "bg-brand-600" : "bg-line"}`} />
                        ))}
                      </span>
                      <span className="w-12 text-right tabular-nums text-ink">{score === null ? "–" : `${score} of 5`}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <span className="font-semibold text-ink">Score</span>
              <span className="tabular-nums text-ink">
                <span className="font-semibold">{sme.exportReadinessScore ?? "–"}</span> of 25
                <span className="ml-2 text-ink-3">{sme.exportReadinessScore === null ? "Needs all five scores" : `${level.label} readiness`}</span>
              </span>
            </p>
          </section>
        </Card>

        <Section id="services" title="What Entrust is doing" wide>
          <Fact label="Support needed" wide={isLong(sme.entrustSupportNeeded)}>{orDash(sme.entrustSupportNeeded)}</Fact>
          <Fact label="Notes" wide={isLong(sme.serviceNotes)}>{orDash(sme.serviceNotes)}</Fact>
        </Section>
      </div>

      <p className="text-xs text-ink-3">Last updated {formatDay(sme.updatedAt)}. Amounts are in birr. Only Entrust staff see this page; a sponsor sees none of it unless the business agrees to share it.</p>
    </div>
  );
}
