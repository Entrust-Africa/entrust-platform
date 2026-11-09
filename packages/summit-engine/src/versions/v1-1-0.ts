import type { Category, SummitRules } from "../types";
import { SUMMIT_RULES_1_0_0 } from "./v1-0-0";

// Version 1.1.0 is 1.0.0 with one change, made on 9 November 2026 when the partner pack went out saying financial records
// do not need to be submitted: the evidence an officer looks for in categories D and E no longer lists financial statements,
// management accounts, a financial model or cash-flow projections. The applicant types in key figures instead, and an
// officer scores from those. No criterion, point value or scoring band changed, so a score under 1.1.0 is comparable to one
// under 1.0.0. APPROVED, so it never changes: put a correction in a new version.

/** The evidence entries that were documents of financial records. */
const FINANCIAL_DOCUMENTS = new Set(["Financial statements", "Management accounts", "Financial model", "Cash-flow projections"]);

const STATED = "Financial figures the applicant types in (no financial document is required, and a missing one lowers no score)";

function withoutFinancialDocuments(category: Category): Category {
  const evidence = category.evidence;
  if (!evidence?.some((e) => FINANCIAL_DOCUMENTS.has(e))) return category;
  const first = evidence.findIndex((e) => FINANCIAL_DOCUMENTS.has(e));
  return { ...category, evidence: evidence.flatMap((e, i) => (i === first ? [STATED] : FINANCIAL_DOCUMENTS.has(e) ? [] : [e])) };
}

export const SUMMIT_RULES_1_1_0: SummitRules = {
  ...SUMMIT_RULES_1_0_0,
  version: "1.1.0",
  rubric: { ...SUMMIT_RULES_1_0_0.rubric, categories: SUMMIT_RULES_1_0_0.rubric.categories.map(withoutFinancialDocuments) },
};
