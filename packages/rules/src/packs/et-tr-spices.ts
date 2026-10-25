import { HEALTH_CERT_REQUIRED, PHYTO_REQUIRED } from "../facts";
import type { PackRequirement, RulePack } from "../types";
import { CHECKED, ETHIOPIAN_EXPORT, TRADE_LICENCE, awaiting, checked, cite, inWorkflowOrder, phytosanitaryCertificate } from "./common";
import { ET, TR } from "./sources";
import { ETHIOPIAN_SPICES } from "./spices";

// Rule pack: Ethiopian black cumin and paprika to Türkiye, researched on 24 and 25 October 2026.
// It covers the oilseeds and spices category, written for these two (see CASE-02). Turkish texts
// were read in Turkish.
//
// A published version never changes: add a new version below and list it in ET_TR_SPICES.

const TR_SIDE: readonly PackRequirement[] = [
  {
    code: "TRE-02",
    name: "Turkish tariff and duty",
    description:
      "Dried paprika and other peppers pay 41% (sweet pepper, whole, 0904.21.10) or 75% (red and other peppers, whole or crushed or ground, 0904.21.90 and 0904.22.00); whole black cumin (0910.99.91.00.14) pays 30%. Ethiopia is on Türkiye's list of least-developed countries, but that preference doesn't reach chapters 09 or 12, so no proof of preferential origin is needed. No additional customs duty applies.",
    action: "Confirm the tariff line with the importer before contracting (for paprika, whether it is sweet or other), and price the duty into the deal.",
    whyItMatters: "The duty is high and turns on the exact line, so a misclassified pepper changes the landed cost by a third.",
    responsible: "Turkish importer or its customs broker",
    trigger: "Before the contract.",
    evidence: "Tariff line and duty confirmed by the importer.",
    jurisdiction: "TR",
    authority: "Ministry of Trade (Ticaret Bakanlığı); Turkish customs",
    basis: "confirmed",
    verification: checked(
      "Import Regime Decision No. 3350 (in force 1 January 2021), consolidated to 27 August 2026: Art. 9(1) and (3) (the GSP and least-developed country rates are only in list II), list I chapters 09 and 12 (other countries: 0904.21.10 41%, 0904.21.90 and 0904.22.00 75%, 0910.99.91.00.14 30%), Annex 1 (Ethiopia among the least-developed beneficiaries); Decision No. 3351 Art. 1 and 2 (additional duty only on lists II and III); the 2026 customs tariff (Decision No. 10781). Not read: Decision 11507 (11 July 2026), reported to amend the tariff; import VAT.",
    ),
    sources: [
      cite(TR.importRegime, "Art. 9: which lists carry the preferences."),
      cite(TR.importRegimeTables, "List I chapters 09 and 12; Annex 1."),
      cite(TR.additionalDuty, "Art. 1 and 2: additional duty only on lists II and III."),
    ],
    steps: ["STEP-036"],
  },
  {
    code: "TRP-01",
    name: "Import registration for paprika (Kayıt Belgesi)",
    description:
      "Dried paprika and red pepper (0904.21.10, 0904.21.90.00.11 and 0904.22.00.00.11) may be imported only after the importer registers the import and receives an electronic registration certificate, decided within 10 working days and valid 45 days for one declaration. For the first application with each exporter, the exporter supplies an Exporter Registration Form approved by the Ethiopian authorities and then by the Turkish consulate, valid one year. Black cumin isn't on the list.",
    action: "Give the importer the Exporter Registration Form, approved and legalised, before shipment, and don't ship until the importer has the certificate.",
    whyItMatters: "Paprika without a valid registration certificate can't be declared for import.",
    responsible: "Turkish importer (the exporter supplies the legalised form)",
    trigger: "Before shipment: allow 10 working days, and the certificate lasts 45 days.",
    evidence: "Registration certificate number; the legalised Exporter Registration Form.",
    jurisdiction: "TR",
    authority: "Ministry of Trade, General Directorate of Imports (registration through the exporters' associations)",
    basis: "conditional",
    appliesWhen: { description: "the product is paprika or other dried red pepper of 0904.21.10, 0904.21.90.00.11 or 0904.22.00.00.11 (not black cumin)" },
    verification: awaiting(
      "Surveillance communiqué 2022/1 (in force 1 January 2022) Art. 2, 3, 5 and 6, Annex 1 (the registered goods) and Annex 2 (the exporter's forms), amended on 31 December 2025 and 9 October 2026; the October 2026 amendment confirms 0904.22.00.00.11 is still listed. Open: whether the two 0904.21 lines are still listed (confirmed only in the 2021 text; no consolidated list was found), and which Ethiopian authority approves the Exporter Registration Form.",
    ),
    sources: [
      cite(TR.surveillance, "Art. 2 to 6."),
      cite(TR.surveillanceAnnexes, "Annex 1 (the paprika lines) and Annex 2 (the forms)."),
      cite(TR.surveillance2026, "0904.22.00.00.11 still listed on 9 October 2026."),
    ],
    steps: ["STEP-037"],
  },
  {
    code: "TRE-01",
    name: "Turkish importer registered in TOB's food safety system",
    description:
      "The Turkish importer registers with its provincial directorate of the Ministry of Agriculture and Forestry (TOB) in the food safety information system (GGBS), and registers the producer and exporter there if they aren't already. Each product notification has an examination fee (TRY 10,728 in 2026).",
    action: "Give the importer the producer's and exporter's details for its GGBS registration, and confirm it is registered.",
    whyItMatters: "No shipment can be pre-notified for TOB's checks without the registration.",
    responsible: "Turkish importer (the exporter supplies its details)",
    trigger: "Before the first shipment.",
    evidence: "Importer's confirmation of its GGBS registration.",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (Tarım ve Orman Bakanlığı), provincial directorate",
    basis: "confirmed",
    verification: checked(
      "Law No. 5996 Art. 30 (food businesses register with the Ministry); the Ministry's page on importing plant-origin food (GGBS registration steps and the 2026 fee). Open: whether a trading importer without premises also needs a food business registration certificate.",
    ),
    sources: [cite(TR.law5996, "Art. 30: registration of food businesses."), cite(TR.tobImport, "GGBS registration; the 2026 fee.")],
    steps: ["STEP-037"],
  },
  {
    code: "TRP-02",
    name: "Contaminant limits: aflatoxins and ochratoxin A",
    description:
      "Dried peppers, paprika included, may not exceed 5 µg/kg of aflatoxin B1 and 10 µg/kg of total aflatoxins, nor 20 µg/kg of ochratoxin A. Other dried spices, black cumin among them, may not exceed 15 µg/kg of ochratoxin A; black cumin has no aflatoxin limit. A lot over a limit can't be blended down or detoxified, and TOB samples imports at its border checks.",
    action: "Test each lot for aflatoxins and ochratoxin A at an accredited laboratory before shipment, and record the results against the Turkish limits.",
    whyItMatters: "A lot over a limit is refused at the border and returned or destroyed at the importer's cost.",
    responsible: "Exporter; the Turkish importer answers for compliance",
    trigger: "Before shipment, on the export lot.",
    evidence: "Laboratory report for aflatoxins and ochratoxin A.",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (TOB)",
    basis: "confirmed",
    verification: checked(
      "Turkish Food Codex Contaminants Regulation (5 November 2023, aligned with Regulation (EU) 2023/915) Art. 5, 7 and 8, and Annex 1 entries 1.1.14 (aflatoxins in Capsicum and other listed spices), 1.2.17 (ochratoxin A in dried spices, 15) and 1.2.18 (Capsicum, 20). Annex 1 is a scanned table, read by OCR and checked against the layout. Black cumin counts as a dried spice by its tariff heading (0910); the regulation doesn't name it. No amendment found since November 2023.",
    ),
    sources: [cite(TR.contaminants, "Art. 5, 7 and 8."), cite(TR.contaminantLimits, "Annex 1 entries 1.1.14, 1.2.17 and 1.2.18.")],
    steps: ["STEP-040", "STEP-060"],
  },
  {
    code: "TRP-03",
    name: "Pesticide maximum residue limits",
    description:
      "Residues are judged against the Turkish Food Codex limits, aligned with the EU's, or 0.01 mg/kg where none is set; dried products are judged on the fresh product's limit through a processing factor. Failed lots can't be blended down.",
    action: "Check the pesticides used against the Turkish limits, and test each lot for residues before shipment.",
    whyItMatters: "A lot over a limit is refused at the border.",
    responsible: "Exporter; the Turkish importer answers for compliance",
    trigger: "Before shipment, on the export lot.",
    evidence: "Pesticide residue laboratory report.",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (TOB)",
    basis: "confirmed",
    verification: checked(
      "Turkish Food Codex pesticide residue regulation (27 September 2021, based on Regulation (EC) 396/2005) Art. 6 (the limits; 0.01 mg/kg by default) and 8 (processing factors); its annexes were replaced on 7 January 2025. The limits for black cumin and paprika weren't looked up.",
    ),
    sources: [cite(TR.pesticides, "Art. 6 and 8."), cite(TR.pesticides2025, "The annexes replaced in January 2025.")],
    steps: ["STEP-040", "STEP-060"],
  },
  {
    code: "TRP-04",
    name: "Plant health: phytosanitary certificate for whole black cumin",
    description:
      "Since 1 July 2026 whole spices of heading 0910, black cumin among them, are under Türkiye's plant quarantine control: the importer applies with the original phytosanitary certificate, the shipment is pre-notified at least 24 hours before arrival by sea (4 hours by air), and it enters only through the authorised customs offices. The certificate follows the IPPC model, in Turkish or English, addressed to Türkiye. Ground black cumin and dried paprika aren't under plant quarantine control. Wooden packaging must meet ISPM 15.",
    action: "At STEP-042, record a phytosanitary certificate as required for whole black cumin (not for paprika or ground black cumin), and send the original with the shipment.",
    whyItMatters: "Whole black cumin without a valid certificate is refused at the first point of entry.",
    responsible: "Exporter (certificate from the Ethiopian Agricultural Authority); the Turkish importer applies",
    trigger: "Before shipment; pre-notified at least 24 hours before arrival by sea.",
    evidence: "Phytosanitary certificate.",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (TOB), plant quarantine directorates at the entry point",
    basis: "conditional",
    appliesWhen: { condition: PHYTO_REQUIRED, description: "the product is whole black cumin (recorded at STEP-042); ground black cumin and paprika need none" },
    verification: awaiting(
      "Plant Quarantine Regulation (6 May 2026, in force 4 August 2026) Art. 3(4), 5, 8(2), 8(4), 8(15) and 22; communiqué 2026/5 Annex 7, as amended by communiqué 2026/34 Art. 4, 5 and 7 (whole headings 09.09 and 09.10 under plant quarantine control from 1 July 2026); the communiqué on authorised customs offices. Open: Annex 5 of the 2026 regulation, the list of goods that must carry a certificate, still shows only the old chapter 09 lines, so the two lists disagree; send the certificate with whole black cumin. A first import from a new origin can trigger a pest risk analysis (Art. 8(9)): ask the importer whether Ethiopian black cumin has entered before.",
    ),
    sources: [
      cite(TR.plantQuarantine, "Art. 3, 5, 8 and 22."),
      cite(TR.plantQuarantineAnnexes, "Annex 5 (the old list)."),
      cite(TR.importControl, "Annex 7: goods under plant quarantine control."),
      cite(TR.importControlAmendment, "Whole spices of 09.09 and 09.10 added from 1 July 2026."),
      cite(TR.entryPoints, "The authorised customs offices."),
    ],
    steps: ["STEP-040", "STEP-042"],
  },
  {
    code: "TRP-05",
    name: "Food certificate from the Ethiopian authorities",
    description:
      "Each import of plant-origin food needs a certificate approved by the competent authority of the country of origin, naming the product, the producer or exporter and the approving officer, valid at the document check (12 months if no date is given). Where the country issues no such certificate, a phytosanitary certificate is accepted instead. For Ethiopia, TOB's list of recognised issuers still names the food regulator by its 2018 name (EFMHACA, now EFDA). Whole black cumin, under plant quarantine control, travels on its phytosanitary certificate instead.",
    action: "Ask the importer which certificate TOB will accept for the lot (EFDA's export health certificate or the phytosanitary certificate), and send it with the shipment.",
    whyItMatters: "TOB won't issue its conformity letter, and customs won't release the goods, without it.",
    responsible: "Exporter (certificate from EFDA or the Ethiopian Agricultural Authority)",
    trigger: "Before shipment.",
    evidence: "Health certificate or phytosanitary certificate for the lot.",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (TOB); issued in Ethiopia",
    basis: "conditional",
    appliesWhen: { condition: HEALTH_CERT_REQUIRED, description: "the product is paprika or ground black cumin (recorded at STEP-042); whole black cumin travels on its phytosanitary certificate" },
    verification: awaiting(
      "Regulation on official controls of imported plant-origin food and feed Art. 9(1) to (7), as amended in 2013; the Ministry's list of recognised certificate issuers (14 October 2026), Ethiopia row. Open: whether TOB accepts EFDA's certificate under its current name, or the Ethiopian Agricultural Authority's phytosanitary certificate under Art. 9(5); and whether EFDA issues export health certificates for spices, which ECTA regulates (EFDA's Directive 357 covers food made by food manufacturers).",
    ),
    sources: [
      cite(TR.plantFoodImport, "Art. 9: the certificate."),
      cite(TR.certificateIssuers, "Ethiopia's recognised issuer."),
      cite(ET.efda357, "Art. 26: EFDA's export health certificate."),
    ],
    steps: ["STEP-051", "STEP-070"],
  },
  {
    code: "TRP-06",
    name: "Turkish labelling for retail packs",
    description:
      "Food prepacked for consumers carries, in Turkish: the name, ingredients and allergens, net quantity, date of minimum durability, storage conditions, the importer's name and address, the business registration number and the country of origin; the importer is responsible for it. Labels must meet the April 2024 amendment by 31 December 2026. Bulk spices for the importer's own processing need no Turkish label, though they must carry enough information for the next business.",
    action: "For retail packs, have the importer approve the Turkish label before printing; for bulk, record the importer's declaration that it will process the goods itself.",
    whyItMatters: "Retail packs without a compliant Turkish label are refused or relabelled at the importer's cost.",
    responsible: "Turkish importer, with the exporter (the packer)",
    trigger: "Before retail packaging is printed.",
    evidence: "Approved Turkish label, or the importer's own-use declaration.",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (TOB)",
    basis: "conditional",
    appliesWhen: { description: "the spices are prepacked for retail sale in Türkiye (bulk for the importer's own processing needs no Turkish label)" },
    verification: checked(
      "Turkish Food Codex labelling regulation (26 January 2017) Art. 8, 9, 18 and 29 to 31; the amendment of 6 April 2024 (compliance by 31 December 2026); regulation on imported plant-origin food Art. 13 (bulk and own-use food needs no label; labels can be corrected and notified again). Not read: later amendments (one of 21 June 2025 is reported) and TOB's labelling guide.",
    ),
    sources: [
      cite(TR.labelling, "Art. 8, 9, 18 and 29 to 31."),
      cite(TR.labelling2024, "Compliance by 31 December 2026."),
      cite(TR.plantFoodImport, "Art. 13: labels on imported food."),
    ],
    steps: ["STEP-043"],
  },
  {
    code: "TRE-03",
    name: "TOB import control: pre-notification, checks and conformity letter",
    description:
      "Spices are plant-origin food under TOB's import control. The importer pre-notifies each shipment in GGBS with the certificate, label and ingredients; TOB reviews it within two working days and checks the documents, identity and physical condition, taking samples at risk-based rates, before the declaration or in temporary storage. Customs release the goods only on TOB's conformity letter; non-compliant goods get a non-conformity letter and are returned or dealt with as TOB decides, at the importer's cost.",
    action: "Send the importer the shipping documents, certificates and lot details in time for the pre-notification, and record TOB's conformity letter.",
    whyItMatters: "Without TOB's conformity letter customs won't release the goods.",
    responsible: "Turkish importer (the exporter supplies the documents)",
    trigger: "Before arrival; checks on arrival.",
    evidence: "TOB conformity letter (Uygunluk Yazısı).",
    jurisdiction: "TR",
    authority: "Ministry of Agriculture and Forestry (TOB); Ministry of Trade; Turkish customs",
    basis: "confirmed",
    verification: checked(
      "Communiqué 2026/5 (in force 1 January 2026) Art. 4, 5, 6, 8 and 12, and Annex 2 (chapters 09 and 12); regulation on imported plant-origin food Art. 5 to 7 and 12; Law No. 5996 Art. 34; Customs Law No. 4458 Art. 74 (release for free circulation). No control certificate (Kontrol Belgesi) is needed for these products: it is only for Annex 1/A, 3 and 12 goods. Commercial quality control (TAREKS) doesn't cover chapter 09. TOB may raise sampling rates for an origin without publishing it: no measure specific to Ethiopia was found.",
    ),
    sources: [
      cite(TR.importControl, "Art. 4 to 12 and Annex 2."),
      cite(TR.plantFoodImport, "Art. 5 to 7 and 12."),
      cite(TR.law5996, "Art. 34."),
      cite(TR.customsLaw, "Art. 74: release for free circulation."),
    ],
    steps: ["STEP-105", "STEP-106"],
  },
];

const V0_1_0: RulePack = {
  id: "et-tr-spices",
  version: "0.1.0",
  name: "Ethiopian black cumin and paprika to Türkiye",
  corridor: { products: ["oilseeds_spices"], destinations: ["TR"] },
  route: "Ethiopia to Djibouti (port of loading) to a Turkish port, or by air",
  status: "draft",
  checkedOn: CHECKED,
  changes: "First version, researched on 24 and 25 October 2026.",
  notes: [
    "Draft for Entrust's review: no requirement is verified by Entrust yet.",
    "Covers the oilseeds and spices category, but was researched for black cumin and dried pepper only (CASE-02).",
    "Spices are regulated by ECTA under Directive 994/2016, not MoTRI as Entrust's answer had it: MoTRI or the regional trade bureau issues the business licence (ELG-03), ECTA the certificate of competence (ELG-04).",
    "Whether a phytosanitary certificate is needed now turns on the product's form: whole black cumin yes since 1 July 2026, paprika and ground black cumin no (TRP-04).",
    "No preferential origin applies: Türkiye's least-developed country preference doesn't cover chapters 09 and 12. Import VAT wasn't researched.",
  ],
  requirements: inWorkflowOrder([
    ...ETHIOPIAN_EXPORT,
    TRADE_LICENCE,
    ...ETHIOPIAN_SPICES,
    phytosanitaryCertificate("Türkiye requires one for whole black cumin since 1 July 2026, but not for paprika or ground black cumin (TRP-04).", {
      condition: PHYTO_REQUIRED,
      description: "the product is whole black cumin, or the buyer or bank asks for a certificate (recorded at STEP-042)",
    }),
    ...TR_SIDE,
  ]),
};

/** Every published version, oldest first. */
export const ET_TR_SPICES: readonly RulePack[] = [V0_1_0];
