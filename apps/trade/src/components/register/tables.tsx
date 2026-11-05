import type { ReactNode } from "react";
import Link from "next/link";
import { StatusBadge } from "@entrust/ui";
import type { RegisterItem } from "@/lib/register";
import { PRIORITY, amount, orDash, readiness, registerPhoneHref, yesNo } from "./format";

// The four views of the register, one per sheet of the workbook it comes from. Each is a plain table that scrolls sideways on a
// phone, with the business in the first column so a row can still be read.

function Table({ label, head, children }: { label: string; head: { text: string; right?: boolean }[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-canvas text-xs font-semibold uppercase tracking-wide text-ink-3">
          <tr>
            {head.map((h) => (
              <th key={h.text} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${h.right ? "text-right" : ""}`}>
                {h.text}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function Business({ item }: { item: RegisterItem }) {
  return (
    <th scope="row" className="min-w-[200px] px-3 py-3 text-left align-top font-normal">
      <Link
        href={`/register/${item.id}`}
        className="block font-semibold text-brand-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-brand-500"
      >
        {item.companyName}
      </Link>
      <span className="block text-xs text-ink-2">{item.participantName ?? "No contact recorded"}</span>
      <span className="block text-xs text-ink-3">{item.code}</span>
    </th>
  );
}

const Td = ({ children, right }: { children: ReactNode; right?: boolean }) => (
  <td className={`px-3 py-3 align-top text-ink-2 ${right ? "text-right tabular-nums" : ""}`}>{children}</td>
);

function Level({ item }: { item: RegisterItem }) {
  const r = readiness(item.financeReadinessLevel);
  return <StatusBadge tone={r.tone}>{r.label}</StatusBadge>;
}

export function RegisterTable({ items }: { items: RegisterItem[] }) {
  return (
    <Table
      label="Businesses in the register"
      head={[{ text: "Business" }, { text: "Location" }, { text: "Staff", right: true }, { text: "Export licence" }, { text: "Bank" }, { text: "Product" }, { text: "Markets" }, { text: "Monthly revenue (ETB)", right: true }]}
    >
      {items.map((item) => (
        <tr key={item.id}>
          <Business item={item} />
          <Td>{orDash(item.location)}</Td>
          <Td right>{orDash(item.employees)}</Td>
          <Td>{yesNo(item.exportLicence)}</Td>
          <Td>{orDash(item.currentBank)}</Td>
          <Td>{orDash(item.mainProduct)}</Td>
          <Td>
            {orDash(item.currentMarkets)}
            {item.targetExportMarket && <span className="block text-xs text-ink-3">Target: {item.targetExportMarket}</span>}
          </Td>
          <Td right>{amount(item.averageMonthlyRevenue)}</Td>
        </tr>
      ))}
    </Table>
  );
}

export function ReadinessTable({ items }: { items: RegisterItem[] }) {
  return (
    <Table
      label="Export readiness scores, 1 to 5 each"
      head={[{ text: "Business" }, { text: "Costing", right: true }, { text: "Capacity", right: true }, { text: "Documents", right: true }, { text: "Records", right: true }, { text: "Market", right: true }, { text: "Score (of 25)", right: true }, { text: "Level" }]}
    >
      {items.map((item) => (
        <tr key={item.id}>
          <Business item={item} />
          <Td right>{orDash(item.costingKnowledge)}</Td>
          <Td right>{orDash(item.productionCapacityStrength)}</Td>
          <Td right>{orDash(item.documentationKnowledge)}</Td>
          <Td right>{orDash(item.financialRecordKeeping)}</Td>
          <Td right>{orDash(item.marketReadiness)}</Td>
          <Td right>
            <span className="font-semibold text-ink">{orDash(item.exportReadinessScore)}</span>
          </Td>
          <Td>
            <Level item={item} />
          </Td>
        </tr>
      ))}
    </Table>
  );
}

/** Largest gap first, since that is the order a finance conversation goes in. */
export function FinanceTable({ items }: { items: RegisterItem[] }) {
  const sorted = [...items].sort((a, b) => (b.totalCapitalGap ?? -1) - (a.totalCapitalGap ?? -1) || a.code.localeCompare(b.code));
  return (
    <Table
      label="Finance pipeline, largest capital gap first"
      head={[{ text: "Business" }, { text: "Bank" }, { text: "Monthly revenue (ETB)", right: true }, { text: "Working capital", right: true }, { text: "Equipment", right: true }, { text: "Export logistics", right: true }, { text: "Capital gap (ETB)", right: true }, { text: "Priority" }, { text: "Readiness" }, { text: "Existing loan" }, { text: "Cash flow" }, { text: "Bank opportunity" }]}
    >
      {sorted.map((item) => (
        <tr key={item.id}>
          <Business item={item} />
          <Td>{orDash(item.currentBank)}</Td>
          <Td right>{amount(item.averageMonthlyRevenue)}</Td>
          <Td right>{amount(item.workingCapitalGap)}</Td>
          <Td right>{amount(item.equipmentInvestmentNeeded)}</Td>
          <Td right>{amount(item.exportLogisticsGap)}</Td>
          <Td right>
            <span className="font-semibold text-ink">{amount(item.totalCapitalGap)}</span>
          </Td>
          <Td>{item.financePriority ? <StatusBadge tone={PRIORITY[item.financePriority].tone}>{PRIORITY[item.financePriority].label}</StatusBadge> : "–"}</Td>
          <Td>
            <Level item={item} />
          </Td>
          <Td>
            {yesNo(item.existingLoan)}
            {item.existingLoan && item.loanAmount !== null && <span className="block text-xs text-ink-3">{amount(item.loanAmount)}</span>}
          </Td>
          <Td>{orDash(item.cashflowStability)}</Td>
          <Td>{orDash(item.bankOpportunity)}</Td>
        </tr>
      ))}
    </Table>
  );
}

export function ServicesTable({ items }: { items: RegisterItem[] }) {
  return (
    <Table label="What Entrust is doing for each business" head={[{ text: "Business" }, { text: "Phone" }, { text: "Email" }, { text: "Support needed" }, { text: "Notes" }]}>
      {items.map((item) => (
        <tr key={item.id}>
          <Business item={item} />
          <Td>{item.phone ? <a className="text-brand-600 underline-offset-4 hover:underline" href={registerPhoneHref(item.phone)}>{item.phone}</a> : "–"}</Td>
          <Td>{item.email ? <a className="break-all text-brand-600 underline-offset-4 hover:underline" href={`mailto:${item.email}`}>{item.email}</a> : "–"}</Td>
          <Td>{orDash(item.entrustSupportNeeded)}</Td>
          <Td>{orDash(item.serviceNotes)}</Td>
        </tr>
      ))}
    </Table>
  );
}
