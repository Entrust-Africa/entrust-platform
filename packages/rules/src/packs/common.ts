import { BY_RAIL, BY_ROAD, BY_SEA, COLD_CHAIN, PAID_BY_LC, PAID_BY_LC_OR_CAD } from "../facts";
import { INCOTERMS_2020, UCP_600 } from "../sources";
import { STEPS } from "../steps";
import type { PackRequirement, SourceRef } from "../types";
import { DJ, ET, ICC, US } from "./sources";

// Requirements every Ethiopian export shares, whatever the product and destination, for the packs
// first published on 24 October 2026. A pack lists them with its own. The green coffee to US pack
// (0.4.0) keeps its own wording, as published.
//
// Like the sources, these are part of every pack that lists them: changing one changes those packs,
// which the published-version test refuses. A new pack version that needs different wording
// replaces the requirement in its own list.

export const CHECKED = "2026-10-24";

export const cite = (source: SourceRef, note: string): SourceRef => ({ ...source, note });
export const checked = (note: string) => ({ status: "source_checked" as const, checkedOn: CHECKED, note });
export const awaiting = (note: string) => ({ status: "awaiting_verification" as const, checkedOn: CHECKED, note });

const position = new Map(STEPS.map((s, i) => [s.id, i]));
const startsAt = (r: PackRequirement) => Math.min(...r.steps.map((s) => position.get(s) ?? Infinity));

/** Puts a pack's requirements in the order their work starts, keeping the given order for ties. */
export const inWorkflowOrder = (requirements: readonly PackRequirement[]): PackRequirement[] =>
  [...requirements].sort((a, b) => startsAt(a) - startsAt(b));

// ---- Ethiopia: exporter, permit, customs and transit ----

export const TIN: PackRequirement = {
  code: "ELG-02",
  name: "Taxpayer registration (TIN)",
  description:
    "The exporting company's Taxpayer Identification Number. The tax authority issues one TIN per taxpayer for all tax laws, and a business licence, the export trade licence included, needs one.",
  action: "Record the exporter's TIN.",
  whyItMatters: "Declarations, licences and bank permits are issued against a registered taxpayer.",
  responsible: "Exporter",
  trigger: "Company registration.",
  evidence: "TIN certificate.",
  jurisdiction: "ET",
  authority: "Ministry of Revenue (the Addis Ababa and Dire Dawa revenue bureaus for their own taxpayers)",
  basis: "confirmed",
  verification: checked(
    "Proclamation 983/2016 Art. 9 (registration), 12 and 13 (the tax authority issues the TIN; one TIN per taxpayer), 14(2) and (4) (a business licence needs a TIN); Proclamation 1434/2026 Art. 2(1) names the Ministry of Revenue as the tax authority.",
  ),
  sources: [
    cite(ET.tax983, "Art. 9, 12 to 14: registration, the TIN, and the TIN for business licences."),
    cite(ET.tax1434, "Art. 2(1): the Ministry of Revenue is the tax authority."),
  ],
  steps: ["STEP-002"],
};

export const TRANSACTION_RECORD: PackRequirement = {
  code: "CASE-01",
  name: "Confirm the export transaction record",
  description: "Confirm the purchase order or sales contract details held in the case: buyer, product, quantity, value, Incoterm and payment terms.",
  action: "Check the case record against the buyer's purchase order or the sales contract, and upload it.",
  whyItMatters: "Every later requirement, document and payment milestone is worked out from these transaction details.",
  responsible: "Exporter (with the CLEAR facilitator)",
  trigger: "Export opportunity received (purchase order).",
  evidence: "Buyer purchase order or sales contract.",
  jurisdiction: null,
  authority: "Exporter and buyer",
  basis: "transaction",
  verification: checked("Taken from the buyer's purchase order or the sales contract."),
  sources: [],
  steps: ["STEP-020"],
};

export const LC_TERMS: PackRequirement = {
  code: "PAY-05",
  name: "Check the letter of credit's terms",
  description:
    "Before shipping, check the credit against the contract: the documents it asks for and who issues them, the latest shipment date, the expiry and the presentation period. The NBE directive accepts a credit at sight, or on acceptance of up to 60 days when it is irrevocable and confirmed through a local bank.",
  action: "Record the credit's terms and any the exporter can't meet, and have the buyer amend them before shipment.",
  whyItMatters: "The bank pays only against documents that comply with the credit, and a term the exporter can't meet is cheaper to amend before shipping than to dispute after.",
  responsible: "Exporter, with its bank",
  trigger: "Letter of credit advised through the exporter's bank.",
  evidence: "Letter of credit and any amendments.",
  jurisdiction: null,
  authority: "Exporter's bank (advising bank); ICC UCP 600 as incorporated in the credit",
  basis: "transaction",
  appliesWhen: { condition: PAID_BY_LC, description: "payment is wholly or partly by letter of credit" },
  verification: checked(
    "The credit's terms come from the buyer's bank. FXD/01/2024 Annex One 1.3.1: at sight, or on acceptance secured by an irrevocable confirmed credit advised through a local bank, within the 90 days allowed for repatriation and for at most 60 days.",
  ),
  sources: [cite(ET.nbeFxd, "Annex One 1.2.1 and 1.3.1: export by letter of credit."), UCP_600],
  steps: ["STEP-026"],
};

export const ADVANCE_PAYMENT: PackRequirement = {
  code: "PAY-01",
  name: "Receive the advance payment",
  description:
    "Where the payment terms include an advance, it is the first payment milestone. An export permit against an advance is issued by the bank branch that received it, for no more than the advance.",
  action: "Record receipt of the advance, as the payment terms set it.",
  whyItMatters: "The bank permit is applied for against the advance, and an advance for future export is valid for one year.",
  responsible: "Buyer; confirmed by the exporter's bank",
  trigger: "After the contract is confirmed, as the payment terms say.",
  evidence: "Bank credit advice for the advance.",
  jurisdiction: null,
  authority: "Exporter's bank",
  basis: "transaction",
  verification: checked(
    "Payment terms come from the sales contract. FXD/01/2024 Annex One 1.2.3 (documents and the one-year validity) and 1.3.3 (the permit doesn't exceed the advance and is issued by the branch that received it); FXD/04/2026 lets a third party send the advance under an agreement (1.3.3(b)).",
  ),
  sources: [
    cite(ET.nbeFxd, "Annex One 1.2.3 and 1.3.3: exports against advance payment."),
    cite(ET.nbeFxd04, "Advance payment from a third party."),
  ],
  steps: ["STEP-028"],
};

export const BANK_PERMIT: PackRequirement = {
  code: "COM-01",
  name: "Bank export permit",
  description:
    "Authorized banks issue export permits under the National Bank of Ethiopia's foreign exchange directive, against a valid export trade licence, the application, the invoice and the sales contract (and the credit, for a letter of credit), submitted through the Electronic Single Window. The directive accepts letters of credit, cash against documents (CAD), advance payment, and consignment sales for perishables such as fruit.",
  action: "Apply to the exporter's bank for the export permit with the contract and invoice, and confirm with the bank how a mixed payment (such as an advance and CAD) is permitted.",
  whyItMatters:
    "Export clearance depends on the permit. The proceeds of every permit must be repatriated within 90 days of its issue, and a single CAD permit may not exceed USD 500,000.",
  responsible: "Exporter (permit issued by the authorized bank)",
  trigger: "Contract signed and invoice prepared. Export applications are valid for 30 days.",
  evidence: "Bank export permit; for CAD, the written undertaking to repatriate the proceeds.",
  jurisdiction: "ET",
  authority: "Authorized commercial bank, under National Bank of Ethiopia Directive FXD/01/2024 (as amended)",
  basis: "confirmed",
  verification: checked(
    "FXD/01/2024 7.1.1 (banks issue export permits), 7.1.5 (letters of credit, CAD, advance payment, consignment and, with NBE permission, open account), 7.1.6 (applications valid 30 days), Annex One 1.1.4 (consignment for perishables such as fruit), 1.2 (documents through the eSW, including a valid foreign trade licence for export), 1.3.2 (CAD: 90 days; USD 500,000 per permit) and 1.3.7(d) (90-day repatriation for every mode). FXD/04/2026 (in force 12 February 2026) amends the directive. The directive does not say how a mixed payment is permitted: confirm with the bank.",
  ),
  sources: [
    cite(ET.nbeFxd, "7.1.1, 7.1.5, 7.1.6 and Annex One 1.1 to 1.3."),
    cite(ET.nbeFxd04, "Amendment in force 12 February 2026."),
  ],
  steps: ["STEP-046", "STEP-047", "STEP-048"],
};

export const LOT_DETAILS: PackRequirement = {
  code: "QLT-03",
  name: "Confirm lot quantity, grade and packaging",
  description: "Confirm the lot's quantity, grade and packaging from the packed lot, matching the certificates, before the documents are prepared.",
  action: "Record the lot quantity, grade and packaging in the case.",
  whyItMatters: "The invoice, packing list, certificates, bank documents and the importer's filings all describe the same lot, and figures that disagree cause document discrepancies.",
  responsible: "Exporter",
  trigger: "After grading and packing.",
  evidence: "Inspection result and packing details.",
  jurisdiction: null,
  authority: "Exporter",
  basis: "transaction",
  verification: checked("Part of the case record the documents are prepared from."),
  sources: [],
  steps: ["STEP-064", "STEP-065"],
};

export const CARRIER_BOOKING: PackRequirement = {
  code: "TRN-05",
  name: "Carrier booking",
  description:
    "Book the vessel or flight. Under FCA and FOB the buyer contracts the main carriage and the exporter delivers to the carrier it names; under CFR and CIF the exporter contracts it. FOB, CFR and CIF are for sea freight only: for air freight the rule is FCA (or CPT or CIP).",
  action: "Record the booking: carrier, vessel or flight, cut-off and the booking reference.",
  whyItMatters: "The booking sets the dates the export clearance, the transit and the documents work back from.",
  responsible: "Exporter or freight forwarder, or the buyer's forwarder under FCA and FOB",
  trigger: "Cargo packed and certified, or earlier for scarce space such as reefers and flights.",
  evidence: "Booking confirmation.",
  jurisdiction: null,
  authority: "Ocean carrier or airline, or the forwarder",
  basis: "transaction",
  verification: checked("Who books follows the Incoterm in the contract (ICC Incoterms 2020)."),
  sources: [cite(ICC.incoterms, "FCA and FOB: delivery to the buyer's carrier; FCA for containers and air."), INCOTERMS_2020],
  steps: ["STEP-074"],
};

export const REEFER: PackRequirement = {
  code: "TRN-06",
  name: "Reefer container and cold chain",
  description:
    "Perishable cargo goes in a refrigerated container (or chilled air cargo) at the set point the buyer and carrier agree, pre-cooled, with the set point on the booking and the temperature record kept through to the port.",
  action: "Record the agreed set point, the container's pre-trip inspection and the temperature log.",
  whyItMatters: "A wrong set point or a break in the cold chain ruins the cargo, and the temperature record is what a claim rests on.",
  responsible: "Exporter and carrier",
  trigger: "Container released for stuffing.",
  evidence: "Booking with the set point; pre-trip inspection; temperature log.",
  jurisdiction: null,
  authority: "Ocean carrier or airline",
  basis: "transaction",
  appliesWhen: { condition: COLD_CHAIN, description: "the cargo needs temperature control" },
  verification: checked("The set point and handling come from the contract and the carrier; no Ethiopian rule was found that sets them."),
  sources: [],
  steps: ["STEP-075", "STEP-076"],
};

export const BY_RAIL_TO_DJIBOUTI: PackRequirement = {
  code: "TRN-01",
  name: "Inland transport to Djibouti by rail",
  description:
    "Book the Ethio-Djibouti railway for the cleared container. The railway runs into the SGTD Doraleh container terminal, where rail-received export containers have the same cut-off as road: 24 hours before the vessel berths.",
  action: "Book rail transport and record the booking or consignment note.",
  whyItMatters: "Until delivery under the Incoterm (on board the vessel for FOB, CFR and CIF Djibouti) the exporter bears the transport and the risk.",
  responsible: "Exporter or freight forwarder",
  trigger: "After export clearance, when rail is the inland mode.",
  evidence: "Rail booking or consignment note.",
  jurisdiction: null,
  authority: "Ethio-Djibouti railway operator or freight forwarder",
  basis: "transaction",
  appliesWhen: { condition: { all: [BY_SEA, BY_RAIL] }, description: "the cargo goes to Djibouti by rail" },
  verification: awaiting(
    "A route option of the transaction. SGTD Circular N012/2024 gives rail-received export containers the 24-hour cut-off, and DPFZA describes the rail link to the SGTD terminal. Not confirmed: how customs transit works for rail exports, which no Ethiopian, EDR or DPFZA text describes.",
  ),
  sources: [cite(DJ.sgtd, "Circular N012/2024: cut-off for rail-received export containers."), cite(DJ.dpfzaRail, "The railway's link to the port terminals.")],
  steps: ["STEP-078"],
};

export const BY_ROAD_TO_DJIBOUTI: PackRequirement = {
  code: "TRN-02",
  name: "Inland transport to Djibouti by road",
  description: "Book road haulage for the cleared container to the port of Djibouti.",
  action: "Book road transport and record the transport document.",
  whyItMatters: "Until delivery under the Incoterm (on board the vessel for FOB, CFR and CIF Djibouti) the exporter bears the transport and the risk.",
  responsible: "Exporter or freight forwarder",
  trigger: "After export clearance, when road is the inland mode.",
  evidence: "Road consignment note or waybill.",
  jurisdiction: null,
  authority: "Haulier or freight forwarder",
  basis: "transaction",
  appliesWhen: { condition: { all: [BY_SEA, BY_ROAD] }, description: "the cargo goes to Djibouti by road" },
  verification: awaiting("A route option of the transaction. The transit procedure is covered by TRN-03 and TRN-04."),
  sources: [],
  steps: ["STEP-078"],
};

export const INVOICE: PackRequirement = {
  code: "COM-02",
  name: "Commercial invoice",
  description: "Commercial invoice to the buyer for the lot, consistent with the contract, the grade and the quantity.",
  action: "Prepare the commercial invoice from the confirmed lot details.",
  whyItMatters: "The bank permit is issued against it; customs, the bank collection and the importer's entry use it too.",
  responsible: "Exporter",
  trigger: "Lot details confirmed.",
  evidence: "Signed commercial invoice.",
  jurisdiction: "ET",
  authority: "Exporter (required by the bank under the NBE directive)",
  basis: "confirmed",
  verification: checked("FXD/01/2024 Annex One 1.2.1(d) and 1.2.2 to 1.2.4: an invoice for every export permit, which may be chamberized. The importing country's rules on invoice content were not checked separately."),
  sources: [cite(ET.nbeFxd, "Annex One 1.2: documents for export permits.")],
  steps: ["STEP-080", "STEP-100"],
};

export const PACKING_LIST: PackRequirement = {
  code: "COM-03",
  name: "Packing list",
  description: "Packing list for the lot: number of packages, marks, net and gross weights.",
  action: "Prepare the packing list from the confirmed lot details.",
  whyItMatters: "Customs, the carrier and the bank use it, and it must match the invoice.",
  responsible: "Exporter",
  trigger: "After the lot details are confirmed.",
  evidence: "Packing list.",
  jurisdiction: null,
  authority: "Exporter",
  basis: "transaction",
  verification: checked("A standard shipping document of the transaction."),
  sources: [],
  steps: ["STEP-080", "STEP-101"],
};

export const CUSTOMS_EXPORT: PackRequirement = {
  code: "CUS-01",
  name: "Ethiopian customs export declaration and clearance",
  description: "All export goods are subject to a goods declaration. Declarations and export documents are submitted through the Electronic Single Window (eSW).",
  action: "Lodge the export declaration through the eSW with the supporting documents and record the clearance.",
  whyItMatters: "Goods cannot leave Ethiopia without customs clearance.",
  responsible: "Exporter or a licensed customs agent",
  trigger: "Bank permit issued, certificates in hand and shipping documents ready.",
  evidence: "Customs export declaration and release.",
  jurisdiction: "ET",
  authority: "Ethiopian Customs Commission",
  basis: "confirmed",
  verification: checked(
    "Customs Proclamation 859/2014 Art. 12(1): export goods are subject to a goods declaration; the eSW portal takes customs declarations. The Further Amendment Proclamation 1425/2026 (July 2026) doesn't change the article cited. Not verified: the exact document list for each product.",
  ),
  sources: [
    cite(ET.customs859, "Art. 12(1): goods declaration for export goods."),
    cite(ET.customs1425, "Amends other articles of 859/2014."),
    cite(ET.esw, "Customs declaration and permit applications for traders."),
  ],
  steps: ["STEP-080", "STEP-087"],
};

export const EXPORT_TRANSIT: PackRequirement = {
  code: "TRN-03",
  name: "Ethiopian export transit to Djibouti: customs seal, T1, tracking and exit certificate",
  description:
    "After export clearance the container moves under customs control from the inland customs station to the exit station, under a customs seal and a T1 transit document, on a carrier fitted with an electronic cargo-tracking device. Ethiopian customs issues the exit certificate once the exit checkpoint confirms the goods have left.",
  action: "Record the container and customs seal numbers, the T1 transit document and the carrier's tracking device, then the customs exit certificate at the border.",
  whyItMatters:
    "The declarant and carrier are jointly liable for delivering the goods intact; a broken seal or a missing exit certificate can stop the shipment or leave the export unacquitted.",
  responsible: "Exporter's customs agent or freight forwarder, and the carrier",
  trigger: "Container cleared and sealed for export; dispatched by road or rail.",
  evidence: "Container and seal numbers; T1 transit document; carrier tracking device; customs exit certificate.",
  jurisdiction: "ET",
  authority: "Ethiopian Customs Commission",
  basis: "confirmed",
  appliesWhen: { condition: BY_SEA, description: "the cargo goes by sea, through Djibouti" },
  verification: checked(
    "Customs Proclamation 859/2014 Art. 16 (transit to the customs station of exit), Art. 18 (customs seals), Art. 141(4) (exit certificate); Proclamation 1160/2019 Art. 2(5), adding Art. 18(9) and (10) (anyone carrying export goods installs a cargo-tracking device). Not confirmed: whether a multimodal operator is mandatory for exports (press reports Directive 1140/2026 opening multimodal transport; its text wasn't found).",
  ),
  sources: [cite(ET.customs859, "Art. 16, 18 and 141(4)."), cite(ET.procl1160, "Art. 2(5): cargo-tracking device for carriers of export goods.")],
  steps: ["STEP-086", "STEP-088", "STEP-089"],
};

export const DJIBOUTI_PORT: PackRequirement = {
  code: "TRN-04",
  name: "Djibouti export clearance and port entry: DPCS, terminal cut-off and VGM",
  description:
    "In Djibouti, exported goods are declared in detail by the owner or a licensed declarant and move in transit under bond. A Djibouti-licensed freight forwarder completes export clearance through the Djibouti Port Community System (DPCS), mandatory for all port, export and transit submissions since May 2026. At the Doraleh container terminal the truck must be registered, the gate needs the terminal invoice and booking ticket, the verified gross mass (VGM) must be lodged, and the container must arrive before the cut-off, 24 hours before the vessel berths.",
  action: "Confirm the Djibouti forwarder, the DPCS export clearance, the carrier booking, the VGM certificate and the terminal invoice and booking ticket, and that the container arrives before the cut-off.",
  whyItMatters: "A container that misses the cut-off or lacks a VGM or DPCS clearance is not loaded and misses its vessel.",
  responsible: "Djibouti-licensed freight forwarder, appointed by the exporter",
  trigger: "Container approaching Djibouti; at least 24 hours before the vessel berths.",
  evidence: "DPCS export clearance; booking confirmation; signed VGM certificate; terminal invoice and booking ticket.",
  jurisdiction: "DJ",
  authority: "Djibouti Ports and Free Zones Authority; Djibouti customs; SGTD Doraleh Container Terminal",
  basis: "confirmed",
  verification: checked(
    "Djibouti Customs Code (2011) Art. 88 (exports declared in detail by the owner or a licensed declarant) and Art. 127 to 138 (transit under bond); DPFZA Directive DPFZA-43-26 of 19 May 2026 (DPCS mandatory); DPFZA forwarder licence (Djiboutian-owned forwarders); DPCS export transit procedure (2018, road); SGTD circulars (truck registration; gate documents since 15 July 2026; 24-hour cut-off for road and rail) and Tariff Book rule 227 (VGM). Not confirmed: amendments to the customs code since 2011.",
  ),
  sources: [
    cite(DJ.djCustoms, "Art. 88 and 127 to 138: export declaration and transit under bond."),
    cite(DJ.dpfzaNotice, "DPCS mandatory for port, export and transit submissions (19 May 2026)."),
    cite(DJ.dpcsExport, "Export transit steps and documents (2018, road)."),
    cite(DJ.dpfzaForwarder, "Forwarders need a DPFZA licence."),
    cite(DJ.sgtd, "Truck registration, gate documents, cut-off."),
    cite(DJ.sgtdTariff, "Rule 227: verified gross mass."),
  ],
  steps: ["STEP-089"],
};

export const TRADE_LICENCE: PackRequirement = {
  code: "ELG-03",
  name: "Business licence for export trade",
  description:
    "Every export business needs a valid business licence in the export category for its product (pepper and spices, fruits and vegetables, food products, processed agricultural products), applied for online after commercial registration. Where the category needs a sector body's certificate of competence, the certificate comes first. The licence is renewed every budget year: without penalty from 1 Hamle to 30 Tahsas (about 8 July to 8 January), with a penalty until 30 Sene, and a licence not renewed within the year after that is cancelled.",
  action: "Record the exporter's business licence, its export category and its renewal for the current budget year.",
  whyItMatters: "Banks issue export permits only against a valid trade licence for export (COM-01), and trading without one is an offence.",
  responsible: "Exporter",
  trigger: "Before the first export; renewal every budget year.",
  evidence: "Business licence for export trade, renewed for the current year.",
  jurisdiction: "ET",
  authority: "Ministry of Trade and Regional Integration (MoTRI) or the regional trade bureau",
  basis: "confirmed",
  verification: checked(
    "Proclamation 980/2016 Art. 5(1) (commercial registration first), 22(1) (no business without a valid licence), 27 and 28 (renewal from 1 Hamle to 30 Tahsas, with a penalty to 30 Sene), 42(4) and (5) (a certificate of competence first, where a directive requires one); Proclamation 1150/2019 Art. 2(5) (online licensing) and 2(17) (renewal within a further year for ETB 20,000, or the licence is cancelled); Regulation 392/2016 Art. 23, 24 and 30 (application and renewal documents, with tax clearance); Directive 935/2022 Art. 19 and 49; the 2019 categories directive, export division 66 (66114 pepper and spices, 66115 fruits and vegetables, 66131 food products, 66142 processed agricultural products). Open: which office licenses a given exporter (MoTRI or a regional bureau), and which categories still need a certificate of competence first since MoTRI shortened the list in November 2021 (reported by Addis Fortune; the letter wasn't found). etrade.gov.et and motri.gov.et couldn't be read (connection refused; expired certificate).",
  ),
  sources: [
    cite(ET.licensing980, "Art. 5, 22, 27, 28 and 42."),
    cite(ET.licensing1150, "Art. 2(5) and 2(17): online licensing; late renewal."),
    cite(ET.licensingRegulation, "Art. 23, 24 and 30: application and renewal documents."),
    cite(ET.licensingDirective, "Art. 19 and 49: renewal; online services."),
    cite(ET.licenceCategories, "Annex 1, export division 66: the licence categories."),
  ],
  steps: ["STEP-003"],
};

/**
 * The Ethiopian phytosanitary certificate. `destination` says what the importing country asks
 * for; give `appliesWhen` when the destination doesn't always ask for one.
 */
export const phytosanitaryCertificate = (destination: string, appliesWhen?: PackRequirement["appliesWhen"]): PackRequirement => ({
  code: "PHY-01",
  name: "Phytosanitary certificate",
  description: `The Ethiopian Agricultural Authority inspects plant products for export and issues the phytosanitary certificate, through its IEICS system, when the importing country asks for one; every consignment must meet the importing country's requirements before it leaves. Packages are marked with the contents, where they were produced, and the shipper and consignee, and wood packaging carries the ISPM 15 mark. ${destination}`,
  action: "Apply to the Ethiopian Agricultural Authority for inspection, and record the certificate's number and date.",
  whyItMatters: "The destination's border authority, the buyer or the bank refuses the consignment without it.",
  responsible: "Exporter (certificate issued by the Ethiopian Agricultural Authority)",
  trigger: "Consignment packed and ready for inspection, before it leaves Ethiopia.",
  evidence: "Phytosanitary certificate.",
  jurisdiction: "ET",
  authority: "Ethiopian Agricultural Authority",
  basis: appliesWhen ? "conditional" : "confirmed",
  ...(appliesWhen && { appliesWhen }),
  verification: checked(
    "Proclamation 1400/2026 Art. 6(2) to (4) (meet the importing country's requirements; a certificate when it asks), 6(6) (wood packaging marked to ISPM 15), 7(2) (treatments by a licensed operator), 20(13) (the Authority issues export certificates) and 26 (Regulation 4/1992 stays in force); Regulation 4/1992 Art. 6(3) (package marking). The IPPC reports Ethiopia began live ePhyto exchanges in July 2026 for selected trade flows. Open: the Amharic text of Art. 6(4) also calls for a release permit for every export consignment, and the Authority hasn't published how it issues one; the current fees (Regulation 4/1992's table is from 1992).",
  ),
  sources: [
    cite(ET.plant1400, "Art. 6, 7, 20(13) and 26."),
    cite(ET.plant1400Text, "The gazette text, Amharic and English."),
    cite(ET.plantReg, "Art. 6(3): package marking."),
    cite(ET.ieics, "The Authority's certification system."),
    cite(ET.ephyto, "Ethiopia's live ePhyto exchanges from July 2026."),
  ],
  steps: ["STEP-049", "STEP-069"],
});

export const CERTIFICATE_OF_ORIGIN: PackRequirement = {
  code: "COM-05",
  name: "Certificate of origin, when one is asked for",
  description:
    "Where the buyer, the bank or the importing country asks for a certificate of origin, the Ethiopian Chamber of Commerce and Sectoral Associations issues it, applied for on the Electronic Single Window. No Ethiopian law requires one for every export.",
  action: "Check whether the contract, the bank's document list or the destination asks for a certificate of origin, and if so record it.",
  whyItMatters: "A document the credit or the collection lists and the exporter can't present delays payment.",
  responsible: "Exporter",
  trigger: "When the document list is known; issued once the invoice is final.",
  evidence: "Certificate of origin.",
  jurisdiction: null,
  authority: "Ethiopian Chamber of Commerce and Sectoral Associations",
  basis: "transaction",
  verification: checked(
    "Proclamation 341/2003 Art. 5(7) (the chamber issues certificates of origin on delegation by the government), 15(11) and 19(8) (regional and city chambers). The eSW lists the chamber's ordinary certificate of origin forms. The Customs Commission added its own certificate of origin application to the eSW on 1 July 2026, without saying what it covers.",
  ),
  sources: [cite(ET.chambers341, "Art. 5(7), 15(11) and 19(8)."), cite(ET.eswForms, "The chamber's certificate of origin forms.")],
  steps: ["STEP-050"],
};

// ---- Shipment and payment ----

export const DELIVERY: PackRequirement = {
  code: "POR-01",
  name: "Delivery under the Incoterm",
  description:
    "The exporter delivers where the contract's Incoterm says: under FCA, to the buyer's carrier at the named place (a dry port, or the airline at Addis Ababa Bole); under FOB, CFR and CIF, on board the vessel at Djibouti. Risk passes to the buyer at that point. Under CFR and CIF the exporter also pays the sea freight, and under CIF it insures the cargo.",
  action: "Record proof of delivery at the named place: the carrier's receipt, or proof the cargo was loaded on board.",
  whyItMatters: "This is the point of delivery and risk transfer, and the transport document the bank needs follows from it.",
  responsible: "Exporter",
  trigger: "All pre-shipment requirements resolved and the cargo at the named place.",
  evidence: "Carrier's receipt, mate's receipt or proof of loading.",
  jurisdiction: null,
  authority: "Carrier and port or airport",
  basis: "transaction",
  verification: checked(
    "The Incoterm comes from the sales contract. The delivery points are summarised from ICC guidance on Incoterms 2020, still ICC's current version; the full Incoterms 2020 text was not reviewed.",
  ),
  sources: [cite(ICC.incoterms, "FCA and FOB delivery; FCA recommended for containerised and air cargo."), INCOTERMS_2020],
  steps: ["STEP-104"],
};

export const TRANSPORT_DOCUMENT: PackRequirement = {
  code: "POR-02",
  name: "Bill of lading or air waybill issued",
  description:
    "The carrier issues the bill of lading (sea) or air waybill (air). Under a letter of credit or CAD it is made out to the order of a bank licensed in Ethiopia or the buyer's bank; under advance payment or consignment it can be in the buyer's name.",
  action: "Give the carrier the consignee the payment terms call for, and record the transport document.",
  whyItMatters: "It is the key document for the bank collection and for the importer's arrival filings, and a wrong consignee breaks the bank's control of the goods.",
  responsible: "Carrier; the exporter or its forwarder gives the shipping instructions",
  trigger: "After loading.",
  evidence: "Bill of lading or air waybill.",
  jurisdiction: "ET",
  authority: "Ocean carrier or airline, under the NBE directive's rule on consignees",
  basis: "confirmed",
  verification: checked(
    "FXD/01/2024 Annex One 1.3.7(a) to (c): transport documents to the order of a bank for letters of credit and CAD, the buyer's name allowed for advance payment and consignment; forwarders deliver them to the bank.",
  ),
  sources: [cite(ET.nbeFxd, "Annex One 1.3.7: transport documents issued in the name of a bank.")],
  steps: ["STEP-094"],
};

export const SHIPPING_ADVICE: PackRequirement = {
  code: "POR-03",
  name: "Shipping advice to the buyer",
  description: "Tell the buyer about the shipment: vessel or flight, transport document number, containers and documents.",
  action: "Send the shipping advice and record the date it was sent.",
  whyItMatters: "The buyer and its broker need the shipment details for the import filings and arrival planning.",
  responsible: "Exporter",
  trigger: "Transport document issued.",
  evidence: "Shipping advice sent to the buyer.",
  jurisdiction: null,
  authority: "Exporter",
  basis: "transaction",
  verification: checked("A step of the transaction."),
  sources: [],
  steps: ["STEP-094"],
};

export const OUTCOME: PackRequirement = {
  code: "REV-01",
  name: "Record the shipment outcome and discrepancies",
  description: "Record the shipment outcome: arrival, release, quality or quantity claims and document discrepancies.",
  action: "Record the outcome and any discrepancies.",
  whyItMatters: "It builds the case history used to improve the next export.",
  responsible: "Exporter (with the CLEAR facilitator)",
  trigger: "Shipment released to the buyer.",
  evidence: "Proof of delivery and the recorded outcome.",
  jurisdiction: null,
  authority: "Exporter",
  basis: "transaction",
  verification: checked("A step of the transaction."),
  sources: [],
  steps: ["STEP-107"],
};

export const PRESENT_DOCUMENTS: PackRequirement = {
  code: "PAY-02",
  name: "Present the documents through the bank (letter of credit or CAD)",
  description:
    "Present the shipping documents through the banks: under a letter of credit, documents that comply with the credit, within its presentation period (21 days after shipment unless the credit says otherwise) and before it expires; under CAD, the documents the collection instructions list.",
  action: "Assemble the document set the credit or the collection instructions list and present it to the exporter's bank.",
  whyItMatters: "The buyer pays, or the credit is honoured, against these documents, and discrepancies delay or stop payment.",
  responsible: "Exporter, through its bank",
  trigger: "Transport document and shipping documents available.",
  evidence: "Bank cover letter or proof of presentation.",
  jurisdiction: null,
  authority: "Exporter's bank",
  basis: "transaction",
  appliesWhen: { condition: PAID_BY_LC_OR_CAD, description: "payment is wholly or partly by letter of credit or cash against documents" },
  verification: checked("Payment terms come from the sales contract; the 21-day default is UCP 600 Art. 14(c), where the credit incorporates UCP 600."),
  sources: [UCP_600],
  steps: ["STEP-109", "STEP-110", "STEP-112", "STEP-114"],
};

export const PROCEEDS: PackRequirement = {
  code: "PAY-03",
  name: "Receive the export proceeds",
  description: "Receipt of the payment the terms call for. Under the NBE directive the proceeds of every export permit are repatriated within 90 days of its issue.",
  action: "Record receipt of the payment and the bank's credit advice.",
  whyItMatters: "Completes the payment terms and the foreign exchange repatriation the bank must enforce.",
  responsible: "Buyer (pays through the banks); the exporter's bank confirms",
  trigger: "Documents presented, or as the payment terms say.",
  evidence: "Bank credit advice.",
  jurisdiction: null,
  authority: "Exporter's bank",
  basis: "transaction",
  verification: checked("Payment terms come from the sales contract; the repatriation rule is FXD/01/2024 Annex One 1.3.7(d)."),
  sources: [cite(ET.nbeFxd, "Annex One 1.3.7(d): proceeds repatriated within 90 days of the permit's issue.")],
  steps: ["STEP-116", "STEP-117"],
};

export const RECONCILE: PackRequirement = {
  code: "PAY-04",
  name: "Reconcile the payments against the contract",
  description: "Reconcile the payments received against the contract value and record any shortfall, charges or discrepancy.",
  action: "Compare the amounts received with the contract value and record the reconciliation.",
  whyItMatters: "Confirms the transaction was paid in full and shows bank charges or deductions.",
  responsible: "Exporter",
  trigger: "All payments received.",
  evidence: "Reconciliation record.",
  jurisdiction: null,
  authority: "Exporter",
  basis: "transaction",
  verification: checked("A step of the transaction."),
  sources: [],
  steps: ["STEP-118", "STEP-119"],
};

export const CLOSURE: PackRequirement = {
  code: "REV-02",
  name: "Lessons learned and case closure",
  description: "Record lessons learned and close the export case.",
  action: "Record lessons learned and close the case.",
  whyItMatters: "Closing the loop builds the exporter's CLEAR record for its next cases.",
  responsible: "Exporter (with the CLEAR facilitator)",
  trigger: "Outcome recorded and payments reconciled.",
  evidence: "Lessons learned entry.",
  jurisdiction: null,
  authority: "Exporter",
  basis: "transaction",
  verification: checked("A step of the transaction."),
  sources: [],
  steps: ["STEP-125"],
};

/** What every pack lists from the Ethiopian side and the transaction, in workflow order. */
export const ETHIOPIAN_EXPORT: readonly PackRequirement[] = [
  TIN,
  TRANSACTION_RECORD,
  LC_TERMS,
  ADVANCE_PAYMENT,
  BANK_PERMIT,
  LOT_DETAILS,
  CARRIER_BOOKING,
  REEFER,
  BY_RAIL_TO_DJIBOUTI,
  BY_ROAD_TO_DJIBOUTI,
  INVOICE,
  PACKING_LIST,
  CUSTOMS_EXPORT,
  EXPORT_TRANSIT,
  DJIBOUTI_PORT,
  DELIVERY,
  TRANSPORT_DOCUMENT,
  SHIPPING_ADVICE,
  OUTCOME,
  PRESENT_DOCUMENTS,
  PROCEEDS,
  RECONCILE,
  CLOSURE,
];

// ---- United States: what every US-bound food export shares ----

export const US_IMPORTER: PackRequirement = {
  code: "USP-03",
  name: "Importer of record, customs bond and broker",
  description:
    "The US importer of record makes entry. Goods are not released without a customs bond, and an ISF needs a bond too: the ISF importer's, or its filing agent's. A licensed broker is optional; the importer of record stays responsible either way.",
  action: "Confirm the importer of record, its customs bond and, if one is used, its customs broker's contact details.",
  whyItMatters: "US filings (ISF, entry) and release depend on a bond, and the exporter needs the broker's contact for documents.",
  responsible: "US importer",
  trigger: "Before the cargo is loaded.",
  evidence: "Importer of record and bond confirmation; broker details if one is used.",
  jurisdiction: "US",
  authority: "US Customs and Border Protection (CBP)",
  basis: "confirmed",
  verification: checked("19 CFR 142.4 (no release without a bond), 149.5(b) (the ISF bond can be the ISF importer's or its filing agent's), 111.2(a)(2)(i) (an importer acting on its own account needs no broker licence)."),
  sources: [
    cite(US.cfrEntry, "142.4: bond required for release."),
    cite(US.cfrIsf, "149.5(b): the bond for the ISF."),
    cite(US.cfrBroker, "A broker is optional for an importer's own entries."),
  ],
  steps: ["STEP-037"],
};

export const US_FACILITY: PackRequirement = {
  code: "USP-01",
  name: "FDA food facility registration and renewal",
  description:
    "A foreign facility that manufactures, processes, packs or holds food for US consumption must be registered with FDA through a US agent, with a unique facility identifier (DUNS). Here that is the Ethiopian plant that cleans, grinds, blends, makes or packs the food, and any warehouse that holds it. Registrations are renewed between 1 October and 31 December of every even-numbered year: one not renewed by 31 December 2026 has expired, which counts as not registered.",
  action: "Confirm the FDA registration number of each facility that makes, packs or holds the food, that it was renewed in the current window, and its US agent.",
  whyItMatters: "Prior notice names the manufacturer's registration number, and food from an unregistered facility is held at the port.",
  responsible: "Owner or operator of the Ethiopian facility, through its US agent",
  trigger: "Before the food is offered for import; renewal from 1 October to 31 December 2026, and every even-numbered year after.",
  evidence: "FDA registration number and renewal confirmation; US agent confirmation.",
  jurisdiction: "US",
  authority: "US Food and Drug Administration (FDA)",
  basis: "confirmed",
  verification: checked(
    "21 CFR 1.225 (who must register), 1.226 (exemptions), 1.230(b) (renewal October to December of even years), 1.232 (unique facility identifier; US agent), 1.241(b) and (c) (a registration not renewed has expired); 1.281(a)(6) and 1.285(a) on prior notice. FDA's reminder of 29 September 2026 confirms the 2026 window and expiry after 31 December 2026.",
  ),
  sources: [
    cite(US.cfrFacility, "Who must register; exemptions."),
    cite(US.cfrRenewal, "Renewal every other year, 1 October to 31 December of even-numbered years."),
    cite(US.cfrExpired, "1.241(b) and (c): expired registrations."),
    cite(US.fdaRenewal2026, "The 2026 renewal window and expiry after 31 December 2026."),
    cite(US.cfrPriorNotice, "1.281(a)(6) and 1.285(a): the registration number in prior notice; food from an unregistered facility is held."),
  ],
  steps: ["STEP-038", "STEP-039"],
};

export const US_FSVP: PackRequirement = {
  code: "USP-02",
  name: "Importer's FSVP: hazard analysis and supplier verification",
  description:
    "The US importer needs a written Foreign Supplier Verification Program for each food and each foreign supplier before importing: a hazard analysis, an evaluation and approval of the Ethiopian supplier (its FDA import alert and warning letter history included), and verification activities. For a hazard that can cause serious illness, such as Salmonella in ready-to-eat spices, the default is an onsite audit of the supplier before the first shipment and every year, unless the importer documents that testing or a review of records gives adequate assurance. Lighter routes exist for a very small importer or supplier (under USD 1,372,952 a year of food sales, for 2026), and where a US customer applies a kill step and gives an annual written assurance. Each entry line names the importer by its DUNS number.",
  action:
    "Get the importer's FSVP route in writing, and supply what it needs: the supplier's hazard analysis and food safety plan, lot test results with the method and laboratory, the FDA registration, and access for an audit.",
  whyItMatters: "Food from an importer without an FSVP can be refused admission (Import Alert 99-41), and the supplier evaluation weighs the exporter's FDA history.",
  responsible: "US importer (the exporter supplies the documents)",
  trigger: "Before the first shipment; verification at least yearly.",
  evidence: "Importer's written FSVP confirmation; the documents supplied.",
  jurisdiction: "US",
  authority: "US Food and Drug Administration (FDA)",
  basis: "confirmed",
  verification: checked(
    "21 CFR 1.500 (importer; very small importer), 1.502, 1.504 (hazard analysis; the importer may review the supplier's), 1.505 (supplier evaluation, compliance history included), 1.506 (verification: an onsite audit by default for serious hazards, (d)(2); what the supplier provides, (e)), 1.507(a)(2) to (4) (a customer controls the hazard), 1.509(a) (importer identification at entry), 1.510 (records in English on request), 1.512 (very small importers and small suppliers: written assurance every 2 years). FDA's inflation-adjusted cut-off for 2026 is USD 1,372,952. No substantive amendment since 2016.",
  ),
  sources: [
    cite(US.cfrFsvp, "1.500 to 1.514."),
    cite(US.cfrFsvpVerification, "Verification; the onsite audit default."),
    cite(US.cfrFsvpSmall, "Very small importers and small suppliers."),
    cite(US.fdaCutoffs, "USD 1,372,952 for 2026."),
    cite(US.fdaFsvp, "DUNS as the importer identifier."),
  ],
  steps: ["STEP-037"],
};

export const US_PREVENTIVE_CONTROLS: PackRequirement = {
  code: "USP-08",
  name: "FDA preventive controls at the Ethiopian facility (21 CFR part 117)",
  description:
    "A registered foreign facility follows FDA's current good manufacturing practice and, unless exempt, a written food safety plan (hazard analysis, preventive controls, supply-chain program, recall plan) prepared or overseen by a preventive controls qualified individual. A qualified facility (a very small business, under USD 1,372,952 a year of food sales) needs no plan but files an attestation (Form FDA 3942a) every two years, in the same 1 October to 31 December window as the registration renewal. A facility whose US customer applies the kill step can rely on it, with a disclosure and the customer's annual written assurance.",
  action:
    "Record whether the facility is a qualified facility or has a food safety plan, its preventive controls qualified individual, and, where it relies on a customer's control, the disclosure and the assurance.",
  whyItMatters: "The importer's FSVP checks the facility against these rules, and FDA can inspect foreign facilities.",
  responsible: "Ethiopian manufacturer or packer",
  trigger: "Before the first US shipment; attestations between 1 October and 31 December 2026.",
  evidence: "Food safety plan, or the qualified facility attestation.",
  jurisdiction: "US",
  authority: "US Food and Drug Administration (FDA)",
  basis: "confirmed",
  verification: checked(
    "21 CFR 117.1 and 117.3 (facilities that must register, foreign ones included; drying and grinding are manufacturing), 117.5(a) (qualified facilities), 117.126 (food safety plan), 117.136 (relying on the customer), 117.180 (the qualified individual), 117.201 (attestations every two years, 1 October to 31 December), 117.405 to 117.475 (supply-chain program). The produce safety rule (part 112) covers only raw agricultural commodities, not dried spices or processed food. No 2025 or 2026 amendment.",
  ),
  sources: [
    cite(US.cfrPreventive, "117.1 to 117.475."),
    cite(US.cfrQualified, "Qualified facility attestations."),
    cite(US.cfrCustomerControl, "Relying on a customer's control."),
    cite(US.fdaCutoffs, "USD 1,372,952 for 2026."),
  ],
  steps: ["STEP-012"],
};

export const US_PRIOR_NOTICE: PackRequirement = {
  code: "USE-01",
  name: "FDA prior notice",
  description:
    "Prior notice must be submitted to FDA for all imported food: no less than 8 hours before arrival at the US port by water and 4 hours by air, and no more than 30 days before (15 through PNSI). For food no longer in its natural state it names the manufacturer's FDA registration number.",
  action: "Confirm the importer or broker submitted prior notice, and record the FDA confirmation number.",
  whyItMatters: "Food without adequate prior notice may be refused admission and held at the port.",
  responsible: "US importer or broker",
  trigger: "Before arrival: at least 8 hours by water, 4 hours by air.",
  evidence: "Prior notice confirmation number.",
  jurisdiction: "US",
  authority: "US Food and Drug Administration (FDA)",
  basis: "confirmed",
  verification: checked("21 CFR 1.277(a) (applies to all imported food), 1.278 (who may submit), 1.279(a) (8 hours by water, 4 by air; at most 30 days ahead, 15 through PNSI), 1.281(a)(6) (the manufacturer's registration number)."),
  sources: [cite(US.cfrPriorNotice, "1.277 to 1.281: scope, submitter, timing and content."), US.fdaImport],
  steps: ["STEP-095", "STEP-096"],
};

export const US_ISF: PackRequirement = {
  code: "USP-04",
  name: "Importer Security Filing (ISF \"10+2\")",
  description:
    "For ocean cargo to the US, the ISF importer files the ISF data (seller, buyer, importer of record, consignee, manufacturer or supplier, ship-to party, country of origin, HTS code) no later than 24 hours before the cargo is loaded at the foreign port, here Djibouti.",
  action: "Send the ISF data to the importer's broker and get confirmation that the ISF was filed at least 24 hours before loading.",
  whyItMatters: "A late or missing ISF can lead to penalties and holds, and the deadline falls before loading.",
  responsible: "US importer or broker (the exporter supplies the data)",
  trigger: "No later than 24 hours before loading at Djibouti.",
  evidence: "ISF filing confirmation.",
  jurisdiction: "US",
  authority: "US Customs and Border Protection (CBP)",
  basis: "confirmed",
  verification: checked("19 CFR 149.2 (data elements and 24-hour timing); containerised cargo in bags or cartons is not bulk cargo exempted under 149.4."),
  sources: [cite(US.cfrIsf, "Timing: 24 hours before lading at the foreign port."), US.cbpIsf],
  steps: ["STEP-097"],
};

export const US_RELEASE: PackRequirement = {
  code: "USE-03",
  name: "FDA admissibility review and release",
  description:
    "FDA screens each food entry electronically and may release it automatically; otherwise it reviews the entry and may release it, ask for documents, examine or sample it, or detain it, with a Notice of FDA Action and the right to a hearing.",
  action: "Record FDA's admissibility decision as the importer or broker reports it.",
  whyItMatters: "The buyer can't take possession until the shipment is released.",
  responsible: "US importer or broker",
  trigger: "After entry is filed.",
  evidence: "FDA release, or the Notice of FDA Action, reported by the broker.",
  jurisdiction: "US",
  authority: "US Food and Drug Administration (FDA)",
  basis: "confirmed",
  verification: checked(
    "FDA's entry review page (January 2026): electronic screening with possible automatic release, then review, with release, a request for documents, examination or sampling, or detention. Detention gives a Notice of FDA Action and a hearing under 21 CFR 1.94.",
  ),
  sources: [cite(US.fdaEntryReview, "Screening, review and the outcomes."), cite(US.fdaDetention, "Detention, the notice and the hearing.")],
  steps: ["STEP-106"],
};
