import type { StatusTone } from "./status-badge";

export type LabelledStatus = { label: string; tone: StatusTone };

export const TASK_STATUSES = {
  not_started: { label: "Not started", tone: "idle" },
  in_progress: { label: "In progress", tone: "info" },
  awaiting_sme: { label: "Awaiting SME", tone: "warn" },
  awaiting_buyer: { label: "Awaiting buyer", tone: "warn" },
  awaiting_bank: { label: "Awaiting bank", tone: "warn" },
  awaiting_authority: { label: "Awaiting authority", tone: "warn" },
  blocked: { label: "Blocked", tone: "danger" },
} as const satisfies Record<string, LabelledStatus>;

export const EVIDENCE_STATUSES = {
  not_provided: { label: "Not provided", tone: "idle" },
  submitted: { label: "Evidence submitted", tone: "info" },
  under_review: { label: "Under review", tone: "info" },
  changes_required: { label: "Changes required", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "danger" },
} as const satisfies Record<string, LabelledStatus>;

export const STEP_STATUSES = {
  ...TASK_STATUSES,
  completed: { label: "Completed", tone: "ok" },
  not_applicable: { label: "Not applicable", tone: "idle" },
  undetermined: { label: "Needs facts", tone: "idle" },
} as const satisfies Record<string, LabelledStatus>;

export const CASE_STATUSES = {
  open: { label: "Open", tone: "info" },
  amendments_pending: { label: "Amendments pending", tone: "warn" },
  closed: { label: "Closed", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "idle" },
} as const satisfies Record<string, LabelledStatus>;

export const GATE_STATUSES = {
  open: { label: "In progress", tone: "info" },
  ready: { label: "Ready to sign off", tone: "product" },
  locked: { label: "Signed off", tone: "ok" },
} as const satisfies Record<string, LabelledStatus>;

export const FLAG_SEVERITIES = {
  critical: { label: "Critical", tone: "danger" },
  high: { label: "High", tone: "warn" },
  medium: { label: "Medium", tone: "info" },
} as const satisfies Record<string, LabelledStatus>;

export const FLAG_STATUSES = {
  open: { label: "Open", tone: "danger" },
  waived: { label: "Waived", tone: "idle" },
  resolved: { label: "Resolved", tone: "ok" },
} as const satisfies Record<string, LabelledStatus>;

export const PHASES = [
  { n: 1, title: "Exporter onboarding & product identity", steps: "001–018" },
  { n: 2, title: "Buyer contracting & commercial terms", steps: "019–035" },
  { n: 3, title: "Destination admissibility & regulatory licensing", steps: "036–054" },
  { n: 4, title: "Sourcing, processing & quality control", steps: "055–072" },
  { n: 5, title: "Logistics, equipment & customs clearance", steps: "073–091" },
  { n: 6, title: "Pre-arrival & post-shipment logistics", steps: "092–108" },
  { n: 7, title: "Bank presentation, FX repatriation & closure", steps: "109–125" },
] as const;

export type PhaseItem = (typeof PHASES)[number];
