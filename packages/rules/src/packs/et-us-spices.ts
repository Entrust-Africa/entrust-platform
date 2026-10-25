import { PHYTO_REQUIRED } from "../facts";
import type { PackRequirement, RulePack } from "../types";
import {
  CHECKED,
  ETHIOPIAN_EXPORT,
  TRADE_LICENCE,
  US_FACILITY,
  US_FSVP,
  US_IMPORTER,
  US_ISF,
  US_PREVENTIVE_CONTROLS,
  US_PRIOR_NOTICE,
  US_RELEASE,
  awaiting,
  checked,
  cite,
  inWorkflowOrder,
  phytosanitaryCertificate,
} from "./common";
import { US } from "./sources";
import { ETHIOPIAN_SPICES } from "./spices";

// Rule pack: Ethiopian black cumin and paprika to the United States, researched on 24 and 25
// October 2026. It covers the oilseeds and spices category, written for these two (see CASE-02).
//
// A published version never changes: add a new version below and list it in ET_US_SPICES.

const US_SIDE: readonly PackRequirement[] = [
  {
    code: "USE-02",
    name: "US tariff classification and duty",
    description:
      "Dried paprika (Capsicum annuum) is HTS 0904.21.20 whole and 0904.22.20 crushed or ground, at 3 cents a kilogram; other dried hot pepper is 0904.21.60 whole (2.5 cents/kg) or 0904.22.76 ground (5 cents/kg). Whole Nigella seed has no CBP ruling: 0910.99.60 (other spices, 1.9%), 0909.31 (cumin seed, free) and 1207.99 (oil seeds, free) are all possible, and a binding ruling settles it. Ethiopia has no AGOA or GSP preference, and no additional US duty applies to these products. Entry is made within 15 days of landing.",
    action: "Confirm the HTS code before shipping (for Nigella seed, ask the importer whether to seek a binding ruling) and record the duty assessed at entry.",
    whyItMatters: "Classification decides the duty and whether the bags must be marked with the country of origin (USP-05).",
    responsible: "US importer of record or its broker",
    trigger: "Before shipment (classification); within 15 days of landing (entry).",
    evidence: "Tariff lookup or ruling; entry summary or broker confirmation.",
    jurisdiction: "US",
    authority: "US Customs and Border Protection (CBP); USITC tariff schedule",
    basis: "confirmed",
    verification: awaiting(
      "HTSUS 2026 Revision 21 (current from 9 October 2026), with no Chapter 99 footnote on these lines: 0904.21.20 and 0904.22.20 (3 cents/kg), 0904.21.60 (2.5 cents/kg), 0904.22.76 (5 cents/kg), 0910.91.00 (1.9%); CBP rulings NY B88084 (mitmita as ground Capsicum) and HQ H053755 (where a chili blend leaves heading 0904). General Note 16(a) doesn't list Ethiopia as an AGOA beneficiary (its designation ended on 1 January 2022, Proclamation 10326; AGOA runs to 31 December 2026, Proclamation 11030), and General Note 4 says GSP hasn't been renewed. The coffee pack's check of additional duties holds: the IEEPA duties ended (EO 14389), the Section 122 surcharge expired on 23 July 2026, and EO 14436 is waived; no Federal Register action on Ethiopia from 1 September to 24 October 2026. Open: the subheading for whole Nigella seed. Time-sensitive: check again before each shipment.",
    ),
    sources: [
      cite(US.hts, "Rev. 21: headings 0904, 0909, 0910 and 1207."),
      cite(US.cbpMitmita, "Ground hot pepper in heading 0904."),
      cite(US.cbpChiliBlends, "Chili blends that leave heading 0904."),
      cite(US.htsGeneralNotes, "General Notes 4 (GSP) and 16 (AGOA beneficiaries)."),
      cite(US.agoaEthiopia, "Ethiopia's AGOA designation ended on 1 January 2022."),
      cite(US.agoa2026, "AGOA extended to 31 December 2026; Ethiopia not redesignated."),
      cite(US.frEndingTariffs, "IEEPA reciprocal duties no longer in effect."),
      cite(US.cfrEntry, "142.2: entry within 15 days of landing."),
    ],
    steps: ["STEP-036", "STEP-106"],
  },
  {
    code: "USP-07",
    name: "FDA import alerts and admission testing",
    description:
      "An FDA import alert lets FDA detain every shipment of a listed firm's product without examining it. Ethiopian spice firms are on Import Alert 99-19 for Salmonella (ground red pepper, berbere, mitmita, pepper mixes and shiro, listed from 2009 to 2019), and Ethiopian firms are on 99-39 for misbranding. Other alerts that cover spices list no Ethiopian firm: 99-42 (lead and other heavy metals), 45-02 (illegal colours such as Sudan dyes, which can't be reconditioned) and 23-14 (aflatoxins and other mycotoxins). A detained shipment is released on private laboratory results, which for heavy metals (from 23 October 2026) and mycotoxins must come from a LAAF-accredited laboratory.",
    action: "Check the exporter and the manufacturer against the import alerts before contracting; for a listed firm, arrange the laboratory evidence for release in advance.",
    whyItMatters: "A listed firm's shipments are held until test results clear them, and the importer's FSVP weighs the history (USP-02).",
    responsible: "Exporter, with the US importer",
    trigger: "Before the contract; every shipment of a listed firm.",
    evidence: "Import alert check; laboratory reports where needed.",
    jurisdiction: "US",
    authority: "US Food and Drug Administration (FDA)",
    basis: "confirmed",
    verification: awaiting(
      "FDA's Ethiopia page lists Ethiopian firms on 99-19 and 99-39 only. 99-19 (published 20 October 2026): Ethiopian Red List entries for ground red pepper, berbere, mitmita, pepper mixes, shiro and sesame seed, 2009 to 2019. 99-42 (20 October 2026; LAAF testing for toxic elements from 23 October 2026), 45-02 (23 October 2026) and 23-14 (LAAF since 1 December 2024) list no Ethiopian firm. Open: the Ethiopian entries on 99-39 (the page was too large to read), and whether Salmonella tests for release under 99-19 must come from a LAAF laboratory.",
    ),
    sources: [
      cite(US.alertsEthiopia, "Only 99-19 and 99-39 name Ethiopian firms."),
      cite(US.alertSalmonella, "Ethiopian Red List entries; release and removal."),
      cite(US.alertMisbranding, "Misbranding."),
      cite(US.alertHeavyMetals, "Lead in spices; LAAF testing from 23 October 2026."),
      cite(US.alertColours, "Illegal colours can't be reconditioned."),
      cite(US.alertMycotoxins, "Aflatoxins; LAAF testing."),
      cite(US.laaf, "The LAAF programme."),
    ],
    steps: ["STEP-037", "STEP-060"],
  },
  US_FSVP,
  US_IMPORTER,
  US_FACILITY,
  US_PREVENTIVE_CONTROLS,
  {
    code: "USP-06",
    name: "USDA APHIS entry conditions for dried pepper and Nigella seed",
    description:
      "Dried, cured or processed fruits and vegetables, dried paprika among them, enter without an APHIS permit or phytosanitary certificate. Nigella seed for eating isn't on APHIS's list of regulated seeds not for planting, so it is inspected and released. Ethiopia and Djibouti aren't khapra beetle countries, but cargo unloaded on the way in one that is (Oman, the UAE, Saudi Arabia, Egypt and India among them) counts as coming from it, and whole chilies in jute or burlap bags from there need a permit and treatment; used jute or burlap bags always do.",
    action: "Use new bags (polypropylene or paper, or new jute on a routing that doesn't unload in a khapra country), and have the importer or broker confirm the APHIS entry requirements before shipment.",
    whyItMatters: "Regulated cargo without a permit and treatment is refused, or treated at the importer's cost.",
    responsible: "Exporter (bags and routing); US importer or broker (APHIS)",
    trigger: "When the packaging and routing are chosen.",
    evidence: "Packaging and routing record; the broker's confirmation of the APHIS requirements.",
    jurisdiction: "US",
    authority: "USDA Animal and Plant Health Inspection Service (APHIS); CBP agriculture specialists",
    basis: "confirmed",
    verification: awaiting(
      "7 CFR 319.56-2 and 319.56-11(a) (dried products need no permit or phytosanitary certificate); 319.75-1 (\"from\" includes every country where the cargo was offloaded), 319.75-2(a)(4) to (6) (whole chilies and cumin seed in jute or burlap, and used bags), 319.75-3 and 319.75-4; APHIS's khapra country list (June 2022) names neither Ethiopia nor Djibouti, and no Federal Register change was found since 2019. Open: the live ACIR records, which couldn't be read, and Nigella seed, judged from the 2011 manual.",
    ),
    sources: [
      cite(US.cfrPlantProducts, "319.56-2 and 319.56-11: dried products."),
      cite(US.cfrKhapra, "319.75: khapra beetle countries and regulated articles."),
      cite(US.khapraCountries, "The khapra beetle countries (June 2022)."),
      cite(US.aphisManual, "Unlisted seeds not for planting: inspect and release (2011 edition)."),
      US.aphis,
    ],
    steps: ["STEP-042"],
  },
  {
    code: "USP-09",
    name: "US food labelling for spices packed for retail",
    description:
      "Spices packed for US consumers carry, in English: the common name on the front panel, the net quantity in ounces and pounds (metric optional), an ingredient list for blends, and the name and place of business of the manufacturer, packer or distributor. Paprika is declared as \"paprika\" or \"spice and coloring\". A single spice with insignificant nutrients and no claims needs no Nutrition Facts panel; a salted blend may. Any of the nine major allergens (sesame since 2023) is declared. Bags shipped in bulk to a US processor or packer under a written agreement don't need these labels.",
    action: "Check the retail label against FDA's rules before printing, or for bulk, record the processing agreement with the US customer.",
    whyItMatters: "Misbranded food is refused admission, and Ethiopian firms are already on FDA's misbranding alert (USP-07).",
    responsible: "Exporter (the packer), with the US importer",
    trigger: "Before the retail packaging is printed.",
    evidence: "Approved label artwork, or the bulk processing agreement.",
    jurisdiction: "US",
    authority: "US Food and Drug Administration (FDA)",
    basis: "conditional",
    appliesWhen: { description: "the spices are packed for retail sale (bulk for a US processor or packer under a written agreement is exempt)" },
    verification: checked(
      "21 CFR 101.3, 101.4, 101.5, 101.7, 101.9(j)(4) (insignificant nutrients), 101.15(c) (English; every statement repeated in any other language used), 101.22(a)(2) (spices that are also colours) and 101.100(d) (bulk for further processing: a signed agreement kept for 2 years); 21 U.S.C. 321(qq) and 343(w) (allergens; sesame from 1 January 2023). Open: whether a bulk shipment must still declare allergens.",
    ),
    sources: [
      cite(US.cfrLabelling, "101.3 to 101.22."),
      cite(US.cfrNutrition, "101.9(j): exemptions."),
      cite(US.cfrBulkExemption, "101.100(d): bulk for further processing."),
      cite(US.uscAllergens, "321(qq): the major food allergens."),
      cite(US.uscMisbranding, "343(w): allergen declaration."),
    ],
    steps: ["STEP-043"],
  },
  {
    code: "USP-05",
    name: "Country-of-origin marking: spices exempt",
    description:
      "Spices of HTS headings 0904, 0909 and 0910 (paprika, chili, spice mixtures, and Nigella if classified there) and their containers are exempt from country-of-origin marking. Nigella seed classified as an oil seed (1207.99) isn't, and its bags must carry the English name of the country, such as \"Product of Ethiopia\". Marking is allowed either way, and buyers often ask for it.",
    action: "Mark the bags \"Product of Ethiopia\" unless the importer confirms the spice exemption applies.",
    whyItMatters: "Unmarked goods that need marking are held at entry or charged marking duties.",
    responsible: "Exporter (marks the bags); the US importer is liable at entry",
    trigger: "When the lot is bagged and marked.",
    evidence: "Photograph of the bag marks.",
    jurisdiction: "US",
    authority: "US Customs and Border Protection (CBP)",
    basis: "confirmed",
    verification: checked("19 U.S.C. 1304(g) (the spice subheadings, containers included); CBP ruling N327895 (Ethiopian berbere and its container need no marking); 19 CFR 134.11 and 134.35 for other goods."),
    sources: [cite(US.uscMarking, "1304(g): spices."), cite(US.cbpBerbere, "Ethiopian berbere: no marking needed."), cite(US.cfrMarking, "134.11 and 134.35.")],
    steps: ["STEP-043", "STEP-066"],
  },
  US_PRIOR_NOTICE,
  US_ISF,
  US_RELEASE,
];

const V0_1_0: RulePack = {
  id: "et-us-spices",
  version: "0.1.0",
  name: "Ethiopian black cumin and paprika to the United States",
  corridor: { products: ["oilseeds_spices"], destinations: ["US"] },
  route: "Ethiopia to Djibouti (port of loading) to the United States, or by air",
  status: "draft",
  checkedOn: CHECKED,
  changes: "First version, researched on 24 and 25 October 2026.",
  notes: [
    "Draft for Entrust's review: no requirement is verified by Entrust yet.",
    "Covers the oilseeds and spices category, but was researched for black cumin and dried pepper only (CASE-02).",
    "Spices are regulated by ECTA under Directive 994/2016, not MoTRI as Entrust's answer had it: MoTRI or the regional trade bureau issues the business licence (ELG-03), ECTA the certificate of competence (ELG-04). Spices aren't traded through ECX and have no minimum export price.",
    "Not applicable: FDA's food traceability rule (no dried spice is on its list, and FDA won't enforce it before 20 July 2028). Open: whole Nigella seed that is only cleaned and bagged may be a raw agricultural commodity under the produce safety rule (21 CFR 112.3); no FDA statement was found.",
    "Fumigation and irradiation: spices may be irradiated up to 30 kGy (21 CFR 179.26), labelled with the radura. EPA tolerances for pesticides and fumigants such as ethylene oxide (40 CFR part 180) weren't read.",
  ],
  requirements: inWorkflowOrder([
    ...ETHIOPIAN_EXPORT,
    TRADE_LICENCE,
    ...ETHIOPIAN_SPICES,
    phytosanitaryCertificate("The US requires none for dried paprika or Nigella seed (USP-06), but a buyer or bank may still ask for one.", {
      condition: PHYTO_REQUIRED,
      description: "the buyer's contract or the bank's document list asks for a phytosanitary certificate (recorded at STEP-042); US rules don't",
    }),
    ...US_SIDE,
  ]),
};

/** Every published version, oldest first. */
export const ET_US_SPICES: readonly RulePack[] = [V0_1_0];
