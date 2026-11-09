import type { TradeRules } from "../../types";
import { TRADE_RULES_0_2_0 } from "../v0-2-0";

// 0.3.0 follows Entrust's architecture specification (section 6.7) and the FRD: Pathway B needs one completed shipment,
// however long ago. A self-reported shipment is accepted at diagnostic stage, so the plan doesn't wait for staff, and
// reports show its evidence status. Everything else is 0.2.0 unchanged.

const TEXTS: Readonly<Record<string, string>> = {
  PATHWAY_RECENT_SHIPMENT: "You've completed an export shipment, so you start on Pathway B.",
  PATHWAY_NO_RECENT_SHIPMENT: "You haven't completed an export shipment yet, so you start on Pathway A.",
  PATHWAY_SHIPMENT_UNVERIFIED: "This rests on what you told us about your shipment. Entrust may ask to see a record of it, and your plan goes ahead in the meantime.",
};

export const TRADE_RULES_0_3_0: TradeRules = {
  ...TRADE_RULES_0_2_0,
  version: "0.3.0",
  reasonCodes: TRADE_RULES_0_2_0.reasonCodes.map((r) => ({ ...r, text: TEXTS[r.code] ?? r.text })),
  pathway: { shipmentWindowMonths: null, selfReportedAccepted: true },
};
