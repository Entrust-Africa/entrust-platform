import { Card } from "@entrust/ui";
import { currencyOf, isShown, moneyText, resultText, valueText, dayText, type WorksheetDefinition, type WorksheetVersion } from "@/lib/worksheets";
import { Flags } from "./worksheet-runner";
import { PrintButton } from "@/components/assessment/print-button";
import { StartDraftButton } from "./start-draft-button";

/**
 * A worksheet version as it was kept: every answer and every result, read only. It is also the printable summary for a bank. The
 * menus are hidden when it prints, and each block stays on one page.
 */
export function WorksheetSummary({ definition, version, canStartNext }: { definition: WorksheetDefinition; version: WorksheetVersion; canStartNext: boolean }) {
  const values = version.values;
  const currency = currencyOf(values);
  const { result } = version;
  const rate = typeof values.exchange_rate === "number" && typeof values.rate_date === "string" ? `1 ${currency} = ETB ${values.exchange_rate} on ${dayText(values.rate_date)}` : null;
  return (
    <article className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            {definition.module} · version {version.version} · submitted{version.submittedAt ? ` on ${dayText(version.submittedAt.slice(0, 10))}` : ""}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{definition.title}</h1>
          <p className="mt-1 text-sm text-ink-3">
            Self-reported by the business
            {rate ? ` · ${rate}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <PrintButton label={definition.printable ? "Print the summary for the bank" : "Print or save as PDF"} />
          {canStartNext && <StartDraftButton worksheetId={definition.id} label="Start a new version to change it" variant="secondary" />}
        </div>
      </header>

      <Flags flags={result.flags} />

      {definition.sections.map((section) => (
        <Card key={section.id} className="space-y-3 p-4 sm:p-5 print:break-inside-avoid">
          <h2 className="font-display text-lg font-bold text-ink">{section.title}</h2>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {section.items.map((id) => {
              const field = definition.fields.find((f) => f.id === id);
              if (field) {
                if (!isShown(field, values)) return null;
                return (
                  <div key={id} className={field.kind === "long_text" ? "sm:col-span-2" : ""}>
                    <dt className="text-xs text-ink-3">{field.label}</dt>
                    <dd className="whitespace-pre-wrap text-ink">{valueText(field, values[id], currency)}</dd>
                  </div>
                );
              }
              const table = definition.tables.find((t) => t.id === id);
              if (table) {
                const rows = Array.isArray(values[id]) ? (values[id] as Record<string, unknown>[]) : [];
                const computed = result.rows[id] ?? [];
                return (
                  <div key={id} className="sm:col-span-2">
                    <dt className="mb-1 text-xs text-ink-3">{table.label}</dt>
                    {rows.length === 0 ? (
                      <dd className="text-ink">—</dd>
                    ) : (
                      <dd className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-sm">
                          <thead className="text-xs text-ink-2">
                            <tr>
                              {table.columns.map((c) => (
                                <th key={c.id} className="border-b border-line px-2 py-1.5 font-semibold">
                                  {c.label}
                                </th>
                              ))}
                              {table.computedColumns.map((c) => (
                                <th key={c.id} className="border-b border-line px-2 py-1.5 font-semibold">
                                  {c.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={i} className="align-top">
                                {table.columns.map((c) => (
                                  <td key={c.id} className="border-b border-line px-2 py-1.5 text-ink">
                                    {valueText(c, row[c.id], currency)}
                                  </td>
                                ))}
                                {table.computedColumns.map((c) => (
                                  <td key={c.id} className="whitespace-nowrap border-b border-line px-2 py-1.5 text-ink-2">
                                    {resultText(c.kind, computed[i]?.[c.id], currency)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </dd>
                    )}
                  </div>
                );
              }
              const computed = definition.computed.find((c) => c.id === id);
              if (computed) {
                const etb = result.etb[id];
                return (
                  <div key={id} className="rounded-md bg-canvas p-3 print:border print:border-line">
                    <dt className="text-xs font-semibold text-ink-3">{computed.label}</dt>
                    <dd className="font-display text-lg font-bold text-ink">{resultText(computed.kind, result.computed[id], currency)}</dd>
                    {computed.etb && currency !== "ETB" && typeof etb === "number" && <dd className="text-xs text-ink-3">About {moneyText(etb, "ETB")}</dd>}
                  </div>
                );
              }
              return null;
            })}
          </dl>
        </Card>
      ))}

      {version.mizan && <p className="text-xs text-ink-3">{version.mizan.message}</p>}
      <p className="text-xs leading-relaxed text-ink-3">
        These figures are what the business entered, worked out with TRADE's calculators. They are self-reported until Entrust staff review them, and they are not a credit assessment or a lending decision.
      </p>
    </article>
  );
}
