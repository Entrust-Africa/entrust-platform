import type { StatusTone } from "@entrust/ui";

type Labelled = { label: string; tone: StatusTone };

export {
  TASK_STATUSES,
  EVIDENCE_STATUSES,
  STEP_STATUSES,
  CASE_STATUSES,
  GATE_STATUSES,
  FLAG_SEVERITIES,
  FLAG_STATUSES,
  PHASES,
  type PhaseItem,
} from "@entrust/ui";

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
