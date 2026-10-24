import type { SourceRef } from "./types";

// Sources cited by the canonical steps. The simulation's research (October 2026) checked these;
// rule packs re-check them with a date before relying on them (#7).

export const FXD_01_2024: SourceRef = {
  title: "NBE Foreign Exchange Directive FXD/01/2024",
  url: "https://nbe.gov.et/files/fxd-01-2024/",
  note: "7.1.1: authorized banks provide export permits. 7.1.6: export applications are valid for 30 calendar days from the date of issue. Annex One 1.3.7(d): proceeds of every permit are repatriated within 90 days of its issue date (flowers excepted); 1.11(a): NBE may extend that for good cause. 1.3.2: CAD at sight or on acceptance, with (a) the same 90 days and (c) a cap of USD 500,000 for a single permit, which NBE may exceed case by case under (e).",
};

export const ENTRUST_ANSWERS_2026_10: SourceRef = {
  title: "CLEAR Export Technical Alignment & Production Build Specification (Entrust Africa, October 2026)",
  note: "Entrust's answers to the 12 build questions (Q1 to Q12).",
};

export const PROCLAMATION_1051_2017: SourceRef = {
  title: "Coffee Quality Control and Marketing Proclamation No. 1051/2017",
  note: "Art. 10(4) originally required contract registration at NBE. USDA FAS reports registration moved to ECTA from 1 May 2025, and that ECTA sets the weekly minimum export price for coffee.",
};

export const USDA_FAS_COFFEE_ANNUAL_2025: SourceRef = {
  title: "USDA FAS, Ethiopia Coffee Annual (June 2025)",
  note: "ECTA sets a minimum export price for coffee every week. It isn't published online, so an Entrust admin loads the weekly figures into CLEAR.",
};

export const CFR_19_149_2: SourceRef = {
  title: "19 CFR 149.2 (Importer Security Filing)",
  url: "https://www.ecfr.gov/current/title-19/section-149.2",
  note: "ISF elements are due no later than 24 hours before the cargo is laden aboard the vessel at the foreign port.",
};

export const CFR_21_1_279: SourceRef = {
  title: "21 CFR 1.279 (Prior Notice timing)",
  url: "https://www.ecfr.gov/current/title-21/section-1.279",
  note: "Prior Notice must be submitted and confirmed no less than 8 hours before arrival by water, 4 hours by air (road 2, rail 4); and no more than 30 calendar days before arrival through ABI/ACE, 15 through PNSI.",
};

export const UCP_600: SourceRef = {
  title: "ICC Uniform Customs and Practice for Documentary Credits (UCP 600)",
  note: "Art. 14(c): presentation no later than 21 calendar days after the date of shipment, and not later than the credit's expiry. Art. 20(a)(ii): a bill of lading must show the goods shipped on board.",
};

export const INCOTERMS_2020: SourceRef = {
  title: "ICC Incoterms 2020 rules",
  note: "FOB, CFR and CIF are for sea and inland waterway transport only. For air or other transport the ICC rules to use are FCA, CPT or CIP.",
};
