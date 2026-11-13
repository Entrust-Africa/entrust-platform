export interface PurchaseOrderData {
  poNumber: string;
  poDate: string;
  orderType: string;
  currency: string;
  buyer: {
    company: string;
    address: string;
    country: string;
    contactPerson: string;
    email: string;
    telephone: string;
  };
  seller: {
    company: string;
    country: string;
    businessAddress: string;
    contactPerson: string;
    email: string;
  };
  product: {
    name: string;
    origin: string;
    productForm: string;
    roast: string;
    packaging: string;
    quantity: string;
    totalNetWeight: string;
    intendedUse: string;
    hsCode: string; // Initially "To be confirmed by exporter and customs authority"
  };
  orderValue: {
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    currency: string;
  };
  deliveryTerms: {
    incoterm: string;
    namedPlace: string; // Initially "Exporter's designated handover location, Addis Ababa, Ethiopia"
    incotermsVersion: string;
    handoverNote: string;
  };
  paymentTerms: string[];
  packagingAndMarking: string[];
  qualityRequirements: string[];
  deliverySchedule: {
    confirmation: string;
    production: string;
    targetDispatch: string;
    finalDelivery: string;
  };
  requiredDocuments: string[];
}

export type StepRunStatus = "not_started" | "in_progress" | "awaiting_sme" | "completed" | "blocked" | "not_applicable";

export interface SimulationStepDefinition {
  id: string;
  phase: number;
  name: string;
  owner: "sme" | "entrust" | "system" | "bank" | "buyer" | "carrier" | "authority";
  authority: string | null;
  prerequisites: string[];
  masterControl?: string;
  milestone?: boolean;
  evidenceType?: string;
  summary: string;
  executionDetail: string;
  gapId?: "gap-hs-code" | "gap-handover-location";
}

export interface SimulationGap {
  id: "gap-hs-code" | "gap-handover-location";
  stepId: string;
  title: string;
  triggerCondition: string;
  impact: string;
  policyReason: string;
  noticeHeading: string;
  noticeMessage: string;
  resolutionLabel: string;
  resolvedMessage: string;
}

export interface SimulationLogEntry {
  id: string;
  timestamp: string;
  phase: number;
  stepId: string;
  actor: string;
  action: string;
  detail: string;
  level: "info" | "warning" | "success" | "milestone";
}

export type PlaybackSpeed = 0.5 | 1 | 2 | 5;
