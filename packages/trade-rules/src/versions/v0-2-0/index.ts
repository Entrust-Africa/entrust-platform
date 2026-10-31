import type { ReasonCodeDefinition, TradeRules } from "../../types";
import { TRADE_RULES_0_1_0 } from "../v0-1-0";

// 0.1.0 can score a placement assessment. 0.2.0 adds what the engine needs to assign a pathway and
// build a learning plan, so those parameters are versioned with the rules and not hidden in code.
// Everything else is 0.1.0 unchanged.

const PATHWAY_REASON_CODE_DEFINITIONS: readonly ReasonCodeDefinition[] = [
  { code: "PATHWAY_RECENT_SHIPMENT", text: "You shipped an export in the last two years, so you start on Pathway B." },
  { code: "PATHWAY_NO_RECENT_SHIPMENT", text: "You haven't shipped an export in the last two years, so you start on Pathway A." },
  { code: "PATHWAY_SHIPMENT_UNVERIFIED", text: "We still need to see a record of your shipment before Pathway B is confirmed." },
  { code: "PATHWAY_ORDER_PRIORITY", text: "You have a confirmed first order, so you stay on Pathway A and your plan puts that order first." },
];

export const TRADE_RULES_0_2_0: TradeRules = {
  ...TRADE_RULES_0_1_0,
  version: "0.2.0",
  reasonCodes: [...TRADE_RULES_0_1_0.reasonCodes, ...PATHWAY_REASON_CODE_DEFINITIONS],
  // Pathway B means a verified shipment in the last 24 months (#48). The review says a former exporter
  // with an older shipment starts on Pathway A.
  pathway: { shipmentWindowMonths: 24 },
  plan: {
    // Placement spec section 5 of the rules engine: an order, a shipment or a shipment awaiting payment.
    liveOrderStages: ["order_confirmed", "shipment_underway", "shipped_awaiting_payment"],
    quotationStages: ["quotation_sent"],
    // A buyer who has only been identified or contacted isn't qualified. From an inquiry on there is one.
    noBuyerStages: ["none", "buyer_identified", "buyer_contacted"],
    exportedHistory: ["occasional_exports", "regular_exports"],
    urgentModules: ["M04", "M06", "M08"],
    // Bottlenecks follow the curriculum's rule numbers (Rule 2 M04, 3 M05, 4 M06, 5 M08, 6 M07), with
    // M02 first because records come before everything else, and M03 after costing: in the placement
    // spec's first-time exporter profile bankability follows the buyer and costing work.
    sequence: {
      first: ["M01"],
      bottleneck: ["M02", "M04", "M05", "M06", "M03", "M08", "M07"],
      enabler: ["M09"],
      closing: ["M10", "M11", "M12"],
    },
  },
};
