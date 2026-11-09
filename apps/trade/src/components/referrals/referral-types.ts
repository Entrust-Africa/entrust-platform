export interface Referral {
  id: string;
  organizationId: string;
  organizationName: string;
  destinationName: string;
  destinationType: "bank" | "insurer" | "service_provider";
  reason: string;
  sharedDataKinds: string[];
  consentStatus: "not_requested" | "requested" | "granted" | "declined" | "withdrawn";
  consentAt: string | null;
  status: string;
  referralDate: string | null;
  responsible: string | null;
  outcome: string | null;
}

export const DESTINATION_LABEL: Record<Referral["destinationType"], string> = { bank: "Bank", insurer: "Insurer", service_provider: "Service provider" };
export const KIND_LABEL: Record<string, string> = {
  profile: "Business details",
  products: "Products",
  export_history: "Completed shipments",
  financial_worksheets: "Financial worksheets (figures only)",
};
export const CONSENT_LABEL: Record<Referral["consentStatus"], string> = {
  not_requested: "Consent not asked for yet",
  requested: "Waiting for the business to decide",
  granted: "The business agreed",
  declined: "The business declined",
  withdrawn: "The business withdrew its consent",
};
