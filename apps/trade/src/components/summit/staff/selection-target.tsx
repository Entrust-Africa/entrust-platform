"use client";

import { useState } from "react";
import { Button, Card } from "@entrust/ui";
import { countryName } from "@/lib/summit";
import { browserApi, ok } from "@/lib/summit-api";
import type { Dashboard } from "@/lib/summit-staff";
import { Outcome, useAction } from "./use-action";

/** The committee's planning target: how many applicants to select from each country. A country with no figure of its own takes the default. */
export function SelectionTarget({ dashboard, canEdit }: { dashboard: Dashboard; canEdit: boolean }) {
  const save = useAction();
  const [perCountry, setPerCountry] = useState(String(dashboard.target.perCountry));
  const [own, setOwn] = useState<Record<string, string>>(Object.fromEntries(dashboard.period.countries.map((c) => [c, dashboard.target.overrides[c] === undefined ? "" : String(dashboard.target.overrides[c])])));
  const countries = Object.fromEntries(dashboard.period.countries.map((c) => [c, own[c] === "" || own[c] === undefined ? null : Number(own[c])]));
  const valid = Number.isInteger(Number(perCountry)) && Object.values(countries).every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 1000));
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-ink">Selection target</h2>
      <p className="text-sm text-ink-2">
        {dashboard.target.selected} selected of {dashboard.target.total} planned{dashboard.target.remaining > 0 ? `, ${dashboard.target.remaining} to go` : ""}.
      </p>
      {canEdit ? (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
            Default for each country
            <input type="number" min={0} max={1000} value={perCountry} onChange={(e) => setPerCountry(e.target.value)} className="h-9 w-24 rounded-md border border-line-strong bg-surface px-2 text-sm font-normal" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dashboard.period.countries.map((c) => (
              <label key={c} className="flex items-center justify-between gap-2 rounded-md bg-canvas px-3 py-2 text-sm text-ink">
                {countryName(c)}
                <input
                  type="number"
                  min={0}
                  max={1000}
                  placeholder={perCountry}
                  aria-label={`Target for ${countryName(c)}`}
                  value={own[c] ?? ""}
                  onChange={(e) => setOwn({ ...own, [c]: e.target.value })}
                  className="h-9 w-20 rounded-md border border-line-strong bg-surface px-2 text-sm"
                />
              </label>
            ))}
          </div>
          <Button size="sm" loading={save.busy} disabled={!valid} onClick={() => save.run(() => ok(browserApi().v1.summit.periods[":id"]["selection-target"].$put({ param: { id: dashboard.period.id }, json: { perCountry: Number(perCountry), countries } })), "Target saved.")}>
            Save the target
          </Button>
          <Outcome error={save.error} done={save.done} />
        </>
      ) : (
        <p className="text-sm text-ink-3">The committee sets the target.</p>
      )}
    </Card>
  );
}
