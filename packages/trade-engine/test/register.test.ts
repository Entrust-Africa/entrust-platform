import { describe, expect, it } from "vitest";
import {
  bankNames,
  deriveRegister,
  financePriority,
  readRegister,
  readinessLevel,
  summariseRegister,
  type Cell,
  type RegisterInput,
} from "../src";

// Rows laid out like the diagnostic workbook: a title row, the headings (with the year column unnamed), then one business a row.
// The businesses are invented.
const HEADINGS: Cell[] = [
  "SME ID", "Company Name", "Participant Name ", "Phone", null, "Location", "Employees", "Export Lincese", "Current Bank",
  "Main Product Category", "Monthly production Capacity", "Average monthly revenue", "Largest order completed",
  "Current markets(local/export)", "Target export market", "Monthly Operating Cost", "Estimated monthly Profit",
  "Existing loan (Yes/No)", "Loan Amount", "Cashflow Stability (stable/moderate/unstable)", "Working Capital Gap",
  "Equipment Investment Needed", "Export Logistics Gap", "Total capital Gap", "Costing Knowledge (1-5)",
  "Production Capacity Strength (1-5)", "Documentation Knowledge (1-5)", "Financial Record keeping (1-5)",
  "Market Readiness (1-5)", "Export Readiness Score", "Finance readiness level",
  "Entrust Support Needed(export strategy/costing/Finance structuring / documentation/digital systems/buyer intro",
  "Zemen opportunity type (working capital/equipment loan/trade finance/FX services)",
];

const business = (over: Record<number, Cell> = {}): Cell[] => {
  const row: Cell[] = [
    "TRADE-TST-LEA-002", "Acme Leather Plc", "Abebe Kebede", 911000001, 2017, "AA (Bole)", 20, "Yes", "CBE", "Bags", 2000,
    1_000_000, 14_725_000, "Local/Export", "Africa", 300_000, 600_000, "Yes", 15_000_000, "Moderate", 20_000_000, 5_000_000,
    500_000, 25_500_000, 4, 5, 4, 4, 5, 22, "High", "Buyer Intro", "Working capital",
  ];
  for (const [index, value] of Object.entries(over)) row[Number(index)] = value;
  return row;
};

const at = (name: string) => HEADINGS.findIndex((h) => typeof h === "string" && h.toLowerCase().startsWith(name.toLowerCase()));

const workbook = (rows: Cell[][], extra: Record<string, Cell[][]> = {}) => ({
  "Master SME Database": [["TRADE Program – SME Export Readiness Diagnostic Database"], HEADINGS, ...rows],
  ...extra,
});

describe("reading the workbook", () => {
  it("reads a business, with the year from the column that has no heading", () => {
    const { records, warnings } = readRegister(workbook([business()]));
    expect(warnings).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      code: "TRADE-TST-LEA-002",
      companyName: "Acme Leather Plc",
      participantName: "Abebe Kebede",
      phone: "911000001",
      yearEstablished: 2017,
      location: "AA (Bole)",
      employees: 20,
      exportLicence: true,
      currentBank: "CBE",
      mainProduct: "Bags",
      monthlyProductionCapacity: 2000,
      averageMonthlyRevenue: 1_000_000,
      largestOrderCompleted: 14_725_000,
      existingLoan: true,
      loanAmount: 15_000_000,
      cashflowStability: "Moderate",
      workingCapitalGap: 20_000_000,
      equipmentInvestmentNeeded: 5_000_000,
      exportLogisticsGap: 500_000,
      costingKnowledge: 4,
      productionCapacityStrength: 5,
      documentationKnowledge: 4,
      financialRecordKeeping: 4,
      marketReadiness: 5,
      entrustSupportNeeded: "Buyer Intro",
      bankOpportunity: "Working capital",
      email: null,
      serviceNotes: null,
    });
  });

  it("finds the headings wherever the title rows end, and the sheet whatever its capitals", () => {
    const sheets = { "master sme database": [[], [], ["Title"], HEADINGS, business()] };
    expect(readRegister(sheets).records.map((r) => r.code)).toEqual(["TRADE-TST-LEA-002"]);
  });

  it("reads numbers typed as text, with commas or exponents, and answers typed in any case", () => {
    const { records, warnings } = readRegister(
      workbook([business({ [at("Average monthly revenue")]: "1,200,000", [at("Largest order")]: "2.25E7", [at("Export Lincese")]: "YES", [at("Existing loan")]: "no" })]),
    );
    expect(warnings).toEqual([]);
    expect(records[0]).toMatchObject({ averageMonthlyRevenue: 1_200_000, largestOrderCompleted: 22_500_000, exportLicence: true, existingLoan: false });
  });

  it("leaves out what it can't read and says which business and what", () => {
    const { records, warnings } = readRegister(
      workbook([
        business({
          [at("Export Lincese")]: "Export",
          [at("Employees")]: "many",
          [at("Average monthly revenue")]: "lots",
          [at("Costing Knowledge")]: 9,
          [4]: 1850,
        }),
      ]),
    );
    expect(records[0]).toMatchObject({ exportLicence: null, employees: null, averageMonthlyRevenue: null, costingKnowledge: null, yearEstablished: null });
    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`TRADE-TST-LEA-002: "Export" isn't a valid answer for the export licence`),
        expect.stringContaining(`"many" isn't a valid number of employees`),
        expect.stringContaining(`"lots" isn't a valid amount`),
        expect.stringContaining(`"9" isn't a valid score (1 to 5)`),
        expect.stringContaining(`"1850" isn't a valid year`),
      ]),
    );
  });

  it("treats a 0 in a text column as nothing", () => {
    const { records } = readRegister(workbook([business({ [at("Cashflow")]: 0, [at("Current Bank")]: "0" })]));
    expect(records[0]).toMatchObject({ cashflowStability: null, currentBank: "0" });
  });

  it("treats a 0 or a blank score as not assessed, without a warning", () => {
    const { records, warnings } = readRegister(
      workbook([business({ [at("Costing Knowledge")]: 0, [at("Production Capacity Strength")]: null, [at("Documentation")]: 0, [at("Financial")]: 0, [at("Market")]: 0, [at("Export Readiness")]: 0 })]),
    );
    expect(warnings).toEqual([]);
    expect(deriveRegister(records[0]!).exportReadinessScore).toBeNull();
  });

  it("keeps a business with hardly anything filled in", () => {
    const sparse: Cell[] = ["TRADE-TST-LEA-018", "Sparse Leather", "Almaz", 911000002, 2017];
    const { records, warnings } = readRegister(workbook([sparse]));
    expect(warnings).toEqual([]);
    expect(records[0]).toMatchObject({ code: "TRADE-TST-LEA-018", participantName: "Almaz", yearEstablished: 2017, employees: null, workingCapitalGap: null });
  });

  it("skips empty rows and rows it can't identify, and keeps the first of a repeated code", () => {
    const { records, warnings } = readRegister(
      workbook([
        business(),
        [],
        [null, null, null],
        business({ 0: null, 1: "No Code Ltd" }),
        business({ 0: "not a code!" }),
        business({ 1: "Same Code Again" }),
        business({ 0: "TRADE-TST-LEA-003", 1: null }),
        business({ 0: " trade-tst-lea-004 ", 1: "Tidy Code Plc" }),
      ]),
    );
    expect(records.map((r) => r.code)).toEqual(["TRADE-TST-LEA-002", "TRADE-TST-LEA-004"]);
    expect(records[0]!.companyName).toBe("Acme Leather Plc");
    expect(warnings).toEqual([
      "Row 6 (No Code Ltd) has no SME ID, so it was skipped.",
      `Row 7 has "NOTACODE!" as its SME ID, which isn't one, so it was skipped.`,
      "TRADE-TST-LEA-002 appears on more than one row; the later row (Row 8) was skipped.",
      "TRADE-TST-LEA-003 has no company name, so it was skipped.",
    ]);
  });

  it("says where the workbook's own totals disagree with their parts, and uses the parts", () => {
    const { records, warnings } = readRegister(
      workbook([
        business({
          [at("Working Capital Gap")]: 1_000_000,
          [at("Equipment")]: 500_000,
          [at("Export Logistics")]: 250_000,
          [at("Total capital")]: 2_500_000,
          [at("Costing Knowledge")]: 4,
          [at("Production Capacity Strength")]: 5,
          [at("Documentation")]: 3,
          [at("Financial")]: 3,
          [at("Market")]: 3,
          [at("Export Readiness")]: 4,
        }),
      ]),
    );
    expect(deriveRegister(records[0]!)).toMatchObject({ totalCapitalGap: 1_750_000, exportReadinessScore: 18, financeReadinessLevel: "medium" });
    expect(warnings).toEqual([
      "TRADE-TST-LEA-002: the workbook's total capital gap is 2,500,000, but its three gaps add up to 1,750,000. The register uses 1,750,000.",
      "TRADE-TST-LEA-002: the workbook's export readiness score is 4, but its five scores add up to 18. The register uses 18.",
    ]);
  });

  it("is quiet when the totals agree", () => {
    expect(readRegister(workbook([business()])).warnings).toEqual([]);
  });

  it("adds an email and notes from the service sheet by company name, since its codes are numbered from its own rows", () => {
    const service = [
      ["SME ID", "Company Name", "Participant Name", "Phone", "Email", "Service Area", "Service Description"],
      ["TRADE-TST-LEA-001", "  acme   LEATHER plc ", "Abebe Kebede", 911000001, "Abebe@Example.test", "Buyer Intro", "Intro to two buyers"],
      ["TRADE-TST-LEA-099", "Someone Not In The Register", null, null, "x@example.test", null, null],
    ];
    const { records, warnings } = readRegister(workbook([business()], { "Entrust Service Pipeline": service }));
    expect(warnings).toEqual([]);
    expect(records[0]).toMatchObject({ email: "abebe@example.test", serviceNotes: "Intro to two buyers" });
  });

  it("warns about an email address that isn't one", () => {
    const service = [["SME ID", "Company Name", "Email"], ["X", "Acme Leather Plc", "call him"]];
    const { records, warnings } = readRegister(workbook([business()], { "Entrust Service Pipeline": service }));
    expect(records[0]!.email).toBeNull();
    expect(warnings).toEqual([`TRADE-TST-LEA-002: "call him" isn't an email address, so it was left blank.`]);
  });

  it("refuses a file that isn't the workbook, in words that say why", () => {
    expect(() => readRegister({ Sheet1: [["a"]] })).toThrow(/no sheet called "Master SME Database"/);
    expect(() => readRegister({ "Master SME Database": [["Name", "Phone"], ["x", "y"]] })).toThrow(/needs "SME ID" and "Company Name"/);
    expect(() => readRegister(workbook([]))).toThrow(/has no businesses in it/);
  });

  it("doesn't mix up the capacity column with the capacity score", () => {
    const { records } = readRegister(workbook([business({ [at("Monthly production")]: 300, [at("Production Capacity Strength")]: 3 })]));
    expect(records[0]).toMatchObject({ monthlyProductionCapacity: 300, productionCapacityStrength: 3 });
  });
});

describe("what is worked out from a record", () => {
  const base = readRegister(workbook([business()])).records[0] as RegisterInput;

  it("adds the three gaps, and the five scores once all five are there", () => {
    const record = deriveRegister(base);
    expect(record).toMatchObject({ totalCapitalGap: 25_500_000, exportReadinessScore: 22, financeReadinessLevel: "high", financePriority: "high" });
    expect(deriveRegister({ ...base, marketReadiness: null })).toMatchObject({ exportReadinessScore: null, financeReadinessLevel: null });
    expect(deriveRegister({ ...base, workingCapitalGap: null, equipmentInvestmentNeeded: null, exportLogisticsGap: 70_000 }).totalCapitalGap).toBe(70_000);
    expect(deriveRegister({ ...base, workingCapitalGap: null, equipmentInvestmentNeeded: null, exportLogisticsGap: null })).toMatchObject({
      totalCapitalGap: null,
      financePriority: null,
    });
  });

  it("puts the readiness levels where the workbook does", () => {
    expect([25, 20, 19, 15, 14, 5].map(readinessLevel)).toEqual(["high", "high", "medium", "medium", "low", "low"]);
    expect(readinessLevel(null)).toBeNull();
  });

  it("puts the finance priorities where the workbook does", () => {
    expect([10_000_000, 500_000, 499_999, 200_000, 199_999, 0].map(financePriority)).toEqual(["high", "high", "medium", "medium", "low", "low"]);
    expect(financePriority(null)).toBeNull();
  });
});

describe("banks", () => {
  it("splits a business's banks and names each the same way however it was typed", () => {
    expect(bankNames("CBE/Dashen")).toEqual(["CBE", "Dashen"]);
    expect(bankNames("Abyssinia /CBE")).toEqual(["Abyssinia", "CBE"]);
    expect(bankNames("ENAT")).toEqual(["Enat"]);
    expect(bankNames("Enat")).toEqual(["Enat"]);
    expect(bankNames("cbe, Awash & zemen")).toEqual(["CBE", "Awash", "Zemen"]);
    expect(bankNames("CBE/cbe")).toEqual(["CBE"]);
    expect(bankNames("  ")).toEqual([]);
    expect(bankNames(null)).toEqual([]);
  });
});

describe("the summary", () => {
  const record = (over: Partial<RegisterInput>) => deriveRegister({ ...(readRegister(workbook([business()])).records[0] as RegisterInput), ...over });

  it("counts the businesses, averages the scores of those assessed, and adds the gaps", () => {
    const summary = summariseRegister([
      record({ code: "A", currentBank: "CBE/Dashen" }),
      record({ code: "B", currentBank: "Enat", costingKnowledge: 1, marketReadiness: 1, workingCapitalGap: 1_000_000, equipmentInvestmentNeeded: null, exportLogisticsGap: null }),
      record({ code: "C", currentBank: "ENAT", marketReadiness: null, workingCapitalGap: null, equipmentInvestmentNeeded: null, exportLogisticsGap: null }),
      record({ code: "D", currentBank: null, costingKnowledge: 2, productionCapacityStrength: 2, documentationKnowledge: 2, financialRecordKeeping: 2, marketReadiness: 2 }),
    ]);
    expect(summary).toEqual({
      total: 4,
      assessed: 3,
      // 22, 22 - 3 - 4 = 15 (costing 1, market 1), and 10: 47 / 3.
      averageReadiness: 15.7,
      totalCapitalGap: 25_500_000 + 1_000_000 + 25_500_000,
      byLevel: { high: 1, medium: 1, low: 1, notAssessed: 1 },
      banks: [
        { bank: "Enat", count: 2 },
        { bank: "CBE", count: 1 },
        { bank: "Dashen", count: 1 },
      ],
    });
  });

  it("is empty for nobody", () => {
    expect(summariseRegister([])).toEqual({ total: 0, assessed: 0, averageReadiness: null, totalCapitalGap: 0, byLevel: { high: 0, medium: 0, low: 0, notAssessed: 0 }, banks: [] });
  });
});
