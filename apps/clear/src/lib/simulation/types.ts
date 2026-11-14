import type { CaseFacts, EvidenceRecord, StepRecord } from "@entrust/gate-engine";
import type { PhaseId, StepId } from "@entrust/rules";

// The simulator plays one export order through CLEAR's real steps and GATE engine. A scenario is
// data: the order, what happens at each step, and the questions CLEAR stops to ask. The engine
// decides which steps apply, which are waiting, and when a phase can be signed off.

export interface PurchaseOrder {
  number: string;
  /** ISO date. */
  date: string;
  currency: string;
  buyer: { company: string; address: string; country: string; contact: string; email: string; telephone: string };
  seller: { company: string; country: string; address: string; contact: string; email: string };
  product: {
    name: string;
    origin: string;
    form: string;
    roast: string;
    packaging: string;
    quantity: string;
    netWeight: string;
    intendedUse: string;
    hsCode: string;
  };
  value: { units: number; unitPrice: number; total: number };
  delivery: { incoterm: string; incotermsVersion: string; namedPlace: string; note: string };
  paymentTerms: readonly string[];
  packagingAndMarking: readonly string[];
  qualityRequirements: readonly string[];
  schedule: readonly { label: string; value: string }[];
  /** The documents the order asks for, the evidence that answers each one, and the open item that settles one left vague. */
  requiredDocuments: readonly { label: string; evidence: readonly string[]; openItem?: string }[];
}

/** The answers given so far, by question. */
export type Answers = Partial<Record<string, string>>;

/** Text that can depend on how the questions were answered. */
export type Told = string | ((answers: Answers) => string);

/** What happens when a step is done. */
export interface StoryStep {
  id: StepId;
  /** When it happens: an ISO date, or a timestamp with an offset where the hour matters. */
  at: string;
  /** Who did it, by role. */
  actor: string;
  /** One line for the step list and the log. */
  summary: Told;
  /** The fuller account, for the step's panel. */
  detail: Told;
  /** Case facts this step establishes. */
  sets?: CaseFacts;
  /** Dates the deadline clocks run from, recorded here. */
  clockInputs?: Partial<Record<"plannedLoading" | "estimatedArrival" | "priorNoticeSystem", string>>;
  /** A reference for each document this step puts on file, by evidence type. */
  references?: Partial<Record<string, string>>;
  /** Open items of the order that this step settles. */
  settles?: readonly string[];
  /** Advice CLEAR gives here, shown apart from what happened. */
  advice?: string;
}

export interface AskOption {
  id: string;
  label: string;
  /** Extra words under the label. */
  hint?: string;
  accepted: boolean;
  /** What CLEAR says back: why the answer stands, or why it does not. */
  response: string;
  /** How the order reads once this answer is on record. */
  recorded?: string;
}

/** A point where the run stops until the user answers. */
export interface Ask {
  id: string;
  stepId: StepId;
  title: string;
  /** What the order says, and what CLEAR has on file. */
  context: string;
  /** Why CLEAR will not fill the answer in by itself. */
  why: string;
  /** Who has to answer. */
  from: string;
  options: readonly AskOption[];
}

/** Something the order leaves open. The two asks stop the run; the rest are confirmed along the way. */
export interface OpenItem {
  id: string;
  label: string;
  /** The order's own words. */
  orderSays: string;
  /** The step where it is settled. */
  stepId: StepId;
  /** Set when the item is one of the asks. */
  askId?: string;
  /** How it was settled, for items confirmed along the way. */
  settled?: string;
}

export interface Scenario {
  title: string;
  order: PurchaseOrder;
  /** ISO date the case is opened. */
  opened: string;
  /** Facts known when the case is opened. The rest are established by steps. */
  facts: CaseFacts;
  /** The steps in the order the story plays them. The engine checks each one is ready first. */
  story: readonly StoryStep[];
  asks: readonly Ask[];
  openItems: readonly OpenItem[];
}

export type LogKind = "opened" | "step" | "gate" | "ask" | "answer" | "rejected" | "ruled_out" | "settled" | "waiting" | "closed";

export interface LogEntry {
  /** Position in the log, from 1. */
  n: number;
  kind: LogKind;
  /** ISO date or timestamp, on the simulated calendar. */
  at: string;
  phase: PhaseId | null;
  stepId: StepId | null;
  actor: string;
  title: string;
  detail: string;
}

/** A document on file, with the step that put it there. */
export interface FiledEvidence extends EvidenceRecord {
  stepId: StepId;
  reference: string | null;
}

/** A clock input or a step completion, as the deadline clocks read them. */
export interface RunEvent {
  type: "step_completed" | "clock_input_set";
  stepId?: StepId;
  occurredAt: string;
  data?: { key: string; value: string };
}

/** Everything that has happened in a run. Never changed in place: each action returns a new one. */
export interface Run {
  facts: CaseFacts;
  steps: Partial<Record<StepId, StepRecord>>;
  /** When each completed step was done, on the simulated calendar. */
  completedAt: Partial<Record<StepId, string>>;
  evidence: readonly FiledEvidence[];
  events: readonly RunEvent[];
  /** Questions CLEAR has asked, in the order it asked them. */
  asked: readonly string[];
  /** Accepted answers, by question. */
  answers: Answers;
  /** Answers that were not accepted, by question. */
  refused: Partial<Record<string, readonly string[]>>;
  /** Open items settled so far. */
  settled: readonly string[];
  /** The simulated time of the last thing that happened. */
  clock: string;
  log: readonly LogEntry[];
}

/** What the next move is. */
export type Next =
  | { kind: "step"; stepId: StepId }
  /** A question CLEAR is about to ask. */
  | { kind: "ask"; askId: string; stepId: StepId }
  /** Nothing can move until these questions are answered. */
  | { kind: "waiting"; askIds: readonly string[] }
  | { kind: "finished" };
