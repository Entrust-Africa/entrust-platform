import { EU_COUNTRIES, PHYTO_REQUIRED } from "../facts";
import type { Condition, PackRequirement, RulePack } from "../types";
import { CHECKED, ETHIOPIAN_EXPORT, checked, cite, inWorkflowOrder } from "./common";
import { ET_US_GREEN_COFFEE } from "./et-us-green-coffee";
import { ENTRY_SUMMARY, EU_IMPORTER, statementOnOrigin } from "./eu";
import { ET, EU } from "./sources";

// Rule pack: Ethiopian green and roasted coffee to the European Union.
//
// The Ethiopian side is the green coffee to US pack's: ECTA's rules apply to every coffee export,
// so its ECTA requirements are listed here unchanged. The EU side was researched on 24 and 25
// October 2026. EU acts are linked on EUR-Lex; see sources.ts for how they were read.
//
// A published version never changes: add a new version below and list it in ET_EU_COFFEE.

const GREEN: Condition = { fact: "product", in: ["green_coffee"] };
const ROASTED: Condition = { fact: "product", in: ["roasted_coffee"] };
const TO_GERMANY: Condition = { fact: "destinationCountry", in: ["DE"] };

const fromUsPack = (code: string): PackRequirement => {
  const requirement = ET_US_GREEN_COFFEE.find((p) => p.version === "0.4.0")?.requirements.find((r) => r.code === code);
  if (!requirement) throw new Error(`et-us-green-coffee 0.4.0 has no ${code}`);
  return requirement;
};

const EUDR_DATES =
  "the coffee is released for free circulation in the EU on or after 30 December 2026, or 30 June 2027 when the EU operator is a micro or small undertaking established by 31 December 2024";

const EU_SIDE: readonly PackRequirement[] = [
  // ---- Phase 1: product ----
  {
    code: "EUP-07",
    name: "Food contact packaging and the EU packaging regulation",
    description:
      "Packaging in contact with the coffee must not transfer its constituents to it, and plastic layers (liners, hermetic bags, multilayer retail bags with valves) need the supplier's declaration of compliance. Since 12 August 2026 food-contact packaging can't contain PFAS above the EU limits, and the EU importer, as the producer of the packaging, registers in each member state's producer register.",
    action: "Get the bag or liner supplier's declaration of compliance, pass it to the importer, and confirm the importer handles the packaging registration.",
    whyItMatters: "Packaging that doesn't comply makes the food non-compliant, and the importer can't place packaged goods on the market without registering.",
    responsible: "Exporter (packaging supplier's declaration); EU importer (registration)",
    trigger: "When the packaging is chosen, before packing.",
    evidence: "Packaging supplier's declaration of compliance.",
    jurisdiction: "EU",
    authority: "Member state food control and packaging authorities",
    basis: "confirmed",
    verification: checked(
      "Regulation (EC) No 1935/2004 Art. 3, 15, 16 and 17; Regulation (EU) No 10/2011 Art. 2(1)(e) (plastic layers in multilayer materials), 15 and 16 (declaration of compliance), consolidated 14 July 2026; Regulation (EU) 2025/40 Art. 3(15) (the importer as producer), 5(5) (PFAS: 25 ppb for one PFAS, 250 ppb for the sum, 50 ppm in total), 44, 45 and 71 (applies from 12 August 2026). Open: whether the destination's producer register is open yet, and how jute sacks of green coffee are treated.",
    ),
    sources: [
      cite(EU.foodContact, "Art. 3, 15 to 17."),
      cite(EU.plastics, "Art. 2(1)(e), 15 and 16: declaration of compliance."),
      cite(EU.packaging, "Art. 3(15), 5(5), 44, 45 and 71."),
    ],
    steps: ["STEP-007", "STEP-065"],
  },

  // ---- Phase 3: destination admissibility ----
  {
    code: "EUE-02",
    name: "EU tariff classification and duty",
    description:
      "Green coffee, not decaffeinated (CN 0901 11 00), enters free of duty. Roasted coffee, not decaffeinated (0901 21 00), has a conventional duty of 7.5%; decaffeinated coffee 8.3% green and 9% roasted. Ethiopia is an Everything But Arms country, so originating coffee pays no duty with a statement on origin (ORG-01).",
    action: "Confirm the CN code and, for roasted or decaffeinated coffee, that the importer will claim the Everything But Arms preference.",
    whyItMatters: "Classification and origin decide the duty: roasted coffee without a valid statement on origin pays 7.5%.",
    responsible: "EU importer or its customs representative",
    trigger: "Before shipment. The 2027 Combined Nomenclature applies from 1 January 2027.",
    evidence: "Tariff lookup (TARIC) for the CN code and origin ET.",
    jurisdiction: "EU",
    authority: "European Commission (Combined Nomenclature, TARIC); member state customs",
    basis: "confirmed",
    verification: checked(
      "Implementing Regulation (EU) 2025/1926 (Combined Nomenclature 2026): 0901 11 00 Free, 0901 12 00 8.3%, 0901 21 00 7.5%, 0901 22 00 9%. Regulation (EU) No 978/2012 Art. 18(1) and Annex IV (Ethiopia, EBA), replaced from 1 January 2027 by Regulation (EU) 2026/1395 (Ethiopia, EBA, in Annex I). Time-sensitive: the 2027 nomenclature wasn't published by 24 October 2026, and TARIC's measures for origin ET couldn't be read by script; check both before shipment.",
    ),
    sources: [
      cite(EU.cn2026, "Heading 0901: conventional rates for 2026."),
      cite(EU.gsp, "Art. 18(1) and Annex IV: Ethiopia under Everything But Arms."),
      cite(EU.gsp2027, "From 1 January 2027: Art. 18 and Annex I."),
    ],
    steps: ["STEP-036"],
  },
  EU_IMPORTER,
  {
    code: "EUP-01",
    name: "EU deforestation regulation (EUDR): due diligence statement",
    description:
      "Coffee, green or roasted (heading 0901), may be placed on the EU market only if it is deforestation-free (no deforestation after 31 December 2020), was produced under Ethiopia's relevant laws, and is covered by the EU operator's due diligence statement, submitted in the EUDR Information System before release. The statement's reference number goes to customs before release for free circulation. Ethiopia is classed standard risk, so the operator does full due diligence; no simplified regime applies.",
    action: "Confirm the EU operator, whether the coffee will be released on or after the date that applies to it, and the due diligence statement's reference number.",
    whyItMatters: "Customs can hold coffee without a valid statement reference, and the operator can't file one without the exporter's plot data (EUP-02).",
    responsible: "EU operator (the importer); the Ethiopian exporter supplies the data",
    trigger: "Before release for free circulation: from 30 December 2026 for large and medium operators, 30 June 2027 for micro and small ones.",
    evidence: "Due diligence statement reference number, from the importer.",
    jurisdiction: "EU",
    authority: "Member state EUDR competent authority; European Commission (Information System); member state customs",
    basis: "conditional",
    appliesWhen: { description: EUDR_DATES },
    verification: checked(
      "Regulation (EU) 2023/1115 Art. 3, 4(1) and (2), 7, 8 to 11, 26(4) and Annex I (heading 0901), consolidated 18 September 2026; Art. 38 as replaced by Regulation (EU) 2025/2650 (30 December 2026; 30 June 2027 for micro and small operators established by 31 December 2024). Implementing Regulation (EU) 2025/1093 lists Ethiopia as neither low nor high risk, so it is standard risk (Art. 1(2)). The Commission's review of 4 May 2026 (COM(2026) 191) proposes no change to the dates, and the only pending amendment (COM(2026) 661) concerns French Guiana. Time-sensitive: the deciding date is release in the EU, not shipment, so coffee shipped in November 2026 may need a statement.",
    ),
    sources: [
      cite(EU.eudr, "Art. 3, 4, 7 to 11, 26(4), 38 and Annex I."),
      cite(EU.eudrDates, "The application dates in Art. 38."),
      cite(EU.eudrRisk, "Ethiopia is in neither the low-risk nor the high-risk list."),
      cite(EU.eudrGuidance, "Who is the operator at import; coffee placed on the market before the dates."),
      cite(EU.eudrReview, "No further change to the legal text proposed."),
      EU.eudrPage,
    ],
    steps: ["STEP-037", "STEP-106"],
  },

  // ---- Phase 3: contaminants, plant health, labelling ----
  {
    code: "EUP-03",
    name: "Ochratoxin A and acrylamide in roasted coffee",
    description:
      "Roasted coffee beans and ground roasted coffee may not exceed 3.0 µg/kg of ochratoxin A, and food over a maximum level can't be blended down. Roasters apply the EU's acrylamide mitigation measures for coffee and check by sampling that levels stay below the 400 µg/kg benchmark. Green coffee has no EU maximum for ochratoxin A, but it has to roast to below 3.0, so buyers usually set a limit in the contract.",
    action: "Test the roasted lot for ochratoxin A and acrylamide at an accredited laboratory and record the results against the limits.",
    whyItMatters: "A lot over the maximum can't be placed on the EU market, and a test in Ethiopia costs less than a rejection at the border.",
    responsible: "Exporter (the roaster); the EU importer answers for compliance",
    trigger: "Before shipment, on the export lot.",
    evidence: "Laboratory report for ochratoxin A and acrylamide.",
    jurisdiction: "EU",
    authority: "Member state food control authorities",
    basis: "conditional",
    appliesWhen: { condition: ROASTED, description: "the coffee is roasted (green coffee has no EU maximum level; the contract may set one)" },
    verification: checked(
      "Regulation (EU) 2023/915 Art. 2 and Annex I 1.2.14 (roasted coffee, 3.0 µg/kg), consolidated 19 August 2026: no entry for green coffee, and no 2025 or 2026 amendment touches coffee. Regulation (EU) 2017/2158 Art. 1(2)(f), 2, Annex I Part V and Annex IV (roast coffee benchmark 400 µg/kg), not amended. How the acrylamide duties apply to a roaster outside the EU isn't spelled out: the importer answers for compliance under Regulation (EC) No 178/2002 Art. 11.",
    ),
    sources: [
      cite(EU.contaminants, "Annex I 1.2.14: ochratoxin A in roasted coffee."),
      cite(EU.acrylamide, "Annex I Part V and Annex IV: coffee."),
      cite(EU.generalFoodLaw, "Art. 11: imported food complies."),
    ],
    steps: ["STEP-041", "STEP-060"],
  },
  {
    code: "EUP-04",
    name: "Pesticide maximum residue levels",
    description:
      "Coffee beans (product code 0620000) may not carry pesticide residues above the EU's maximum residue levels, which are set on green beans, or above 0.01 mg/kg where no level is set. Roasted coffee is judged on the green-bean level, adjusted for roasting. Mixing to dilute residues is prohibited.",
    action: "Check the pesticides used in the supply chain against the EU Pesticides Database, and test the lot for residues before shipment.",
    whyItMatters: "A lot over a maximum residue level can't be placed on the EU market.",
    responsible: "Exporter; the EU importer answers for compliance",
    trigger: "Before shipment, on the export lot.",
    evidence: "Pesticide residue laboratory report.",
    jurisdiction: "EU",
    authority: "Member state food control authorities",
    basis: "confirmed",
    verification: checked(
      "Regulation (EC) No 396/2005 Art. 18(1) (maximum levels; 0.01 mg/kg by default), 19 (no dilution) and 20(1) (processed products), read in the original text; Regulation (EU) 2018/62 Annex I: 0620000 coffee beans, levels on green beans. Not retrieved: the level for each pesticide, because the database's API failed; look them up before shipment.",
    ),
    sources: [
      cite(EU.mrl, "Art. 18 to 20."),
      cite(EU.mrlProducts, "Annex I: 0620000 coffee beans, green beans."),
      cite(EU.mrlDatabase, "The levels by product and pesticide."),
    ],
    steps: ["STEP-041", "STEP-060"],
  },
  {
    code: "EUP-05",
    name: "EU plant health and border checks: no phytosanitary certificate or CHED",
    description:
      "EU plant health law requires no phytosanitary certificate for green coffee beans (only for fresh coffee berries in the husk), and roasted coffee is processed. Coffee isn't on the EU's list of food under increased border controls (Ethiopia's entries there are sesame seed, and dried peppers and spices), so no CHED is filed, though ordinary risk-based checks still apply. Wood packaging, such as pallets, must be ISPM 15 treated and marked.",
    action: "At STEP-042, record that EU law needs no phytosanitary certificate for coffee beans, and record one as required only if the buyer's contract or the bank asks for it. Use ISPM 15 marked pallets if any are used.",
    whyItMatters: "An unneeded certificate costs time; one the buyer or the bank requires still decides payment (PHY-01).",
    responsible: "Exporter",
    trigger: "When the destination's requirements are checked.",
    evidence: "The recorded result of the check.",
    jurisdiction: "EU",
    authority: "Member state plant protection organisations and border control posts",
    basis: "confirmed",
    verification: checked(
      "Implementing Regulation (EU) 2019/2072 Annex XI, consolidated 15 October 2026: the only coffee line is in Part B, fresh coffee berries in the husk (ex 0901 11 00); no coffee in Annexes VI or VII. Regulation (EU) 2016/2031 Art. 2(1) and (2) (beans are plant products), 43 (wood packaging), 72 and 73. Implementing Regulation (EU) 2019/1793, consolidated 30 June 2026: Ethiopia's entries are sesame seed (Salmonella, 50% of consignments) and dried peppers and spices of headings 0904 and 0910 (aflatoxins, 30%); no coffee from any country is listed. Regulation (EU) 2017/625 Art. 44 and 47. 2019/1793 is revised about every six months.",
    ),
    sources: [
      cite(EU.plantHealthAnnexes, "Annex XI Part B: coffee berries only."),
      cite(EU.plantHealth, "Art. 2, 43, 72 and 73."),
      cite(EU.increasedControls, "Annex I: Ethiopia's entries are sesame seed and dried peppers and spices; no coffee."),
      cite(EU.officialControls, "Art. 44 and 47."),
    ],
    steps: ["STEP-041", "STEP-042"],
  },
  {
    code: "EUP-06",
    name: "Labelling of roasted coffee prepacked for consumers",
    description:
      "Roasted coffee prepacked for consumers carries the EU's mandatory particulars: the name of the food, the net quantity, the date of minimum durability, any storage conditions, and the name and address of the responsible food business operator (the EU importer, when the brand owner isn't in the EU), in a language consumers of the member state understand. Whole or ground coffee beans need no ingredients list or nutrition declaration. Coffee shipped in bulk for packing in the EU needs only the information the next business needs.",
    action: "Check the retail label against the EU particulars and the destination's language before printing, and have the importer confirm it.",
    whyItMatters: "Wrongly labelled packs can't be sold, and relabelling in the EU costs more than printing it right.",
    responsible: "Exporter (the roaster and packer), with the EU importer",
    trigger: "Before the retail packaging is printed.",
    evidence: "Approved label artwork.",
    jurisdiction: "EU",
    authority: "Member state food control authorities",
    basis: "conditional",
    appliesWhen: { condition: ROASTED, description: "the coffee is roasted and prepacked for the final consumer or mass caterers" },
    verification: checked(
      "Regulation (EU) No 1169/2011 Art. 8(1), (7) and (8), 9(1), 15, 19(1)(e), 26(2)(a) and Annex V point 7, consolidated 1 April 2025. Not read: the lot marking directive (2011/91/EU) and the destination's national language rules.",
    ),
    sources: [cite(EU.foodInformation, "Art. 8, 9, 15, 19 and 26; Annex V point 7.")],
    steps: ["STEP-043"],
  },

  // ---- Phase 4: the exporter's deforestation data ----
  {
    code: "EUP-02",
    name: "EUDR traceability data: plot geolocation and legality evidence",
    description:
      "For the operator's statement, the exporter supplies for each lot: the geolocation of every plot the coffee came from (latitude and longitude to six decimal places, a polygon for plots over 4 hectares), the date or period of production, the quantity, and evidence that the plots weren't deforested after 31 December 2020 and that the coffee was produced under Ethiopia's relevant laws (land use rights, environment, labour, tax, trade and customs, among others). Coffee mixed with coffee from untraced plots can't be covered.",
    action: "Record the geolocation of each plot and the production period for the lot (ECTA's ECTMS holds them for registered plots), keep the lot apart from untraced coffee, and hand the data and the legality evidence to the buyer before shipment.",
    whyItMatters: "Without the plot data the EU operator can't file its statement, and the coffee can't be placed on the EU market. Coffee bulked from many suppliers is the hardest to trace.",
    responsible: "Exporter (supplies the data under the sales contract)",
    trigger: "When the coffee is bought and the export lot is made up.",
    evidence: "Plot geolocation file and production dates for the lot; legality evidence.",
    jurisdiction: "EU",
    authority: "Member state EUDR competent authority (which acts against the EU operator)",
    basis: "conditional",
    appliesWhen: { description: EUDR_DATES },
    verification: checked(
      "Regulation (EU) 2023/1115 Art. 2(13), (28) and (40) (deforestation-free, geolocation, relevant legislation), 9(1) (what the operator holds) and 10(2) (risk factors, mixing among them), consolidated 18 September 2026. The Commission's guidance (20 July 2026): small-scale coffee growing in forest doesn't by itself make the land agricultural. Only the operator is bound; the handover is a term of the sales contract. In Ethiopia, ECTA's coffee traceability and management system (ECTMS) records plot geolocation with the farmer's land-use certificate, and the Ministry of Finance said in August 2025 that geolocation data goes to ECTA for validation and that ECTA would issue a directive. Open: that directive (not found on the Ministry of Justice portal), so whether exporters must use ECTMS.",
    ),
    sources: [
      cite(EU.eudr, "Art. 2, 9 and 10."),
      cite(EU.eudrGuidance, "Coffee grown in forest; the information required."),
      cite(EU.eudrReview, "Ethiopia's digital coffee traceability system."),
      cite(ET.ectaEudrGuide, "ECTMS: plot geolocation and land-use certificates."),
      cite(ET.mofEudr, "Geolocation data to ECTA for validation; an ECTA directive announced."),
    ],
    steps: ["STEP-055", "STEP-064"],
  },

  // ---- Phase 3: origin ----
  statementOnOrigin(
    {
      description:
        "Coffee grown in Ethiopia, and coffee roasted from it, is originating (for heading 0901 the rule is manufacture from materials of any heading); it may be stored in Djibouti but not altered there.",
      whyItMatters: "Without a valid statement roasted coffee pays the 7.5% conventional duty.",
    },
    {
      condition: ROASTED,
      description: "the coffee is roasted (or decaffeinated), so the preference saves duty; green coffee that isn't decaffeinated is duty-free anyway",
    },
  ),

  // ---- Phase 6: pre-arrival and release ----
  ENTRY_SUMMARY,
  {
    code: "EUE-05",
    name: "German coffee tax",
    description: "Germany taxes roasted coffee at EUR 2.19 a kilogram when it is released for free circulation, paid by the declarant. Green coffee isn't taxed.",
    action: "Confirm the importer has allowed for the coffee tax in the price.",
    whyItMatters: "The tax is due on release and changes the buyer's landed cost.",
    responsible: "EU importer (the declarant)",
    trigger: "Release for free circulation in Germany.",
    evidence: "Importer's confirmation.",
    jurisdiction: "DE",
    authority: "German customs (Zoll)",
    basis: "conditional",
    appliesWhen: { condition: { all: [ROASTED, TO_GERMANY] }, description: "roasted coffee is imported into Germany" },
    verification: checked(
      "Kaffeesteuergesetz § 1 (roasted coffee of heading 0901 and coffee-containing goods; green coffee isn't in the definition), § 2 (EUR 2.19/kg roasted, EUR 4.78/kg soluble) and § 15 (import from third countries). Other member states' coffee taxes weren't researched.",
    ),
    sources: [cite(EU.deCoffeeTax, "§§ 1, 2 and 15.")],
    steps: ["STEP-106"],
  },
];

const GREEN_ONLY = { condition: GREEN, description: "the coffee is green; roasted coffee has its own rules (ELG-08, QLT-12)" };

const ETHIOPIA_COFFEE: readonly PackRequirement[] = [
  { ...fromUsPack("ELG-01"), appliesWhen: GREEN_ONLY },
  {
    code: "ELG-08",
    name: "ECTA export coffee roaster: certificate of competence",
    description:
      "Roasted and roasted-and-ground coffee is export coffee, and exporting it needs ECTA's export coffee roaster certificate of competence with the business licence. The roastery (own or leased) needs a store of at least 100 m², an electric roaster of at least 100 kg an hour and a grinder of 50 kg an hour, a certified cupping laboratory, airtight aluminium-lined valve packaging and trained staff; the roaster needs bank-certified capital of ETB 500,000 (ETB 1,000,000 for a business association). It keeps origins unmixed unless ECTA approves a blend, and may not sell export roasted coffee locally. The certificate is renewed every budget year, from 1 Hamle to 30 Tahsas.",
    action: "Record the roaster's ECTA certificate of competence and its renewal for the current year.",
    whyItMatters: "ECTA registers roasted coffee contracts and certifies roasted export coffee only for a certified roaster.",
    responsible: "Exporter (the roaster; ECTA reviews and approves)",
    trigger: "Before registering a roasted coffee export contract; renewal every budget year.",
    evidence: "ECTA export coffee roaster certificate of competence.",
    jurisdiction: "ET",
    authority: "Ethiopian Coffee and Tea Authority (ECTA)",
    basis: "conditional",
    appliesWhen: { condition: ROASTED, description: "the coffee is roasted" },
    verification: checked(
      "Proclamation 1051/2017 Art. 2(10) and (31) (roasted coffee is export coffee; the roaster's certificate) and 13 (the roaster's duties: competence certificate and trade licence, unmixed origins, no local sales, records); Directive 1100 Art. 9 (the roastery's technical criteria), 22 item 11 (competence criteria, with the capital) and 23 (renewal). Directive 1106/2025's ETB 15 and 20 million applies to the coffee exporter certificate (ELG-01), not the roaster's. Open: whether the roastery also needs EFDA's food manufacturing certificate, since roasted coffee is a food under Proclamation 1112/2019; no instrument dividing the two was found.",
    ),
    sources: [
      cite(ET.coffee1051, "Art. 2 and 13: export coffee roasters."),
      cite(ET.coffee1100, "Art. 9, 22 and 23: the roastery, the criteria and renewal."),
      cite(ET.food1112, "Art. 4(2) and 6: EFDA's food manufacturer certificates."),
    ],
    steps: ["STEP-004"],
  },
  fromUsPack("QLT-01"),
  { ...fromUsPack("QLT-02"), appliesWhen: GREEN_ONLY },
  {
    code: "QLT-12",
    name: "Roasted coffee: preparation, packing and ECTA certification",
    description:
      "Export roasted coffee is made only from coffee that has finished export preparation, roasted (light, medium or dark), cooled, ground if needed, and packed with the country of production, the coffee type, grade, quantity, crop year, production and expiry dates and the trade mark printed on the pack. ECTA's quality inspection and certification centres inspect and certify the quality and origin of roasted export coffee, and ECTA issues the release letter.",
    action: "Present the roasted lot for ECTA inspection, and record the quality certificate, the release letter and the pack markings.",
    whyItMatters: "Roasted coffee can't be exported without ECTA's certificate, and the pack markings are part of what ECTA checks.",
    responsible: "Exporter (the roaster; inspection by ECTA)",
    trigger: "Lot roasted and packed.",
    evidence: "ECTA quality certificate and release letter; photograph of the pack markings.",
    jurisdiction: "ET",
    authority: "Ethiopian Coffee and Tea Authority (ECTA)",
    basis: "conditional",
    appliesWhen: { condition: ROASTED, description: "the coffee is roasted" },
    verification: checked(
      "Proclamation 1051/2017 Art. 2(26), 4(5), 13(7) and (8) (pack labelling) and 18(3) (ECTA certifies quality and origin); Directive 1100 Art. 9(4) and 16(2)(a) to (f) (preparation and packing of export roasted coffee). Sampling, timing and fees weren't found. The 2025 catalogue lists no compulsory Ethiopian Standard for roasted coffee.",
    ),
    sources: [
      cite(ET.coffee1051, "Art. 2(26), 4(5), 13(7) and (8), 18(3)."),
      cite(ET.coffee1100, "Art. 9(4) and 16(2): export roasted coffee."),
    ],
    steps: ["STEP-062", "STEP-066", "STEP-068"],
  },
  {
    ...fromUsPack("PHY-01"),
    description:
      "Ethiopian law requires a phytosanitary certificate for exported plant products only if the importing country requires one, and the Ethiopian Agricultural Authority issues it. The EU requires none for coffee beans (see EUP-05), but a buyer or bank may still ask for one.",
    appliesWhen: {
      condition: PHYTO_REQUIRED,
      description: "a phytosanitary certificate is required by the buyer's contract or the bank's document list (recorded at STEP-042); EU law requires none for coffee beans",
    },
  },
  {
    ...fromUsPack("COM-04"),
    description:
      "Ethiopia is an exporting member of the International Coffee Agreement 2007, whose rules require every coffee export, in all forms, from an exporting member to be covered by a valid certificate of origin; roasted coffee counts at 1.19 times its weight in green coffee, and lots up to 60 kg green equivalent are exempt. ECTA is empowered to issue production-country certification. No EU rule requiring the document at import was found: the Everything But Arms preference rests on the statement on origin instead (ORG-01).",
  },
  { ...fromUsPack("QLT-04"), appliesWhen: GREEN_ONLY },
];

const V0_1_0: RulePack = {
  id: "et-eu-coffee",
  version: "0.1.0",
  name: "Ethiopian green and roasted coffee to the European Union",
  corridor: { products: ["green_coffee", "roasted_coffee"], destinations: EU_COUNTRIES },
  route: "Ethiopia to Djibouti (port of loading) to an EU port, or by air from Addis Ababa",
  status: "draft",
  checkedOn: CHECKED,
  changes:
    "First version. The Ethiopian green coffee requirements come from et-us-green-coffee 0.4.0; the roasted coffee and EU requirements were researched on 24 and 25 October 2026.",
  notes: [
    "Draft for Entrust's review: no requirement is verified by Entrust yet.",
    "The deforestation regulation (EUP-01, EUP-02) applies from 30 December 2026 for large and medium operators; the deciding date is release for free circulation, not shipment. Check the buyer's size before relying on 30 June 2027.",
    "Time-sensitive: the 2027 Combined Nomenclature, the new GSP regulation (from 1 January 2027) and the new Union Customs Code (from 21 September 2027).",
    "Not modelled: import VAT, and coffee taxes in member states other than Germany; decaffeinated and soluble coffee, which have their own rates.",
  ],
  requirements: inWorkflowOrder([...ETHIOPIAN_EXPORT, ...ETHIOPIA_COFFEE, ...EU_SIDE]),
};

/** Every published version, oldest first. */
export const ET_EU_COFFEE: readonly RulePack[] = [V0_1_0];
