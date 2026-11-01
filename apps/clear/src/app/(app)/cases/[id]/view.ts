import type { CaseDetailView } from "@entrust/api/client";
import { PHASES, STEP_STATUSES } from "@/lib/statuses";

// The case page's views: which tab is shown, and what is picked on it. They live in the URL, so a
// view can be linked to, Back closes a step's panel, and a server action's refresh keeps the view.

export type Detail = CaseDetailView;
export type Step = Detail["workflow"]["steps"][number];

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "steps", label: "Steps" },
  { id: "evidence", label: "Evidence" },
  { id: "flags", label: "Flags" },
  { id: "details", label: "Facts & contract" },
  { id: "deadlines", label: "Deadlines" },
  { id: "requirements", label: "Requirements" },
] as const;

export type Tab = (typeof TABS)[number]["id"];

export interface View {
  tab: Tab;
  /** The phase the steps tab shows, when it isn't the case's current phase. */
  phase?: number;
  /** A filter on the tab's list. */
  show?: string;
  /** The step whose panel is open. */
  step?: string;
  /** The requirement opened on the requirements tab. */
  req?: string;
}

/** The URL of a view of the case page. */
export function caseHref(caseId: string, view: Partial<View>): string {
  const params = new URLSearchParams();
  if (view.tab && view.tab !== "overview") params.set("tab", view.tab);
  if (view.phase) params.set("phase", String(view.phase));
  if (view.show) params.set("show", view.show);
  if (view.req) params.set("req", view.req);
  if (view.step) params.set("step", view.step);
  const query = params.toString();
  return `/cases/${caseId}${query ? `?${query}` : ""}`;
}

/** The view with a step's panel open over it. */
export const withStep = (caseId: string, view: View, stepId: string) => caseHref(caseId, { ...view, step: stepId });

/** Short phase names for the phase tracker; the full title is in its tooltip. */
export const PHASE_NAMES: Record<number, string> = {
  1: "Onboarding & product",
  2: "Buyer contract & terms",
  3: "Admissibility & licences",
  4: "Sourcing & quality",
  5: "Logistics & customs",
  6: "Arrival & post-shipment",
  7: "Bank & closure",
};

export const phaseTitle = (n: number) => PHASES.find((p) => p.n === n)?.title ?? `Phase ${n}`;

/** "STEP-019 to STEP-035", the phase's canonical step range. */
export function phaseRange(n: number) {
  const range = PHASES.find((p) => p.n === n)?.steps.split("–");
  return range ? `STEP-${range[0]} to STEP-${range[1]}` : "";
}

const applies = (s: Step) => s.applicability !== "not_applicable";
const isDone = (s: Step) => s.status === "completed" || s.status === "not_applicable";

/** Steps done of the steps that apply, in one phase or (without `phase`) the whole case. */
export function progress(detail: Detail, phase?: number) {
  const steps = detail.workflow.steps.filter((s) => applies(s) && (phase === undefined || s.phase === phase));
  return { done: steps.filter(isDone).length, total: steps.length };
}

/**
 * The step's status as shown. The engine reports a step waiting on its prerequisites as blocked;
 * that is shown as waiting, and blocked is kept for a flag holding it or a person marking it so.
 */
export function shownStatus(step: Step) {
  if (step.status === "blocked" && step.derived) {
    return step.heldBy.length ? { label: "Held by a flag", tone: "danger" as const } : { label: "Waiting", tone: "idle" as const };
  }
  return STEP_STATUSES[step.status];
}

export const STEP_FILTERS = [
  { id: "action", label: "Needs action" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Done" },
] as const;

export type StepFilter = (typeof STEP_FILTERS)[number]["id"];

/**
 * Where a step sits for the filters: done, waiting (on its prerequisites, or on the buyer, a bank or
 * an authority), or needing action from someone using CLEAR.
 */
export function stepFilter(step: Step): StepFilter {
  if (isDone(step)) return "done";
  if (step.status === "blocked" && step.derived && !step.heldBy.length) return "waiting";
  if (step.status === "awaiting_buyer" || step.status === "awaiting_bank" || step.status === "awaiting_authority") return "waiting";
  return "action";
}

/** Steps that apply to the case, in one phase. */
export const phaseSteps = (detail: Detail, phase: number) => detail.workflow.steps.filter((s) => s.phase === phase && applies(s));

/** The step that asks for an evidence type, for linking evidence to where it is used. */
export const stepAskingFor = (detail: Detail, type: string) =>
  detail.workflow.steps.find((s) => applies(s) && s.evidence.some((e) => e.type === type));

/** Open flags holding a step. */
export const flagsHolding = (detail: Detail, stepId: string) =>
  detail.flags.filter((f) => f.status === "open" && f.blocks.includes(stepId));

/** The evidence still waiting on an Entrust reviewer. */
export const awaitingReview = (detail: Detail) =>
  detail.evidence.filter((e) => e.latest && (e.status === "submitted" || e.status === "under_review"));
