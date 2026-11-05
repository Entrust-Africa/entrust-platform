// Entrust's register of pilot SMEs (the "SME Export Readiness Diagnostic Database" workbook): reading a workbook's
// sheets into records, and the figures worked out from a record. Pure, so it can be tested without a database or a file.

/** What a spreadsheet cell holds once read: text, a number, or nothing. */
export type Cell = string | number | null | undefined;

/** A sheet as rows of cells, from the first row and the first column. */
export type SheetGrid = readonly (readonly Cell[])[];

/** The scores a business is given, 1 (weak) to 5 (strong), for the five things the diagnostic asks about. */
export const READINESS_SCORES = [
  { key: "costingKnowledge", label: "Costing knowledge" },
  { key: "productionCapacityStrength", label: "Production capacity" },
  { key: "documentationKnowledge", label: "Documentation knowledge" },
  { key: "financialRecordKeeping", label: "Financial record keeping" },
  { key: "marketReadiness", label: "Market readiness" },
] as const;
export type ReadinessScoreKey = (typeof READINESS_SCORES)[number]["key"];

/** The amounts that make up what a business still has to find to export. */
export const CAPITAL_GAP_PARTS = ["workingCapitalGap", "equipmentInvestmentNeeded", "exportLogisticsGap"] as const;

/** What staff recorded about a business. Nothing here is worked out; see `deriveRegister`. */
export interface RegisterInput {
  /** The workbook's SME ID, such as TRADE-ETH-LEA-002. Records are matched on it when a workbook is loaded again. */
  code: string;
  companyName: string;
  participantName: string | null;
  phone: string | null;
  email: string | null;
  yearEstablished: number | null;
  location: string | null;
  employees: number | null;
  exportLicence: boolean | null;
  currentBank: string | null;
  mainProduct: string | null;
  monthlyProductionCapacity: number | null;
  averageMonthlyRevenue: number | null;
  largestOrderCompleted: number | null;
  currentMarkets: string | null;
  targetExportMarket: string | null;
  monthlyOperatingCost: number | null;
  estimatedMonthlyProfit: number | null;
  existingLoan: boolean | null;
  loanAmount: number | null;
  cashflowStability: string | null;
  workingCapitalGap: number | null;
  equipmentInvestmentNeeded: number | null;
  exportLogisticsGap: number | null;
  costingKnowledge: number | null;
  productionCapacityStrength: number | null;
  documentationKnowledge: number | null;
  financialRecordKeeping: number | null;
  marketReadiness: number | null;
  entrustSupportNeeded: string | null;
  bankOpportunity: string | null;
  serviceNotes: string | null;
}

export type ReadinessLevel = "high" | "medium" | "low";
export type FinancePriority = "high" | "medium" | "low";

/** A record with what is worked out from it. */
export interface RegisterRecord extends RegisterInput {
  /** The three gaps added up; null when none of them is recorded. */
  totalCapitalGap: number | null;
  /** The five scores added up (5 to 25); null until all five are recorded. */
  exportReadinessScore: number | null;
  /** From the score, as the workbook does it: 20 or more is high, 15 or more medium, below that low. */
  financeReadinessLevel: ReadinessLevel | null;
  /** From the capital gap, as the workbook does it: 500,000 or more is high, 200,000 or more medium, below that low. */
  financePriority: FinancePriority | null;
}

export const READINESS_LEVEL_THRESHOLDS = { high: 20, medium: 15 } as const;
export const FINANCE_PRIORITY_THRESHOLDS = { high: 500_000, medium: 200_000 } as const;

export function totalCapitalGap(r: Pick<RegisterInput, (typeof CAPITAL_GAP_PARTS)[number]>): number | null {
  const parts = CAPITAL_GAP_PARTS.map((k) => r[k]).filter((v): v is number => v !== null);
  return parts.length === 0 ? null : parts.reduce((sum, v) => sum + v, 0);
}

export function exportReadinessScore(r: Pick<RegisterInput, ReadinessScoreKey>): number | null {
  const scores = READINESS_SCORES.map(({ key }) => r[key]);
  return scores.every((s): s is number => s !== null) ? scores.reduce((sum, s) => sum + s, 0) : null;
}

export function readinessLevel(score: number | null): ReadinessLevel | null {
  if (score === null) return null;
  return score >= READINESS_LEVEL_THRESHOLDS.high ? "high" : score >= READINESS_LEVEL_THRESHOLDS.medium ? "medium" : "low";
}

export function financePriority(gap: number | null): FinancePriority | null {
  if (gap === null) return null;
  return gap >= FINANCE_PRIORITY_THRESHOLDS.high ? "high" : gap >= FINANCE_PRIORITY_THRESHOLDS.medium ? "medium" : "low";
}

export function deriveRegister(input: RegisterInput): RegisterRecord {
  const gap = totalCapitalGap(input);
  const score = exportReadinessScore(input);
  return { ...input, totalCapitalGap: gap, exportReadinessScore: score, financeReadinessLevel: readinessLevel(score), financePriority: financePriority(gap) };
}

/** The banks in a "Current bank" entry such as "CBE/Dashen" or "Abyssinia /CBE", named the same way however they were typed. */
export function bankNames(entry: string | null): string[] {
  if (!entry) return [];
  const names = entry
    .split(/[/,&+]|\band\b/i)
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((name) => (name.length <= 3 ? name.toUpperCase() : name[0]!.toUpperCase() + name.slice(1).toLowerCase()));
  return [...new Set(names)];
}

export interface RegisterSummary {
  total: number;
  /** How many have all five scores, so a score and level. */
  assessed: number;
  /** The mean score of those assessed, to one decimal place; null when none is. */
  averageReadiness: number | null;
  totalCapitalGap: number;
  byLevel: Record<ReadinessLevel | "notAssessed", number>;
  /** Businesses per bank, most first; a business with two banks counts under each. */
  banks: { bank: string; count: number }[];
}

export function summariseRegister(records: readonly RegisterRecord[]): RegisterSummary {
  const scores = records.map((r) => r.exportReadinessScore).filter((s): s is number => s !== null);
  const byLevel: RegisterSummary["byLevel"] = { high: 0, medium: 0, low: 0, notAssessed: 0 };
  const banks = new Map<string, number>();
  for (const r of records) {
    byLevel[r.financeReadinessLevel ?? "notAssessed"] += 1;
    for (const bank of bankNames(r.currentBank)) banks.set(bank, (banks.get(bank) ?? 0) + 1);
  }
  return {
    total: records.length,
    assessed: scores.length,
    averageReadiness: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    totalCapitalGap: records.reduce((sum, r) => sum + (r.totalCapitalGap ?? 0), 0),
    byLevel,
    banks: [...banks].map(([bank, count]) => ({ bank, count })).sort((a, b) => b.count - a.count || a.bank.localeCompare(b.bank)),
  };
}

// ---- Reading the workbook ----

/** The sheet with the businesses, and the one with how Entrust follows each up. Other sheets are worked out from these. */
export const MASTER_SHEET = "Master SME Database";
export const SERVICE_SHEET = "Entrust Service Pipeline";

/** A heading or name as lower-case words, for matching. */
export const letters = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

type TextField = "participantName" | "phone" | "location" | "currentBank" | "mainProduct" | "currentMarkets" | "targetExportMarket" | "cashflowStability" | "entrustSupportNeeded" | "bankOpportunity";
type MoneyField = "monthlyProductionCapacity" | "averageMonthlyRevenue" | "largestOrderCompleted" | "monthlyOperatingCost" | "estimatedMonthlyProfit" | "loanAmount" | (typeof CAPITAL_GAP_PARTS)[number];

// How each column is recognised by its heading. The workbook's headings have typos ("Export Lincese") and notes in them,
// so these match on the start of the heading, and the more specific ones come first.
const COLUMNS: readonly { field: string; kind: "code" | "company" | "text" | "money" | "count" | "year" | "yesNo" | "score" | "storedTotal" | "storedScore"; heading: RegExp }[] = [
  { field: "code", kind: "code", heading: /^sme id/ },
  { field: "companyName", kind: "company", heading: /^company name/ },
  { field: "participantName", kind: "text", heading: /^participant name/ },
  { field: "phone", kind: "text", heading: /^phone/ },
  { field: "yearEstablished", kind: "year", heading: /^year/ },
  { field: "location", kind: "text", heading: /^location/ },
  { field: "employees", kind: "count", heading: /^employees/ },
  { field: "exportLicence", kind: "yesNo", heading: /^export li/ },
  { field: "currentBank", kind: "text", heading: /^current bank/ },
  { field: "mainProduct", kind: "text", heading: /^main product/ },
  { field: "monthlyProductionCapacity", kind: "money", heading: /^monthly production capacity/ },
  { field: "averageMonthlyRevenue", kind: "money", heading: /^average monthly revenue/ },
  { field: "largestOrderCompleted", kind: "money", heading: /^largest order/ },
  { field: "currentMarkets", kind: "text", heading: /^current markets/ },
  { field: "targetExportMarket", kind: "text", heading: /^target export market/ },
  { field: "monthlyOperatingCost", kind: "money", heading: /^monthly operating cost/ },
  { field: "estimatedMonthlyProfit", kind: "money", heading: /^estimated monthly profit/ },
  { field: "existingLoan", kind: "yesNo", heading: /^existing loan/ },
  { field: "loanAmount", kind: "money", heading: /^loan amount/ },
  { field: "cashflowStability", kind: "text", heading: /^cashflow stability/ },
  { field: "workingCapitalGap", kind: "money", heading: /^working capital gap/ },
  { field: "equipmentInvestmentNeeded", kind: "money", heading: /^equipment investment/ },
  { field: "exportLogisticsGap", kind: "money", heading: /^export logistics gap/ },
  { field: "totalCapitalGap", kind: "storedTotal", heading: /^total capital gap/ },
  { field: "costingKnowledge", kind: "score", heading: /^costing knowledge/ },
  { field: "productionCapacityStrength", kind: "score", heading: /^production capacity strength/ },
  { field: "documentationKnowledge", kind: "score", heading: /^documentation knowledge/ },
  { field: "financialRecordKeeping", kind: "score", heading: /^financial record/ },
  { field: "marketReadiness", kind: "score", heading: /^market readiness/ },
  { field: "exportReadinessScore", kind: "storedScore", heading: /^export readiness score/ },
  { field: "entrustSupportNeeded", kind: "text", heading: /^entrust support needed/ },
  { field: "bankOpportunity", kind: "text", heading: /^zemen opportunity|^opportunity type/ },
];

const EMPTY_INPUT = (code: string, companyName: string): RegisterInput => ({
  code,
  companyName,
  participantName: null,
  phone: null,
  email: null,
  yearEstablished: null,
  location: null,
  employees: null,
  exportLicence: null,
  currentBank: null,
  mainProduct: null,
  monthlyProductionCapacity: null,
  averageMonthlyRevenue: null,
  largestOrderCompleted: null,
  currentMarkets: null,
  targetExportMarket: null,
  monthlyOperatingCost: null,
  estimatedMonthlyProfit: null,
  existingLoan: null,
  loanAmount: null,
  cashflowStability: null,
  workingCapitalGap: null,
  equipmentInvestmentNeeded: null,
  exportLogisticsGap: null,
  costingKnowledge: null,
  productionCapacityStrength: null,
  documentationKnowledge: null,
  financialRecordKeeping: null,
  marketReadiness: null,
  entrustSupportNeeded: null,
  bankOpportunity: null,
  serviceNotes: null,
});

/** A cell as one line of trimmed text, or null when it is blank. */
export const asText = (cell: Cell): string | null => {
  if (cell === null || cell === undefined) return null;
  const text = (typeof cell === "number" ? String(cell) : cell).replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
};

/** A number from a cell, or null when it is blank or isn't one ("2.25E7" and "1,500,000" are numbers). */
function asNumber(cell: Cell): { value: number | null; bad: string | null } {
  if (typeof cell === "number") return Number.isFinite(cell) ? { value: cell, bad: null } : { value: null, bad: String(cell) };
  const text = asText(cell);
  if (text === null) return { value: null, bad: null };
  const value = Number(text.replace(/[,\s]/g, ""));
  return Number.isFinite(value) ? { value, bad: null } : { value: null, bad: text };
}

const yesNo = (cell: Cell): { value: boolean | null; bad: string | null } => {
  const text = asText(cell);
  if (text === null) return { value: null, bad: null };
  if (/^(y|yes)$/i.test(text)) return { value: true, bad: null };
  if (/^(n|no)$/i.test(text)) return { value: false, bad: null };
  return { value: null, bad: text };
};

export interface ReadRegisterResult {
  records: RegisterInput[];
  /** Things staff should look at in the workbook: values that were left out, and totals that don't add up. */
  warnings: string[];
}

/** Finds the row with "SME ID" at the start of a cell, and the columns by their headings. */
function findHeader(grid: SheetGrid): { rowIndex: number; headings: string[] } | null {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const row = grid[i] ?? [];
    const headings = row.map((cell) => letters(asText(cell) ?? ""));
    if (headings.some((h) => /^sme id/.test(h)) && headings.some((h) => /^company name/.test(h))) return { rowIndex: i, headings };
  }
  return null;
}

const sheetNamed = (sheets: Readonly<Record<string, SheetGrid>>, name: string): SheetGrid | null => {
  const key = Object.keys(sheets).find((k) => letters(k) === letters(name));
  return key === undefined ? null : (sheets[key] ?? null);
};

const same = (a: number, b: number) => Math.abs(a - b) < 0.5;
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * Reads the businesses from the workbook's sheets. Throws a sentence fit to show when the master sheet isn't there or has no
 * "SME ID" and "Company Name" columns. A value that can't be read is left out, with a warning, rather than refusing the file.
 *
 * Totals, the readiness score and levels in the workbook are typed over by hand in places, so none is read as a fact: they are
 * worked out again by `deriveRegister`, and a warning says where the workbook disagrees with its own parts.
 */
export function readRegister(sheets: Readonly<Record<string, SheetGrid>>): ReadRegisterResult {
  const master = sheetNamed(sheets, MASTER_SHEET);
  if (!master) throw new Error(`This isn't the diagnostic workbook: it has no sheet called "${MASTER_SHEET}".`);
  const header = findHeader(master);
  if (!header) throw new Error(`The "${MASTER_SHEET}" sheet needs "SME ID" and "Company Name" headings, and has none.`);

  // Which column holds which field. The year the business started has no heading in the workbook; it is the unnamed
  // column between the phone number and the location.
  const columnOf = new Map<string, { index: number; kind: (typeof COLUMNS)[number]["kind"] }>();
  header.headings.forEach((heading, index) => {
    const column = heading ? COLUMNS.find((c) => c.heading.test(heading) && !columnOf.has(c.field)) : undefined;
    if (column) columnOf.set(column.field, { index, kind: column.kind });
  });
  const phone = columnOf.get("phone");
  const location = columnOf.get("location");
  if (!columnOf.has("yearEstablished") && phone && location && location.index - phone.index === 2 && !header.headings[phone.index + 1]) {
    columnOf.set("yearEstablished", { index: phone.index + 1, kind: "year" });
  }

  const records: RegisterInput[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (let i = header.rowIndex + 1; i < master.length; i++) {
    const row = master[i] ?? [];
    const cell = (field: string): Cell => {
      const column = columnOf.get(field);
      return column ? row[column.index] : undefined;
    };
    const code = asText(cell("code"))?.toUpperCase().replace(/\s+/g, "") ?? null;
    const companyName = asText(cell("companyName"));
    if (code === null && companyName === null) continue;
    const where = `Row ${i + 1}`;
    if (code === null) {
      warnings.push(`${where} (${companyName}) has no SME ID, so it was skipped.`);
      continue;
    }
    if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(code)) {
      warnings.push(`${where} has "${code}" as its SME ID, which isn't one, so it was skipped.`);
      continue;
    }
    if (companyName === null) {
      warnings.push(`${code} has no company name, so it was skipped.`);
      continue;
    }
    if (seen.has(code)) {
      warnings.push(`${code} appears on more than one row; the later row (${where}) was skipped.`);
      continue;
    }
    seen.add(code);

    const record = EMPTY_INPUT(code, companyName);
    const dropped = (what: string, value: string) => warnings.push(`${code}: "${value}" isn't a valid ${what}, so it was left blank.`);
    for (const [field, column] of columnOf) {
      const kind = column.kind;
      const value = row[column.index];
      switch (kind) {
        case "text":
          // A 0 left in a text column is the workbook's filler for "nothing", not an answer.
          record[field as TextField] = value === 0 ? null : asText(value);
          break;
        case "money": {
          const n = asNumber(value);
          if (n.bad !== null) dropped(field === "loanAmount" ? "loan amount" : "amount", n.bad);
          else if (n.value !== null && n.value < 0) warnings.push(`${code}: ${n.value} in "${field}" is negative, so it was left blank.`);
          else record[field as MoneyField] = n.value;
          break;
        }
        case "count": {
          const n = asNumber(value);
          if (n.bad !== null || (n.value !== null && n.value < 0)) dropped("number of employees", n.bad ?? String(n.value));
          else record.employees = n.value === null ? null : Math.round(n.value);
          break;
        }
        case "year": {
          const n = asNumber(value);
          if (n.value !== null && n.value >= 1900 && n.value <= 2100) record.yearEstablished = Math.round(n.value);
          else if (n.bad !== null || n.value !== null) dropped("year", n.bad ?? String(n.value));
          break;
        }
        case "yesNo": {
          const answer = yesNo(value);
          if (answer.bad !== null) dropped(field === "exportLicence" ? "answer for the export licence (Yes or No)" : "answer for the existing loan (Yes or No)", answer.bad);
          else record[field as "exportLicence" | "existingLoan"] = answer.value;
          break;
        }
        case "score": {
          // 0 is how an unassessed business is left in the workbook, so it means "not recorded" without a warning.
          const n = asNumber(value);
          if (n.value === null || n.value === 0) {
            if (n.bad !== null) dropped("score", n.bad);
          } else if (Number.isInteger(n.value) && n.value >= 1 && n.value <= 5) record[field as ReadinessScoreKey] = n.value;
          else dropped("score (1 to 5)", String(n.value));
          break;
        }
        default:
          break;
      }
    }

    // The workbook's own totals, against what its parts add up to.
    const derived = deriveRegister(record);
    const storedGap = asNumber(cell("totalCapitalGap")).value;
    if (storedGap !== null && derived.totalCapitalGap !== null && !same(storedGap, derived.totalCapitalGap) && !(storedGap === 0 && derived.totalCapitalGap === 0)) {
      warnings.push(`${code}: the workbook's total capital gap is ${money(storedGap)}, but its three gaps add up to ${money(derived.totalCapitalGap)}. The register uses ${money(derived.totalCapitalGap)}.`);
    }
    const storedScore = asNumber(cell("exportReadinessScore")).value;
    if (storedScore !== null && derived.exportReadinessScore !== null && !same(storedScore, derived.exportReadinessScore)) {
      warnings.push(`${code}: the workbook's export readiness score is ${money(storedScore)}, but its five scores add up to ${derived.exportReadinessScore}. The register uses ${derived.exportReadinessScore}.`);
    }
    records.push(record);
  }

  if (records.length === 0) throw new Error(`The "${MASTER_SHEET}" sheet has no businesses in it.`);
  readServiceSheet(sheets, records, warnings);
  return { records, warnings };
}

/** The email and service notes Entrust keeps for a business. Its rows carry names, not the master's codes (those are numbered from the sheet's own rows), so a row is matched on the company name. */
function readServiceSheet(sheets: Readonly<Record<string, SheetGrid>>, records: RegisterInput[], warnings: string[]): void {
  const sheet = sheetNamed(sheets, SERVICE_SHEET);
  if (!sheet) return;
  const header = findHeader(sheet);
  if (!header) return;
  const email = header.headings.findIndex((h) => /^email/.test(h));
  const description = header.headings.findIndex((h) => /^service description/.test(h));
  const company = header.headings.findIndex((h) => /^company name/.test(h));
  if (company < 0 || (email < 0 && description < 0)) return;
  const byName = new Map(records.map((r) => [letters(r.companyName), r]));
  for (let i = header.rowIndex + 1; i < sheet.length; i++) {
    const row = sheet[i] ?? [];
    const record = byName.get(letters(asText(row[company]) ?? ""));
    if (!record) continue;
    if (email >= 0) {
      const address = asText(row[email]);
      if (address !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) record.email = address.toLowerCase();
      else if (address !== null) warnings.push(`${record.code}: "${address}" isn't an email address, so it was left blank.`);
    }
    if (description >= 0) record.serviceNotes = asText(row[description]);
  }
}
