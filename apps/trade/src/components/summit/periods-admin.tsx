"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { staffInput } from "@/components/form-runner/styles";
import { browserApi, errorText, ok } from "@/lib/summit-api";
import { countryName, formatDateTime, type SummitPeriod } from "@/lib/summit";

const STATE: Record<SummitPeriod["state"], { tone: "ok" | "info" | "idle"; label: string }> = {
  open: { tone: "ok", label: "Open" },
  upcoming: { tone: "info", label: "Not open yet" },
  closed: { tone: "idle", label: "Closed" },
};

/** An ISO time as the value of a datetime-local input, in the device's time zone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Country codes typed as "ET, KE gh" become ["ET", "KE", "GH"]; anything that isn't two letters is reported. */
function parseCountries(text: string): { codes: string[]; bad: string[] } {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const codes = [...new Set(parts.filter((p) => /^[A-Za-z]{2}$/.test(p)).map((p) => p.toUpperCase()))];
  return { codes, bad: parts.filter((p) => !/^[A-Za-z]{2}$/.test(p)) };
}

function PeriodForm({ period, onDone }: { period?: SummitPeriod; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(period?.name ?? "");
  const [opensAt, setOpensAt] = useState(period ? toLocalInput(period.opensAt) : "");
  const [closesAt, setClosesAt] = useState(period ? toLocalInput(period.closesAt) : "");
  const [countries, setCountries] = useState(period?.countries.join(", ") ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const parsed = parseCountries(countries);

  async function save() {
    setError(undefined);
    if (parsed.bad.length) return setError(`These are not two-letter country codes: ${parsed.bad.join(", ")}.`);
    if (parsed.codes.length === 0) return setError("Add at least one country.");
    if (!opensAt || !closesAt) return setError("Choose when applications open and close.");
    const body = { name: name.trim(), opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString(), countries: parsed.codes };
    setPending(true);
    try {
      const api = browserApi().v1.summit.periods;
      if (period) await ok(api[":id"].$patch({ param: { id: period.id }, json: body }));
      else await ok(api.$post({ json: body }));
      router.refresh();
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }

  const id = period?.id ?? "new";
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={`p-name-${id}`} className="block text-base font-semibold text-ink">
          Name
        </label>
        <input id={`p-name-${id}`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} placeholder="ADTIS 2027 applications" className={staffInput(false)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`p-open-${id}`} className="block text-base font-semibold text-ink">
            Opens
          </label>
          <input id={`p-open-${id}`} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required className={staffInput(false)} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`p-close-${id}`} className="block text-base font-semibold text-ink">
            Closes
          </label>
          <input id={`p-close-${id}`} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} required className={staffInput(false)} />
        </div>
      </div>
      <p className="text-sm text-ink-3">Times are in your device's time zone.</p>
      <div className="space-y-1.5">
        <label htmlFor={`p-countries-${id}`} className="block text-base font-semibold text-ink">
          Countries that can apply
        </label>
        <input
          id={`p-countries-${id}`}
          value={countries}
          onChange={(e) => setCountries(e.target.value)}
          required
          placeholder="ET, KE, GH"
          aria-describedby={`p-countries-hint-${id}`}
          className={staffInput(parsed.bad.length > 0)}
        />
        <p id={`p-countries-hint-${id}`} className="text-sm text-ink-3">
          {parsed.codes.length > 0 ? parsed.codes.map(countryName).join(", ") : "Two-letter codes, separated by commas."}
        </p>
      </div>
      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" size="lg" loading={pending}>
          {period ? "Save changes" : "Open the period"}
        </Button>
        {period && (
          <Button variant="secondary" size="lg" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

/** Entrust administrators: the application periods, and a way to open one or change one. */
export function PeriodsAdmin({ periods }: { periods: SummitPeriod[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-ink">Open a new period</h2>
        <PeriodForm onDone={() => undefined} />
      </Card>

      <section className="space-y-3" aria-labelledby="periods-title">
        <h2 id="periods-title" className="font-display text-xl font-bold text-ink">
          Periods
        </h2>
        {periods.length === 0 && <p className="text-base text-ink-2">No period has been set yet, so businesses can't apply. Open one above when the dates are decided.</p>}
        {periods.map((period) => (
          <Card key={period.id} className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold text-ink">{period.name}</h3>
              <StatusBadge tone={STATE[period.state].tone}>{STATE[period.state].label}</StatusBadge>
            </div>
            {editing === period.id ? (
              <PeriodForm period={period} onDone={() => setEditing(null)} />
            ) : (
              <>
                <dl className="space-y-2 text-base">
                  <div>
                    <dt className="text-sm text-ink-3">Applications</dt>
                    <dd className="text-ink">
                      {formatDateTime(period.opensAt)} to {formatDateTime(period.closesAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-3">Countries</dt>
                    <dd className="text-ink">{period.countries.map(countryName).join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-sm text-ink-3">Form and rules</dt>
                    <dd className="font-mono text-sm text-ink-2">
                      form {period.templateVersion}, rules {period.rulesVersion}
                    </dd>
                  </div>
                </dl>
                <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => setEditing(period.id)}>
                  Change this period
                </Button>
              </>
            )}
          </Card>
        ))}
      </section>
    </div>
  );
}
