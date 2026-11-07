import { describe, expect, it } from "vitest";
import { applicationCountry, hasExported, isApplicationResponses, isYes, readApplications, sameApplicant, tidyPhone, timesApplied, type Cell } from "../src";

const country = (location: string | null, phone: string | null = null, email: string | null = null) => applicationCountry({ location, email, phone });

describe("which country a response is from", () => {
  it("reads Ethiopian places however they were spelled", () => {
    for (const place of ["Addis Ababa", "ADDIS ABABA", "Addis Abeba", "Adiss ababa", "Addis Ababa / Dukem", "Addis Ababa , Ethiopia", "Bahir Dar City / Amhara Region", "Bonga, South-west Ethiopia", "South west Ethioipia", "Hawassa"]) {
      expect([place, country(place)]).toEqual([place, "ET"]);
    }
  });

  it("reads places in other countries, and doesn't take Harare for Harar", () => {
    expect(
      ["Dar es salaam", "Dar Es Salaam", "Minna/North Central", "Ogun", "Accra", "Nairobi", "Kenya", "Lahore", "Sierra Leone West Africa", "harare", "Lilongwe, Malawi"].map((p) => country(p)),
    ).toEqual(["TZ", "TZ", "NG", "NG", "GH", "KE", "KE", "PK", "SL", "ZW", "MW"]);
  });

  it("doesn't guess when a place names two countries", () => {
    expect(country("Addis Ababa / Nairobi")).toBeNull();
  });

  it("lets the place beat the phone number and the email address", () => {
    expect(country("Nairobi", "+251911105926", "a@firm.com.et")).toBe("KE");
    expect(country("Addis Ababa", "+255762489028", "a@firm.co.tz")).toBe("ET");
  });

  it("falls back to the email address, then the phone number, when the place says nothing", () => {
    expect(country("Somewhere nice", null, "a@firm.com.et")).toBe("ET");
    expect(country(null, "+255762489028", "a@firm.co.tz")).toBe("TZ");
    expect(country(null, "+251911105926", "a@gmail.com")).toBe("ET");
    expect(country(null, "00263777747936")).toBe("ZW");
    expect(country(null, "±254710393986")).toBe("KE");
    expect(country(null, "251911105926")).toBe("ET");
    expect(country("a place nobody knows", "0911246192")).toBe("ET");
    expect(country(null, "930100185")).toBe("ET");
  });

  it("leaves a response it can't place as null, so it is never shown", () => {
    expect(country(null)).toBeNull();
    expect(country("Nowhere")).toBeNull();
    // 07 is Kenya's and Ethiopia's; 05 is Ghana's: neither says where the business is.
    expect(country(null, "0716117879", "a@gmail.com")).toBeNull();
    expect(country(null, "0594400090", "a@gmail.com")).toBeNull();
    expect(country(null, "+7034620837")).toBeNull();
  });
});

describe("tidying a phone number", () => {
  it("writes an Ethiopian number the same way whichever way it was typed", () => {
    for (const typed of ["+251911105926", "251911105926", "0911105926", "911105926", "+251 911 105 926", "09-11-10-59-26", "(0911) 105926"]) {
      expect([typed, tidyPhone(typed, "ET")]).toEqual([typed, "+251911105926"]);
    }
  });

  it("leaves a number it doesn't know how to write as typed, less the spaces and dashes", () => {
    expect(tidyPhone("+255 762-489-028", "TZ")).toBe("+255762489028");
    expect(tidyPhone("±254 710 393 986", "KE")).toBe("+254710393986");
    expect(tidyPhone("+25920600006", "ET")).toBe("+25920600006");
    expect(tidyPhone("n/a", "ET")).toBeNull();
    expect(tidyPhone(null, "ET")).toBeNull();
  });
});

// Headings as Google Forms exports them, with its stray line breaks, and two email columns.
const HEADINGS: Cell[] = [
  "Timestamp", "Email Address", "Business Name ", "Contact Person (Full Name)", "\nPhone Number (WhatsApp preferred) \n\n", "\nCity / Region \n\n",
  "\nWhat does your business produce? (Short answer) \n\n", "Which category best describes your business? (Multiple choice)",
  "Number of Employees", "Have you exported before", "Which bank do you use?",
  "Are you inerested in financing opportunities through Zemen bank?", "Any additional information you would like to share?",
  "Year Business Was Established\n", "\nEmail Address \n\n", "Column 32",
];
const SERIAL = 46108.5; // 27 March 2026, noon

const response = (over: Record<number, Cell> = {}): Cell[] => {
  const row: Cell[] = [SERIAL, "owner@firm.test", "Acme Foods PLC", "Abebe Kebede", "+251911105926", "Addis Ababa", "Dried fruit", "Food processing", 10, "No", "Awash", "Yes", "1. first\n2. second", 2019, "owner@firm.test", null];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
};
const sheets = (...rows: Cell[][]) => ({ "Form Responses 1": [HEADINGS, ...rows], Sheet1: [] });

describe("reading the form's responses", () => {
  it("reads a response, and keeps each answer as it was typed", () => {
    const { applications, warnings } = readApplications(sheets(response()));
    expect(warnings).toEqual([]);
    expect(applications).toEqual([
      {
        submittedAt: "2026-03-27T12:00:00.000Z",
        email: "owner@firm.test",
        businessName: "Acme Foods PLC",
        contactName: "Abebe Kebede",
        phone: "+251911105926",
        location: "Addis Ababa",
        country: "ET",
        answers: {
          produces: "Dried fruit",
          category: "Food processing",
          employees: "10",
          exportedBefore: "No",
          bank: "Awash",
          zemenInterest: "Yes",
          additional: "1. first\n2. second",
          yearEstablished: "2019",
        },
      },
    ]);
  });

  it("takes the email from the second email column when the first is empty, and lower-cases it", () => {
    const { applications } = readApplications(sheets(response({ 1: null, 14: "  Owner@Firm.TEST " })));
    expect(applications[0]!.email).toBe("owner@firm.test");
  });

  it("keeps a response from abroad without a word about it in the warnings", () => {
    const { applications, warnings } = readApplications(
      sheets(response({ 2: "Lagos Ventures", 4: "070-bad", 5: "Lagos", 1: "not an email", 14: null }), response({ 2: "Ethiopian Firm", 1: "not an email", 14: null, 4: "+7034620837" })),
    );
    expect(applications.map((a) => [a.businessName, a.country])).toEqual([["Lagos Ventures", "NG"], ["Ethiopian Firm", "ET"]]);
    // Only the Ethiopian business is named, whatever is wrong with its details.
    expect(warnings).toEqual([`Ethiopian Firm: "not an email" isn't an email address.`, `Ethiopian Firm: the phone number "+7034620837" doesn't look like an Ethiopian one.`]);
    expect(warnings.join(" ")).not.toMatch(/Lagos/);
  });

  it("skips a response with no time, email or name, naming the business only when it is Ethiopian", () => {
    const rows = [response({ 0: null, 2: "Local Firm" }), response({ 1: null, 14: null }), response({ 0: null, 2: "Lagos Ventures", 5: "Lagos" }), response()];
    const { applications, warnings } = readApplications(sheets(...rows));
    expect(applications.map((a) => a.businessName)).toEqual(["Acme Foods PLC"]);
    expect(warnings).toEqual([
      "Row 2 (Local Firm) has no time sent, so it was skipped.",
      "Row 3 (Acme Foods PLC) has no email address, so it was skipped.",
      "Row 4 has no time sent, so it was skipped.",
    ]);
  });

  it("ignores empty rows and columns", () => {
    const { applications } = readApplications(sheets([], [null, null, null], response()));
    expect(applications).toHaveLength(1);
  });

  it("reads a time typed as text", () => {
    const { applications } = readApplications(sheets(response({ 0: "2026-03-27 12:00:00" })));
    expect(applications[0]!.submittedAt).toBe("2026-03-27T12:00:00.000Z");
  });

  it("refuses a sheet that isn't a form's responses, in words that say why", () => {
    expect(() => readApplications({ Sheet1: [["a", "b"]] })).toThrow(/no sheet has "Timestamp" and "Business Name" \(or "Company Name"\) headings/);
    expect(() => readApplications({ "Form Responses 1": [HEADINGS] })).toThrow(/no responses/);
  });
});

describe("counting", () => {
  it("counts how many times a business applied, by its email or its name", () => {
    expect(
      timesApplied([
        { email: "a@x.test", businessName: "Maheder Foods" },
        { email: "b@x.test", businessName: "Other Co" },
        { email: "a@x.test", businessName: "Maheder Foods" },
        { email: "c@x.test", businessName: "  maheder   FOODS " },
      ]),
    ).toEqual([3, 1, 3, 3]);
  });

  it("knows two responses are from one business by email or by name, but not otherwise", () => {
    expect(sameApplicant({ email: "a@x.test", businessName: "One" }, { email: "a@x.test", businessName: "Two" })).toBe(true);
    expect(sameApplicant({ email: "a@x.test", businessName: "Maheder Foods" }, { email: "b@x.test", businessName: " maheder  FOODS" })).toBe(true);
    expect(sameApplicant({ email: "a@x.test", businessName: "One" }, { email: "b@x.test", businessName: "Two" })).toBe(false);
  });

  it("tells a yes from other answers", () => {
    expect(["Yes", "yes", " Yes, please", "Y"].map(isYes)).toEqual([true, true, true, true]);
    expect(["No", "Not yet", "Maybe", undefined, ""].map(isYes)).toEqual([false, false, false, false, false]);
  });
});

describe("telling a form's responses from other files", () => {
  it("knows them by the Timestamp and Business Name headings, whatever the sheet is called", () => {
    expect(isApplicationResponses(sheets(response()))).toBe(true);
    expect(isApplicationResponses({ Responses: [HEADINGS] })).toBe(true);
    expect(isApplicationResponses({ "Master SME Database": [["SME ID", "Company Name"]] })).toBe(false);
    expect(isApplicationResponses({})).toBe(false);
  });
});

// The Export Growth Companies cohort's form: "Company Name" for the business, an address and a region apart, "Mobile Number",
// and questions worded their own way (some with the form's typos). The businesses here are invented.
const GROWTH_HEADINGS: Cell[] = [
  "Timestamp", "Email Address", "Company Name ", "Contact Person", "Position", "Mobile Number", "Email Address 2", "Company Address", "Region", "Website",
  "Social Media", "Business Profile", "Year Established", "Business Registration Number", "TIN", "Number of Employees", "What products and services do you offer?",
  "Wat are are your top 3 products?", "Current production capacity?", "Main customers?", "Which best describes your company?",
  "Which countries do you currently export to?", "Which countries are you targeting?", "Average annual export sales ", "Approximate annual turnover",
  "Do you have audited financial statements?", "Do you currently work with a bank?", "He you ever received business financing?",
  "Business needs-select your top priorities", "Is your business", "Can the owner or CEO attend all training sessions?", "Documents upload", "Final Declaration",
];

const growth = (over: Record<number, Cell> = {}): Cell[] => {
  const row: Cell[] = [
    SERIAL, "owner@firm.test", "Acme Spices PLC", "Abebe Kebede", "Manager", "0911105926", "abebe@firm.test", "Arada sub city, Wo 1", "Addis Ababa", "www.acme.test",
    "Facebook", "Agro-Processing, Honey & Spices", 2021, "AA/1/0001/2013", "0012345678", "11-25", "Spices and honey", "Turmeric, cardamom, honey", "100kg/day", "Local",
    "Preparing to export", "None", "Europe", null, "Under ETB 5 million", "Yes", "Yes", "No", "Export Readiness, Market Access", "Women-owned", "Yes", "Business License",
    "I confirm that the information provided is accurate",
  ];
  for (const [i, v] of Object.entries(over)) row[Number(i)] = v;
  return row;
};
const growthSheets = (...rows: Cell[][]) => ({ "Form Responses 1": [GROWTH_HEADINGS, ...rows] });

describe("reading the Export Growth Companies form", () => {
  it("is known as a form's responses by its Company Name heading, and a diagnostic workbook still isn't one", () => {
    expect(isApplicationResponses(growthSheets(growth()))).toBe(true);
    expect(isApplicationResponses({ Responses: [["Timestamp", "Company Name"]] })).toBe(true);
    expect(isApplicationResponses({ "Master SME Database": [["SME ID", "Company Name"]] })).toBe(false);
  });

  it("reads the business, the contact and where it is", () => {
    const { applications, warnings } = readApplications(growthSheets(growth()));
    expect(warnings).toEqual([]);
    expect(applications).toHaveLength(1);
    expect(applications[0]).toMatchObject({
      submittedAt: "2026-03-27T12:00:00.000Z",
      email: "owner@firm.test",
      businessName: "Acme Spices PLC",
      contactName: "Abebe Kebede",
      phone: "+251911105926",
      location: "Arada sub city, Wo 1, Addis Ababa",
      country: "ET",
    });
  });

  it("keeps every answer under the question it is, whichever way the form words it", () => {
    const { answers } = readApplications(growthSheets(growth())).applications[0]!;
    expect(answers).toEqual({
      position: "Manager",
      contactEmail: "abebe@firm.test",
      website: "www.acme.test",
      socialMedia: "Facebook",
      registrationNumber: "AA/1/0001/2013",
      tin: "0012345678",
      produces: "Spices and honey",
      category: "Agro-Processing, Honey & Spices",
      mainProducts: "Turmeric, cardamom, honey",
      capacity: "100kg/day",
      customers: "Local",
      employees: "11-25",
      yearEstablished: "2021",
      ownership: "Women-owned",
      turnover: "Under ETB 5 million",
      exportStage: "Preparing to export",
      exportingTo: "None",
      exportMarkets: "Europe",
      supportNeeded: "Export Readiness, Market Access",
      hasBankAccount: "Yes",
      hadLoan: "No",
      auditedStatements: "Yes",
      availability: "Yes",
      documentsUploaded: "Business License",
      declaration: "I confirm that the information provided is accurate",
    });
  });

  it("joins the address and region, leaving out a region the address already names and one that is only a number", () => {
    const place = (address: Cell, region: Cell) => readApplications(growthSheets(growth({ 7: address, 8: region }))).applications[0]!.location;
    expect(place("Addis Ababa, Ethiopia", "Addis Ababa")).toBe("Addis Ababa, Ethiopia");
    expect(place("Bole, Addis Ababa", "addis ababa ")).toBe("Bole, Addis Ababa");
    expect(place("Kirkos", 14)).toBe("Kirkos");
    expect(place(null, "Amhara")).toBe("Amhara");
    expect(place("Debre Birhan", "Amhara")).toBe("Debre Birhan, Amhara");
  });

  it("works out the country from the address and region together, then the phone number", () => {
    const country = (address: Cell, region: Cell, phone: Cell) => readApplications(growthSheets(growth({ 7: address, 8: region, 5: phone }))).applications[0]!.country;
    expect(country("Kirkos subcity", "Addis Ababa", "0911105926")).toBe("ET");
    expect(country("Behind Bole building 2nd floor addisababa Ethiopia", "Woreda 03", "0911105926")).toBe("ET");
    // Says nothing about where it is, so the phone number does, even typed as a bare number.
    expect(country("Nefas Silk", "Addisabeba", 944173254)).toBe("ET");
    expect(country("Lagos", "Lagos", "07063479837")).toBe("NG");
  });

  it("tidies Ethiopian phone numbers however the cell holds them, and warns about one that has a digit too many", () => {
    const phone = (typed: Cell) => readApplications(growthSheets(growth({ 5: typed }))).applications[0]!.phone;
    expect(["0911105926", "+251911105926", 251911105926, "+251-911105926 "].map(phone)).toEqual(Array(4).fill("+251911105926"));
    const { warnings } = readApplications(growthSheets(growth({ 5: "+2519666933709" })));
    expect(warnings).toEqual([expect.stringContaining('the phone number "+2519666933709" doesn\'t look like an Ethiopian one')]);
  });

  it("keeps the second email address only when it is a different one", () => {
    expect(readApplications(growthSheets(growth({ 6: "owner@firm.test" }))).applications[0]!.answers.contactEmail).toBeUndefined();
    expect(readApplications(growthSheets(growth({ 6: "OTHER@firm.test" }))).applications[0]!.answers.contactEmail).toBe("other@firm.test");
    expect(readApplications(growthSheets(growth({ 6: "not an email" }))).applications[0]!.answers.contactEmail).toBeUndefined();
  });

  it("keeps a repeat submission as its own response, and counts the business as having applied twice", () => {
    const { applications } = readApplications(growthSheets(growth(), growth({ 0: SERIAL + 1, 17: "Honey only" })));
    expect(applications).toHaveLength(2);
    expect(timesApplied(applications)).toEqual([2, 2]);
  });
});

describe("whether a response has exported", () => {
  it("reads the yes or no answer when the form asks it", () => {
    expect(hasExported({ exportedBefore: "Yes" })).toBe(true);
    expect(hasExported({ exportedBefore: "No" })).toBe(false);
    expect(hasExported({ exportedBefore: "Maybe" })).toBeNull();
  });

  it("reads where the business is with exporting when the form asks that instead", () => {
    expect(["Exported previously", "Currently exporting"].map((exportStage) => hasExported({ exportStage }))).toEqual([true, true]);
    expect(["Preparing to export", "Not yet exporting"].map((exportStage) => hasExported({ exportStage }))).toEqual([false, false]);
    expect(hasExported({ exportStage: "Something else" })).toBeNull();
  });

  it("says nothing when neither is answered, and prefers the direct answer", () => {
    expect(hasExported({})).toBeNull();
    expect(hasExported({ exportedBefore: "No", exportStage: "Currently exporting" })).toBe(false);
  });
});
