import { describe, expect, it } from "vitest";
import { APPLICATION_COHORTS, PILOT_COHORTS, buildCatalogue, catalogueFromApplications, cohortOfProgramme, catalogueFromRegister, deriveRegister, markSharedBusinesses, sameBusiness, type ApplicationRow, type RegisterInput } from "../src";

const register = (over: Partial<RegisterInput> = {}) =>
  deriveRegister({
    code: "TRADE-TST-LEA-002",
    companyName: "Acme Leather Plc",
    participantName: "Abebe Kebede",
    phone: "911000001",
    email: null,
    yearEstablished: 2017,
    location: "AA (Bole)",
    employees: 20,
    exportLicence: true,
    currentBank: "CBE",
    mainProduct: "Bags",
    monthlyProductionCapacity: 2000,
    averageMonthlyRevenue: 1_000_000,
    largestOrderCompleted: null,
    currentMarkets: "Local/Export",
    targetExportMarket: "Africa",
    monthlyOperatingCost: null,
    estimatedMonthlyProfit: null,
    existingLoan: false,
    loanAmount: null,
    cashflowStability: null,
    workingCapitalGap: 100,
    equipmentInvestmentNeeded: null,
    exportLogisticsGap: null,
    costingKnowledge: 4,
    productionCapacityStrength: 5,
    documentationKnowledge: 4,
    financialRecordKeeping: 4,
    marketReadiness: 5,
    entrustSupportNeeded: null,
    bankOpportunity: null,
    serviceNotes: null,
    ...over,
  });

const AGRO = "Agro-Processing SME Training Program (TRADE Program)";
const GROWTH = "TRADE Export Growth Companies Cohort";

const application = (over: Partial<ApplicationRow> = {}): ApplicationRow => ({
  id: "a1",
  program: AGRO,
  submittedAt: "2026-03-27T12:00:00.000Z",
  email: "owner@firm.test",
  businessName: "Acme Foods PLC",
  contactName: "Almaz",
  phone: "+251911105926",
  location: "Addis Ababa",
  answers: { mainProducts: "1. Dried mango\n2. Mango juice", category: "Food processing", employees: "10", bank: "Awash", exportedBefore: "No", zemenInterest: "Yes" },
  ...over,
});

describe("a leather business as a catalogue entry", () => {
  it("is in cohort 1 with its SME ID, readiness and a tidied phone number", () => {
    expect(catalogueFromRegister(register(), "row-1")).toEqual({
      key: "register:TRADE-TST-LEA-002",
      id: "row-1",
      cohort: 1,
      name: "Acme Leather Plc",
      contactName: "Abebe Kebede",
      phone: "+251911000001",
      email: null,
      location: "AA (Bole)",
      product: "Bags",
      employees: "20",
      bank: "CBE",
      reference: "TRADE-TST-LEA-002",
      readinessLevel: "high",
      readinessScore: 22,
      exportedBefore: null,
      wantsZemenFinancing: null,
      alsoInCohorts: [],
    });
  });

  it("leaves readiness out for a business that hasn't been scored", () => {
    const sme = catalogueFromRegister(register({ costingKnowledge: null, employees: null }), "row-1");
    expect(sme).toMatchObject({ readinessLevel: null, readinessScore: null, employees: null });
  });
});

describe("an agro application as a catalogue entry", () => {
  it("is in cohort 2, with the products on one line and the yes and no answers read", () => {
    expect(catalogueFromApplications([application()])).toEqual([
      {
        key: "application:a1",
        id: "a1",
        cohort: 2,
        name: "Acme Foods PLC",
        contactName: "Almaz",
        phone: "+251911105926",
        email: "owner@firm.test",
        location: "Addis Ababa",
        product: "1. Dried mango; 2. Mango juice",
        employees: "10",
        bank: "Awash",
        reference: null,
        readinessLevel: null,
        readinessScore: null,
        exportedBefore: false,
        wantsZemenFinancing: true,
        alsoInCohorts: [],
      },
    ]);
  });

  it("falls back to what it produces, then its category, when no products are listed, and cuts a long list short", () => {
    expect(catalogueFromApplications([application({ answers: { produces: "Honey", category: "Food" } })])[0]!.product).toBe("Honey");
    expect(catalogueFromApplications([application({ answers: { category: "Food" } })])[0]!.product).toBe("Food");
    const long = catalogueFromApplications([application({ answers: { mainProducts: "x".repeat(300) } })])[0]!.product!;
    expect(long).toHaveLength(140);
    expect(long.endsWith("…")).toBe(true);
    expect(catalogueFromApplications([application({ answers: {} })])[0]).toMatchObject({ product: null, exportedBefore: null, wantsZemenFinancing: null });
  });

  it("lists a business once when it applied more than once, from its latest response", () => {
    const smes = catalogueFromApplications([
      application({ id: "old", submittedAt: "2026-03-27T12:00:00.000Z", location: "Addis Ababa" }),
      application({ id: "other", email: "other@firm.test", businessName: "Other Co" }),
      // Same email, different spelling of the name.
      application({ id: "new", submittedAt: "2026-04-08T12:00:00.000Z", businessName: "ACME  Foods plc", location: "Addis Ababa / Dukem" }),
      // Same name, a different email.
      application({ id: "third", submittedAt: "2026-04-09T12:00:00.000Z", email: "second@firm.test", location: "Bole" }),
    ]);
    expect(smes.map((s) => [s.key, s.location])).toEqual([["application:third", "Bole"], ["application:other", "Addis Ababa"]]);
  });
});

describe("the same business in two cohorts", () => {
  it("is found by its phone number, however it was written, or its email address", () => {
    const leather = catalogueFromRegister(register({ phone: "913362262", companyName: "TTGI leather plc" }), "row");
    const agro = catalogueFromApplications([application({ phone: "+251913362262", businessName: "TTG Leather & Shema" })])[0]!;
    const byEmail = { ...catalogueFromApplications([application({ id: "z", phone: null, email: "same@firm.test", businessName: "Z Foods" })])[0]! };
    const leatherByEmail = { ...catalogueFromRegister(register({ code: "TRADE-TST-LEA-003", phone: null, email: "SAME@firm.test" }), "row") };
    const unrelated = catalogueFromRegister(register({ code: "TRADE-TST-LEA-004", phone: "911999999", companyName: "Unrelated" }), "row");
    const marked = markSharedBusinesses([leather, agro, byEmail, leatherByEmail, unrelated]);
    expect(marked.map((s) => [s.name, s.alsoInCohorts])).toEqual([
      ["TTGI leather plc", [2]],
      ["TTG Leather & Shema", [1]],
      ["Z Foods", [1]],
      ["Acme Leather Plc", [2]],
      ["Unrelated", []],
    ]);
  });

  it("doesn't count two businesses in the same cohort that share a number", () => {
    const a = catalogueFromRegister(register(), "row");
    const b = catalogueFromRegister(register({ code: "TRADE-TST-LEA-009", companyName: "Twin Plc" }), "row");
    expect(markSharedBusinesses([a, b]).map((s) => s.alsoInCohorts)).toEqual([[], []]);
  });
});

describe("the catalogue", () => {
  it("has the three cohorts, with their businesses by name", () => {
    const catalogue = buildCatalogue([
      catalogueFromRegister(register({ code: "TRADE-TST-LEA-003", companyName: "zeta Leather", phone: null }), "row"),
      catalogueFromRegister(register({ companyName: "Alpha Leather", phone: null }), "row"),
      ...catalogueFromApplications([application({ businessName: "Mango Co", email: "m@firm.test", phone: null })]),
    ]);
    expect(catalogue.map((c) => [c.number, c.name, c.count])).toEqual([[1, "Leather", 2], [2, "Agro-processing", 1], [3, "Export growth companies", 0]]);
    expect(catalogue[0]!.smes.map((s) => s.name)).toEqual(["Alpha Leather", "zeta Leather"]);
  });

  it("keeps every cohort when it is empty", () => {
    expect(buildCatalogue([]).map((c) => [c.number, c.count])).toEqual([[1, 0], [2, 0], [3, 0]]);
  });

  it("says the first two pilot cohorts are previous and the Export Growth Companies cohort is active", () => {
    expect(buildCatalogue([]).map((c) => [c.number, c.status])).toEqual([[1, "previous"], [2, "previous"], [3, "active"]]);
    expect(PILOT_COHORTS.map((c) => c.status)).toEqual(["previous", "previous", "active"]);
  });

  it("has a cohort for every programme pattern", () => {
    expect(APPLICATION_COHORTS.every((c) => PILOT_COHORTS.some((p) => p.number === c.number))).toBe(true);
  });
});

describe("which cohort a programme's applications are in", () => {
  it("is found by words in the programme's name, however the file was named", () => {
    expect(cohortOfProgramme("TRADE Export Growth Companies Cohort")).toBe(3);
    expect(cohortOfProgramme("trade export  growth companies cohort (responses)")).toBe(3);
    expect(cohortOfProgramme("Export-Growth Companies")).toBe(3);
    expect(cohortOfProgramme("Agro-Processing SME Training Program (TRADE Program) Powered by Entrust in partnership with Zemen Bank")).toBe(2);
  });

  it("puts a programme in none when its name says no cohort, and the most specific name first", () => {
    expect(cohortOfProgramme("Coffee Programme")).toBeNull();
    expect(cohortOfProgramme("")).toBeNull();
    expect(cohortOfProgramme("Agro Export Growth Companies")).toBe(3);
  });
});

describe("an Export Growth Companies application as a catalogue entry", () => {
  it("is in cohort 3, with the exporting stage read as whether it has exported", () => {
    const [sme] = catalogueFromApplications([
      application({ program: GROWTH, answers: { mainProducts: "Turmeric, ginger", employees: "11-25", exportStage: "Exported previously", category: "Agro-Processing" } }),
    ]);
    expect(sme).toMatchObject({ cohort: 3, name: "Acme Foods PLC", product: "Turmeric, ginger", employees: "11-25", bank: null, exportedBefore: true, wantsZemenFinancing: null });
  });

  it("keeps the cohorts apart: a business that applied to both programmes has an entry in each, and is marked", () => {
    const smes = catalogueFromApplications([
      application({ id: "agro", submittedAt: "2026-03-27T12:00:00.000Z" }),
      application({ id: "growth", program: GROWTH, submittedAt: "2026-07-16T12:00:00.000Z" }),
    ]);
    expect(smes.map((s) => [s.cohort, s.key]).sort()).toEqual([[2, "application:agro"], [3, "application:growth"]]);
    expect(markSharedBusinesses(smes).map((s) => [s.cohort, s.alsoInCohorts]).sort()).toEqual([[2, [3]], [3, [2]]]);
  });

  it("lists a business once within the cohort when it applied twice, from its latest response", () => {
    const smes = catalogueFromApplications([
      application({ id: "first", program: GROWTH, submittedAt: "2026-07-15T12:00:00.000Z", location: "Addis Ababa" }),
      application({ id: "second", program: GROWTH, submittedAt: "2026-07-16T12:00:00.000Z", location: "Bole, Addis Ababa" }),
    ]);
    expect(smes.map((s) => [s.key, s.location])).toEqual([["application:second", "Bole, Addis Ababa"]]);
  });

  it("leaves out applications to a programme that is in no cohort", () => {
    expect(catalogueFromApplications([application({ program: "Coffee Programme" })])).toEqual([]);
  });
});

describe("recognising one business in two records", () => {
  it("matches on the last nine digits of a phone number, however written, or on an email address in any case", () => {
    expect(sameBusiness({ phone: "0913362262", email: null }, { phone: "+251 913 362 262", email: null })).toBe(true);
    expect(sameBusiness({ phone: null, email: "A@Firm.test" }, { phone: null, email: "a@firm.test" })).toBe(true);
    expect(sameBusiness({ phone: "911000001", email: "a@firm.test" }, { phone: "911999999", email: "b@firm.test" })).toBe(false);
  });

  it("doesn't match on nothing, or on a number too short to be one", () => {
    expect(sameBusiness({ phone: null, email: null }, { phone: null, email: null })).toBe(false);
    expect(sameBusiness({ phone: "12345", email: null }, { phone: "12345", email: null })).toBe(false);
  });
});
