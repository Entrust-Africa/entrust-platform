import { Field, StatusBadge } from "@entrust/ui";
import type { CaseDetailView } from "@entrust/api/client";
import { COFFEE_TYPES, PRICE_UNITS } from "@entrust/gate-engine";
import type { FactKey } from "@entrust/rules";
import { FACT_KEYS, canWaiveFlags, canWorkCase, countryName, factDefinition, factValueLabel, productLabel } from "@/lib/catalogue";
import { formatDate, formatDateTime } from "@/lib/format";
import { CLOCK_STATES, FLAG_SEVERITIES, FLAG_STATUSES, REQUIREMENT_BASES, REQUIREMENT_STATUSES } from "@/lib/statuses";
import { recordContract, reevaluateRulePack, updateFacts, waiveFlag } from "../actions";
import { ActionForm } from "../action-form";
import { CheckboxGroup, NoteField, SelectField } from "../inputs";

const show = (value: string | string[] | undefined, key: FactKey) =>
  value === undefined || (Array.isArray(value) && value.length === 0)
    ? null
    : [value].flat().map((v) => factValueLabel(key, v)).join(", ");

export function Facts({ detail }: { detail: CaseDetailView }) {
  return (
    <>
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {FACT_KEYS.map((key) => (
          <div key={key} className="contents">
            <dt className="text-ink-2">{factDefinition(key)?.label ?? key}</dt>
            <dd className={show(detail.facts[key], key) ? "font-semibold" : "text-ink-3"}>
              {show(detail.facts[key], key) ?? "Not recorded"}
            </dd>
          </div>
        ))}
      </dl>
      {canWorkCase(detail.yourRole) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600">Record or change facts</summary>
          <ActionForm
            action={updateFacts}
            hidden={{ caseId: detail.id, current: JSON.stringify(detail.facts) }}
            submits={[{ label: "Save facts" }]}
            className="mt-3"
          >
            <p className="text-xs text-ink-3">After a phase gate is signed off, facts it relied on change by amendment.</p>
            {FACT_KEYS.map((key) => {
              const fact = factDefinition(key)!;
              const current = detail.facts[key];
              return (
                <div key={key}>
                  <input type="hidden" name="key" value={key} />
                  {fact.multiple ? (
                    <>
                      <input type="hidden" name={`multiple:${key}`} value="true" />
                      <CheckboxGroup
                        legend={fact.label}
                        name={`fact:${key}`}
                        options={fact.options ?? []}
                        defaultValues={[current ?? []].flat()}
                      />
                    </>
                  ) : fact.options ? (
                    <SelectField
                      label={fact.label}
                      name={`fact:${key}`}
                      defaultValue={typeof current === "string" ? current : ""}
                      placeholder="Not recorded"
                      options={fact.options}
                    />
                  ) : (
                    <Field
                      label={fact.label}
                      name={`fact:${key}`}
                      defaultValue={typeof current === "string" ? current : ""}
                      hint={fact.help}
                      maxLength={key === "destinationCountry" ? 2 : undefined}
                    />
                  )}
                </div>
              );
            })}
          </ActionForm>
        </details>
      )}
    </>
  );
}

export function Contract({ detail }: { detail: CaseDetailView }) {
  const contract = detail.contract;
  const coffee = detail.product === "green_coffee" || detail.product === "roasted_coffee";
  const check = detail.minimumPrice;
  return (
    <>
      {contract ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-2">Number</dt>
          <dd className="font-semibold">{contract.number}</dd>
          <dt className="text-ink-2">Buyer</dt>
          <dd className="font-semibold">{contract.buyerName}</dd>
          <dt className="text-ink-2">Date</dt>
          <dd className="font-semibold">{formatDate(contract.contractDate)}</dd>
          <dt className="text-ink-2">Unit price</dt>
          <dd className="font-semibold">
            {contract.unitPrice ? `${contract.unitPrice.currency} ${contract.unitPrice.amount} per ${contract.unitPrice.per}` : "Not recorded"}
          </dd>
          {coffee && (
            <>
              <dt className="text-ink-2">Coffee</dt>
              <dd className="font-semibold">
                {[contract.coffeeType, contract.grade && `grade ${contract.grade}`, contract.origin].filter(Boolean).join(", ") || "Not recorded"}
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-sm text-ink-2">No sales contract recorded yet. Its terms are checked at STEP-020 to STEP-024.</p>
      )}
      {check && (
        <p className="mt-3 rounded-sm bg-surface-2 px-2 py-1.5 text-sm">
          <span className="font-semibold">Minimum export price: </span>
          {check.message}
        </p>
      )}
      {canWorkCase(detail.yourRole) && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-semibold text-brand-600">
            {contract ? "Change the contract terms" : "Record the contract"}
          </summary>
          <ActionForm action={recordContract} hidden={{ caseId: detail.id }} submits={[{ label: "Save the contract" }]} className="mt-3">
            <p className="text-xs text-ink-3">Saving replaces the terms: anything left blank is cleared.</p>
            <Field label="Contract or purchase order number" name="number" defaultValue={contract?.number} required />
            <Field label="Buyer" name="buyerName" defaultValue={contract?.buyerName} required />
            <Field label="Contract date" name="contractDate" type="date" defaultValue={contract?.contractDate} required />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit price" name="amount" inputMode="decimal" defaultValue={contract?.unitPrice?.amount} />
              <Field label="Currency" name="currency" maxLength={3} defaultValue={contract?.unitPrice?.currency ?? "USD"} />
            </div>
            <SelectField
              label="Price per"
              name="per"
              defaultValue={contract?.unitPrice?.per ?? "kg"}
              options={PRICE_UNITS.map((u) => ({ value: u, label: u === "mt" ? "metric tonne" : u }))}
              className="max-w-xs"
            />
            {coffee && (
              <>
                <SelectField
                  label="Coffee type"
                  name="coffeeType"
                  defaultValue={contract?.coffeeType ?? ""}
                  placeholder="Not recorded"
                  options={COFFEE_TYPES.map((t) => ({ value: t, label: t === "washed" ? "Washed" : "Unwashed" }))}
                  hint="The minimum export price check needs the type, the grade and the price."
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Grade" name="grade" defaultValue={contract?.grade ?? ""} />
                  <Field label="Origin" name="origin" defaultValue={contract?.origin ?? ""} placeholder="Yirgacheffe" />
                </div>
              </>
            )}
          </ActionForm>
        </details>
      )}
    </>
  );
}

export function Flags({ detail }: { detail: CaseDetailView }) {
  if (!detail.flags.length) return <p className="text-sm text-ink-2">No flags. The failure rules have found nothing.</p>;
  const flags = [...detail.flags].sort((a, b) => Number(b.status === "open") - Number(a.status === "open"));
  return (
    <ul className="flex flex-col gap-3">
      {flags.map((flag) => (
        <li key={flag.id} className="rounded-md border border-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-semibold">
              <span className="font-mono text-xs text-ink-3">{flag.rule}</span> {flag.name}
            </p>
            <div className="flex gap-1.5">
              <StatusBadge tone={FLAG_SEVERITIES[flag.severity].tone}>{FLAG_SEVERITIES[flag.severity].label}</StatusBadge>
              <StatusBadge tone={FLAG_STATUSES[flag.status].tone}>{FLAG_STATUSES[flag.status].label}</StatusBadge>
            </div>
          </div>
          <p className="mt-1 text-sm text-ink-2">{flag.message}</p>
          <p className="mt-1 text-xs text-ink-3">
            Raised {formatDateTime(flag.raisedAt)}
            {flag.blocks.length > 0 && <> · holds {flag.blocks.join(", ")}</>}
          </p>
          {flag.waiveReason && <p className="mt-1 text-xs text-ink-3">Waived: {flag.waiveReason}</p>}
          {flag.status === "open" && canWaiveFlags(detail.yourRole) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-sm font-semibold text-brand-600">Waive it</summary>
              <ActionForm
                action={waiveFlag}
                hidden={{ caseId: detail.id, flagId: flag.id }}
                submits={[{ label: "Waive the flag", variant: "danger" }]}
                className="mt-3"
              >
                <NoteField label="Why the situation is accepted" name="reason" required />
              </ActionForm>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Deadlines({ detail }: { detail: CaseDetailView }) {
  const clocks = detail.deadlines.filter((d) => d.state !== "not_applicable");
  if (!clocks.length) return <p className="text-sm text-ink-2">No deadline applies to this case.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {clocks.map((clock) => (
        <li key={clock.id} className="text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{clock.label}</p>
            <StatusBadge tone={CLOCK_STATES[clock.state].tone}>{CLOCK_STATES[clock.state].label}</StatusBadge>
          </div>
          <p className="text-xs text-ink-3">
            Starts at {clock.stepId}
            {clock.due && <> · due {"day" in clock.due ? formatDate(clock.due.day) : formatDateTime(clock.due.at)}</>} ·{" "}
            {clock.clause}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function Amendments({ detail }: { detail: CaseDetailView }) {
  if (!detail.amendments.length) return null;
  return (
    <ul className="flex flex-col gap-3">
      {detail.amendments.map((a) => (
        <li key={a.version} className="text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Version {a.version}</p>
            <StatusBadge tone={a.status === "pending" ? "warn" : "ok"}>{a.status === "pending" ? "Pending" : "Complete"}</StatusBadge>
          </div>
          <p className="text-ink-2">{a.reason}</p>
          <p className="text-xs text-ink-3">
            {formatDateTime(a.madeAt)} · changed {a.changes.map((c) => c.label).join(", ")}
            {a.reverifySteps.length > 0 && <> · to do again: {a.reverifySteps.join(", ")}</>}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The rule pack the case follows, and each requirement's status on it. */
export function Requirements({ detail }: { detail: CaseDetailView }) {
  const pack = detail.rulePack;
  const update = detail.rulePackUpdate;
  const staff = detail.yourRole === "admin" || detail.yourRole === "facilitator";
  if (!pack) {
    return (
      <p className="text-sm text-ink-2">
        No rule pack covers {productLabel(detail.product)} to {countryName(detail.destinationCountry)} yet. The canonical steps still
        apply.
      </p>
    );
  }
  const applying = pack.requirements.filter((r) => r.status !== "not_applicable");
  const ruledOut = pack.requirements.filter((r) => r.status === "not_applicable");
  const met = applying.filter((r) => r.status === "met").length;
  return (
    <>
      <p className="text-sm">
        <span className="font-semibold">{pack.name}</span>{" "}
        <span className="font-mono text-xs text-ink-3">
          {pack.id} {pack.version}
        </span>
      </p>
      <p className="mt-1 text-xs text-ink-3">
        {pack.status === "draft" ? "Draft, not yet approved by Entrust" : "Approved by Entrust"} · sources checked{" "}
        {formatDate(pack.checkedOn)} · {met} of {applying.length} met
      </p>
      {!pack.coversCase && (
        <p className="mt-2 text-sm text-warn">The case&apos;s product or destination has changed, so this pack no longer covers it.</p>
      )}
      {update && (
        <div className="mt-3 rounded-md bg-surface-2 p-3 text-sm">
          <p>
            {update.id
              ? `${update.id} ${update.version} is newer: re-evaluating would add ${update.added.length}, remove ${update.removed.length} and change ${update.changed.length} requirements.`
              : `No pack covers the case now: re-evaluating would remove its ${update.removed.length} requirements.`}
          </p>
          {staff && (
            <ActionForm
              action={reevaluateRulePack}
              hidden={{ caseId: detail.id }}
              submits={[{ label: "Re-evaluate", variant: "secondary" }]}
              className="mt-3"
            >
              <NoteField label="Why the case moves" name="reason" required />
            </ActionForm>
          )}
        </div>
      )}
      <ul className="mt-3 flex flex-col">
        {applying.map((r) => (
          <li key={r.code} className="border-t border-line py-2 first:border-t-0">
            <details>
              <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2">
                <span className="min-w-0 text-sm">
                  <span className="font-mono text-xs text-ink-3">{r.code}</span> {r.name}
                </span>
                <StatusBadge tone={REQUIREMENT_STATUSES[r.status].tone}>{REQUIREMENT_STATUSES[r.status].label}</StatusBadge>
              </summary>
              <div className="mt-2 flex flex-col gap-1.5 text-sm text-ink-2">
                <p>
                  <span className="font-semibold text-ink">{REQUIREMENT_BASES[r.basis]}</span> · {r.authority}
                </p>
                <p>{r.action}</p>
                <p className="text-xs">Why: {r.whyItMatters}</p>
                <p className="text-xs">On {r.steps.map((s) => s.id).join(", ")}</p>
                {r.verification.status === "awaiting_verification" && (
                  <p className="text-xs text-warn">Still open: {r.verification.note}</p>
                )}
                {r.sources.some((s) => s.url) && (
                  <ul className="text-xs">
                    {r.sources
                      .filter((s) => s.url)
                      .map((s, i) => (
                        <li key={i}>
                          <a href={s.url} className="text-brand-600 underline underline-offset-2" target="_blank" rel="noreferrer">
                            {s.title}
                          </a>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {ruledOut.length > 0 && (
        <p className="mt-2 text-xs text-ink-3">
          {ruledOut.length === 1 ? "1 requirement doesn't" : `${ruledOut.length} requirements don't`} apply to this case.
        </p>
      )}
    </>
  );
}
