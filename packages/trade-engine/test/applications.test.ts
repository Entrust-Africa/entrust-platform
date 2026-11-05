import { describe, expect, it } from "vitest";
import { applicationCountry, isYes, readApplications, tidyPhone, timesApplied, type Cell } from "../src";

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
    expect(() => readApplications({ Sheet1: [["a", "b"]] })).toThrow(/no sheet has "Timestamp" and "Business Name" headings/);
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

  it("tells a yes from other answers", () => {
    expect(["Yes", "yes", " Yes, please", "Y"].map(isYes)).toEqual([true, true, true, true]);
    expect(["No", "Not yet", "Maybe", undefined, ""].map(isYes)).toEqual([false, false, false, false, false]);
  });
});
