import type { ReasonCodeDefinition } from "../../types";

// Every module on a learning plan carries one of these with the rules version, so staff and the SME can
// see why it's there. The sentences are what the SME reads.
export const REASON_CODE_DEFINITIONS: readonly ReasonCodeDefinition[] = [
  { code: "REQUIRED_ALL", text: "Every TRADE participant takes this module." },
  { code: "REQUIRED_TO_GRADUATE", text: "You need to finish this module to complete TRADE." },
  { code: "GAP_BUYER", text: "Your answers show a gap in finding, checking and following up buyers." },
  { code: "GAP_FINANCIAL", text: "Your answers show a gap in financial records and what a bank needs to see." },
  { code: "GAP_TRADE_FINANCE", text: "Your answers show a gap in export payment terms and financing a transaction." },
  { code: "GAP_COSTING", text: "Your answers show a gap in costing an export order and protecting your margin." },
  { code: "GAP_EXECUTION", text: "Your answers show a gap in managing a shipment and meeting export requirements." },
  { code: "GAP_OPERATIONS", text: "Your answers show a gap in planning production and delivering orders on time." },
  { code: "GAP_DIGITAL", text: "Your answers show a gap in keeping digital business records and tools." },
  { code: "GAP_AI_PRODUCTIVITY", text: "Your answers show a gap in using AI tools to save time while checking what they produce." },
  { code: "LIVE_ORDER", text: "You have a confirmed order, so payment terms, costing and shipping requirements come first." },
  { code: "ACTIVE_QUOTATION", text: "You have a quotation out, so you need a costed price you can stand behind." },
  { code: "NO_QUALIFIED_BUYER", text: "You don't have an active, qualified buyer yet, so building a buyer pipeline comes first." },
  { code: "HAS_EXPORTED_RETENTION", text: "You have exported before, so keeping buyers and winning repeat orders matters now." },
  { code: "ASSESSMENT_NEEDED", text: "We don't have enough answers in this area to score it, so the module stays on your plan until we do." },
  { code: "RECORDS_BEFORE_FINANCE", text: "Your financial records aren't verified yet, so the records module comes before the finance module." },
  { code: "TEST_OUT_OFFERED", text: "Your score here is strong. You can take a short practical test to skip this module." },
  { code: "STAFF_OVERRIDE", text: "An Entrust staff member changed this part of your plan." },
];
