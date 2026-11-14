import type { EvaluatedStep } from "@entrust/gate-engine";
import { EVIDENCE_TYPES, FACTS } from "@entrust/rules";
import type { StatusTone } from "@entrust/ui";
import { formatDate } from "@/lib/format";
import { dayOf } from "@/lib/simulation/run";
import type { LogKind } from "@/lib/simulation/types";
import { STEP_STATUSES } from "@/lib/statuses";

const evidenceTypes = new Map(EVIDENCE_TYPES.map((e) => [e.id, e]));
const regions = new Intl.DisplayNames(["en"], { type: "region" });

export const evidenceName = (type: string) => evidenceTypes.get(type)?.name ?? type;
export const evidenceIssuer = (type: string) => evidenceTypes.get(type)?.issuer ?? "";

export const productLabel = (value: string) => FACTS.find((f) => f.key === "product")?.options?.find((o) => o.value === value)?.label ?? value;
export const countryName = (code: string) => regions.of(code) ?? code;

/** "14 Dec 2026", on the simulated calendar, in Addis Ababa. */
export const simDate = (at: string) => formatDate(dayOf(at));

/** "USD 7,000", or "USD 3.50" when there are cents. */
export const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 })}`;

/**
 * A step's status as shown, the way the case page shows it: a step the engine reports as blocked
 * because its prerequisites are not done is waiting, not blocked.
 */
export function shownStatus(step: EvaluatedStep): { label: string; tone: StatusTone } {
  if (step.status === "blocked" && step.derived) {
    return step.heldBy.length ? { label: "Held by a flag", tone: "danger" } : { label: "Waiting", tone: "idle" };
  }
  return STEP_STATUSES[step.status];
}

/** How each kind of log entry is labelled. The label carries the meaning; the tone only supports it. */
export const LOG_KINDS: Record<LogKind, { label: string; tone: StatusTone }> = {
  opened: { label: "Case opened", tone: "info" },
  step: { label: "Step done", tone: "ok" },
  gate: { label: "Phase signed off", tone: "product" },
  ask: { label: "Question", tone: "warn" },
  answer: { label: "Answer", tone: "ok" },
  rejected: { label: "Not accepted", tone: "danger" },
  ruled_out: { label: "Ruled out", tone: "idle" },
  settled: { label: "Settled", tone: "info" },
  waiting: { label: "Waiting", tone: "warn" },
  closed: { label: "Case closed", tone: "ok" },
};
