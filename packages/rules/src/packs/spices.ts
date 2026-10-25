import type { PackRequirement } from "../types";
import { CERTIFICATE_OF_ORIGIN, checked, cite } from "./common";
import { ET } from "./sources";

// The Ethiopian side of exporting black cumin and dried pepper (paprika), shared by the spice
// packs. ECTA regulates spice exports under the Ministry of Agriculture's Directive 994/2016,
// registered on 18 March 2024. Read on 24 and 25 October 2026.

export const SPICES_COVERED: PackRequirement = {
  code: "CASE-02",
  name: "Product covered by this pack",
  description:
    "This pack was researched for black cumin (Nigella sativa seed) and for paprika and other dried Capsicum pepper, whole, crushed or ground. Another product in the oilseeds and spices category has other rules: sesame, for one, is traded through ECX and registered with MoTRI.",
  action: "Confirm the product is black cumin or dried pepper. For another oilseed or spice, ask Entrust to check its rules before relying on this pack.",
  whyItMatters: "The licensing, inspection, tariff and plant health rules differ from one product to the next.",
  responsible: "CLEAR facilitator",
  trigger: "When the product is identified.",
  evidence: "The product's botanical name and form.",
  jurisdiction: null,
  authority: "Entrust (the pack's scope)",
  basis: "transaction",
  verification: checked(
    "The pack's scope. Sesame's Ethiopian rules (Regulation 178/2010 on ECX trading; MoTRI Directives 1026/2017, 1033/2017 and 1115/2025 on direct marketing) are not covered here.",
  ),
  sources: [],
  steps: ["STEP-005"],
};

export const SPICE_EXPORTER: PackRequirement = {
  code: "ELG-04",
  name: "ECTA certificate of competence for spice export",
  description:
    "Anyone who prepares, stores or trades spices for export needs a certificate of competence from ECTA, alongside the business licence. A spice exporter needs its own or a leased cleaning and storage facility meeting the directive's criteria (a cleaning machine for black cumin, hand-sorting for dried pepper), an office with a diploma-level spice quality expert, and bank-certified capital of ETB 1,000,000 (ETB 1,500,000 for a business association; ETB 100,000 or 250,000 for a new business). ECTA decides within 3 working days of its site check. The certificate is renewed every year from 1 to 30 Tir (about 9 January to 7 February), with tax clearance, the renewed business licence and an annual report.",
  action: "Record the exporter's ECTA certificate of competence for spice export and its renewal for the current year.",
  whyItMatters: "Trading export spices without the certificate is an offence, and ECTA's contract notification, inspection and dispatch all depend on it.",
  responsible: "Exporter (ECTA inspects and certifies)",
  trigger: "Before buying spices for export; renewal every Tir.",
  evidence: "ECTA certificate of competence for spice export.",
  jurisdiction: "ET",
  authority: "Ethiopian Coffee and Tea Authority (ECTA), under the Ministry of Agriculture's directive",
  basis: "confirmed",
  verification: checked(
    "Directive 994/2016 (registered 18 March 2024) Art. 2(19) and 2(27), 3 (everyone in the chain of exported spices), 55 (technical criteria), 57 and 58 (the spice exporter's certificate and its criteria), 59 to 63 (grower, cooperative, smallholder, processor and service-provider exporters), 67 (ECTA decides within 3 working days), 68 (renewal 1 to 30 Tir; ETB 500, and ETB 500 a month, when late), 91(2) (penalties) and 94 (no spice business without a certificate after the first year). This differs from Entrust's answer, which named MoTRI: MoTRI or the regional bureau issues the business licence (ELG-03), ECTA the certificate. No amendment found. Open: whether ECTA registers spice exporters on CMIMS.",
  ),
  sources: [cite(ET.spice994, "Art. 2, 3, 55, 57 to 63, 67, 68, 91 and 94.")],
  steps: ["STEP-004"],
};

export const SPICE_CONTRACT: PackRequirement = {
  code: "QLT-05",
  name: "Spice export contract registration",
  description:
    "The export sales contract states the parties, the quantity, the price in foreign currency, and the place and time of delivery. It is registered with the exporter's bank within 24 hours of signing, and ECTA is notified within 72 hours of the bank registration (another article says 3 working days after the contract: keep to the shorter). Contracts are performed on time; an extension is agreed and notified at least a month before the due date.",
  action: "Register the contract with the bank, notify ECTA, and record both dates.",
  whyItMatters: "ECTA's inspection and dispatch check the registered contract, and the bank permit is issued against it.",
  responsible: "Exporter",
  trigger: "Contract signed: the bank within 24 hours, ECTA within 72 hours after that.",
  evidence: "Bank contract registration and the ECTA notification.",
  jurisdiction: "ET",
  authority: "Exporter's bank; Ethiopian Coffee and Tea Authority (ECTA)",
  basis: "confirmed",
  verification: checked(
    "Directive 994/2016 Art. 73(3)(a) to (f) (contract terms; bank registration within 24 hours; notice to ECTA within 72 hours), 78(4) and (7) (notice within 3 working days; performance on time) and 80(6) (extensions). No minimum export price applies to spices: none was found in the directive or from MoTRI or NBE.",
  ),
  sources: [cite(ET.spice994, "Art. 73(3), 78 and 80(6).")],
  steps: ["STEP-034"],
};

export const SPICE_PREPARATION: PackRequirement = {
  code: "QLT-06",
  name: "Spice export preparation: certified facilities and quality criteria",
  description:
    "Export spices are cleaned by machine in a certified preparation plant, or by hand, kept apart by area and crop year, stored in a certified warehouse until export, and packed in standard packaging labelled with the product details. The directive sets criteria for each spice: dried pepper at 10 to 11% moisture, with at most 2% immature pods, 1% insect damage and 8% ash; black cumin at 7% moisture, clean of chaff and foreign matter, stored in lined airtight bags. Re-wetting dried pepper, and trading immature, mouldy or soiled black cumin, are prohibited.",
  action: "Record the preparation plant and warehouse, the moisture result, and that the lot meets the directive's criteria or the buyer's specification.",
  whyItMatters: "ECTA inspects the lot against these criteria before it can go to the port.",
  responsible: "Exporter",
  trigger: "When the lot is prepared for export.",
  evidence: "Moisture result; preparation and packing record.",
  jurisdiction: "ET",
  authority: "Ethiopian Coffee and Tea Authority (ECTA)",
  basis: "confirmed",
  verification: checked(
    "Directive 994/2016 Art. 15 to 17 (dried pepper), 18 to 20 (black cumin), 53 and 54 (preparation, separation and packing), 55 and 63 (certified plants and service providers), 78(3) (the national standard or the buyer's requirement), 90(1) and (2) (prohibited acts). The directive's pepper (berbere) is Ethiopian dried hot pepper; sweet paprika may be judged on the buyer's specification. The 2025 catalogue lists no compulsory Ethiopian Standard for spices.",
  ),
  sources: [cite(ET.spice994, "Art. 15 to 20, 53 to 55, 63, 78 and 90."), cite(ET.compulsoryStandards, "No compulsory standard for spices.")],
  steps: ["STEP-059", "STEP-062", "STEP-065"],
};

export const SPICE_TESTING: PackRequirement = {
  code: "QLT-08",
  name: "Quality and food-safety testing of the export lot",
  description:
    "The spice exporter has the grade and food safety of each export lot tested and keeps the results. The directive doesn't name the tests: the destination and the buyer decide them, typically aflatoxins, ochratoxin A, pesticide residues and Salmonella, and for ground spices also lead and illegal colours. The Ethiopian Agricultural Authority's 2026 hot pepper guideline recommends testing for pesticides, aflatoxin and ochratoxin A before packing for shipment.",
  action: "Test the lot at an accredited laboratory for what the destination and the buyer require, and keep the reports.",
  whyItMatters: "Spices are among the products most often held at the border for aflatoxins, Salmonella and colours, and the test report is the first thing the importer asks for.",
  responsible: "Exporter",
  trigger: "Before the lot is presented for ECTA inspection.",
  evidence: "Laboratory reports for the lot.",
  jurisdiction: "ET",
  authority: "Ethiopian Coffee and Tea Authority (ECTA) and the laboratories it certifies",
  basis: "confirmed",
  verification: checked(
    "Directive 994/2016 Art. 72(2) (ECTA-certified laboratories) and 78(6) (the exporter has quality and food-safety tests done and keeps the results). The EAA and RAISE-FS hot pepper guideline (March 2026) is guidance. No mandatory Ethiopian aflatoxin limit for export spices was found.",
  ),
  sources: [cite(ET.spice994, "Art. 72(2) and 78(6)."), cite(ET.eaaPepperGuide, "Recommended tests before shipment (guidance).")],
  steps: ["STEP-060"],
};

export const SPICE_INSPECTION: PackRequirement = {
  code: "QLT-07",
  name: "ECTA inspection, certificate and dispatch",
  description:
    "ECTA's spice quality inspection and certification centre tests a 250 g representative sample of every export lot and keeps it for reference. Spices go to the port only from that centre, once ECTA has set the grade, verified that the lot meets the buyer's quality requirement and issued its certificate. Its inspectors issue the dispatch document after checking the certificate, the vehicle, the bank permit and the transit and customs documents, or the air cargo booking.",
  action: "Present the lot for ECTA inspection and record the quality certificate and the dispatch document.",
  whyItMatters: "Without ECTA's certificate and dispatch the spices can't leave for the port.",
  responsible: "Exporter (inspection and certification by ECTA)",
  trigger: "Lot prepared and tested; before dispatch to the port.",
  evidence: "ECTA quality certificate and dispatch document.",
  jurisdiction: "ET",
  authority: "Ethiopian Coffee and Tea Authority (ECTA)",
  basis: "confirmed",
  verification: checked(
    "Directive 994/2016 Art. 72 (quality control and certified laboratories), 73(3)(b) (certificate before dispatch), 86(4) and (6) (dispatch from the certification centre; the dispatch document), 87(3) (250 g sample at the export centre) and 89(3) (ECTA's inspection, dispatch and certificate of production country). Laboratory locations, turnaround and fees weren't found.",
  ),
  sources: [cite(ET.spice994, "Art. 72, 73, 86, 87 and 89.")],
  steps: ["STEP-045", "STEP-061", "STEP-068"],
};

export const SPICE_ORIGIN: PackRequirement = {
  ...CERTIFICATE_OF_ORIGIN,
  description:
    "Where the buyer, the bank or the importing country asks for a certificate of origin, the Ethiopian Chamber of Commerce and Sectoral Associations issues it, applied for on the Electronic Single Window. For spices, ECTA also issues a certificate of production country with its inspection. No Ethiopian law requires one for every export.",
  verification: checked(
    "Proclamation 341/2003 Art. 5(7), 15(11) and 19(8) (chambers issue certificates of origin on delegation by the government); the eSW lists the chamber's forms; Directive 994/2016 Art. 89(3) (ECTA's certificate of production country for exported spices). Open: whether the two are alternatives, and whether ECTA issues its certificate on every export or on request.",
  ),
  sources: [...CERTIFICATE_OF_ORIGIN.sources, cite(ET.spice994, "Art. 89(3): ECTA's certificate of production country.")],
};

/** The Ethiopian spice requirements, for a pack to list with the common ones. */
export const ETHIOPIAN_SPICES: readonly PackRequirement[] = [
  SPICES_COVERED,
  SPICE_EXPORTER,
  SPICE_CONTRACT,
  SPICE_PREPARATION,
  SPICE_TESTING,
  SPICE_INSPECTION,
  SPICE_ORIGIN,
];
