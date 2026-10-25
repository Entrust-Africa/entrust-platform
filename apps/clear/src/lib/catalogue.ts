import "server-only";
import {
  EVIDENCE_TRANSITIONS,
  STEP_TRANSITIONS,
  STEP_WORKERS,
  TASK_STATUSES,
  type Actor,
  type EvidenceStatus,
  type Role,
  type StepStatus,
  type TaskStatus,
} from "@entrust/gate-engine";
import { EU_COUNTRIES, EVIDENCE_TYPES, FACTS, type FactKey, type StepOwner } from "@entrust/rules";

// What the case pages need from CLEAR's canonical data and the GATE engine's tables. Server only:
// the pages pass plain values to the client components.

const regions = new Intl.DisplayNames(["en"], { type: "region" });
const facts = new Map(FACTS.map((f) => [f.key, f]));
const evidenceTypes = new Map(EVIDENCE_TYPES.map((e) => [e.id, e]));

export const countryName = (code: string) => {
  try {
    return regions.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
};

/** A fact's label and, if it has a fixed list, its options. */
export const factDefinition = (key: FactKey) => facts.get(key);

export const FACT_KEYS = FACTS.map((f) => f.key);

/** The label of one of a fact's values, or the value itself. */
export function factValueLabel(key: FactKey, value: string): string {
  if (key === "destinationCountry") return countryName(value);
  return facts.get(key)?.options?.find((o) => o.value === value)?.label ?? value;
}

export const productLabel = (value: string) => factValueLabel("product", value);

export const evidenceName = (type: string) => evidenceTypes.get(type)?.name ?? type;

/** The engine's next-action text names evidence by its type id; this puts the type's name in. */
export const readable = (text: string) =>
  text.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, (word) => evidenceTypes.get(word)?.name ?? word);

/** The launch corridors' destinations, for the new case form. */
export const DESTINATIONS = [
  { group: "United States and Türkiye", codes: ["US", "TR"] },
  { group: "European Union", codes: [...EU_COUNTRIES] },
  { group: "Gulf Cooperation Council", codes: ["SA", "AE", "QA", "KW", "BH", "OM"] },
].map(({ group, codes }) => ({
  group,
  countries: codes.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name)),
}));

// ---- What a role may do, from the engine's transition tables ----

export interface StepLike {
  owner: StepOwner;
  milestone: boolean;
  status: StepStatus;
  derived: boolean;
  applicability: "applicable" | "not_applicable" | "undetermined";
}

export interface StepActions {
  /** Task statuses the role may set. */
  update: TaskStatus[];
  complete: boolean;
  signOff: boolean;
  markNotApplicable: boolean;
  reopen: boolean;
  unlock: boolean;
}

const NO_ACTIONS: StepActions = { update: [], complete: false, signOff: false, markNotApplicable: false, reopen: false, unlock: false };

/**
 * The changes `role` may make to a step, as the engine's STEP_TRANSITIONS allow. The engine still
 * decides: this only chooses which controls to show, and the API refuses anything else.
 */
export function stepActions(step: StepLike, role: Role): StepActions {
  const rules = STEP_TRANSITIONS.filter(
    (r) =>
      r.milestone === step.milestone &&
      r.from.includes(step.status) &&
      (r.by === "workers" ? STEP_WORKERS[step.owner] : r.by).includes(role as Actor),
  );
  const can = (action: string) => rules.some((r) => r.action === action);
  // A status the engine worked out (waiting on prerequisites or facts, or ruled out by the facts)
  // can only be marked not applicable, and only while it could still apply.
  if (step.derived) return { ...NO_ACTIONS, markNotApplicable: step.applicability !== "not_applicable" && can("mark_not_applicable") };
  const update = rules
    .filter((r) => r.action === "update")
    .flatMap((r) => r.to)
    .filter((s): s is TaskStatus => (TASK_STATUSES as readonly string[]).includes(s) && s !== step.status);
  return {
    update: [...new Set(update)],
    complete: can("complete"),
    signOff: can("sign_off"),
    markNotApplicable: can("mark_not_applicable"),
    reopen: can("reopen"),
    unlock: can("unlock"),
  };
}

/** The evidence changes `role` may make from `status`: submit, start a review, or decide one. */
export function evidenceActions(status: EvidenceStatus, role: Role) {
  const allowed = (action: string) =>
    EVIDENCE_TRANSITIONS.some((r) => r.action === action && r.from.includes(status) && r.by.includes(role as Actor));
  return {
    submit: allowed("submit"),
    startReview: allowed("start_review"),
    approve: allowed("approve"),
    requestChanges: allowed("request_changes"),
    reject: allowed("reject"),
  };
}

/** Who may change facts, record the contract and open cases: whoever works the SME's steps. */
export const canWorkCase = (role: Role) => STEP_WORKERS.sme.includes(role as Actor);
/** Who may waive a flag (the API's waiveFlag). */
export const canWaiveFlags = (role: Role) => role === "reviewer" || role === "admin";
