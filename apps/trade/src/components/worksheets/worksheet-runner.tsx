"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge, cn } from "@entrust/ui";
import { useAutosave } from "@/components/form-runner/use-autosave";
import type { AnswerPatch } from "@/components/form-runner/types";
import { browserApi, errorText, ok } from "@/lib/summit-api";
import {
  currencyOf,
  isShown,
  moneyText,
  resultText,
  type WorksheetDefinition,
  type WorksheetField,
  type WorksheetResult,
  type WorksheetTable,
  type WorksheetVersion,
} from "@/lib/worksheets";

type Values = Record<string, unknown>;

const SAVE_DELAY = 700;
const box =
  "w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25";

/**
 * The worksheet a learner fills in. Values save as they type, the result is worked out by the API and comes back with each save, and
 * a warning or a critical-failure candidate shows as soon as the answers that cause it are in. Submitting keeps the version.
 */
export function WorksheetRunner({ definition, initial }: { definition: WorksheetDefinition; initial: WorksheetVersion }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(initial.values);
  const [result, setResult] = useState<WorksheetResult>(initial.result);
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const currency = currencyOf(values);

  // The same saving as the diagnostic's forms: changes go a moment after the last one, one save at a time and in order;
  // what is waiting goes when the tab is hidden or the page is left, and the browser warns before unsaved changes go.
  const autosave = useAutosave(async (patch) => {
    const saved = await ok(browserApi().v1.trade["worksheet-versions"][":id"].values.$put({ param: { id: initial.id }, json: { values: patch } }));
    setResult(saved.result);
  }, { delayMs: SAVE_DELAY });
  const state = autosave.state.status === "error" ? "error" : autosave.state.status === "unsaved" || autosave.state.status === "saving" ? "saving" : "saved";
  const saveMessage = autosave.state.status === "error" ? autosave.state.message : undefined;

  function change(key: string, value: unknown) {
    const next = value === "" ? null : value;
    setValues((now) => {
      const copy = { ...now };
      if (next === null) delete copy[key];
      else copy[key] = next;
      return copy;
    });
    autosave.queue({ [key]: next } as AnswerPatch);
  }

  async function submit() {
    setSubmitting(true);
    setMessage(undefined);
    try {
      // Everything waiting, and any save already on its way, lands first, so the version holds what the learner sees.
      if (!(await autosave.flush())) {
        setMessage("Your last changes haven't saved yet, so it wasn't submitted. Check your connection and try again.");
        return;
      }
      await ok(browserApi().v1.trade["worksheet-versions"][":id"].submit.$post({ param: { id: initial.id } }));
      router.refresh();
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setSubmitting(false);
    }
  }

  const flagged = new Set(result.flags.flatMap((f) => f.fields));
  const problemAt = (field: string) => result.problems.find((p) => p.field === field)?.message;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
            {definition.module} · version {initial.version} · draft
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">{definition.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">{definition.description}</p>
        </div>
        <p role="status" aria-live="polite" className={cn("text-sm", state === "error" ? "text-danger" : "text-ink-3")}>
          {state === "saving" ? "Saving…" : state === "error" ? "Not saved" : "Saved"}
        </p>
      </div>

      {initial.prefilledFrom && (
        <p className="rounded-md bg-info-50 px-3 py-2 text-sm text-info">
          Some figures started from your {initial.prefilledFrom.title} (version {initial.prefilledFrom.version}). Change anything that is different for this deal.
        </p>
      )}
      {initial.basedOn && <p className="text-sm text-ink-3">Started from version {initial.basedOn.version}, which stays as you submitted it.</p>}

      <Flags flags={result.flags} />

      {definition.sections.map((section) => (
        <Card key={section.id} className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-lg font-bold text-ink">{section.title}</h2>
            {section.description && <p className="text-sm text-ink-2">{section.description}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.items.map((id) => {
              const field = definition.fields.find((f) => f.id === id);
              if (field) {
                if (!isShown(field, values)) return null;
                return (
                  <div key={id} className={cn(field.kind === "long_text" || field.kind === "checkbox" ? "sm:col-span-2" : "")}>
                    <FieldInput field={field} value={values[id]} currency={currency} flagged={flagged.has(id)} problem={problemAt(id)} onChange={(v) => change(id, v)} />
                  </div>
                );
              }
              const table = definition.tables.find((t) => t.id === id);
              if (table) {
                return (
                  <div key={id} className="sm:col-span-2">
                    <TableInput table={table} rows={Array.isArray(values[id]) ? (values[id] as Values[]) : []} computed={result.rows[id] ?? []} currency={currency} flagged={flagged} onChange={(rows) => change(id, rows)} />
                  </div>
                );
              }
              const computed = definition.computed.find((c) => c.id === id);
              if (computed) {
                const etb = result.etb[id];
                return (
                  <div key={id} className="rounded-md bg-canvas p-3">
                    <p className="text-xs font-semibold text-ink-3">{computed.label}</p>
                    <p className="font-display text-xl font-bold text-ink" aria-live="polite">
                      {resultText(computed.kind, result.computed[id], currency)}
                    </p>
                    {computed.etb && currency !== "ETB" && (
                      <p className="text-xs text-ink-3">{typeof etb === "number" ? `About ${moneyText(etb, "ETB")}` : "Enter the exchange rate and its date to see it in birr."}</p>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </Card>
      ))}

      {initial.mizan && <p className="text-xs text-ink-3">{initial.mizan.message}</p>}
      <p className="text-xs text-ink-3">These figures are self-reported until Entrust staff review them.</p>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-md">
        <Button loading={submitting} disabled={state === "saving"} onClick={submit}>
          Submit this version
        </Button>
        <p className="text-xs text-ink-3">A submitted version is kept as it is. To change it later you start the next one.</p>
        {(message ?? saveMessage) && (
          <p role="alert" className="w-full rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">
            {message ?? saveMessage}
          </p>
        )}
      </div>
    </div>
  );
}

/** Warnings for the learner, and critical-failure candidates the assessor confirms. */
export function Flags({ flags }: { flags: WorksheetResult["flags"] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Checks">
      {flags.map((f, i) => (
        <li
          key={`${f.code}-${i}`}
          role="status"
          className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", f.severity === "critical_candidate" ? "border-danger/30 bg-danger-50 text-danger" : "border-warn/30 bg-warn-50 text-warn")}
        >
          <StatusBadge tone={f.severity === "critical_candidate" ? "danger" : "warn"}>{f.severity === "critical_candidate" ? "Assessor will check" : "Check this"}</StatusBadge>
          <span>{f.message}</span>
        </li>
      ))}
    </ul>
  );
}

function FieldInput({ field, value, currency, flagged, problem, onChange }: { field: WorksheetField; value: unknown; currency: string; flagged: boolean; problem: string | undefined; onChange: (value: unknown) => void }) {
  const id = `ws-${field.id}`;
  const border = problem || flagged ? "border-danger" : "border-line-strong";
  const label = (
    <label htmlFor={id} className="text-sm font-semibold text-ink">
      {field.label}
      {field.required && <span className="text-danger"> *</span>}
      {field.kind === "money" && <span className="font-normal text-ink-3"> ({currency})</span>}
    </label>
  );
  const note = problem ? (
    <p className="text-sm text-danger">{problem}</p>
  ) : field.help ? (
    <p className="text-xs text-ink-3">{field.help}</p>
  ) : null;

  if (field.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked ? true : null)} className="size-4" />
        {field.label}
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {label}
      {field.kind === "long_text" ? (
        <textarea id={id} rows={4} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={cn(box, border)} />
      ) : field.kind === "choice" ? (
        <select id={id} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={cn(box, border, "h-10")}>
          <option value="">Choose</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : field.kind === "date" ? (
        <input id={id} type="date" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={cn(box, border, "h-10")} />
      ) : field.kind === "number" || field.kind === "money" || field.kind === "percent" ? (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="any"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={cn(box, border, "h-10")}
        />
      ) : (
        <input id={id} type="text" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} className={cn(box, border, "h-10")} />
      )}
      {note}
    </div>
  );
}

function TableInput({ table, rows, computed, currency, flagged, onChange }: { table: WorksheetTable; rows: Values[]; computed: Record<string, ResultCell>[]; currency: string; flagged: Set<string>; onChange: (rows: Values[]) => void }) {
  const shown = Math.max(rows.length, table.minRows ?? 0);
  const full = table.maxRows !== null && shown >= table.maxRows;
  const set = (i: number, column: string, value: unknown) => {
    const next = Array.from({ length: shown }, (_, k) => ({ ...(rows[k] ?? {}) }));
    const row = next[i]!;
    if (value === null || value === "") delete row[column];
    else row[column] = value;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">{table.label}</h3>
      <div className="relative overflow-x-auto rounded-md border border-line">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-canvas text-xs font-semibold text-ink-2">
            <tr>
              <th className="w-8 px-2 py-2">#</th>
              {table.columns.map((c) => (
                <th key={c.id} className="px-2 py-2">
                  {c.label}
                  {c.kind === "money" ? ` (${currency})` : ""}
                </th>
              ))}
              {table.computedColumns.map((c) => (
                <th key={c.id} className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              <th className="w-8 px-2 py-2">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {Array.from({ length: shown }, (_, i) => {
              const row = rows[i] ?? {};
              return (
                <tr key={i} className="align-top">
                  <td className="px-2 py-2 text-ink-3">{i + 1}</td>
                  {table.columns.map((c) => {
                    const cell = row[c.id];
                    const bad = flagged.has(`${table.id}.${i}.${c.id}`) || (flagged.has(table.id) && c.kind === "money");
                    const cls = cn(box, "h-9 px-2", bad ? "border-danger" : "border-line-strong");
                    return (
                      <td key={c.id} className="px-2 py-1.5">
                        {c.kind === "choice" ? (
                          <select aria-label={`${c.label}, row ${i + 1}`} value={typeof cell === "string" ? cell : ""} onChange={(e) => set(i, c.id, e.target.value)} className={cls}>
                            <option value="">Choose</option>
                            {c.options?.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : c.kind === "date" ? (
                          <input aria-label={`${c.label}, row ${i + 1}`} type="date" value={typeof cell === "string" ? cell : ""} onChange={(e) => set(i, c.id, e.target.value)} className={cls} />
                        ) : c.kind === "money" || c.kind === "number" || c.kind === "percent" ? (
                          <input
                            aria-label={`${c.label}, row ${i + 1}`}
                            type="number"
                            inputMode="decimal"
                            step="any"
                            value={typeof cell === "number" ? cell : ""}
                            onChange={(e) => set(i, c.id, e.target.value === "" ? null : Number(e.target.value))}
                            className={cls}
                          />
                        ) : (
                          <input aria-label={`${c.label}, row ${i + 1}`} type="text" value={typeof cell === "string" ? cell : ""} onChange={(e) => set(i, c.id, e.target.value)} className={cls} />
                        )}
                      </td>
                    );
                  })}
                  {table.computedColumns.map((c) => (
                    <td key={c.id} className="whitespace-nowrap px-2 py-2 text-ink-2">
                      {resultText(c.kind, computed[i]?.[c.id], currency)}
                    </td>
                  ))}
                  <td className="px-1 py-1.5">
                    {shown > (table.minRows ?? 0) && (
                      <button
                        type="button"
                        aria-label={`Remove row ${i + 1}`}
                        className="rounded p-1 text-ink-3 hover:bg-canvas hover:text-danger"
                        onClick={() => onChange(Array.from({ length: shown }, (_, k) => rows[k] ?? {}).filter((_, k) => k !== i))}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!full && (
        <Button size="sm" variant="secondary" onClick={() => onChange([...Array.from({ length: shown }, (_, k) => rows[k] ?? {}), {}])}>
          Add a row
        </Button>
      )}
    </div>
  );
}

type ResultCell = number | string | null;
