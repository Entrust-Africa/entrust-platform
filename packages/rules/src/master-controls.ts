import type { MasterControl } from "./types";

// The 14 master controls from the Operational Control Matrix. `checkpointStages` maps the pilot
// checkpoints (CE-01-S01 to CE-06-S14) by what each checkpoint does. The spec maps them by
// position (S06 to MC-06 and so on), which is wrong for S06 to S12: S06 is finance (MC-07), S07
// production (MC-08), S08 packaging (MC-06), S10 container availability (MC-09), and S11 and S12
// customs (MC-10). MC-07 is renamed from "Banking, Forex & NBE Permits": banks issue the permits.
export const MASTER_CONTROLS: readonly MasterControl[] = [
  {
    id: "MC-01",
    name: "Exporter & Product ID Verification",
    objective: "Verify legal exporter status, technical product specs, processing state and 8-digit HS code.",
    classification: "mandatory",
    checkpointStages: ["S01"],
  },
  {
    id: "MC-02",
    name: "Buyer Order & Commercial Terms",
    objective: "Validate purchase order, proforma invoice, Incoterms named place, unit price and payment method.",
    classification: "mandatory",
    checkpointStages: ["S02"],
  },
  {
    id: "MC-03",
    name: "Destination Market Admissibility",
    objective: "Check importing country tariffs, entry prohibitions, US FDA facility registration and TRACES rules.",
    classification: "conditional",
    checkpointStages: ["S03"],
  },
  {
    id: "MC-04",
    name: "Registration & Sectoral Licensing",
    objective: "Audit trade license validity, tax clearance and commodity competence certificates (ECTA/MoA).",
    classification: "mandatory",
    checkpointStages: ["S04"],
  },
  {
    id: "MC-05",
    name: "Quality Inspection & Certification",
    objective: "Lab testing (moisture/pesticides), grading, phytosanitary and quality certificate issuance.",
    classification: "mandatory",
    checkpointStages: ["S05"],
  },
  {
    id: "MC-06",
    name: "Packaging, Labeling & Traceability",
    objective: "Inspect export bagging, shipping marks, batch lot stenciling and destination language labeling.",
    classification: "conditional",
    checkpointStages: ["S08"],
  },
  {
    id: "MC-07",
    name: "Banking, Forex & Export Permits",
    objective: "Submit the eSW bank export permit, check the contract price against the minimum export price, and secure the permit.",
    classification: "mandatory",
    checkpointStages: ["S06"],
  },
  {
    id: "MC-08",
    name: "Supply Sourcing & Processing",
    objective: "Track ECX purchases, direct farm-gate sourcing, processing batch records and yield losses.",
    classification: "advisory",
    checkpointStages: ["S07"],
  },
  {
    id: "MC-09",
    name: "Logistics & Transport Booking",
    objective: "Confirm freight booking, equipment allocation (dry/reefer), inland haulage and transit.",
    classification: "mandatory",
    checkpointStages: ["S09", "S10"],
  },
  {
    id: "MC-10",
    name: "Customs Export Declaration",
    objective: "Submit the eSW customs declaration, physical inspection if Red Channel, and secure the release note.",
    classification: "mandatory",
    checkpointStages: ["S11", "S12"],
  },
  {
    id: "MC-11",
    name: "Destination Pre-Arrival Entry",
    objective: "US FDA Prior Notice, US ISF 10+2 and destination broker pre-clearance.",
    classification: "conditional",
    checkpointStages: [],
  },
  {
    id: "MC-12",
    name: "Shipping Document Reconciliation",
    objective: "Zero-discrepancy audit across B/L, commercial invoice, packing list and certificates.",
    classification: "mandatory",
    checkpointStages: ["S13"],
  },
  {
    id: "MC-13",
    name: "Payment Execution & CAD/LC Handoff",
    objective: "Present a clean shipping document set to the bank and track SWIFT transmission.",
    classification: "mandatory",
    checkpointStages: ["S13"],
  },
  {
    id: "MC-14",
    name: "Delivery Verification & FX Repatriation",
    objective: "Reconcile the foreign currency credit advice (SWIFT MT103) against the permit and discharge the permit.",
    classification: "mandatory",
    checkpointStages: ["S14"],
  },
];
