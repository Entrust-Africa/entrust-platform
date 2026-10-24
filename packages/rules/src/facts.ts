import type { Condition, FactDefinition } from "./types";

export const FACTS: readonly FactDefinition[] = [
  {
    key: "product",
    label: "Product category",
    help: "The launch corridors' product groups (Entrust, Q1).",
    options: [
      { value: "green_coffee", label: "Green coffee" },
      { value: "roasted_coffee", label: "Roasted coffee" },
      { value: "oilseeds_spices", label: "Oilseeds and spices" },
      { value: "fresh_produce", label: "Fresh produce" },
      { value: "processed_food", label: "Processed food" },
    ],
  },
  {
    key: "destinationCountry",
    label: "Destination country",
    help: "ISO 3166-1 alpha-2 code of the importing country.",
  },
  {
    key: "transportMode",
    label: "Transport mode",
    help: "Main carriage.",
    options: [
      { value: "sea", label: "Sea freight" },
      { value: "air", label: "Air freight" },
    ],
  },
  {
    key: "coldChain",
    label: "Cold chain",
    help: "Whether the cargo needs temperature control (reefer).",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
  {
    key: "paymentTerms",
    label: "Payment terms",
    help: "Every payment instrument in the contract. A 10% advance with 90% CAD records both.",
    multiple: true,
    options: [
      { value: "lc", label: "Letter of credit" },
      { value: "cad", label: "Cash against documents" },
      { value: "advance_tt", label: "Advance telegraphic transfer" },
    ],
    determinedAt: "STEP-025",
  },
  {
    key: "incoterm",
    label: "Incoterm",
    help: "Incoterms 2020 rule in the contract. The named place is recorded separately.",
    options: [
      { value: "FCA", label: "FCA" },
      { value: "FOB", label: "FOB" },
      { value: "CFR", label: "CFR" },
      { value: "CIF", label: "CIF" },
    ],
    determinedAt: "STEP-022",
  },
  {
    key: "sourcingChannel",
    label: "Sourcing channel",
    help: "How the exporter buys the commodity.",
    options: [
      { value: "ecx", label: "ECX" },
      { value: "direct", label: "Direct purchase (farm-gate or own farm)" },
    ],
    determinedAt: "STEP-055",
  },
  {
    key: "phytoCertificateRequired",
    label: "Phytosanitary certificate required",
    help: "Whether the destination or the buyer requires a phytosanitary certificate.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    determinedAt: "STEP-042",
  },
  {
    key: "healthCertificateRequired",
    label: "Health certificate required",
    help: "Whether the destination or the buyer requires a sanitary, health or free sale certificate.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
    determinedAt: "STEP-042",
  },
  {
    key: "customsChannel",
    label: "Customs risk channel",
    help: "The channel Ethiopian Customs assigns to the export declaration.",
    options: [
      { value: "green", label: "Green" },
      { value: "yellow", label: "Yellow" },
      { value: "red", label: "Red" },
    ],
    determinedAt: "STEP-082",
  },
];

export const EU_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

// Conditions the canonical steps share.
export const TO_US: Condition = { fact: "destinationCountry", in: ["US"] };
export const TO_TURKEY: Condition = { fact: "destinationCountry", in: ["TR"] };
export const TO_EU: Condition = { fact: "destinationCountry", in: EU_COUNTRIES };
export const BY_SEA: Condition = { fact: "transportMode", in: ["sea"] };
export const COLD_CHAIN: Condition = { fact: "coldChain", in: ["yes"] };
export const PAID_BY_LC: Condition = { fact: "paymentTerms", in: ["lc"] };
export const PAID_BY_CAD: Condition = { fact: "paymentTerms", in: ["cad"] };
export const PAID_BY_LC_OR_CAD: Condition = { fact: "paymentTerms", in: ["lc", "cad"] };
export const PAID_IN_ADVANCE: Condition = { fact: "paymentTerms", in: ["advance_tt"] };
export const COFFEE: Condition = { fact: "product", in: ["green_coffee", "roasted_coffee"] };
export const GRADED_COMMODITY: Condition = { fact: "product", in: ["green_coffee", "oilseeds_spices"] };
// Goods shipped loose or in bulk, which UCP 600 Art. 30(b) gives a 5% quantity tolerance. Roasted
// coffee, fresh produce and processed food are sold in packs, whose count has to match.
export const BULK_GOODS: Condition = GRADED_COMMODITY;
export const ECX_SOURCED: Condition = { fact: "sourcingChannel", in: ["ecx"] };
export const DIRECT_SOURCED: Condition = { fact: "sourcingChannel", in: ["direct"] };
export const PHYTO_REQUIRED: Condition = { fact: "phytoCertificateRequired", in: ["yes"] };
export const HEALTH_CERT_REQUIRED: Condition = { fact: "healthCertificateRequired", in: ["yes"] };
export const CIF: Condition = { fact: "incoterm", in: ["CIF"] };
export const RED_CHANNEL: Condition = { fact: "customsChannel", in: ["red"] };
