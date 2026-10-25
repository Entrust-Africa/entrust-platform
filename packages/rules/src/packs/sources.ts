import type { SourceRef } from "../types";

// Sources the rule packs cite, with what each is cited for in general; a requirement adds the
// articles it relies on. The Ethiopian, Djibouti and US entries were checked for the green coffee
// pack on 24 October 2026 (et-us-green-coffee.ts keeps its own copy, as published).
//
// Published packs cite these entries, so editing one changes those packs and the published-version
// test fails. When a source moves or a new edition comes out, add an entry instead.
//
// ECTA's own website is not linked: on 10 and 24 October 2026 it was serving unrelated gambling content.

/** Ethiopia */
export const ET = {
  tax983: {
    title: "Federal Tax Administration Proclamation No. 983/2016 (Ministry of Justice)",
    url: "https://justice.gov.et/en/law/federal-tax-administration-proclamation/",
  },
  tax1434: {
    title: "Tax Administration (Amendment) Proclamation No. 1434/2026 (Ministry of Justice)",
    url: "https://justice.gov.et/en/law/tax-administration-proclamation-amendment-proclamation-no-1434-2026/",
  },
  nbeFxd: {
    title: "National Bank of Ethiopia Foreign Exchange Directive FXD/01/2024",
    url: "https://nbe.gov.et/files/fxd-01-2024-foreign-exchange/",
  },
  nbeFxd04: {
    title: "National Bank of Ethiopia Directive FXD/04/2026 (amendment)",
    url: "https://nbe.gov.et/wp-content/uploads/2026/02/DIRECTIVE-NO.-FXD042026.pdf",
  },
  customs859: { title: "Customs Proclamation No. 859/2014 (FAOLEX copy)", url: "https://faolex.fao.org/docs/pdf/eth216442.pdf" },
  procl1160: {
    title: "Customs (Amendment) Proclamation No. 1160/2019 (Ministry of Justice copy)",
    url: "https://justice.gov.et/wp-content/uploads/2025/07/1160.pdf",
  },
  customs1425: {
    title: "Customs (Further Amendment) Proclamation No. 1425/2026 (Ministry of Justice)",
    url: "https://justice.gov.et/en/law/customs-proclamation-as-amended-further-amendment-no-1425-2026/",
  },
  esw: { title: "Ethiopian Electronic Single Window: trader portal", url: "https://esw.et/esw-trd/" },
  plant1400: {
    title: "Plant Protection and Quarantine Proclamation No. 1400/2026 (Ministry of Justice)",
    url: "https://justice.gov.et/en/law/plant-protection-and-quarantine-proclamation-no-1400-2026/",
  },
  plantReg: { title: "Plant Quarantine Regulation No. 4/1992 (FAOLEX copy)", url: "https://faolex.fao.org/docs/pdf/eth4524.pdf" },
  eaa: { title: "Ethiopian Agricultural Authority: services", url: "https://eaa.gov.et/services/" },

  // Checked for the packs other than green coffee to the US, on 24 and 25 October 2026.
  licensing980: {
    title: "Commercial Registration and Business Licensing Proclamation No. 980/2016 (Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2025/02/አዋጅ-ቁጥር-980-2008-1.pdf",
  },
  licensing1150: {
    title: "Commercial Registration and Business Licensing (Amendment) Proclamation No. 1150/2019 (Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2025/02/አዋጅ-ቁጥር-1150-2011.pdf",
  },
  licensingRegulation: {
    title: "Commercial Registration and Licensing Council of Ministers Regulation No. 392/2016 (Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2025/02/ደንብ-ቁጥር-392-2009.pdf",
  },
  licensingDirective: {
    title: "MoTRI Commercial Registration, Licensing and Post-Licensing Inspection Directive No. 935/2022 (Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2022/12/Commercial-Registration-Licensing-and-Post-Licensing-Inspection-Directive-No.-935-2022.pdf",
  },
  licenceCategories: {
    title: "Ethiopian Business Licensing Categories Directive (2019; Ministry of Justice No. 556/2013)",
    url: "https://justice.gov.et/wp-content/uploads/2019/06/Guide-to-the-Ethiopian-Business-Licensing-Department-Directive-No.-556-2013.pdf",
  },
  spice994: {
    title: "Spice Production Quality Control and Trade Directive No. 994/2016 (Amharic, Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2024/03/Spice-Production-Quality-Control-and-Trade-Directive-No.-994-2016.pdf",
  },
  plant1400Text: {
    title: "Plant Protection and Quarantine Proclamation No. 1400/2026, gazette text (Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2026/08/አዋጅ-ቁጥር-1400-2018.pdf",
  },
  ieics: { title: "Ethiopian Agricultural Authority: Integrated Export and Import Certification System (IEICS)", url: "https://ieics.eaa.gov.et/" },
  ephyto: {
    title: "IPPC ePhyto Solution: programme updates, September 2026",
    url: "https://www.ippc.int/en/ephyto/ippc-ephyto-solution-programme-updates-september-2026/",
  },
  standards1343: { title: "Ethiopian Standards Proclamation No. 1343/2024 (FAOLEX copy)", url: "https://faolex.fao.org/docs/pdf/eth242772.pdf" },
  compulsoryStandards: {
    title: "Institute of Ethiopian Standards: Compulsory Ethiopian Standards Catalogue (2025)",
    url: "https://www.ethiostandards.org/sites/default/files/2025-10/IES%20-%202025%20Compulsory%20Ethiopian%20standards%20Catalogue%20.pdf",
  },
  moaHorticultureDraft: {
    title: "Ministry of Agriculture: fruit, vegetable and root crop marketing directive (draft, 2015 EC)",
    url: "https://www.moa.gov.et/wp-content/uploads/2024/08/የአትክልት፣-ፍራፍሬና-ስራስር-ምርት-ግብይት-መመሪያ-ቁጥር-2015-ዓ.ም.pdf",
  },
  regulation457: { title: "Council of Ministers Regulation No. 457/2019 (horticulture powers to the Ministry of Agriculture)", url: "https://justice.gov.et/wp-content/uploads/2025/02/ደንብ-ቁጥር-457-2012.pdf" },
  regulation509: { title: "Council of Ministers Regulation No. 509/2022 establishing the Ethiopian Agricultural Authority", url: "https://justice.gov.et/wp-content/uploads/2025/02/ደንብ-ቁጥር-509-2014.pdf" },
  food1112: { title: "Food and Medicine Administration Proclamation No. 1112/2019 (Ministry of Justice)", url: "https://justice.gov.et/wp-content/uploads/2025/02/አዋጅ-ቁጥር-1112-2011.pdf" },
  efda357: {
    title: "EFDA Food Exporter, Importer and Distributor Control Directive No. 357/2013 (Amharic, Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2016/07/Food-Exporter-Importer-and-Distributor-Control-Guide-Directive-No.-357-2013.pdf",
  },
  efda358: {
    title: "EFDA Food Manufacturing Establishments Pre-licensing Directive No. 358/2013 (Amharic, Ministry of Justice)",
    url: "https://justice.gov.et/wp-content/uploads/2025/01/358-ምግብ-ማምረቻ-ተቋማት-የቅድመ-ፍቃድ-መመሪያ-ቁጥር-358-20131.pdf",
  },
  efda360: { title: "EFDA Food Registration Directive No. 360/2013 (Ministry of Justice)", url: "https://justice.gov.et/wp-content/uploads/2019/06/Food-Registration-Guide-Directive-No.-360-2013.pdf" },
  efdaFees: { title: "Council of Ministers Regulation No. 370/2015 on EFDA service fees (Ministry of Justice)", url: "https://justice.gov.et/wp-content/uploads/2025/02/ደንብ-ቁጥር-370-2008.pdf" },
  eswForms: { title: "Ethiopian Electronic Single Window: form list", url: "https://esw.et/esw-trd/info/form/infoFormList?menuId=T04050000" },
  chambers341: {
    title: "Chambers of Commerce and Sectorial Association Establishment Proclamation No. 341/2003 (Ministry of Justice)",
    url: "https://justice.gov.et/en/law/chambers-of-commerce-and-sectorial-association-establishment-proclamation/",
  },
  coffee1051: {
    title: "Coffee Quality Control and Marketing Proclamation No. 1051/2017 (FAOLEX copy)",
    url: "https://faolex.fao.org/docs/pdf/eth183197.pdf",
  },
  coffee1100: {
    title: "ECTA Coffee Marketing and Quality Control Implementation Directive No. 1100 (Amharic, Ministry of Justice copy)",
    url: "https://justice.gov.et/wp-content/uploads/2026/02/1100-2017-የቡና-ግብይት-እና-ጥራት-ቁጥጥር-አፈፃፀም-መመሪያ-ቁጥር-1100-2017-1.pdf",
  },
  icoRules: {
    title: "ICO Rules on Statistics: Certificates of Origin (ICC-102-9 Rev. 5, 2022)",
    url: "https://ico.org/documents/Key%20documents/kd-icc-102-9-r5e-rules-certificates-origin.pdf",
  },
  mofEudr: {
    title: "Ministry of Finance: Ethiopia accelerates efforts to ensure EUDR compliance for coffee exports (13 August 2025)",
    url: "https://www.mofed.gov.et/blog/ethiopia-accelerates-efforts-to-ensure-eu-deforestation-regulation-compliance-for-coffee-exports/",
  },
  ectaEudrGuide: {
    title: "ECTA and the European Forest Institute: a guide to the Ethiopian coffee value chain in the context of the EUDR (May 2026)",
    url: "https://efi.int/sites/default/files/2026-07/a-guide-to-the-ethiopian-coffee-value-chain-in-the-context-of-the-eudr.pdf",
  },
  eaaPepperGuide: {
    title: "Ethiopian Agricultural Authority and RAISE-FS: guidelines for improving the safety and quality of hot pepper (March 2026)",
    url: "https://eaa.gov.et/wp-content/uploads/2026/04/Guideline_for_improving_the_safety_and_quality_of_Hot_pepper_capsicum.pdf",
  },
  japanFormA: { title: "Japan Customs: specimen GSP Form A issued in Ethiopia (Ethiopian Customs Commission)", url: "https://www.customs.go.jp/roo/text/Ethiopia1.pdf" },
} satisfies Record<string, SourceRef>;

/** Djibouti, the port of loading for sea freight */
export const DJ = {
  djCustoms: {
    title: "Djibouti Customs Code (Code des Douanes, 2011 edition), Ministry of Finance",
    url: "https://www.ministere-finances.dj/CodeDouanes2011.pdf",
  },
  dpcsExport: {
    title: "Djibouti Port Community System: transit procedure for export (2018)",
    url: "https://www.dpcs.dj/TFBPCS/media/Transit%20Export_fr.pdf",
  },
  dpfzaNotice: {
    title: "Djibouti Ports and Free Zones Authority: official notifications (DPCS mandatory, 19 May 2026)",
    url: "https://dpfza.gov.dj/official-notification",
  },
  dpfzaForwarder: {
    title: "Djibouti Ports and Free Zones Authority: logistics (forwarder) licence",
    url: "https://dpfza.gov.dj/services/logistics-license",
  },
  dpfzaRail: { title: "Djibouti Ports and Free Zones Authority: inland transport by rail", url: "https://dpfza.gov.dj/facilities/inland-transport/rail" },
  sgtd: {
    title: "SGTD Doraleh Container Terminal: circulars and notices",
    url: "https://www.sgtd-terminal.com/circulars-and-notices/",
  },
  sgtdTariff: {
    title: "SGTD Doraleh Container Terminal Tariff Book (2021)",
    url: "https://www.sgtd-terminal.com/wp-content/uploads/2021/03/SGTDTariff_Book_2021.pdf",
  },
} satisfies Record<string, SourceRef>;

/** International rules the transaction runs on */
export const ICC = {
  incoterms: {
    title: "ICC Academy: Incoterms 2020, FCA or FOB?",
    url: "https://academy.iccwbo.org/incoterms/article/incoterms-2020-fca-or-fob/",
  },
} satisfies Record<string, SourceRef>;

/** United States */
export const US = {
  fdaImport: {
    title: "FDA: Importing Food Products into the United States",
    url: "https://www.fda.gov/food/food-imports-exports/importing-food-products-united-states",
  },
  fdaFsvp: {
    title: "FDA: FSMA Final Rule on Foreign Supplier Verification Programs (FSVP)",
    url: "https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-foreign-supplier-verification-programs-fsvp-importers-food-humans-and-animals",
  },
  cfrFacility: {
    title: "21 CFR 1.225 to 1.227: food facility registration (who must register, exemptions)",
    url: "https://www.ecfr.gov/current/title-21/part-1/subpart-H",
  },
  cfrRenewal: { title: "21 CFR 1.230: registration timing and biennial renewal", url: "https://www.ecfr.gov/current/title-21/section-1.230" },
  cfrExpired: { title: "21 CFR 1.241: failure to register and expired registrations", url: "https://www.ecfr.gov/current/title-21/section-1.241" },
  fdaRenewal2026: {
    title: "FDA: reminder of the biennial food facility registration renewal (29 September 2026)",
    url: "https://www.fda.gov/food/hfp-constituent-updates/fda-reminds-food-facilities-biennial-renewal-requirements",
  },
  cfrPriorNotice: { title: "21 CFR 1.276 to 1.285: prior notice of imported food", url: "https://www.ecfr.gov/current/title-21/part-1/subpart-I" },
  cfrFsvp: { title: "21 CFR part 1 subpart L: Foreign Supplier Verification Programs", url: "https://www.ecfr.gov/current/title-21/part-1/subpart-L" },
  cfrIsf: { title: "19 CFR 149.2: Importer Security Filing timing", url: "https://www.ecfr.gov/current/title-19/section-149.2" },
  cbpIsf: { title: "CBP: Importer Security Filing 10+2", url: "https://www.cbp.gov/border-security/ports-entry/cargo-security/importer-security-filing-102" },
  cfrEntry: { title: "19 CFR 142.2 and 142.4: time of entry; bond required for release", url: "https://www.ecfr.gov/current/title-19/part-142" },
  cfrBroker: { title: "19 CFR 111.2: when a customs broker licence is required", url: "https://www.ecfr.gov/current/title-19/section-111.2" },
  cfrMarking: { title: "19 CFR part 134: country of origin marking (134.11, 134.35)", url: "https://www.ecfr.gov/current/title-19/part-134" },
  hts: { title: "USITC Harmonized Tariff Schedule", url: "https://hts.usitc.gov/" },
  frEndingTariffs: {
    title: "Federal Register 2026-03832: Ending Certain Tariff Actions (25 February 2026)",
    url: "https://www.federalregister.gov/d/2026-03832",
  },
  eo14436: {
    title: "Federal Register 2026-21599: Executive Order 14436 (duties related to Russia, waived)",
    url: "https://www.federalregister.gov/d/2026-21599",
  },
  aphis: { title: "USDA APHIS: how to import plants and plant products", url: "https://www.aphis.usda.gov/plant-imports/how-to-import" },
  aphisManual: {
    title: "APHIS Seeds Not for Planting Manual (2011 edition, IPPC copy)",
    url: "https://assets.ippc.int/static/media/uploads/resources/seeds_not_for_planting.pdf",
  },
  fdaEntryReview: { title: "FDA import process: entry review", url: "https://www.fda.gov/industry/fda-import-process/entry-review" },
  fdaDetention: { title: "FDA import process: detention and hearing", url: "https://www.fda.gov/industry/fda-import-process/detention-hearing" },

  // Checked for the spices and processed food packs on 24 and 25 October 2026.
  cfrFsvpVerification: { title: "21 CFR 1.506: FSVP verification of foreign suppliers", url: "https://www.ecfr.gov/current/title-21/section-1.506" },
  cfrFsvpSmall: { title: "21 CFR 1.512: FSVP for very small importers and certain small foreign suppliers", url: "https://www.ecfr.gov/current/title-21/section-1.512" },
  fdaCutoffs: { title: "FDA: FSMA inflation-adjusted cut-offs", url: "https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-inflation-adjusted-cut-offs" },
  cfrPreventive: { title: "21 CFR part 117: current good manufacturing practice and preventive controls for human food", url: "https://www.ecfr.gov/current/title-21/part-117" },
  cfrQualified: { title: "21 CFR 117.201: qualified facility attestations", url: "https://www.ecfr.gov/current/title-21/section-117.201" },
  cfrCustomerControl: { title: "21 CFR 117.136: relying on a customer to control a hazard", url: "https://www.ecfr.gov/current/title-21/section-117.136" },
  alertsEthiopia: { title: "FDA import alerts by country: Ethiopia", url: "https://www.accessdata.fda.gov/cms_ia/country_ET.html" },
  alertSalmonella: { title: "FDA Import Alert 99-19: detention without physical examination for Salmonella", url: "https://www.accessdata.fda.gov/cms_ia/importalert_263.html" },
  alertMisbranding: { title: "FDA Import Alert 99-39: detention without physical examination for apparent misbranding", url: "https://www.accessdata.fda.gov/cms_ia/importalert_1144.html" },
  alertHeavyMetals: { title: "FDA Import Alert 99-42: detention without physical examination for heavy metals", url: "https://www.accessdata.fda.gov/cms_ia/importalert_1167.html" },
  alertColours: { title: "FDA Import Alert 45-02: detention without physical examination for illegal or undeclared colours", url: "https://www.accessdata.fda.gov/cms_ia/importalert_118.html" },
  alertMycotoxins: { title: "FDA Import Alert 23-14: detention without physical examination for mycotoxins", url: "https://www.accessdata.fda.gov/cms_ia/importalert_581.html" },
  alertsList: { title: "FDA import alerts by number", url: "https://www.accessdata.fda.gov/cms_ia/ialist.html" },
  alertNoProcess: { title: "FDA Import Alert 99-37: low-acid canned and acidified foods without a filed scheduled process", url: "https://www.accessdata.fda.gov/cms_ia/importalert_1131.html" },
  laaf: {
    title: "FDA: Laboratory Accreditation for Analyses of Foods (LAAF) program",
    url: "https://www.fda.gov/food/food-safety-modernization-act-fsma/laboratory-accreditation-analyses-foods-laaf-program-final-rule",
  },
  cfrLabelling: { title: "21 CFR part 101: food labeling", url: "https://www.ecfr.gov/current/title-21/part-101" },
  cfrNutrition: { title: "21 CFR 101.9: nutrition labeling and its exemptions", url: "https://www.ecfr.gov/current/title-21/section-101.9" },
  cfrBulkExemption: { title: "21 CFR 101.100: labeling exemptions, including food shipped in bulk for further processing", url: "https://www.ecfr.gov/current/title-21/section-101.100" },
  uscAllergens: { title: "21 U.S.C. 321(qq): major food allergens (US Code, govinfo)", url: "https://www.govinfo.gov/link/uscode/21/321?link-type=html" },
  uscMisbranding: { title: "21 U.S.C. 343: misbranded food, including 343(w) on allergens (US Code, govinfo)", url: "https://www.govinfo.gov/link/uscode/21/343?link-type=html" },
  fdaAllergens: { title: "FDA: food allergies", url: "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies" },
  cfrAcidified: { title: "21 CFR 108.25: acidified foods (registration and process filing)", url: "https://www.ecfr.gov/current/title-21/section-108.25" },
  cfrLowAcid: { title: "21 CFR 108.35: thermally processed low-acid foods in hermetically sealed containers", url: "https://www.ecfr.gov/current/title-21/section-108.35" },
  cfrAcidDefinitions: { title: "21 CFR 114.3: acid, acidified and low-acid food definitions", url: "https://www.ecfr.gov/current/title-21/section-114.3" },
  cfrLowAcidDefinitions: { title: "21 CFR 113.3: definitions for thermally processed low-acid foods", url: "https://www.ecfr.gov/current/title-21/section-113.3" },
  fdaCanningProgram: { title: "FDA Compliance Program 7303.070: domestic and imported low-acid canned and acidified foods", url: "https://www.fda.gov/media/182173/download" },
  cfrColours: { title: "21 CFR part 73 subpart A: colour additives exempt from certification, for food", url: "https://www.ecfr.gov/current/title-21/part-73/subpart-A" },
  cfrSpicesGras: { title: "21 CFR 182.10: spices and other natural seasonings generally recognized as safe", url: "https://www.ecfr.gov/current/title-21/section-182.10" },
  cfrIrradiation: { title: "21 CFR 179.26: ionizing radiation for the treatment of food", url: "https://www.ecfr.gov/current/title-21/section-179.26" },
  frRedNo3: { title: "Federal Register 2026-15920: FD&C Red No. 3 revoked for food from 15 January 2027 (stay lifted)", url: "https://www.federalregister.gov/d/2026-15920" },
  cfrPlantProducts: { title: "7 CFR part 319 subpart L: fruits and vegetables (319.56-11, dried products)", url: "https://www.ecfr.gov/current/title-7/part-319/subpart-L" },
  cfrKhapra: { title: "7 CFR part 319 subpart Q: articles from khapra beetle countries", url: "https://www.ecfr.gov/current/title-7/part-319/subpart-Q" },
  khapraCountries: { title: "APHIS: countries infested with khapra beetle (June 2022)", url: "https://www.aphis.usda.gov/sites/default/files/kb_1.pdf" },
  cbpBerbere: { title: "CBP ruling N327895: Ethiopian berbere, 0910.91.00, marking", url: "https://rulings.cbp.gov/ruling/N327895" },
  cbpMitmita: { title: "CBP ruling NY B88084: berbere, mitmita and kolo from Ethiopia", url: "https://rulings.cbp.gov/ruling/B88084" },
  cbpChiliBlends: { title: "CBP ruling HQ H053755: where a chili blend leaves heading 0904", url: "https://rulings.cbp.gov/ruling/H053755" },
  htsGeneralNotes: {
    title: "USITC Harmonized Tariff Schedule, 2026 Revision 21: General Notes (GSP, AGOA)",
    url: "https://hts.usitc.gov/reststop/file?release=currentRelease&filename=General%20Notes",
  },
  agoa2026: { title: "Proclamation 11030 (22 May 2026): AGOA extended to 31 December 2026 (govinfo)", url: "https://www.govinfo.gov/content/pkg/FR-2026-05-22/pdf/2026-10398.pdf" },
  agoaEthiopia: { title: "Proclamation 10326 (28 December 2021): Ethiopia's AGOA designation ended (govinfo)", url: "https://www.govinfo.gov/content/pkg/FR-2021-12-28/pdf/2021-28334.pdf" },
  uscMarking: { title: "19 U.S.C. 1304: marking of imported articles, (g) spices (US Code, govinfo)", url: "https://www.govinfo.gov/link/uscode/19/1304?link-type=html" },
} satisfies Record<string, SourceRef>;

// EU acts are linked on EUR-Lex by CELEX number, consolidated where a consolidated text exists.
// EUR-Lex refuses automated requests, so the texts were read from the Publications Office's
// copies of the same CELEX numbers (publications.europa.eu/resource/celex/<number>).
const eurLex = (celex: string) => `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;

/** European Union */
export const EU = {
  eudr: { title: "Regulation (EU) 2023/1115 on deforestation-free products (EUDR), consolidated text of 18 September 2026", url: eurLex("02023R1115-20260918") },
  eudrDates: { title: "Regulation (EU) 2025/2650 amending the EUDR (application dates, downstream operators)", url: eurLex("32025R2650") },
  eudrRisk: { title: "Commission Implementing Regulation (EU) 2025/1093: EUDR country risk classification", url: eurLex("32025R1093") },
  eudrGuidance: { title: "Commission Notice C/2026/3896: guidance document for the EUDR (20 July 2026)", url: eurLex("52026XC03896") },
  eudrReview: {
    title: "European Commission COM(2026) 191: report on the EUDR simplification review (4 May 2026)",
    url: "https://environment.ec.europa.eu/document/download/a3c5c3a0-232e-43c4-b0b8-1eecb1df45c7_en?filename=Report+from+the+Commission+to+the+Council+and+Parliament+on+the+EUDR.pdf",
  },
  eudrPage: {
    title: "European Commission: Regulation on deforestation-free products",
    url: "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en",
  },
  contaminants: { title: "Commission Regulation (EU) 2023/915 on maximum levels for contaminants in food, consolidated text of 19 August 2026", url: eurLex("02023R0915-20260819") },
  acrylamide: { title: "Commission Regulation (EU) 2017/2158 on acrylamide mitigation and benchmark levels", url: eurLex("32017R2158") },
  mrl: { title: "Regulation (EC) No 396/2005 on maximum residue levels of pesticides", url: eurLex("32005R0396") },
  mrlProducts: { title: "Commission Regulation (EU) 2018/62 replacing Annex I to Regulation (EC) No 396/2005 (products covered)", url: eurLex("32018R0062") },
  mrlDatabase: { title: "European Commission: EU Pesticides Database", url: "https://food.ec.europa.eu/plants/pesticides/eu-pesticides-database_en" },
  plantHealth: { title: "Regulation (EU) 2016/2031 on protective measures against plant pests, consolidated text of 6 July 2026", url: eurLex("02016R2031-20260706") },
  plantHealthAnnexes: {
    title: "Commission Implementing Regulation (EU) 2019/2072 (plant health import requirements), consolidated text of 15 October 2026",
    url: eurLex("02019R2072-20261015"),
  },
  officialControls: { title: "Regulation (EU) 2017/625 on official controls, consolidated text of 5 January 2025", url: eurLex("02017R0625-20250105") },
  increasedControls: {
    title: "Commission Implementing Regulation (EU) 2019/1793 (increased official controls on certain food from certain third countries), consolidated text of 30 June 2026",
    url: eurLex("02019R1793-20260630"),
  },
  ucc: { title: "Regulation (EU) No 952/2013 laying down the Union Customs Code, consolidated text of 12 December 2022", url: eurLex("02013R0952-20221212") },
  ucc2026: { title: "Regulation (EU) 2026/2108 (the new Union Customs Code, applying from 21 September 2027)", url: eurLex("32026R2108") },
  uccDelegated: { title: "Commission Delegated Regulation (EU) 2015/2446 (Union Customs Code), consolidated text of 1 July 2026", url: eurLex("02015R2446-20260701") },
  uccImplementing: { title: "Commission Implementing Regulation (EU) 2015/2447 (Union Customs Code), consolidated text of 1 July 2026", url: eurLex("02015R2447-20260701") },
  ics2Dates: { title: "Commission Implementing Decision (EU) 2023/2879 (customs IT systems work programme: ICS2 release dates)", url: eurLex("32023D2879") },
  ics2: { title: "European Commission (DG TAXUD): Import Control System 2 (ICS2)", url: "https://taxation-customs.ec.europa.eu/customs-4/customs-security/import-control-system-2-ics2-0_en" },
  eori: {
    title: "European Commission (DG TAXUD): Economic Operators Registration and Identification number (EORI)",
    url: "https://taxation-customs.ec.europa.eu/customs-4/customs-procedures-import-and-export/customs-procedures/economic-operators-registration-and-identification-number-eori_en",
  },
  cn2026: { title: "Commission Implementing Regulation (EU) 2025/1926: the Combined Nomenclature for 2026", url: eurLex("32025R1926") },
  gsp: { title: "Regulation (EU) No 978/2012 (GSP, including Everything But Arms), consolidated text of 1 January 2025", url: eurLex("02012R0978-20250101") },
  gsp2027: { title: "Regulation (EU) 2026/1395 (the GSP from 1 January 2027)", url: eurLex("32026R1395") },
  rex: {
    title: "European Commission (DG TAXUD): Registered Exporter system (REX)",
    url: "https://taxation-customs.ec.europa.eu/online-services/online-services-and-databases-customs/registered-exporter-rex-system_en",
  },
  foodInformation: { title: "Regulation (EU) No 1169/2011 on food information to consumers, consolidated text of 1 April 2025", url: eurLex("02011R1169-20250401") },
  foodContact: { title: "Regulation (EC) No 1935/2004 on food contact materials, consolidated text of 27 March 2021", url: eurLex("02004R1935-20210327") },
  plastics: { title: "Commission Regulation (EU) No 10/2011 on plastic food contact materials, consolidated text of 14 July 2026", url: eurLex("02011R0010-20260714") },
  packaging: { title: "Regulation (EU) 2025/40 on packaging and packaging waste (PPWR)", url: eurLex("32025R0040") },
  generalFoodLaw: { title: "Regulation (EC) No 178/2002 (general food law), consolidated text of 1 January 2026", url: eurLex("02002R0178-20260101") },
  hygiene: { title: "Regulation (EC) No 852/2004 on the hygiene of foodstuffs, consolidated text of 24 March 2021", url: eurLex("02004R0852-20210324") },
  plantHealthChecks: { title: "Commission Implementing Regulation (EU) 2019/1715 (IMSOC and the CHED), consolidated text of 1 December 2021", url: eurLex("02019R1715-20211201") },
  priorNotification: { title: "Commission Implementing Regulation (EU) 2019/1013 on prior notification of consignments at border control posts", url: eurLex("32019R1013") },
  checkRates: {
    title: "Commission Implementing Regulation (EU) 2022/2389 (plant health check frequencies), consolidated text of 15 June 2026",
    url: eurLex("02022R2389-20260615"),
  },
  checkRates2026: { title: "Commission Implementing Regulation (EU) 2026/1101 replacing Annex I to Regulation (EU) 2022/2389", url: eurLex("32026R1101") },
  marketOrganisation: { title: "Regulation (EU) No 1308/2013 (common market organisation), consolidated text of 18 August 2026", url: eurLex("02013R1308-20260818") },
  marketingStandards: {
    title: "Commission Delegated Regulation (EU) 2023/2429 (marketing standards for fruit and vegetables), consolidated text of 4 October 2025",
    url: eurLex("02023R2429-20251004"),
  },
  conformityChecks: { title: "Commission Implementing Regulation (EU) 2023/2430 (conformity checks of fruit and vegetables)", url: eurLex("32023R2430") },
  conformityPage: {
    title: "European Commission (DG AGRI): conformity checks for fruit and vegetables",
    url: "https://agriculture.ec.europa.eu/farming/crop-productions-and-plant-based-products/fruit-and-vegetables/conformity-checks_en",
  },
  uneceAvocados: { title: "UNECE Standard FFV-42: avocados (2023 edition)", url: "https://unece.org/sites/default/files/2024-03/FFV-42_Avocados_2023_e.pdf" },
  combinedNomenclature: { title: "Council Regulation (EEC) No 2658/87, Annex I (Combined Nomenclature), consolidated text of 1 January 2026", url: eurLex("01987R2658-20260101") },
  taricAvocados: {
    title: "TARIC: measures for 0804 40 00 10 (avocados), origin Ethiopia",
    url: "https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=en&Taric=0804400010&Area=ET",
  },
  mrlConsolidated: { title: "Regulation (EC) No 396/2005 on maximum residue levels of pesticides, consolidated text of 19 August 2026", url: eurLex("02005R0396-20260819") },
  deCoffeeTax: { title: "Germany: Coffee Tax Act (Kaffeesteuergesetz), §§ 1, 2 and 15", url: "https://www.gesetze-im-internet.de/kaffeestg_2009/" },
} satisfies Record<string, SourceRef>;

/** Türkiye. Turkish texts were read in Turkish; titles are given in English with the Turkish name. */
export const TR = {
  plantQuarantine: {
    title: "Plant Quarantine Regulation (Bitki Karantinası Yönetmeliği), Official Gazette 6 May 2026, in force 4 August 2026",
    url: "https://www.resmigazete.gov.tr/eskiler/2026/05/20260506-2.htm",
  },
  plantQuarantineAnnexes: { title: "Plant Quarantine Regulation (2026): annexes", url: "https://www.resmigazete.gov.tr/eskiler/2026/05/20260506-2-1.pdf" },
  importControl: {
    title: "Communiqué on the import control of products under the Ministry of Agriculture and Forestry (Ürün Güvenliği ve Denetimi: 2026/5)",
    url: "https://www.resmigazete.gov.tr/eskiler/2025/12/20251231M4-52.pdf",
  },
  importControlAmendment: {
    title: "Communiqué 2026/34 amending communiqué 2026/5 (whole spices under plant quarantine control from 1 July 2026)",
    url: "https://www.resmigazete.gov.tr/eskiler/2026/04/20260403-11.htm",
  },
  plantFoodImport: {
    title: "Regulation on official controls of imported plant-origin food and feed (Bitkisel Gıda ve Yem İthalatının Resmi Kontrollerine Dair Yönetmelik)",
    url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=15590&MevzuatTur=7&MevzuatTertip=5",
  },
  law5996: {
    title: "Law No. 5996 on Veterinary Services, Plant Health, Food and Feed",
    url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=5996&MevzuatTur=1&MevzuatTertip=5",
  },
  tobImport: {
    title: "Ministry of Agriculture and Forestry: importing plant-origin food and feed",
    url: "https://www.tarimorman.gov.tr/Konular/Gida-Ve-Yem-Hizmetleri/Ithalat-Ihracat/Bitkisel-Kokenli-Gida-Ve-Yemlerin-Ithalati",
  },
  certificateIssuers: {
    title: "Ministry of Agriculture and Forestry: authorities recognised to issue export certificates, by country (14 October 2026)",
    url: "https://www.tarimorman.gov.tr/GKGM/Belgeler/DB_Bitki_Sinir/Ihrac_Sertifikasi_Duzenlemeye_Yetkili_Kuruluslar.xlsx",
  },
  entryPoints: {
    title: "Communiqué on the customs offices authorised for products under the Ministry of Agriculture and Forestry's control",
    url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=18931&MevzuatTur=9&MevzuatTertip=5",
  },
  importRegime: {
    title: "Ministry of Trade: Import Regime Decision No. 3350 (İthalat Rejimi Kararı), consolidated",
    url: "https://ticaret.gov.tr/ithalat/ithalat-mevzuati/ithalat-rejimi-karari-igv-karari-ve-ithalat-tebligleri/1-ithalat-rejimi-kararikarar-sayisi3350karar-metni-ve-tablolar-konsolide-edilmis-olup-gunceldir",
  },
  importRegimeTables: {
    title: "Ministry of Trade: Import Regime Decision tables, consolidated to 27 August 2026",
    url: "https://ticaret.gov.tr/data/68d2951f13b876c2509a480b/rejim%202026%20(27-08-2026).zip",
  },
  additionalDuty: {
    title: "Ministry of Trade: Decision No. 3351 on additional customs duty (İlave Gümrük Vergisi), consolidated",
    url: "https://ticaret.gov.tr/ithalat/ithalat-mevzuati/ithalat-rejimi-karari-igv-karari-ve-ithalat-tebligleri/2-ithalatta-ilave-gumruk-vergisi-uygulanmasina-iliskin-karar-karar-sayisi-3351-karar-metni-ve-tablolar-konsolide-edilmis-olup-gunceldir",
  },
  contaminants: { title: "Turkish Food Codex Contaminants Regulation (Türk Gıda Kodeksi Bulaşanlar Yönetmeliği), 5 November 2023", url: "https://www.resmigazete.gov.tr/eskiler/2023/11/20231105-1.htm" },
  contaminantLimits: { title: "Turkish Food Codex Contaminants Regulation (2023): Annex 1, maximum levels", url: "https://www.resmigazete.gov.tr/eskiler/2023/11/20231105-1-1.pdf" },
  pesticides: { title: "Turkish Food Codex Regulation on pesticide maximum residue limits, 27 September 2021", url: "https://www.resmigazete.gov.tr/eskiler/2021/09/20210927M1-1.htm" },
  pesticides2025: { title: "Amendment of 7 January 2025 to the pesticide residue regulation (new annexes)", url: "https://www.resmigazete.gov.tr/eskiler/2025/01/20250107M1-1.htm" },
  labelling: {
    title: "Turkish Food Codex Regulation on food labelling and consumer information, 26 January 2017",
    url: "https://www.resmigazete.gov.tr/eskiler/2017/01/20170126M1-6.htm",
  },
  labelling2024: { title: "Amendment of 6 April 2024 to the food labelling regulation (compliance by 31 December 2026)", url: "https://www.resmigazete.gov.tr/eskiler/2024/04/20240406-17.htm" },
  surveillance: { title: "Communiqué on surveillance of imports (İthalatta Gözetim Uygulanmasına İlişkin Tebliğ, No. 2022/1)", url: "https://www.resmigazete.gov.tr/eskiler/2021/12/20211224-14.htm" },
  surveillanceAnnexes: { title: "Surveillance communiqué 2022/1: annexes (registered goods; exporter forms)", url: "https://www.resmigazete.gov.tr/eskiler/2021/12/20211224-14-1.pdf" },
  surveillance2026: { title: "Amendment of 9 October 2026 to surveillance communiqué 2022/1", url: "https://www.resmigazete.gov.tr/eskiler/2026/10/20261009-4.htm" },
  customsLaw: { title: "Customs Law No. 4458", url: "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=4458&MevzuatTur=1&MevzuatTertip=5" },
} satisfies Record<string, SourceRef>;

/** The Gulf Cooperation Council and its six states. Arabic texts were read in Arabic. */
export const GCC = {
  quarantineLaw: {
    title: "GCC Secretariat General: Plant Quarantine Law of the GCC states (2003)",
    url: "https://www.gcc-sg.org/en/MediaCenter/DigitalLibrary/Documents/1274263266.pdf",
  },
  ephytoNearEast: {
    title: "IPPC: Near East and North Africa countries step up the digitalization of phytosanitary certification (5 June 2026)",
    url: "https://ippc.int/en/news/near-east-and-north-africa-countries-step-up-efforts-to-expand-digitalization-of-phytosanitary-certifications/",
  },
  customsLaw: {
    title: "GCC Secretariat General: Common Customs Law of the GCC states, rules of implementation and explanatory notes (2003)",
    url: "https://gcc-sg.org/en/MediaCenter/DigitalLibrary/Documents/1274258180.pdf",
  },
  tariff: {
    title: "Qatar General Authority of Customs: GCC Integrated Customs Tariff schedule (2026)",
    url: "https://www.customs.gov.qa/Arabic/Tariff/Documents/جدول%20التعرفة%20الجمركية%20المتكاملة%20لدول%20مجلس%20التعاون%20الخليجي%202026م.pdf",
  },
  firstEntry: {
    title: "Qatar customs: guide to clearance of imported goods, chapter 2 (food at the GCC first point of entry)",
    url: "https://www.customs.gov.qa/English/Procedures/Guide-to-Clearance-of-Imported-Goods/Pages/Chapter2.aspx",
  },
  gsoAvocado: { title: "GSO 2131:2015, Fresh fruits and vegetables: avocado (GSO store)", url: "https://www.gso.org.sa/store/standards/GSO:675787?lang=en" },
  gsoFreshProduce: {
    title: "GSO 123:1990, General requirements for fresh fruits and vegetables (GSO store)",
    url: "https://www.gso.org.sa/store/standards/GSO:480314?lang=en",
  },
  gsoLabelling: { title: "GSO 9:2022, Labeling of prepackaged food stuffs (GSO store)", url: "https://www.gso.org.sa/store/standards/GSO:810825?lang=en" },
  gsoProduceLabelling: {
    title: "GSO 2749:2024, Labelling of prepackaged fruit and vegetables (GSO store)",
    url: "https://dgsm.gso.org.sa/store/standards/GSO:870416?lang=en",
  },
  gsoResidues: {
    title: "GSO 382:2021, Maximum limits of pesticide residues in agricultural and food products (GSO store)",
    url: "https://www.gso.org.sa/store/standards/GSO:781069/?lang=en",
  },

  saLicence: { title: "WTO import licensing: Saudi Arabia, fresh fruit and vegetables (MEWA licence)", url: "https://importlicensing.wto.org/content/fresh-fruit-and-vegetables-0" },
  saPermit: { title: "MEWA Namaa platform: import permit for vegetables and fruits", url: "https://naama.sa/services/details/8323bb8f-c339-48a6-8fb8-4c21c857b2ba" },
  saQuarantine: {
    title: "Saudi Ministry of Environment, Water and Agriculture: General Department of Quarantines",
    url: "https://www.mewa.gov.sa/en/Ministry/Agencies/AgencyLivestock/Departments/Pages/General%20Department%20of%20Quarantines.aspx",
  },
  saFoodClearance: {
    title: "Saudi Food and Drug Authority: conditions and requirements for food clearance (August 2026)",
    url: "https://www.sfda.gov.sa/sites/default/files/2026-08/ConditionsRequirementsFoodClearanceE.pdf",
  },
  saCountries: { title: "Saudi Food and Drug Authority: list of exporting countries and establishments", url: "https://www.sfda.gov.sa/list_countries_excel" },
  saPackaging: {
    title: "Saudi Food and Drug Authority: guidance on packaging requirements for fresh vegetables and fruit (Giud06, Arabic)",
    url: "https://sfda.gov.sa/sites/default/files/2020-01/Giud06.pdf",
  },
  saCustoms: {
    title: "Saudi Zakat, Tax and Customs Authority: documents to attach to the import declaration",
    url: "https://eservices.zatca.gov.sa/sites/sc/en/CustomsGuideNew/CustomsGuideLandPorts/Pages/Page02.aspx",
  },

  aeQuarantine: { title: "UAE Federal Law No. 7 of 2025 on agricultural quarantine (FAOLEX copy)", url: "https://faolex.fao.org/docs/pdf/uae241641E.pdf" },
  aeFoodImport: {
    title: "USDA FAS GAIN TC2025-0008, UAE Food and Agricultural Import Regulations and Standards country report (November 2025), a secondary source",
    url: "https://apps.fas.usda.gov/newgainapi/api/Report/DownloadReportByFileName?fileName=FAIRS+Country+Report+Annual_Dubai_United+Arab+Emirates_TC2025-0008",
  },
  aeAttestation: { title: "UAE Ministry of Foreign Affairs: commercial invoice and certificate of origin attestation (eDAS 2.0)", url: "https://www.mofa.gov.ae/en/services/edas-attestation-v2" },
  aeAttestationRules: { title: "UAE Ministry of Foreign Affairs: frequently asked questions (attestation threshold and fines)", url: "https://www.mofa.gov.ae/en/faqs" },

  qaPhytosanitary: {
    title: "Qatar plant protection organisation: phytosanitary requirements of the State of Qatar (IPPC, 3 April 2025)",
    url: "https://assets.ippc.int/static/media/files/reportingobligation/2025/04/03/Phytosanitary_requirements-QATAR.pdf",
  },
  qaAttachments: {
    title: "Qatar plant protection organisation: attachments to phytosanitary certificates (IPPC, 2017)",
    url: "https://assets.ippc.int/static/media/files/reportingobligation/2017/05/22/Attachments_to_phytosanitary_certificates.pdf",
  },
  qaRestricted: { title: "Qatar General Authority of Customs: restricted goods", url: "https://www.customs.gov.qa/English/Tariff/Pages/Restricted-Goods.aspx" },

  kwQuarantine: { title: "Kuwait Law No. 19 of 2009 issuing the GCC Agricultural Quarantine Law (FAOLEX copy, Arabic)", url: "https://faolex.fao.org/docs/pdf/kuw162600.pdf" },
  kwImportedFood: {
    title: "Kuwait Public Authority for Food and Nutrition: Imported Food Regulation, Ministerial Decision No. 6 of 2023 (Arabic)",
    url: "https://www.pafn.gov.kw/assets/images/Uploads/202351510452.pdf",
  },
  kwArrivalDocuments: {
    title: "Kuwait Public Authority for Food and Nutrition: documents to open a transaction on arrival (Arabic)",
    url: "https://www.pafn.gov.kw/assets/images/Uploads/2023118123035.pdf",
  },
  kwBans: { title: "Kuwait Public Authority for Food and Nutrition: import ban decisions", url: "https://www.pafn.gov.kw/AR/Form?PageID=55" },

  bhQuarantine: { title: "Bahrain Law No. 5 of 2003 approving the GCC Agricultural Quarantine Law (FAOLEX copy)", url: "https://faolex.fao.org/docs/pdf/bah72236.pdf" },
  bhImportDecision: {
    title: "Bahrain Ministerial Decision No. 1 of 2004 on importing agricultural consignments (IPPC copy, Arabic)",
    url: "https://assets.ippc.int/static/media/files/reportingobligation/2018/08/19/1_of_year_2004.pdf",
  },
  bhCustoms: { title: "Bahrain Customs: Agricultural Health Directorate measures for imports", url: "https://www.customs.gov.bh/en/node/648" },
  bhPermit: {
    title: "Bahrain National Portal: import permits for plants and plant products",
    url: "https://www.bahrain.bh/wps/portal/en/BNP/ServicesCatalogue/GSX-UI-PServiceDetails?psID=1560",
  },
  bhFoodGuide: {
    title: "Bahrain Ministry of Health: food importers guide to the Kingdom of Bahrain (2022)",
    url: "https://www.moh.gov.bh/Content/Upload/File/637837207473556239-Food-importers-guide-to-the-kingdom-of-bahrain.pdf",
  },

  omQuarantine: {
    title: "Oman plant protection organisation: plant quarantine law in Oman (IPPC, updated 16 July 2026)",
    url: "https://www.ippc.int/en/countries/oman/reportingobligation/2012/12/plant-quaratine-law-in-oman/",
  },
  omQuarantineRegulation: {
    title: "Oman Ministerial Decision No. 32/2006: Executive Regulation of the Agricultural Quarantine Law (IPPC copy, Arabic)",
    url: "https://assets.ippc.int/static/media/files/reportingobligation/2017/04/11/لائحة_الحجر_الزراعي.pdf",
  },
  omPermit: { title: "Oman Customs: permit to import plant products", url: "https://customs.gov.om/en/business-services/permit/permit-to-import-plant-products" },
  omFoodSafety: { title: "Oman Food Safety Regulation, Ministerial Decision No. 2/2010 (FAOLEX copy)", url: "https://faolex.fao.org/docs/pdf/oma100857E.pdf" },
  omDeclaration: {
    title: "Oman Customs: customs declaration (Bayan)",
    url: "https://customs.gov.om/en/business-services/procedural_services/request-to-apply-a-custom-declaration/",
  },
} satisfies Record<string, SourceRef>;
