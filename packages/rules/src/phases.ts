import type { PhaseDefinition } from "./types";

// Phase names, ranges and milestones follow the detailed step list in the Technical Alignment
// Specification, which agrees with the Operational Control Matrix. The short specification's phase
// table gives different ranges (phase 3 as 036 to 055, and so on) that would leave milestone steps
// in the middle of a phase.
export const PHASES: readonly PhaseDefinition[] = [
  {
    id: 1,
    name: "Exporter Onboarding & Product Identity",
    milestone: "Product Identity Locked",
    firstStep: "STEP-001",
    lastStep: "STEP-018",
  },
  {
    id: 2,
    name: "Buyer Contracting & Commercial Terms",
    milestone: "Commercial Readiness Locked",
    firstStep: "STEP-019",
    lastStep: "STEP-035",
  },
  {
    id: 3,
    name: "Destination Admissibility & Regulatory Licensing",
    milestone: "Regulatory & Market Pathway Approved",
    firstStep: "STEP-036",
    lastStep: "STEP-054",
  },
  {
    id: 4,
    name: "Commodity Sourcing, Processing & Quality Control",
    milestone: "Cargo Packed & Quality Certified",
    firstStep: "STEP-055",
    lastStep: "STEP-072",
  },
  {
    id: 5,
    name: "Logistics, Container Equipment & Customs Clearance",
    milestone: "Cargo Cleared & Released for Export",
    firstStep: "STEP-073",
    lastStep: "STEP-091",
  },
  {
    id: 6,
    name: "Destination Pre-Arrival & Post-Shipment Logistics",
    milestone: "Cargo Shipped & Delivered",
    firstStep: "STEP-092",
    lastStep: "STEP-108",
  },
  {
    id: 7,
    name: "Banking Presentation, FX Repatriation & Case Closure",
    milestone: "Payment Reconciled & Case Closed",
    firstStep: "STEP-109",
    lastStep: "STEP-125",
  },
];
