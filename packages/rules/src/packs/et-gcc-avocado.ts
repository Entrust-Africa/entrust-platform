import type { Condition, PackRequirement, RulePack } from "../types";
import { AVOCADO_COVERED, AVOCADO_STANDARD, HORTICULTURE_EXPORTER } from "./avocado";
import { CHECKED, ETHIOPIAN_EXPORT, TRADE_LICENCE, awaiting, checked, cite, inWorkflowOrder, phytosanitaryCertificate } from "./common";
import { ET, GCC } from "./sources";

// Rule pack: fresh Ethiopian Hass avocado to the six GCC states, researched on 24 and 25 October
// 2026. The canonical steps have destination checks only for the US, Türkiye and the EU, so the GCC
// rules sit on the general checks (STEP-036, 037, 042, 043) and the steps where their work is done;
// a state's own rules apply only to cases bound for it. It covers the fresh produce category,
// written for avocados (see CASE-02).
//
// A published version never changes: add a new version below and list it in ET_GCC_AVOCADO.

const GCC_STATES = ["SA", "AE", "QA", "KW", "BH", "OM"] as const;
const to = (country: (typeof GCC_STATES)[number]): Condition => ({ fact: "destinationCountry", in: [country] });

const GCC_SIDE: readonly PackRequirement[] = [
  // ---- Common to the GCC ----
  {
    code: "GCE-01",
    name: "GCC customs tariff: avocados at 0%",
    description:
      "The six states apply the GCC Integrated Customs Tariff, in force from 1 January 2025 (the UAE from 1 August 2025). Fresh avocados (08 04 40 00 00 00) are duty-free from any origin, so the lack of a GCC preference for Ethiopia doesn't matter for duty. Goods cleared at the first GCC point of entry pay duty once.",
    action: "Confirm the tariff line with the importer before shipping.",
    whyItMatters: "Duty is part of the importer's landed cost, and a state may change a line on its own.",
    responsible: "GCC importer or its customs broker",
    trigger: "Before shipment.",
    evidence: "Tariff line confirmed by the importer.",
    jurisdiction: "GCC",
    authority: "GCC Customs Union Authority; each state's customs",
    basis: "confirmed",
    verification: awaiting(
      "The GCC Integrated Customs Tariff as published by Qatar's customs (2026 edition), line 08 04 40 00 00 00 Avocados, 0%. Qatar's guide to clearing imported goods (chapter 2): food cleared at the first point of entry faces no further measures at intra-GCC borders. Open: the national tariff lookups of Saudi Arabia, the UAE, Kuwait, Bahrain and Oman couldn't be queried; Saudi Arabia changed 51 lines on 26 June 2026, not this one (EY, a secondary source). Import VAT is national and wasn't researched.",
    ),
    sources: [cite(GCC.tariff, "Line 08 04 40 00 00 00: 0%."), cite(GCC.firstEntry, "Clearance once at the first point of entry.")],
    steps: ["STEP-036"],
  },
  {
    code: "GCP-01",
    name: "GCC plant quarantine: phytosanitary certificate and inspection on arrival",
    description:
      "No consignment of plant products may enter a GCC state without the import permit it requires and a phytosanitary certificate from the exporting country, on the IPPC model. All six states require one for fresh avocados. On arrival the importer declares the consignment, it is inspected, and customs release it only once the plant quarantine authority allows; a non-compliant consignment is treated, re-exported or destroyed at the importer's cost. No GCC state was live on the ePhyto hub in mid-2026, so the original paper certificate travels with the goods. It must describe the goods exactly as the invoice and packing list do, and any attachment, such as a treatment certificate, carries the certificate's number, signature and stamp. Bahrain requires it issued no more than 15 days before departure and never after.",
    action: "At STEP-042, record the phytosanitary certificate as required, and send the original with the goods, matching the invoice and packing list line by line.",
    whyItMatters: "Fruit without a valid original certificate is held, re-exported or destroyed at the importer's cost.",
    responsible: "Exporter (certificate from the Ethiopian Agricultural Authority); the importer declares on arrival",
    trigger: "Before departure: within 15 days of it for Bahrain, and never after it.",
    evidence: "Original phytosanitary certificate.",
    jurisdiction: "GCC",
    authority: "Each state's plant quarantine authority, under the GCC Plant Quarantine Law as enacted nationally",
    basis: "confirmed",
    verification: checked(
      "GCC Plant Quarantine Law (2003) Art. 2 (the certificate follows the IPPC model), 14 (customs hold goods until the authority allows), 15 (import permit and/or certificate; pre-shipment conditions), 17 and 18 (declaration, inspection, treatment, re-export or destruction at the importer's cost); enacted as Saudi Royal Decree M/9 of 1426H, Qatar Law 24 of 2005, Kuwait Law 19 of 2009 and Bahrain Law 5 of 2003; Oman's Agricultural Quarantine Law (Royal Decree 47/2004) follows it, and the UAE's Federal Law 7 of 2025 Art. 5 and 6 requires the certificate and inspection. IPPC (5 June 2026): Saudi Arabia to connect to the ePhyto hub by the end of 2026, none of the six live. Qatar: matching lists and ISPM 12 attachments (IPPC 2025 and 2017); Bahrain: Decision 1/2004 (15 days; originals only). Open: additional declarations for fruit flies, which the GCC pest lists regulate; none was found.",
    ),
    sources: [
      cite(GCC.quarantineLaw, "Art. 2, 14, 15, 17 and 18."),
      cite(GCC.aeQuarantine, "UAE Federal Law 7 of 2025, Art. 5 and 6."),
      cite(GCC.ephytoNearEast, "No GCC state live on ePhyto in mid-2026."),
      cite(GCC.qaPhytosanitary, "Qatar: lists matching the certificate."),
      cite(GCC.qaAttachments, "Qatar: attachments in the ISPM 12 form."),
      cite(GCC.bhImportDecision, "Bahrain: issued within 15 days before departure; originals."),
    ],
    steps: ["STEP-042", "STEP-069"],
  },
  {
    code: "GCP-02",
    name: "GSO standards for fresh avocado",
    description:
      "GSO 2131:2015 (fresh avocado) and GSO 123:1990 (general requirements for fresh fruit and vegetables) are Gulf Technical Regulations: they set the quality classes, sizing, maturity, packing and carton marking of avocados sold fresh to consumers in the GCC.",
    action: "Grade, size and pack to GSO 2131 (the importer can supply the text), and record the lot's class and maturity.",
    whyItMatters: "Fruit that doesn't meet a technical regulation can be refused at the border or on the market.",
    responsible: "Exporter (packer); the importer answers for conformity",
    trigger: "Grading and packing.",
    evidence: "Grading record against GSO 2131.",
    jurisdiction: "GCC",
    authority: "GCC Standardization Organization (GSO); each state's standards and food authorities",
    basis: "confirmed",
    verification: awaiting(
      "The GSO store lists GSO 2131:2015 (edition 2, approved 21 May 2015) and GSO 123:1990 as current Gulf Technical Regulations. Open: their content, since GSO sells the texts; GSO 2131's scope matches the Codex standard for avocado (CXS 197-1995), which couldn't be fetched either. How each state checks them at the border wasn't found.",
    ),
    sources: [cite(GCC.gsoAvocado, "GSO 2131:2015: avocado."), cite(GCC.gsoFreshProduce, "GSO 123:1990: fresh fruit and vegetables.")],
    steps: ["STEP-037", "STEP-068"],
  },
  {
    code: "GCP-03",
    name: "Pesticide residue limits (GSO 382)",
    description:
      "GSO 382:2021 sets the GCC's maximum pesticide residue limits, and each state's food authority tests on arrival. The UAE applies Codex limits first, then the EU's and the US's where Codex sets none.",
    action: "Check the spray programme against GSO 382 (or Codex) limits for avocados, keep the spray records, and test the lot for residues before shipment.",
    whyItMatters: "A consignment over a limit is refused at the importer's cost.",
    responsible: "Exporter; the importer answers for compliance",
    trigger: "Before harvest (spray programme) and before shipment (test).",
    evidence: "Spray records; pesticide residue laboratory report.",
    jurisdiction: "GCC",
    authority: "GCC Standardization Organization (GSO); each state's food authority",
    basis: "confirmed",
    verification: awaiting(
      "The GSO store lists GSO 382:2021 (edition 2, approved 1 July 2021, replacing GSO 382:1994) as a current Gulf Technical Regulation. Open: the limits for avocados (the 152-page text is sold); the UAE's order of Codex, EU and US limits (UAE.S MRL 1/2024) is reported by USDA, a secondary source.",
    ),
    sources: [cite(GCC.gsoResidues, "GSO 382:2021.")],
    steps: ["STEP-060"],
  },
  {
    code: "GCP-04",
    name: "Arabic labelling of prepacked avocados (GSO 9)",
    description:
      "Avocados prepacked for retail (punnets, net bags, consumer packs) follow GSO 9:2022, the GCC labelling regulation, and GSO 2749:2024 for prepacked fruit and vegetables: labels in Arabic, any other language identical and alongside, with the country of origin. Loose fruit in cartons is marked under the produce standards instead (and SAP-03 for Saudi Arabia).",
    action: "For retail packs, have the importer approve the Arabic label before printing.",
    whyItMatters: "Prepacked food without a compliant Arabic label can't be sold.",
    responsible: "Exporter (packer), with the importer",
    trigger: "Before retail packaging is printed.",
    evidence: "Approved label artwork.",
    jurisdiction: "GCC",
    authority: "GCC Standardization Organization (GSO); each state's food authority",
    basis: "conditional",
    appliesWhen: { description: "the avocados are prepacked for retail sale" },
    verification: awaiting(
      "The GSO store lists GSO 9:2022 (edition 4, approved 19 October 2022; amendment 1 of 22 April 2025) as a Gulf Technical Regulation, and GSO 2749:2024 as a Gulf Standard. Open: their content (the texts are sold); that labels must be in Arabic is reported by USDA for Saudi Arabia and the UAE and by Bahrain's Ministry of Health guide.",
    ),
    sources: [cite(GCC.gsoLabelling, "GSO 9:2022."), cite(GCC.gsoProduceLabelling, "GSO 2749:2024."), cite(GCC.bhFoodGuide, "Bahrain: GSO 9 among the general requirements.")],
    steps: ["STEP-043"],
  },
  {
    code: "GCE-02",
    name: "Certificate of origin and invoice for GCC customs",
    description:
      "Every import is cleared on a detailed declaration with a detailed original invoice; customs may ask for an Arabic translation and for proof of origin, and release goods against an undertaking to produce missing originals within 90 days. The states' customs lists ask for a certificate of origin, which the Ethiopian Chamber of Commerce and Sectoral Associations issues. Invoices list every item, with freight and insurance shown (Saudi customs value on a CIF basis).",
    action: "Get the chamber's certificate of origin, and issue an invoice that lists every item with its value, freight and insurance, clear enough to translate into Arabic.",
    whyItMatters: "Without the original invoice and certificate of origin, customs won't clear the goods, or only against an undertaking.",
    responsible: "Exporter",
    trigger: "When the invoice is final.",
    evidence: "Certificate of origin; detailed commercial invoice.",
    jurisdiction: "GCC",
    authority: "Each state's customs; the Ethiopian Chamber of Commerce and Sectoral Associations",
    basis: "confirmed",
    verification: checked(
      "GCC Common Customs Law (in force from January 2002) Art. 24 (restricted goods need approval), 25 (proof of origin), 27(1) and (4) (detailed original invoice; 90-day undertaking; Arabic translation), 47 and 48 (the declaration and its documents); customs document lists: Saudi ZATCA (invoice, certificate of origin, Arabic translation, packing list), Kuwait (Decision 6/2023 Art. 15), Bahrain (MOH guide) and Oman (Bayan). Ethiopia: Proclamation 341/2003 Art. 5(7). Oman applied amendments to the customs law by Royal Decree 28/2026; none touches these articles.",
    ),
    sources: [
      cite(GCC.customsLaw, "Art. 24, 25, 27, 47 and 48."),
      cite(GCC.saCustoms, "Saudi Arabia: the documents attached to the declaration."),
      cite(GCC.omDeclaration, "Oman: the Bayan declaration's documents."),
      cite(ET.chambers341, "Art. 5(7): the chamber issues certificates of origin."),
    ],
    steps: ["STEP-050", "STEP-100"],
  },

  // ---- Saudi Arabia ----
  {
    code: "SAP-01",
    name: "Saudi Arabia: MEWA import licence and import permit for each shipment",
    description:
      "The Saudi importer holds the Ministry of Environment, Water and Agriculture's licence to import fresh fruit and vegetables, and gets an import permit for each shipment on MEWA's Namaa platform. Under the import licensing guide revised in October 2026 (from about early November), the permit must be issued at least 24 hours before the shipment reaches the port, the shipment may not be dispatched before it, and the permit lasts 15 days; a shipment without one is rejected. The application needs the phytosanitary certificate (an electronic copy with a QR code or verification link is accepted), the certificate of origin and an invoice listing every item.",
    action: "Don't ship until the Saudi buyer confirms its permit number, and send the certificate, certificate of origin and invoice in time for the application.",
    whyItMatters: "A shipment that arrives without a permit is rejected.",
    responsible: "Saudi importer (the exporter supplies the documents)",
    trigger: "Before dispatch; the permit at least 24 hours before arrival.",
    evidence: "Saudi import permit number.",
    jurisdiction: "SA",
    authority: "Saudi Ministry of Environment, Water and Agriculture (MEWA); Ministry of Commerce",
    basis: "conditional",
    appliesWhen: { condition: to("SA"), description: "the destination is Saudi Arabia" },
    verification: awaiting(
      "Confirmed: the WTO import licensing database records MEWA's licence for fresh fruit and vegetables (automatic, in force since 9 August 2021, notified as G/LIC/N/2/SAU/3), and the Namaa permit service exists; MEWA's quarantine department issues import permits for unprocessed plant products. Open: the October 2026 guide (24 hours, 15 days, the electronic certificate) is known only from news reports (Okaz, Gulf News); its text and start date weren't found.",
    ),
    sources: [
      cite(GCC.saLicence, "MEWA's licence for fresh fruit and vegetables."),
      cite(GCC.saPermit, "The per-shipment permit."),
      cite(GCC.saQuarantine, "Permits and inspection of plant products."),
    ],
    steps: ["STEP-037"],
  },
  {
    code: "SAE-01",
    name: "Saudi Arabia: SFDA food clearance",
    description:
      "The Saudi importer registers its establishment and products on the Saudi Food and Drug Authority's Ghad platform and files the clearance request through FASAH, with a copy of the certificate of origin, the commercial invoice (products, quantities, dates and batch numbers), the bill of lading or air waybill, and a copy of the phytosanitary certificate. SFDA may sample the fruit, at the importer's cost. Ethiopian fruit needs no listed establishment.",
    action: "Send the importer the documents for the clearance request, with batch numbers on the invoice.",
    whyItMatters: "SFDA releases the fruit only after the clearance, and fresh produce loses value while it waits.",
    responsible: "Saudi importer (the exporter supplies the documents)",
    trigger: "On arrival.",
    evidence: "SFDA clearance.",
    jurisdiction: "SA",
    authority: "Saudi Food and Drug Authority (SFDA)",
    basis: "conditional",
    appliesWhen: { condition: to("SA"), description: "the destination is Saudi Arabia" },
    verification: checked(
      "SFDA's conditions and requirements for food clearance (August 2026): Ghad registration, a licensed warehouse (small importers excepted), FASAH, the documents and the fresh fruit row, sampling at the importer's cost. SFDA's list of countries and establishments has no fruit entry for Ethiopia. Open: the current list of countries whose fresh produce needs a certificate of conformity (Ethiopia isn't among those reported).",
    ),
    sources: [cite(GCC.saFoodClearance, "Clearance requirements and documents."), cite(GCC.saCountries, "Ethiopia: no fruit entry.")],
    steps: ["STEP-106"],
  },
  {
    code: "SAP-03",
    name: "Saudi Arabia: carton marking in Arabic",
    description:
      "Cartons of fresh fruit carry, in Arabic (another language may be added alongside), in fixed legible print at least 2 cm high: the type and variety, the grade, the exporter's name, mark and address, gross and net weight (or the fruit count), the country of origin and the packing date.",
    action: "Print the cartons with the Arabic particulars before packing.",
    whyItMatters: "Cartons without the Arabic marks can be refused at clearance.",
    responsible: "Exporter (packer)",
    trigger: "When the cartons are printed.",
    evidence: "Photograph of the carton marks.",
    jurisdiction: "SA",
    authority: "Saudi Food and Drug Authority (SFDA)",
    basis: "conditional",
    appliesWhen: { condition: to("SA"), description: "the destination is Saudi Arabia" },
    verification: checked(
      "SFDA guidance on packaging requirements for fresh vegetables and fruit (Giud06), page 10. It is guidance resting on the technical regulations (GSO 2131 and GSO 123), which bind.",
    ),
    sources: [cite(GCC.saPackaging, "Page 10: the carton particulars.")],
    steps: ["STEP-066"],
  },

  // ---- United Arab Emirates ----
  {
    code: "AEE-01",
    name: "UAE: food registration and import request",
    description:
      "The UAE importer registers the food and its label through ZAD (federal), Dubai Municipality's food import service (FIRS) or the emirate's portal, then files an import request for each shipment; the municipality inspects and may sample on arrival, and releases after quarantine and duty.",
    action: "Send the importer the label, carton artwork and phytosanitary certificate details for the registration and the import request.",
    whyItMatters: "The fruit isn't released without the import request.",
    responsible: "UAE importer (the exporter supplies the details)",
    trigger: "Before arrival.",
    evidence: "Import request reference from the importer.",
    jurisdiction: "AE",
    authority: "Ministry of Climate Change and Environment (MOCCAE); Dubai Municipality; Abu Dhabi Agriculture and Food Safety Authority (ADAFSA)",
    basis: "awaiting_verification",
    appliesWhen: { condition: to("AE"), description: "the destination is the United Arab Emirates" },
    verification: awaiting(
      "Known only from USDA's UAE country report (November 2025, a secondary source). MOCCAE's site refused connections, and Dubai Municipality's and ADAFSA's rules weren't read; neither was Federal Law 10 of 2015 on food safety. Also open: whether MOCCAE issues a plant import permit in advance for fresh fruit (USDA lists permits only for animals, seeds and planting material).",
    ),
    sources: [cite(GCC.aeFoodImport, "Sections VI.3 and IX: ZAD, FIRS, registration, the import request and inspection.")],
    steps: ["STEP-037"],
  },
  {
    code: "AEE-02",
    name: "UAE: attestation of the invoice and certificate of origin",
    description:
      "Since 1 February 2023, the commercial invoice and certificate of origin of goods worth AED 10,000 or more imported into the UAE are attested electronically by the Ministry of Foreign Affairs, through eDAS 2.0 since 8 June 2026: AED 150 a document, paid within 14 days of the bill of entry, after which a fine of AED 500 an invoice applies. The importer does it; no attestation by a UAE embassy abroad is needed. Goods discharged in a free zone port and goods in transit are excluded.",
    action: "Send the importer a clear invoice and the chamber's certificate of origin for the attestation.",
    whyItMatters: "Late attestation costs the importer a fine for every invoice.",
    responsible: "UAE importer (the exporter issues the documents)",
    trigger: "Within 14 days of the bill of entry.",
    evidence: "Importer's attestation confirmation.",
    jurisdiction: "AE",
    authority: "UAE Ministry of Foreign Affairs",
    basis: "conditional",
    appliesWhen: { condition: to("AE"), description: "the destination is the UAE mainland and the invoice is worth AED 10,000 or more" },
    verification: checked(
      "UAE Ministry of Foreign Affairs: the eDAS 2.0 service page (fees and documents) and its FAQs (the AED 10,000 threshold from 1 February 2023, the 14-day period, the AED 500 fine, the exclusions); eDAS 1.0 retired on 8 June 2026. The legal basis is given as Cabinet Resolution 38 of 2022, which wasn't read.",
    ),
    sources: [cite(GCC.aeAttestation, "The service and its fees."), cite(GCC.aeAttestationRules, "Threshold, period, fine and exclusions.")],
    steps: ["STEP-100"],
  },

  // ---- Qatar ----
  {
    code: "QAP-01",
    name: "Qatar: import permit and approvals for avocados",
    description:
      "Fruit and vegetables for human consumption need an import permit from the Ministry of Municipality's Department of Agricultural Affairs and a phytosanitary certificate, with lists of items, varieties and quantities that match the certificate. Qatar customs list avocados as restricted goods, released only with the approval of the Ministry of Public Health and the Ministry of Municipality.",
    action: "Confirm the importer's permit before shipping, and make the invoice and packing list match the certificate line by line.",
    whyItMatters: "Customs won't release restricted goods without both ministries' approval.",
    responsible: "Qatari importer (the exporter supplies matching documents)",
    trigger: "Before shipment.",
    evidence: "Importer's permit; the ministries' approvals on arrival.",
    jurisdiction: "QA",
    authority: "Ministry of Municipality (Department of Agricultural Affairs); Ministry of Public Health",
    basis: "conditional",
    appliesWhen: { condition: to("QA"), description: "the destination is Qatar" },
    verification: awaiting(
      "Confirmed: Qatar's phytosanitary requirements (IPPC, updated 3 April 2025), item 1, and the customs list of restricted goods (line 08044000: Ministry of Public Health and Ministry of Municipality approval); Law 24 of 2005 Art. 2. Open: the monthly import permit reported since December 2021 (news only; the ministry's site couldn't be read), the Ministry of Public Health's documents and sampling for fresh fruit, and whether customs require the invoice or certificate of origin legalised by Qatar's embassy.",
    ),
    sources: [cite(GCC.qaPhytosanitary, "Item 1: the permit and the certificate."), cite(GCC.qaRestricted, "Line 08044000: approvals needed.")],
    steps: ["STEP-037"],
  },

  // ---- Kuwait ----
  {
    code: "KWP-01",
    name: "Kuwait: import licence, PAFN prior approval and documents",
    description:
      "No plant consignment enters Kuwait without an import licence and a phytosanitary certificate. Food may be imported only with the Public Authority for Food and Nutrition's prior approval; fresh fruit is medium-risk, and food imported for the first time gets tighter checks. Each consignment comes with a certificate of origin, the importer's licence and a packing list issued by the exporting firm, giving for each item the number and size of packages, net weight, batch and gross weight; official certificates must be originals (an electronic one needs a QR code or similar check), in Arabic or English, matching the goods.",
    action: "Issue a packing list with the per-item detail PAFN asks for, and confirm the importer's licence and prior approval before shipping.",
    whyItMatters: "PAFN won't open the clearance without the documents and the prior approval.",
    responsible: "Kuwaiti importer (the exporter supplies the documents)",
    trigger: "Before shipment (approval); on arrival (documents).",
    evidence: "Importer's licence and PAFN approval; the packing list.",
    jurisdiction: "KW",
    authority: "Public Authority for Agriculture Affairs and Fish Resources (PAAFR); Public Authority for Food and Nutrition (PAFN)",
    basis: "conditional",
    appliesWhen: { condition: to("KW"), description: "the destination is Kuwait" },
    verification: checked(
      "Kuwait Law 19 of 2009 (the GCC Agricultural Quarantine Law) Art. 15 and 17; PAFN's Imported Food Regulation (Ministerial Decision 6 of 2023, in force 1 September 2023) Art. 1, 6, 7, 13, 15 and 18 to 20; PAFN's list of documents on arrival; PAFN's register shows no ban decision on Ethiopia (24 October 2026). Open: PAAFR's licence procedure (its site timed out), whether PAFN wants a health certificate besides the phytosanitary certificate, and legalisation of the invoice and certificate of origin.",
    ),
    sources: [
      cite(GCC.kwQuarantine, "Art. 15 and 17."),
      cite(GCC.kwImportedFood, "Art. 1, 6, 7, 13, 15 and 18 to 20."),
      cite(GCC.kwArrivalDocuments, "The documents on arrival."),
      cite(GCC.kwBans, "No ban decision on Ethiopia."),
    ],
    steps: ["STEP-037", "STEP-101"],
  },

  // ---- Bahrain ----
  {
    code: "BHP-01",
    name: "Bahrain: prior agricultural import licence and Ministry of Health inspection",
    description:
      "The Bahraini importer gets a prior import licence from the plant quarantine unit before the goods leave the country of origin (BD 10, one per exporting country, valid 6 to 12 months). The phytosanitary certificate must be the original, in Arabic or English, signed and stamped, and issued no more than 15 days before the consignment leaves and never after; packing materials of plant origin are prohibited. On arrival the Ministry of Health inspects the food against the customs declaration, a packing list (sizes, number and weight per item) and the bill of lading, for a fee of BD 8 to 10 by weight.",
    action: "Confirm the importer's licence before shipping, have the certificate issued within 15 days before departure, and send the original.",
    whyItMatters: "A certificate issued too early or after departure, or a photocopy, is refused.",
    responsible: "Bahraini importer (the exporter supplies the certificate and documents)",
    trigger: "Licence before shipment; certificate within 15 days before departure.",
    evidence: "Importer's licence; original phytosanitary certificate.",
    jurisdiction: "BH",
    authority: "Ministry of Municipalities Affairs and Agriculture (Agricultural Health Directorate); Ministry of Health; Bahrain Customs",
    basis: "conditional",
    appliesWhen: { condition: to("BH"), description: "the destination is Bahrain" },
    verification: checked(
      "Bahrain Law 5 of 2003 (approving the GCC law); Ministerial Decision 1 of 2004 Art. 1 to 8 (the prior licence; the certificate's form, 15 days, originals; Art. 4(4) on plant-origin packing); Bahrain Customs' list of Agricultural Health Directorate measures (fresh fruit needs the prior permit, the certificate and inspection); the national portal (BD 10, one permit per exporting country); the Ministry of Health's food importers guide (2022: documents and fees). Open: whether cardboard cartons count as packing of plant origin (believed not), and legalisation of the invoice or certificate of origin.",
    ),
    sources: [
      cite(GCC.bhQuarantine, "Law 5 of 2003."),
      cite(GCC.bhImportDecision, "Decision 1 of 2004, Art. 1 to 8."),
      cite(GCC.bhCustoms, "Fresh fruit: prior permit, certificate and inspection."),
      cite(GCC.bhPermit, "The permit service and its fee."),
      cite(GCC.bhFoodGuide, "Inspection documents and fees."),
    ],
    steps: ["STEP-037", "STEP-069"],
  },

  // ---- Oman ----
  {
    code: "OMP-01",
    name: "Oman: agricultural import permit and food safety control",
    description:
      "Oman's quarantine regulation requires the importer to apply for an agricultural permit before shipment, and the phytosanitary certificate and shipping documents to be authenticated by Oman's embassy or a GCC state's; Oman customs issue a one-shipment permit to import plant products. In July 2026 the ministry lifted permits for a wide range of plant products, now inspected at entry instead. Under the food safety regulation the importer also requests a permit stating the food, its origin and the expected arrival, the food is registered and may be tested, and customs release it only after approval.",
    action: "Ask the importer whether avocados still need the prior permit and whether the certificate must be authenticated by an embassy, and don't ship until it confirms.",
    whyItMatters: "A consignment that needed a permit and arrived without one is refused and re-exported at the importer's cost.",
    responsible: "Omani importer (the exporter supplies the documents)",
    trigger: "Before shipment.",
    evidence: "Importer's confirmation, with the permit number if one is needed.",
    jurisdiction: "OM",
    authority: "Ministry of Agriculture, Fisheries and Water Resources (Agricultural Quarantine Department; Food Safety and Quality Center); Oman customs",
    basis: "conditional",
    appliesWhen: { condition: to("OM"), description: "the destination is Oman" },
    verification: awaiting(
      "Confirmed: Royal Decree 47/2004 and the Executive Regulation (Ministerial Decision 32/2006, as amended) Art. 10 (permit before shipment), 11 (documents authenticated by an Omani or GCC embassy), 13 and 14; Oman customs' permit to import plant products (one shipment, six months); the Food Safety Regulation (Ministerial Decision 2/2010) Art. 30 to 34. Open: which plant products the July 2026 relaxation covers (reported by the Oman Observer; no list found), whether embassy authentication is still asked for, and a 2018 circular reported to require pesticide residue certificates for fruit.",
    ),
    sources: [
      cite(GCC.omQuarantine, "The law and its regulation, as amended."),
      cite(GCC.omQuarantineRegulation, "Art. 10, 11, 13 and 14."),
      cite(GCC.omPermit, "The one-shipment permit."),
      cite(GCC.omFoodSafety, "Art. 30 to 34."),
    ],
    steps: ["STEP-037", "STEP-106"],
  },
];

const ETHIOPIA_AVOCADO: readonly PackRequirement[] = [
  AVOCADO_COVERED,
  TRADE_LICENCE,
  HORTICULTURE_EXPORTER,
  AVOCADO_STANDARD,
  phytosanitaryCertificate("All six GCC states require one for fresh avocados (GCP-01): record it as required at STEP-042."),
];

const V0_1_0: RulePack = {
  id: "et-gcc-avocado",
  version: "0.1.0",
  name: "Ethiopian fresh Hass avocado to the GCC states",
  corridor: { products: ["fresh_produce"], destinations: GCC_STATES },
  route: "By air from Addis Ababa, or in a reefer container through Djibouti, to Saudi Arabia, the UAE, Qatar, Kuwait, Bahrain or Oman",
  status: "draft",
  checkedOn: CHECKED,
  changes: "First version, researched on 24 and 25 October 2026.",
  notes: [
    "Draft for Entrust's review: no requirement is verified by Entrust yet.",
    "Covers the fresh produce category, but was researched for Hass avocado only (CASE-02).",
    "Many GCC sources couldn't be read (MOCCAE, Kuwait's agriculture authority and customs, Oman's food safety centre; GSO standards are sold), so more of this pack awaits verification than the others. Confirm each state's permit with the buyer before every shipment.",
    "The GCC Guide for Control on Imported Foods is voluntary and not in force (WTO G/SPS/N/SAU/14/Add.3), so it isn't cited as a requirement.",
    "Not modelled: legalisation of documents in Qatar, Kuwait, Bahrain and Oman, which wasn't confirmed either way; import VAT.",
  ],
  requirements: inWorkflowOrder([...ETHIOPIAN_EXPORT, ...ETHIOPIA_AVOCADO, ...GCC_SIDE]),
};

/** Every published version, oldest first. */
export const ET_GCC_AVOCADO: readonly RulePack[] = [V0_1_0];
