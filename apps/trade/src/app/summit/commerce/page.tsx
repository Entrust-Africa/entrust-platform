import { ok } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { usd } from "@/lib/commerce";
import { DataTable, NoEdition, PageTitle, Section, Stat, cell } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS dashboard" };

export default async function DashboardPage() {
  const path = "/summit/commerce";
  const editions = await load(path, (api) => ok(api.v1.summit.commerce.editions.$get()));
  if (editions.items.length === 0) return <NoEdition />;
  const d = await load(path, (api) => ok(api.v1.summit.commerce.dashboard.$get({ query: {} })));
  const r = d.registrations;
  const x = d.exhibition;
  const s = d.sponsorship;
  const v = d.revenue;

  return (
    <div className="space-y-10">
      <PageTitle title={d.edition.name} intro="Everything below is added up live from registrations, bookings, enquiries and payments." />

      <Section title="Revenue" hint="Received counts only payments someone has verified. Applications and enquiries still being worked are shown as potential and are not part of the expected revenue.">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Expected" value={usd(v.expectedCents)} note="Committed payments" />
          <Stat label="Received" value={usd(v.receivedCents)} note="Verified payments" tone="ok" />
          <Stat label="Outstanding" value={usd(v.outstandingCents)} note="Not yet verified" tone={v.outstandingCents > 0 ? "warn" : undefined} />
          <Stat label="Potential" value={usd(v.potentialCents)} note="Applications and enquiries in progress" />
        </div>
        <DataTable head={["Revenue by", "Expected", "Received", "Outstanding"]}>
          {v.byStream.map((row) => (
            <tr key={row.stream}>
              <th scope="row" className={`${cell} font-semibold text-ink`}>{row.label}</th>
              <td className={cell}>{usd(row.expectedCents)}</td>
              <td className={cell}>{usd(row.receivedCents)}</td>
              <td className={cell}>{usd(row.outstandingCents)}</td>
            </tr>
          ))}
        </DataTable>
        {v.refundedCents > 0 && <p className="text-sm text-ink-2">Refunded so far: {usd(v.refundedCents)}.</p>}
        {v.byProduct.length > 0 && (
          <DataTable head={["Item", "Stream", "Payments", "Expected", "Received", "Outstanding"]}>
            {v.byProduct.map((row) => (
              <tr key={row.productId}>
                <th scope="row" className={`${cell} font-semibold text-ink`}>{row.name}</th>
                <td className={cell}>{row.stream}</td>
                <td className={cell}>{row.count}</td>
                <td className={cell}>{usd(row.expectedCents)}</td>
                <td className={cell}>{usd(row.receivedCents)}</td>
                <td className={cell}>{usd(row.outstandingCents)}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </Section>

      <Section title="Registrations" hint={d.edition.expectedAttendance ? `Expected attendance: ${d.edition.expectedAttendance}.` : undefined}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Registered" value={r.total} />
          <Stat label="Confirmed" value={r.confirmed} note="Payment verified" tone="ok" />
          <Stat label="Pending" value={r.pending} note="Payment not verified" tone={r.pending > 0 ? "warn" : undefined} />
          <Stat label="Cancelled" value={r.cancelled} />
          <Stat label="Checked in" value={r.checkedIn} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <DataTable compact head={["Category", "Registered", "Confirmed"]}>
            {r.byCategory.map((c) => (
              <tr key={c.productId}>
                <th scope="row" className={`${cell} font-semibold text-ink`}>{c.name}</th>
                <td className={cell}>{c.registered}</td>
                <td className={cell}>{c.confirmed}</td>
              </tr>
            ))}
          </DataTable>
          <DataTable compact head={["Country", "Delegates"]} empty="No registrations yet.">
            {r.byCountry.map((c) => (
              <tr key={c.country}>
                <th scope="row" className={`${cell} font-semibold text-ink`}>{c.name}</th>
                <td className={cell}>{c.count}</td>
              </tr>
            ))}
          </DataTable>
          <DataTable compact head={["Sector", "Delegates"]} empty="No registrations yet.">
            {r.bySector.map((c) => (
              <tr key={c.sector}>
                <th scope="row" className={`${cell} font-semibold text-ink`}>{c.sector}</th>
                <td className={cell}>{c.count}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      </Section>

      <Section title="Exhibition" hint={x.capacitySet ? undefined : "Some packages have no number of booths yet, so the totals below are partial. Set them in Settings."}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Total booths" value={x.totalBooths ?? "Not set"} />
          <Stat label="Available" value={x.available ?? "Not set"} />
          <Stat label="Waiting for a decision" value={x.submitted} tone={x.submitted > 0 ? "warn" : undefined} />
          <Stat label="Reserved" value={x.reserved} note="Approved, not yet paid" />
          <Stat label="Paid and confirmed" value={x.confirmed} tone="ok" />
        </div>
        <DataTable head={["Package", "Booths", "Waiting", "Reserved", "Confirmed", "Left"]}>
          {x.byPackage.map((p) => (
            <tr key={p.productId}>
              <th scope="row" className={`${cell} font-semibold text-ink`}>
                {p.name} {p.soldOut && <span className="ml-1 rounded-sm bg-danger-50 px-1.5 py-0.5 text-xs font-semibold text-danger">Sold out</span>}
              </th>
              <td className={cell}>{p.capacity ?? "Not set"}</td>
              <td className={cell}>{p.submitted}</td>
              <td className={cell}>{p.reserved}</td>
              <td className={cell}>{p.confirmed}</td>
              <td className={cell}>{p.available ?? "No limit"}</td>
            </tr>
          ))}
        </DataTable>
      </Section>

      <Section title="Sponsorship">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Enquiries" value={s.enquiries} />
          <Stat label="Confirmed sponsors" value={s.confirmed} tone="ok" />
          <Stat label="Sponsorship value" value={usd(s.valueCents)} note="Confirmed" tone="ok" />
          <Stat label="Pipeline" value={usd(s.pipelineValueCents)} note={`${s.pipelineCount} still open`} />
        </div>
        <DataTable head={["Level or opportunity", "Enquiries", "Confirmed", "Confirmed value", "Open value"]}>
          {s.byProduct.map((p) => (
            <tr key={p.productId}>
              <th scope="row" className={`${cell} font-semibold text-ink`}>{p.name}</th>
              <td className={cell}>{p.enquiries}</td>
              <td className={cell}>{p.confirmed}</td>
              <td className={cell}>{usd(p.confirmedValueCents)}</td>
              <td className={cell}>{usd(p.openValueCents)}</td>
            </tr>
          ))}
        </DataTable>
      </Section>
    </div>
  );
}
