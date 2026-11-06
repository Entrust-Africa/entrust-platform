// What an SME can let a sponsor see (#70). The sponsor of a cohort (Zemen Bank in the pilot) sees anonymised figures
// by default. Named data is shared only for the kinds the SME's owner has agreed to, and can be taken back at any
// time. The wording is versioned: a grant stores the words that were agreed to.

export const SPONSOR_DATA_KINDS = [
  "placement_results",
  "learning_progress",
  "financial_worksheets",
  "financial_documents",
  "m04_brief",
  "commercial_outcomes",
  // The insurance profile (section 4 of the onboarding diagnostic) is for EthioLife's review. Nothing shares it
  // unless this kind is granted (#78).
  "insurance_profile",
] as const;
export type SponsorDataKind = (typeof SPONSOR_DATA_KINDS)[number];

/**
 * What a Summit applicant can let Entrust share outside Entrust (#80). It uses the same agreements as the sponsors' (one live
 * row per business and kind, the wording kept with it, withdrawn at any time), but the one who shares is Entrust, so the agreement
 * is made with the Entrust organisation and cohort sponsors never see it.
 */
export const SUMMIT_DATA_KINDS = ["summit_profile"] as const;
export type SummitDataKind = (typeof SUMMIT_DATA_KINDS)[number];

/** Every kind an agreement can be for. */
export type ConsentKind = SponsorDataKind | SummitDataKind;

export const CONSENT_WORDING_VERSION = "1.0.0";

export interface DataKindInfo {
  kind: SponsorDataKind;
  /** The short name on the consent page. */
  label: string;
  /** What the sponsor would see, in words an SME owner reads before agreeing. */
  description: string;
}

export const DATA_KINDS: Readonly<Record<SponsorDataKind, DataKindInfo>> = {
  placement_results: {
    kind: "placement_results",
    label: "Placement results",
    description: "Your placement assessment scores, the learning avenue (Pathway A or B) and your learning plan.",
  },
  learning_progress: {
    kind: "learning_progress",
    label: "Learning progress",
    description: "Which modules you have started and finished, and how you did on them.",
  },
  financial_worksheets: {
    kind: "financial_worksheets",
    label: "Financial worksheets",
    description: "The costing and cash-flow worksheets you complete in the training.",
  },
  financial_documents: {
    kind: "financial_documents",
    label: "Financial documents",
    description: "The financial documents you upload, such as statements and records.",
  },
  m04_brief: {
    kind: "m04_brief",
    label: "Transaction finance brief",
    description: "The transaction finance and payment-risk brief you prepare in module M04.",
  },
  commercial_outcomes: {
    kind: "commercial_outcomes",
    label: "Orders and export results",
    description: "Your buyer pipeline, orders, financing results and export shipments recorded in TRADE.",
  },
  insurance_profile: {
    kind: "insurance_profile",
    label: "Insurance profile",
    description: "The insurance and risk answers from your onboarding diagnostic.",
  },
};

/** The sentence an SME owner agrees to, for one kind and one sponsor. Stored with the grant. */
export function consentWording(kind: SponsorDataKind, sponsorName: string): string {
  const info = DATA_KINDS[kind];
  return `I agree that ${sponsorName} can see my business's name and its ${info.label.toLowerCase()} in TRADE: ${info.description} I understand I can take this back at any time, and ${sponsorName} will stop seeing it at once.`;
}

/** The note every sponsor screen carries. Training scores are not a credit decision. */
export const SPONSOR_DISCLAIMER =
  "TRADE scores measure training progress. They are not a credit assessment, and they are not a lending decision.";

export const isSponsorDataKind = (value: string): value is SponsorDataKind => (SPONSOR_DATA_KINDS as readonly string[]).includes(value);

/** The sentence a Summit applicant's owner agrees to. Stored with the agreement. */
export const SUMMIT_PROFILE_WORDING =
  "I agree that Entrust can share the one-page Summit profile of my business with the buyers, investors and partners it introduces me to at the Summit. The profile holds what I told Entrust about my business and what it is looking for. It holds no score, finding or note of Entrust's. I understand I can take this back at any time, and Entrust will stop sharing it from the next request.";
