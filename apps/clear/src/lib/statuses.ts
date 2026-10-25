import type { StatusTone } from "@entrust/ui";

type Labelled = { label: string; tone: StatusTone };

// The three status dictionaries from Entrust's Operational Control Matrix.
export const TASK_STATUSES = {
  not_started: { label: "Not started", tone: "idle" },
  in_progress: { label: "In progress", tone: "info" },
  awaiting_sme: { label: "Awaiting SME", tone: "warn" },
  awaiting_buyer: { label: "Awaiting buyer", tone: "warn" },
  awaiting_bank: { label: "Awaiting bank", tone: "warn" },
  awaiting_authority: { label: "Awaiting authority", tone: "warn" },
  blocked: { label: "Blocked", tone: "danger" },
} as const satisfies Record<string, Labelled>;

export const EVIDENCE_STATUSES = {
  not_provided: { label: "Not provided", tone: "idle" },
  submitted: { label: "Evidence submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  changes_required: { label: "Changes required", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
} as const satisfies Record<string, Labelled>;

/** A step's status on a case: a task status, done, or waiting on a fact. */
export const STEP_STATUSES = {
  ...TASK_STATUSES,
  completed: { label: "Completed", tone: "ok" },
  not_applicable: { label: "Not applicable", tone: "idle" },
  undetermined: { label: "Needs facts", tone: "idle" },
} as const satisfies Record<string, Labelled>;

export const CASE_STATUSES = {
  open: { label: "Open", tone: "info" },
  amendments_pending: { label: "Amendments pending", tone: "warn" },
  closed: { label: "Closed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
} as const satisfies Record<string, Labelled>;

/** A phase gate: signed off (locked), ready to sign off, or still being worked. */
export const GATE_STATUSES = {
  open: { label: "In progress", tone: "info" },
  ready: { label: "Ready to sign off", tone: "product" },
  locked: { label: "Signed off", tone: "ok" },
} as const satisfies Record<string, Labelled>;

export const FLAG_SEVERITIES = {
  critical: { label: "Critical", tone: "danger" },
  high: { label: "High", tone: "warn" },
  medium: { label: "Medium", tone: "info" },
} as const satisfies Record<string, Labelled>;

export const FLAG_STATUSES = {
  open: { label: "Open", tone: "danger" },
  waived: { label: "Waived", tone: "idle" },
  resolved: { label: "Resolved", tone: "ok" },
} as const satisfies Record<string, Labelled>;

/** A rule pack requirement's status on a case, read from its steps. */
export const REQUIREMENT_STATUSES = {
  met: { label: "Met", tone: "ok" },
  open: { label: "Open", tone: "info" },
  blocked: { label: "Waiting on other steps", tone: "idle" },
  undetermined: { label: "Needs facts", tone: "idle" },
  not_applicable: { label: "Not applicable", tone: "idle" },
} as const satisfies Record<string, Labelled>;

export const REQUIREMENT_BASES = {
  confirmed: "Law",
  conditional: "Law, when it applies",
  awaiting_verification: "Awaiting verification",
  transaction: "Transaction term",
} as const;

export const CLOCK_STATES = {
  not_applicable: { label: "Not applicable", tone: "idle" },
  undetermined: { label: "Needs facts", tone: "idle" },
  waiting: { label: "Not started", tone: "idle" },
  running: { label: "Running", tone: "info" },
  overdue: { label: "Overdue", tone: "danger" },
  met: { label: "Met", tone: "ok" },
  met_late: { label: "Met late", tone: "warn" },
} as const satisfies Record<string, Labelled>;

/** Who has to act on a step. Buyers, banks and authorities don't use CLEAR: the SME records what they did. */
export const OWNERS = {
  sme: "SME",
  entrust: "Entrust",
  system: "CLEAR (Entrust for now)",
  buyer: "Buyer, recorded by the SME",
  bank: "Bank, recorded by the SME",
  authority: "Authority, recorded by the SME",
} as const;

export const ROLES = {
  owner: "SME owner",
  member: "SME member",
  admin: "Entrust admin",
  facilitator: "Entrust facilitator",
  reviewer: "Entrust reviewer",
} as const;

export const NEXT_ACTIONS = {
  resolve_exception: "Resolve",
  determine: "Record facts",
  provide_evidence: "Provide evidence",
  review_evidence: "Review evidence",
  complete: "Complete",
  sign_off: "Sign off",
} as const;

// The seven phases Entrust confirmed in the Technical Alignment specification.
export const PHASES = [
  { n: 1, title: "Exporter onboarding & product identity", steps: "001–018" },
  { n: 2, title: "Buyer contracting & commercial terms", steps: "019–035" },
  { n: 3, title: "Destination admissibility & regulatory licensing", steps: "036–054" },
  { n: 4, title: "Sourcing, processing & quality control", steps: "055–072" },
  { n: 5, title: "Logistics, equipment & customs clearance", steps: "073–091" },
  { n: 6, title: "Pre-arrival & post-shipment logistics", steps: "092–108" },
  { n: 7, title: "Bank presentation, FX repatriation & closure", steps: "109–125" },
] as const;
