import type { Band, Domain, Thresholds, TriggerGroup } from "../../types";

// A domain's score is the points earned over the maximum applicable points, times 100 (placement spec,
// section 3). The six scored domains are sections B to G; section A is context and never scored.
export const DOMAINS: readonly Domain[] = [
  { id: "buyer_development", title: "Buyer development and conversion", questions: ["B1", "B2", "B3", "B4", "B5"], maxPoints: 15 },
  { id: "financial_records", title: "Financial records and bankability", questions: ["C1", "C2", "C3", "C4", "C5", "C6"], maxPoints: 18 },
  { id: "transaction_finance", title: "Transaction finance and payment risk", questions: ["D1", "D2", "D3", "D4", "D5"], maxPoints: 15 },
  { id: "costing_execution", title: "Costing and execution management", questions: ["E1", "E2", "E3", "E4", "E5", "E6"], maxPoints: 18 },
  { id: "digital_productivity", title: "Digital operations and productivity", questions: ["F1", "F2", "F3", "F4", "F5"], maxPoints: 15 },
  { id: "operational_readiness", title: "Operational readiness", questions: ["G1", "G2", "G3", "G4"], maxPoints: 12 },
];

// The reference code in the placement spec triggers modules on seven keys that don't match the six
// domains, so each trigger is a named group of questions, scored like a domain. Proposed in #48 and
// #53 for Entrust to confirm which questions trigger which module.
export const TRIGGER_GROUPS: readonly TriggerGroup[] = [
  { id: "buyer", title: "Buyer development", questions: ["B1", "B2", "B3", "B4", "B5"], module: "M05" },
  { id: "financial", title: "Financial records and bankability", questions: ["C1", "C2", "C3", "C4", "C5", "C6"], module: "M03" },
  { id: "trade_finance", title: "Transaction finance and payment risk", questions: ["D1", "D2", "D3", "D4", "D5"], module: "M04" },
  { id: "costing", title: "Costing and margin control", questions: ["E1", "E2", "E5", "E6"], module: "M06" },
  { id: "execution", title: "Export execution", questions: ["E3", "E4", "G3", "G4"], module: "M08" },
  { id: "operations", title: "Operational planning and fulfillment", questions: ["G1", "G2", "C4"], module: "M07" },
  { id: "digital", title: "Digital operations and records", questions: ["F1", "F2", "F3", "F5"], module: "M02" },
  { id: "ai_productivity", title: "AI productivity", questions: ["F4"], module: "M09" },
];

export const BANDS: readonly Band[] = [
  { id: "critical_gap", label: "Critical gap", from: 0, action: "Assign the core module and additional guided practice." },
  { id: "developing", label: "Developing", from: 40, action: "Assign the core module and targeted exercises." },
  { id: "functional", label: "Functional", from: 60, action: "Assign relevant practice and assess competence." },
  { id: "demonstrated", label: "Demonstrated capability", from: 80, action: "Offer a test-out assessment. A high score alone never exempts." },
];

export const THRESHOLDS: Thresholds = {
  assignBelow: 60,
  testOutFrom: 80,
  retentionBelow: 80,
  minCoverage: 0.8,
};
