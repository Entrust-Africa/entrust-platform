import { Download } from "lucide-react";
import { Card } from "@entrust/ui";
import { ok, apiUrl } from "@/lib/summit-api";
import { load } from "@/lib/summit-server";
import { NoEdition, PageTitle } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS reports" };

const FORMATS = [
  ["xlsx", "Excel"],
  ["csv", "CSV"],
  ["pdf", "PDF"],
] as const;

export default async function ReportsPage() {
  const [{ items }, editions] = await Promise.all([
    load("/summit/commerce/reports", (api) => ok(api.v1.summit.commerce.reports.$get())),
    load("/summit/commerce/reports", (api) => ok(api.v1.summit.commerce.editions.$get())),
  ]);
  // Every report is of an edition, so with none a download would only fail.
  if (editions.items.length === 0) return <NoEdition />;
  return (
    <div className="space-y-5">
      <PageTitle title="Reports" intro="Each report is made when you ask for it, from the live records, for the current edition. They hold personal details, so keep the files safe. Every download is logged." />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((report) => (
          <Card key={report.id} className="space-y-3 p-4 sm:p-5">
            <div>
              <h2 className="font-display text-xl font-bold text-ink">{report.title}</h2>
              <p className="mt-1 text-sm text-ink-2">{report.purpose}</p>
              <p className="mt-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">{report.classification}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map(([format, label]) => (
                <a
                  key={format}
                  href={`${apiUrl}/v1/summit/commerce/reports/${report.id}?format=${format}`}
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2"
                >
                  <Download aria-hidden className="size-4" /> {label}
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
