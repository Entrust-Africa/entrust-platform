import { EU_COUNTRIES } from "../facts";
import type { PackRequirement, RulePack } from "../types";
import { AVOCADO_COVERED, AVOCADO_STANDARD, HORTICULTURE_EXPORTER } from "./avocado";
import { CERTIFICATE_OF_ORIGIN, CHECKED, ETHIOPIAN_EXPORT, TRADE_LICENCE, awaiting, checked, cite, inWorkflowOrder, phytosanitaryCertificate } from "./common";
import { ENTRY_SUMMARY, EU_IMPORTER, statementOnOrigin } from "./eu";
import { EU } from "./sources";

// Rule pack: fresh Ethiopian Hass avocado to the European Union, researched on 24 and 25 October
// 2026. It covers the fresh produce category, written for avocados (see CASE-02).
//
// A published version never changes: add a new version below and list it in ET_EU_AVOCADO.

const EU_SIDE: readonly PackRequirement[] = [
  {
    code: "EUE-02",
    name: "EU tariff classification and duty",
    description:
      "Fresh avocados are TARIC 0804 40 00 10. The conventional duty is seasonal: 4% from 1 December to 31 May and 5.1% from 1 June to 30 November. Ethiopian avocados enter at 0% under Everything But Arms with a statement on origin (ORG-01). Avocados sold on consignment can be valued at the Commission's unit price, published every two weeks.",
    action: "Confirm the code and that the importer will claim the Everything But Arms preference; for a consignment sale, agree how the customs value is set.",
    whyItMatters: "Without a valid statement on origin the importer pays 4% or 5.1%.",
    responsible: "EU importer or its customs representative",
    trigger: "Before shipment. The 2027 Combined Nomenclature applies from 1 January 2027.",
    evidence: "Tariff lookup (TARIC) for the code and origin ET.",
    jurisdiction: "EU",
    authority: "European Commission (Combined Nomenclature, TARIC); member state customs",
    basis: "confirmed",
    verification: checked(
      "Regulation (EEC) No 2658/87 Annex I (the 2026 nomenclature), heading 0804 40 00 and the chapter 8 footnote on seasonal rates; TARIC for origin Ethiopia on 24 October 2026: third-country duty 5.10% (1 June to 30 November), GSP-EBA preference 0%, plant health control (CHED-PP), organic control for organic lots. Regulation (EU) No 978/2012 Art. 17, 18 and Annex IV, replaced from 1 January 2027 by Regulation (EU) 2026/1395 (Ethiopia, EBA, Annex I). Implementing Regulation (EU) 2015/2447 Art. 142(6) and Annex 23-02 (unit prices). Time-sensitive: the 2027 nomenclature and the unit price.",
    ),
    sources: [
      cite(EU.combinedNomenclature, "Heading 0804 40 00 and the seasonal duty."),
      cite(EU.taricAvocados, "Duty, preference and controls for origin ET."),
      cite(EU.gsp, "Art. 17, 18 and Annex IV."),
      cite(EU.gsp2027, "From 1 January 2027."),
      cite(EU.uccImplementing, "Art. 142(6) and Annex 23-02: unit prices for consignment sales."),
    ],
    steps: ["STEP-036"],
  },
  EU_IMPORTER,
  {
    code: "EUP-10",
    name: "EU marketing standard and conformity checks",
    description:
      "Fresh avocados fall under the EU's general marketing standard: intact, sound, clean, practically free from pests and pest damage to the flesh, free of abnormal moisture and foreign smell or taste, able to stand transport, and developed enough to go on ripening, with a 10% tolerance (at most 2% decayed). Fruit conforming to the UNECE avocado standard is deemed to conform. Member states check conformity on a risk basis and may make release depend on it; Ethiopia isn't among the countries whose pre-export checks the EU approves. The UNECE standard is believed to set a minimum dry matter of 21% for Hass, which buyers often write into contracts.",
    action: "Grade and pack to the general marketing standard (or the UNECE standard, if the contract cites it), and record the lot's maturity and dry-matter result.",
    whyItMatters: "Non-conforming fruit can't be moved or sold without the inspection body's authorisation, and immature fruit fails the ripening test on arrival.",
    responsible: "Exporter; the EU importer, as holder, answers for conformity",
    trigger: "Grading and packing.",
    evidence: "Grading record and dry-matter result.",
    jurisdiction: "EU",
    authority: "Member state fruit and vegetable inspection bodies",
    basis: "confirmed",
    verification: awaiting(
      "Confirmed: Regulation (EU) No 1308/2013 Art. 76(1) to (3); Delegated Regulation (EU) 2023/2429 Art. 2 (the general standard; the UNECE route; the holder), 4(1) (the 11 products with specific standards, not avocados) and Annex I Part A points 1 to 3; Implementing Regulation (EU) 2023/2430 Art. 5 (risk-based checks), 6 (customs release), 8 and Annex IV (approved third countries: Ethiopia isn't one) and 10(3). Open: the UNECE FFV-42 figures (21% dry matter for Hass), since unece.org refused every request; and whether the destination member state links release to conformity checks.",
    ),
    sources: [
      cite(EU.marketOrganisation, "Art. 76: marketing standards and the country of origin."),
      cite(EU.marketingStandards, "Art. 2 and 4; Annex I Part A."),
      cite(EU.conformityChecks, "Art. 5 to 11 and Annex IV."),
      cite(EU.conformityPage, "The approved third countries."),
      cite(EU.uneceAvocados, "Minimum dry matter by variety (not read)."),
    ],
    steps: ["STEP-041", "STEP-068"],
  },
  {
    code: "EUP-04",
    name: "Pesticide residues and contaminants",
    description:
      "Avocados (product code 0163010) may not carry pesticide residues above the EU's maximum residue levels, or above 0.01 mg/kg where none is set; the levels apply to the whole fruit. Lead may not exceed 0.10 mg/kg and cadmium 0.050 mg/kg. No EU measure puts avocados, or other Ethiopian fruit, under increased border controls (Ethiopia's entries there are sesame seed, and dried peppers and spices).",
    action: "Check the spray programme against the EU levels for avocados before harvest, and test the lot for residues before shipment.",
    whyItMatters: "A lot over a maximum residue level can't be placed on the EU market.",
    responsible: "Exporter; the EU importer answers for compliance",
    trigger: "Before harvest (spray programme) and before shipment (test).",
    evidence: "Pesticide residue laboratory report.",
    jurisdiction: "EU",
    authority: "Member state food control authorities",
    basis: "confirmed",
    verification: checked(
      "Regulation (EC) No 396/2005 Art. 18(1) and (2) (consolidated 19 August 2026); Regulation (EU) 2018/62 Annex I: 0163010 avocados, group 0163000; Regulation (EU) 2023/915 Annex I 3.1.1.2 (lead) and 3.2.1.1 (cadmium), consolidated 19 August 2026; Implementing Regulation (EU) 2019/1793, consolidated 30 June 2026: no avocado entry, and Ethiopia's entries are sesame seed and dried peppers and spices. Not retrieved: the level for each pesticide, because the database's API failed; the levels change several times a year, so look them up each season.",
    ),
    sources: [
      cite(EU.mrlConsolidated, "Art. 18."),
      cite(EU.mrlProducts, "Annex I: 0163010 avocados."),
      cite(EU.mrlDatabase, "The levels by product and pesticide."),
      cite(EU.contaminants, "Annex I: lead and cadmium in fruit."),
      cite(EU.increasedControls, "No avocado entry."),
    ],
    steps: ["STEP-041", "STEP-060"],
  },
  {
    code: "EUP-08",
    name: "EU plant health: phytosanitary certificate for avocados",
    description:
      "Fresh avocados (fruit of Persea americana) need a phytosanitary certificate from Ethiopia's plant protection organisation to enter the EU. It must be addressed to a member state's plant protection organisation, be in an official EU language, be issued no more than 14 days before the goods leave Ethiopia, and certify freedom from the EU's quarantine pests, among them the oriental fruit fly (Bactrocera dorsalis), other non-European fruit flies and false codling moth (Thaumatotibia leucotreta). No additional declaration is required for avocados. Wooden pallets and crates must be ISPM 15 treated and marked.",
    action: "At STEP-042, record that the EU requires a phytosanitary certificate, and make sure the certificate meets these conditions (PHY-01).",
    whyItMatters: "Fruit without a valid certificate, or with a quarantine pest found at the border, is refused, destroyed or treated at the importer's cost.",
    responsible: "Exporter (certificate from the Ethiopian Agricultural Authority)",
    trigger: "When the destination's requirements are checked; the certificate within 14 days before departure.",
    evidence: "Phytosanitary certificate.",
    jurisdiction: "EU",
    authority: "Member state plant protection organisations at the border control post",
    basis: "confirmed",
    verification: checked(
      "Implementing Regulation (EU) 2019/2072, consolidated 15 October 2026: Annex XI Part A point 5 (Persea americana fruit, ex 0804 40 00, from third countries other than Switzerland); Part C exempts only pineapples, coconuts, durians, bananas and dates; Annex VII has no point for avocado fruit; Annex II Part A points 77 and 78 (the fruit flies and false codling moth). Regulation (EU) 2016/2031 Art. 43 (wood packaging), 71 and 76 (the certificate and the conditions for accepting it). An interception at the border triggers official measures; 2026/1101 raised the avocado check rate because of interceptions, without naming the pests.",
    ),
    sources: [
      cite(EU.plantHealthAnnexes, "Annex XI Part A point 5; Annexes II and VII."),
      cite(EU.plantHealth, "Art. 43, 71 and 76."),
    ],
    steps: ["STEP-042"],
  },
  statementOnOrigin({
    description:
      "Avocados grown and harvested in Ethiopia are wholly obtained there; avocados from another country only packed in Ethiopia aren't. They may be stored in Djibouti but not altered there.",
    whyItMatters: "Without a valid statement the importer pays the 4% or 5.1% conventional duty.",
  }),
  {
    code: "EUP-11",
    name: "Package marking: packer and country of origin",
    description:
      "Each package shows, on one side, the packer's or dispatcher's name and address (or an official code mark) and the full or commonly used name of the country of origin, in a language consumers in the destination understand. Invoices state the product and the country of origin. Prepacked retail units also carry the net weight.",
    action: "Check the carton print and the invoice wording before packing.",
    whyItMatters: "Unmarked fruit can't be marketed, and a conformity check fails on missing marks.",
    responsible: "Exporter (packer)",
    trigger: "When the cartons are printed and the lot is marked.",
    evidence: "Photograph of the carton marks.",
    jurisdiction: "EU",
    authority: "Member state fruit and vegetable inspection bodies",
    basis: "confirmed",
    verification: checked(
      "Delegated Regulation (EU) 2023/2429 Art. 6(1), (2) and (4), 7(1) and (2), and Annex I Part A point 4; Regulation (EU) No 1308/2013 Art. 76(1). The UNECE standard adds further marks (variety, size), binding only where relied on.",
    ),
    sources: [cite(EU.marketingStandards, "Art. 6 and 7; Annex I Part A point 4."), cite(EU.marketOrganisation, "Art. 76(1).")],
    steps: ["STEP-066"],
  },
  ENTRY_SUMMARY,
  {
    code: "EUP-09",
    name: "CHED-PP prior notification and border checks",
    description:
      "Avocados are checked at the EU border control post of first arrival. The operator responsible for the consignment, normally the importer, notifies it in advance on a CHED-PP in TRACES, at least one working day before arrival, and the original phytosanitary certificate goes to the border post. Every consignment gets a documentary check; identity and physical checks are made on at least 3% of avocado consignments, picked at random. Customs releases the fruit only on a CHED-PP the border post has finalised as compliant.",
    action: "Send the importer the certificate details and the shipment data in time for the CHED-PP, and record the border post's decision.",
    whyItMatters: "Fruit isn't released without a finalised CHED-PP, and perishable cargo waiting at the border loses value by the day.",
    responsible: "EU importer (the exporter supplies the data)",
    trigger: "At least one working day before arrival.",
    evidence: "CHED-PP reference and the border post's decision.",
    jurisdiction: "EU",
    authority: "Member state plant health authority at the border control post; member state customs",
    basis: "confirmed",
    verification: checked(
      "Regulation (EU) 2017/625 Art. 47(1)(c), 49, 50(1), 56 and 57 (consolidated 5 January 2025); Implementing Regulation (EU) 2019/1715 Art. 40(1)(c) (the CHED-PP); Implementing Regulation (EU) 2019/1013 Art. 1 (one working day ahead, or four hours by derogation); Implementing Regulation (EU) 2022/2389 Annex I, as replaced by 2026/1101 (in force 15 June 2026): Persea americana from all third countries other than Cameroon, 3%. The rate is reviewed at least yearly. Border post fees are national and weren't checked.",
    ),
    sources: [
      cite(EU.officialControls, "Art. 47, 49, 50, 56 and 57."),
      cite(EU.plantHealthChecks, "Art. 40(1)(c): the CHED-PP."),
      cite(EU.priorNotification, "Art. 1: prior notification."),
      cite(EU.checkRates, "Annex I: avocados at 3%."),
      cite(EU.checkRates2026, "The current Annex I, in force 15 June 2026."),
    ],
    steps: ["STEP-105", "STEP-106"],
  },
];

const ETHIOPIA_AVOCADO: readonly PackRequirement[] = [
  AVOCADO_COVERED,
  TRADE_LICENCE,
  HORTICULTURE_EXPORTER,
  AVOCADO_STANDARD,
  phytosanitaryCertificate("The EU requires one for fresh avocados (EUP-08): record it as required at STEP-042."),
  CERTIFICATE_OF_ORIGIN,
];

const V0_1_0: RulePack = {
  id: "et-eu-avocado",
  version: "0.1.0",
  name: "Ethiopian fresh Hass avocado to the European Union",
  corridor: { products: ["fresh_produce"], destinations: EU_COUNTRIES },
  route: "Ethiopia to Djibouti (port of loading) in a reefer container to an EU port, or by air from Addis Ababa",
  status: "draft",
  checkedOn: CHECKED,
  changes: "First version, researched on 24 and 25 October 2026.",
  notes: [
    "Draft for Entrust's review: no requirement is verified by Entrust yet.",
    "Covers the fresh produce category, but was researched for Hass avocado only (CASE-02).",
    "No EU law sets a temperature for whole avocados: the reefer settings are commercial terms (TRN-06). The deforestation regulation doesn't cover avocados.",
    "The NBE directive allows consignment sales for perishables such as fruit, with the proceeds repatriated within 90 days of the permit (COM-01).",
    "Not modelled: organic lots, which need a certificate of inspection in TRACES; import VAT.",
  ],
  requirements: inWorkflowOrder([...ETHIOPIAN_EXPORT, ...ETHIOPIA_AVOCADO, ...EU_SIDE]),
};

/** Every published version, oldest first. */
export const ET_EU_AVOCADO: readonly RulePack[] = [V0_1_0];
