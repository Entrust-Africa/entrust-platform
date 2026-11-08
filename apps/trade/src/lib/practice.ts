// What the M08 practice screens read from /v1/trade/practice-*.

export interface PracticeFact {
  key: string;
  label: string;
  help: string;
  options: { value: string; label: string }[] | null;
  determinedAt: string | null;
}

export interface PracticeScenario {
  id: string;
  title: string;
  summary: string;
  ownFacts: boolean;
}

export interface PracticeScenarios {
  label: string;
  scenarios: PracticeScenario[];
  facts: PracticeFact[];
}

export interface PracticeSummary {
  id: string;
  reference: string;
  practiceScenario: string | null;
  currentPhase: number;
  organizationName: string;
  updatedAt: string;
}

export interface PracticeStep {
  id: string;
  phase: number;
  name: string;
  status: string;
  milestone: boolean;
  heldBy: string[];
  evidence: { type: string; status: string; satisfied: boolean }[];
}

export interface PracticeCase extends PracticeSummary {
  facts: Record<string, unknown>;
  workflow: {
    steps: PracticeStep[];
    phases: { phase: number; status: "locked" | "ready" | "open" }[];
    nextAction: { stepId: string; kind: string; owner: string; detail: string } | null;
  };
  evidence: { id: string; type: string; status: string; latest: boolean }[];
  flags: { id: string; rule: string; name: string; status: string; message: string }[];
  documents: { document: string; name: string; fields: Record<string, string> }[];
}

export interface PracticeEvent {
  id: string;
  title: string;
  story: string;
  played: boolean;
}
