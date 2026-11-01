import Link from "next/link";
import { Card, Field, StatusBadge } from "@entrust/ui";
import { COFFEE_TYPES, PRICE_UNITS } from "@entrust/gate-engine";
import type { FactKey } from "@entrust/rules";
import { FACT_KEYS, canWaiveFlags, canWorkCase, countryName, factDefinition, factValueLabel, productLabel } from "@/lib/catalogue";
import { formatDate, formatDateTime } from "@/lib/format";
import { CLOCK_STATES, FLAG_SEVERITIES, FLAG_STATUSES, REQUIREMENT_BASES, REQUIREMENT_STATUSES } from "@/lib/statuses";
import { recordContract, reevaluateRulePack, updateFacts, waiveFlag } from "../actions";
import { ActionForm } from "../action-form";
import { CheckboxGroup, NoteField, SelectField } from "../inputs";
import { CardHeading, FilterChips } from "./parts";
import { caseHref, withStep, type Detail, type View } from "./view";

/** Step ids as links that open each step's panel over the current view. */
function StepLinks({ ids, detail, view }: { ids: string[]; detail: Detail; view: View }) {
  return ids.map((id, i) => (
    <span key={id}>
      {i > 0 && ", "}
      <Link href={withStep(detail.id, view, id)} scroll={false} className="font-mono text-brand-600 hover:underline">
        {id}
      </Link>
    </span>
  ));
}

// ---- Facts & contract ----

export function DetailsTab({ detail }: { detail: Detail }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeading title="Facts" />
          <div className="px-4 pb-4 sm:px-5">
            <Facts detail={detail} />
          </div>
        </Card>
        <Card>
          <CardHeading title="Sales contract" />
          <div className="px-4 pb-4 sm:px-5">
            <Contract detail={detail} />
          </div>
        </Card>
      </div>
      {detail.amendments.length > 0 && (
        <Card>
          <CardHeading title="Amendments" />
          <div className="px-4 pb-4 sm:px-5">
            <Amendments detail={detail} />
          </div>
        </Card>
      )}
    </div>
  );
}

const show = (value: string | string[] | undefined, key: FactKey) =>
  value === undefined || (Array.isArray(value) && value.length === 0)
    ? null
    : [value].flat().map((v) => factValueLabel(key, v)).join(", ");

function Facts({ detail }: { detail: Detail }) {
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

/** The contract's recorded terms and the minimum export price check, without the form. */
export function ContractTerms({ detail }: { detail: Detail }) {
  const contract = detail.contract;
  const coffee = detail.product === "green_coffee" || detail.product === "roasted_coffee";
  const check = detail.minimumPrice;
  return (
    <>
      {contract ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-x-4 gap-y-2 text-sm">
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
    </>
  );
}

function Contract({ detail }: { detail: Detail }) {
  const contract = detail.contract;
  const coffee = detail.product === "green_coffee" || detail.product === "roasted_coffee";
  return (
    <>
      <ContractTerms detail={detail} />
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

function Amendments({ detail }: { detail: Detail }) {
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

// ---- Flags ----

export function FlagsTab({ detail, view }: { detail: Detail; view: View }) {
  if (!detail.flags.length) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-lg font-bold">No flags</p>
        <p className="mt-2 text-sm text-ink-2">The failure rules have found nothing on this case.</p>
      </Card>
    );
  }
  const flags = [...detail.flags].sort((a, b) => Number(b.status === "open") - Number(a.status === "open"));
  return (
    <ul className="flex flex-col gap-3">
      {flags.map((flag) => (
        <li key={flag.id}>
          <Card className="p-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 font-semibold">
                <span className="mr-1 font-mono text-xs font-normal text-ink-3">{flag.rule}</span> {flag.name}
              </p>
              <div className="flex gap-1.5">
                <StatusBadge tone={FLAG_SEVERITIES[flag.severity].tone}>{FLAG_SEVERITIES[flag.severity].label}</StatusBadge>
                <StatusBadge tone={FLAG_STATUSES[flag.status].tone}>{FLAG_STATUSES[flag.status].label}</StatusBadge>
              </div>
            </div>
            <p className="mt-1 text-sm text-ink-2">{flag.message}</p>
            <p className="mt-1 text-xs text-ink-3">
              Raised {formatDateTime(flag.raisedAt)}
              {flag.blocks.length > 0 && (
                <>
                  {" · holds "}
                  <StepLinks ids={flag.blocks} detail={detail} view={view} />
                </>
              )}
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
          </Card>
        </li>
      ))}
    </ul>
  );
}

// ---- Deadlines ----

export function DeadlinesTab({ detail, view }: { detail: Detail; view: View }) {
  const clocks = detail.deadlines.filter((d) => d.state !== "not_applicable");
  if (!clocks.length) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-lg font-bold">No deadlines</p>
        <p className="mt-2 text-sm text-ink-2">No deadline applies to this case.</p>
      </Card>
    );
  }
  return (
    <Card>
      <ul>
        {clocks.map((clock) => (
          <li key={clock.id} className="border-t border-line px-4 py-3 text-sm first:border-t-0 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{clock.label}</p>
              <StatusBadge tone={CLOCK_STATES[clock.state].tone}>{CLOCK_STATES[clock.state].label}</StatusBadge>
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              Starts at <StepLinks ids={[clock.stepId]} detail={detail} view={view} />
              {clock.due && <> · due {"day" in clock.due ? formatDate(clock.due.day) : formatDateTime(clock.due.at)}</>} · {clock.clause}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---- Requirements ----

type Requirement = NonNullable<Detail["rulePack"]>["requirements"][number];

const REQUIREMENT_FILTERS = [
  { id: "open", label: "Open", statuses: ["open"] },
  { id: "facts", label: "Needs facts", statuses: ["undetermined"] },
  { id: "waiting", label: "Waiting", statuses: ["blocked"] },
  { id: "met", label: "Met", statuses: ["met"] },
] as const satisfies readonly { id: string; label: string; statuses: readonly Requirement["status"][] }[];

/** The rule pack the case follows, and each requirement's status on it. */
export function RequirementsTab({ detail, view }: { detail: Detail; view: View }) {
  const pack = detail.rulePack;
  const update = detail.rulePackUpdate;
  const staff = detail.yourRole === "admin" || detail.yourRole === "facilitator";
  if (!pack) {
    return (
      <Card className="px-6 py-10 text-center">
        <p className="font-display text-lg font-bold">No rule pack</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
          No rule pack covers {productLabel(detail.product)} to {countryName(detail.destinationCountry)} yet. The canonical steps still apply.
        </p>
      </Card>
    );
  }
  const applying = pack.requirements.filter((r) => r.status !== "not_applicable");
  const ruledOut = pack.requirements.length - applying.length;
  const met = applying.filter((r) => r.status === "met").length;
  const filter = REQUIREMENT_FILTERS.find((f) => f.id === view.show);
  const matches = (r: Requirement, f: (typeof REQUIREMENT_FILTERS)[number]) => (f.statuses as readonly string[]).includes(r.status);
  const shown = filter ? applying.filter((r) => matches(r, filter)) : applying;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">
            {met} of {applying.length} requirements met
          </h2>
          <p className="mt-0.5 text-sm text-ink-3">
            {pack.name} <span className="font-mono text-xs">{pack.id} {pack.version}</span> ·{" "}
            {pack.status === "draft" ? "draft, not yet approved by Entrust" : "approved by Entrust"} · sources checked {formatDate(pack.checkedOn)}
          </p>
        </div>
        <FilterChips
          label="Filter requirements"
          current={filter?.id ?? "all"}
          options={[
            { id: "all", label: "All", count: applying.length, href: caseHref(detail.id, { tab: "requirements" }) },
            ...REQUIREMENT_FILTERS.map((f) => ({
              id: f.id,
              label: f.label,
              count: applying.filter((r) => matches(r, f)).length,
              href: caseHref(detail.id, { tab: "requirements", show: f.id }),
            })),
          ]}
        />
      </div>

      {!pack.coversCase && (
        <p className="mt-4 rounded-lg bg-warn-50 px-4 py-3 text-sm text-warn">
          The case&apos;s product or destination has changed, so this pack no longer covers it.
        </p>
      )}
      {update && (
        <div className="mt-4 rounded-lg bg-surface-2 p-4 text-sm">
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

      <Card className="mt-4 overflow-hidden">
        {shown.length ? (
          <ul>
            {shown.map((r) => (
              <RequirementRow key={r.code} requirement={r} open={view.req === r.code} detail={detail} view={view} />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-sm text-ink-2">No requirement is under “{filter?.label}”.</p>
        )}
      </Card>
      {ruledOut > 0 && (
        <p className="mt-3 text-xs text-ink-3">
          {ruledOut === 1 ? "1 requirement doesn't" : `${ruledOut} requirements don't`} apply to this case.
        </p>
      )}
    </>
  );
}

function RequirementRow({ requirement: r, open, detail, view }: { requirement: Requirement; open: boolean; detail: Detail; view: View }) {
  return (
    <li id={`req-${r.code}`} className="scroll-mt-24 border-t border-line first:border-t-0">
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-2 px-4 py-3 hover:bg-surface-2 sm:px-5">
          <span className="min-w-0 text-sm">
            <span className="mr-2 font-mono text-xs text-ink-3">{r.code}</span>
            <span className="font-semibold">{r.name}</span>
            <span className="block text-xs text-ink-3">{r.authority}</span>
          </span>
          <StatusBadge tone={REQUIREMENT_STATUSES[r.status].tone}>{REQUIREMENT_STATUSES[r.status].label}</StatusBadge>
        </summary>
        <div className="flex flex-col gap-1.5 px-4 pb-4 text-sm text-ink-2 sm:px-5">
          <p>
            <span className="font-semibold text-ink">{REQUIREMENT_BASES[r.basis]}</span> · {r.responsible}
          </p>
          <p>{r.action}</p>
          <p className="text-xs">Why: {r.whyItMatters}</p>
          <p className="text-xs">
            On{" "}
            <StepLinks ids={r.steps.map((s) => s.id)} detail={detail} view={view} />
          </p>
          {r.verification.status === "awaiting_verification" && <p className="text-xs text-warn">Still open: {r.verification.note}</p>}
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
  );
}
