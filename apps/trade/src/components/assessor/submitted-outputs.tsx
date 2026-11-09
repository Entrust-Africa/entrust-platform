import { WORKSHEET_DEFINITIONS } from "@entrust/trade-engine";
import type { LearnerModuleData } from "../modules/module-viewer";

interface SubmittedOutput {
  id: string;
  worksheetId: string;
  title: string;
  version: number;
  values: Record<string, unknown>;
  result?: { computed?: Record<string, unknown>; flags?: { code: string; message: string }[] } | null;
}

/** A choice field's stored answer is its value, so it needs its options to read back in words. */
interface Field {
  kind?: string;
  options?: readonly { value: string; label: string }[] | undefined;
}

const blank = (value: unknown) => value === null || value === undefined || value === "";

function answer(field: Field, value: unknown): string {
  if (blank(value)) return "Not answered";
  if (field.kind === "checkbox") return value === true ? "Yes" : "No";
  if (field.kind === "choice") return field.options?.find((o) => o.value === value)?.label ?? String(value);
  return String(value);
}

/** Each output the learner submitted, read the way they filled it in: the questions in words, and tables as tables. */
export function SubmittedOutputs({ outputs, module }: { outputs: SubmittedOutput[]; module: LearnerModuleData }) {
  // Content worksheets are published as "m05-ideal-buyer-profile" from the module's "ideal_buyer_profile".
  const definition = (worksheetId: string) => module.worksheets.find((w) => `${module.module.toLowerCase()}-${w.id.replaceAll("_", "-")}` === worksheetId) ?? WORKSHEET_DEFINITIONS.find((d) => d.id === worksheetId);

  return (
    <div className="space-y-2">
      {outputs.map((output, index) => {
        const def = definition(output.worksheetId);
        return (
          <details key={output.id} open={index === 0} className="rounded-md border border-line bg-canvas/30 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              {output.title} <span className="font-normal text-ink-3">(version {output.version})</span>
            </summary>
            {def ? (
              <div className="mt-3 space-y-3">
                {(def.fields ?? []).length > 0 && (
                  <dl className="space-y-2">
                    {(def.fields ?? []).map((field) => (
                      <div key={field.id}>
                        <dt className="text-xs font-semibold text-ink-3">{field.label}</dt>
                        <dd className={`whitespace-pre-wrap break-words text-sm ${blank(output.values[field.id]) ? "text-ink-3" : "text-ink"}`}>{answer(field, output.values[field.id])}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {(def.tables ?? []).map((table) => {
                  const rows = Array.isArray(output.values[table.id]) ? (output.values[table.id] as Record<string, unknown>[]) : [];
                  return (
                    <div key={table.id}>
                      <p className="text-xs font-semibold text-ink-3">{table.label}</p>
                      {rows.length === 0 ? (
                        <p className="text-sm text-ink-3">No rows</p>
                      ) : (
                        <ol className="mt-1 space-y-2">
                          {rows.map((row, r) => (
                            <li key={r} className="rounded border border-line bg-surface p-2">
                              <p className="text-xs font-semibold text-ink-3">Row {r + 1}</p>
                              <dl className="mt-1 space-y-1">
                                {table.columns
                                  .filter((column) => !blank(row[column.id]))
                                  .map((column) => (
                                    <div key={column.id}>
                                      <dt className="inline text-xs font-semibold text-ink-3">{column.label}: </dt>
                                      <dd className="inline break-words text-sm text-ink">{answer(column, row[column.id])}</dd>
                                    </div>
                                  ))}
                              </dl>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <pre className="mt-2 overflow-x-auto text-xs text-ink-2">{JSON.stringify(output.values, null, 1)}</pre>
            )}
            {output.result?.computed && Object.keys(output.result.computed).length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-ink-3">Worked out from these figures</p>
                <dl className="mt-1 space-y-1">
                  {Object.entries(output.result.computed).map(([key, value]) => (
                    <div key={key} className="flex flex-wrap justify-between gap-2 text-xs">
                      <dt className="break-all font-mono text-ink-2">{key}</dt>
                      <dd className="font-semibold text-ink">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {(output.result?.flags ?? []).map((flag) => (
              <p key={flag.code} className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                {flag.message}
              </p>
            ))}
          </details>
        );
      })}
    </div>
  );
}
