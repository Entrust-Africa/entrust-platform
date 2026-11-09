import Link from "next/link";
import { Card } from "@entrust/ui";
import { humanise } from "@/lib/money";

type Count = number | null;
interface Money {
  count: Count;
  amount: number | null;
}
interface Distribution {
  smes: Count;
  average: number | null;
  buckets: { bucket: string; count: Count }[];
}

export interface ProgrammeReport {
  scope: { kind: "program" | "cohort"; id: string; name: string; program: string; cohorts: { id: string; name: string }[] };
  audience: "staff" | "sponsor";
  generatedAt: string;
  minimumSmes: number;
  disclaimer: string;
  reach: { enrolled: Count; byStatus: { status: string; count: Count }[]; pathwayA: Count; pathwayB: Count };
  engagement: {
    activeWithinDays: number;
    activeLearners: Count;
    modules: { moduleId: string; started: Count; passed: Count }[];
    knowledgeChecks: { moduleId: string; attempted: Count; passed: Count; passRate: number | null }[];
    submissionsWaiting: Count;
  };
  capability: { domain: string; title: string; placement: Distribution; exit: Distribution }[];
  pipeline: { leads: Count; verifiedLeads: Count; qualifiedProspects: Count; rfqs: Count; firmOrders: Count };
  finance: {
    byCurrency: { currency: string; requests: Money; approvals: Money; disbursements: Money }[];
    fundingGap: ({ currency: string } & Money)[];
  };
  exportExecution: {
    byCurrency: { currency: string; shipments: Money; payments: Money }[];
    paymentMethods: { method: string; count: Count }[];
  };
  smes: {
    organizationId: string;
    name: string;
    smeId: string | null;
    cohort: string;
    cohortId: string;
    status: string;
    pathway: string | null;
    pathwayEvidence: "self_reported" | "verified" | null;
    placementAverage: number | null;
    exitAverage: number | null;
    modulesStarted: Count;
    modulesPassed: Count;
    submissionsWaiting: Count;
    leads: Count;
    firmOrders: Count;
  }[];
}

const HIDDEN = "Under 5";
const display = (value: Count): string => (value === null ? HIDDEN : value.toLocaleString("en-GB"));
const moneyText = (currency: string, money: Money): string => (money.amount === null ? HIDDEN : `${currency} ${money.amount.toLocaleString("en-GB")}`);
const BUCKET_LABELS: Record<string, string> = { below_40: "Below 40", "40_to_59": "40 to 59", "60_to_79": "60 to 79", "80_and_above": "80 and above" };

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-xl font-bold text-ink">{value}</dd>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 p-5">
      <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink-2">{note}</p>}
      <div className="mt-4 space-y-5">{children}</div>
    </Card>
  );
}

function Table({ caption, headers, rows }: { caption: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-xs text-ink-3">
            {headers.map((h) => (
              <th key={h} scope="col" className="py-2 pr-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium text-ink" : "text-ink-2"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const None = ({ children }: { children: string }) => <p className="text-sm text-ink-2">{children}</p>;

export function ReportView({ report }: { report: ProgrammeReport }) {
  const { reach, engagement, capability, pipeline, finance, exportExecution, smes } = report;
  const isSponsor = report.audience === "sponsor";
  const startedModules = engagement.modules.filter((m) => m.started !== 0 || m.passed !== 0);
  const scoredDomains = capability.filter((c) => c.placement.smes !== 0 || c.exit.smes !== 0);

  return (
    <div className="space-y-6">
      {isSponsor && (
        <p className="rounded-md bg-surface-2 p-3 text-sm text-ink-2">
          These figures name nobody. "{HIDDEN}" means a figure covers fewer than {report.minimumSmes} businesses that haven't all agreed to share it.
        </p>
      )}

      <Section title="Who took part">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="Enrolled" value={display(reach.enrolled)} />
          <Figure label="Pathway A" value={display(reach.pathwayA)} />
          <Figure label="Pathway B" value={display(reach.pathwayB)} />
          <Figure label={`Active in the last ${engagement.activeWithinDays} days`} value={display(engagement.activeLearners)} />
        </dl>
        <dl className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-6">
          {reach.byStatus.map((s) => (
            <Figure key={s.status} label={humanise(s.status)} value={display(s.count)} />
          ))}
        </dl>
      </Section>

      <Section title="Learning">
        <dl className="grid grid-cols-2 gap-4">
          <Figure label="Submissions waiting to be scored" value={display(engagement.submissionsWaiting)} />
        </dl>
        {startedModules.length === 0 ? (
          <None>No business has started a module yet.</None>
        ) : (
          <Table caption="Module progress" headers={["Module", "Started", "Passed"]} rows={startedModules.map((m) => [m.moduleId, display(m.started), display(m.passed)])} />
        )}
        {engagement.knowledgeChecks.length > 0 && (
          <Table
            caption="Knowledge checks"
            headers={["Knowledge check", "Businesses that tried", "Passed", "Pass rate"]}
            rows={engagement.knowledgeChecks.map((k) => [k.moduleId, display(k.attempted), display(k.passed), k.passRate === null ? HIDDEN : `${k.passRate}%`])}
          />
        )}
      </Section>

      <Section title="Capability" note="Scores out of 100 for each domain, at placement and at exit.">
        {scoredDomains.length === 0 ? (
          <None>No placement or exit assessment has been scored yet.</None>
        ) : (
          <Table
            caption="Capability scores by domain"
            headers={["Domain", "Stage", "Businesses", "Average", ...Object.values(BUCKET_LABELS)]}
            rows={scoredDomains.flatMap((c) =>
              (["placement", "exit"] as const).map((stage) => {
                const d = c[stage];
                return [c.title, humanise(stage), display(d.smes), d.average === null ? "–" : String(d.average), ...d.buckets.map((b) => display(b.count))];
              }),
            )}
          />
        )}
      </Section>

      <Section title="Buyer pipeline">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Figure label="Leads" value={display(pipeline.leads)} />
          <Figure label="Verified leads" value={display(pipeline.verifiedLeads)} />
          <Figure label="Qualified prospects" value={display(pipeline.qualifiedProspects)} />
          <Figure label="RFQs" value={display(pipeline.rfqs)} />
          <Figure label="Firm orders" value={display(pipeline.firmOrders)} />
        </dl>
      </Section>

      <Section title="Finance" note="Requested, approved and disbursed are kept apart: an approved loan isn't money received until it is disbursed.">
        {finance.byCurrency.length === 0 ? (
          <None>No financing has been recorded yet.</None>
        ) : (
          <Table
            caption="Financing by currency"
            headers={["Currency", "Requests", "Requested", "Approvals", "Approved", "Disbursements", "Disbursed"]}
            rows={finance.byCurrency.map((r) => [
              r.currency,
              display(r.requests.count),
              moneyText(r.currency, r.requests),
              display(r.approvals.count),
              moneyText(r.currency, r.approvals),
              display(r.disbursements.count),
              moneyText(r.currency, r.disbursements),
            ])}
          />
        )}
        {finance.fundingGap.length > 0 && (
          <Table caption="Funding gap from the M04 briefs" headers={["Funding gap in M04", "Businesses", "Amount"]} rows={finance.fundingGap.map((g) => [g.currency, display(g.count), moneyText(g.currency, g)])} />
        )}
      </Section>

      <Section title="Export execution" note="Goods shipped and money received are kept apart.">
        {exportExecution.byCurrency.length === 0 ? (
          <None>No shipment has been recorded yet.</None>
        ) : (
          <Table
            caption="Shipments and payments by currency"
            headers={["Currency", "Shipments", "Value shipped", "Payments", "Value paid"]}
            rows={exportExecution.byCurrency.map((r) => [r.currency, display(r.shipments.count), moneyText(r.currency, r.shipments), display(r.payments.count), moneyText(r.currency, r.payments)])}
          />
        )}
        {exportExecution.paymentMethods.length > 0 && (
          <Table caption="Payment methods from the M04 briefs" headers={["How the buyer pays", "Businesses"]} rows={exportExecution.paymentMethods.map((m) => [humanise(m.method), display(m.count)])} />
        )}
      </Section>

      <Section title={isSponsor ? "Businesses that share with you" : "Businesses"} note={isSponsor ? "Only what each owner agreed to share. Everything else shows a dash." : undefined}>
        {smes.length === 0 ? (
          <None>{isSponsor ? "No business has shared anything with you yet." : "No business is enrolled yet."}</None>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <caption className="sr-only">Businesses in this report</caption>
              <thead>
                <tr className="border-b border-line text-xs text-ink-3">
                  {["Business", "Cohort", "Status", "Pathway", "Placement", "Exit", "Modules passed", "Leads", "Firm orders"].map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {smes.map((s) => (
                  <tr key={`${s.cohortId}-${s.organizationId}`} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-4 font-medium text-ink">
                      {isSponsor ? (
                        <Link href={`/sponsor/${s.cohortId}/${encodeURIComponent(s.organizationId)}`} className="text-brand-600 hover:underline">
                          {s.name}
                        </Link>
                      ) : (
                        s.name
                      )}
                    </td>
                    <td className="py-2 pr-4 text-ink-2">{s.cohort}</td>
                    <td className="py-2 pr-4 text-ink-2">{humanise(s.status)}</td>
                    {[s.pathwayEvidence === "self_reported" ? `${s.pathway} (self-reported)` : s.pathway, s.placementAverage, s.exitAverage, s.modulesPassed, s.leads, s.firmOrders].map((v, i) => (
                      <td key={i} className="py-2 pr-4 text-ink-2">
                        {v ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {isSponsor && <p className="text-xs leading-relaxed text-ink-3">{report.disclaimer}</p>}
    </div>
  );
}
