import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  reconcileDocuments,
  type CaseDocuments,
  type CaseEvaluation,
  type DocumentValues,
  type Reconciliation,
} from "@entrust/gate-engine";
import type { DocumentFieldKey, StepId } from "@entrust/rules";
import { passCheck } from "./auto-checks";
import { evaluate, loadOneCaseData, type CaseRow } from "./case-data";
import type { Executor } from "./db";

// The shipping document comparison (STEP-099) on a case: what was entered from each document,
// compared by the GATE engine. A person enters the values; there is no OCR yet.

export const AUDIT_STEP: StepId = "STEP-099";
export const AUDIT_EVIDENCE = "discrepancy_audit_report";

/** Everything entered from the case's documents, by document. */
export async function loadDocuments(db: Executor, caseId: string): Promise<Record<string, DocumentValues>> {
  const rows = await db
    .select({ document: schema.documentField.document, field: schema.documentField.field, value: schema.documentField.value })
    .from(schema.documentField)
    .where(eq(schema.documentField.caseId, caseId));
  const documents: Record<string, DocumentValues> = {};
  for (const { document, field, value } of rows) {
    (documents[document] ??= {})[field as DocumentFieldKey] = value;
  }
  return documents;
}

/**
 * The case's documents compared, or null when STEP-099 doesn't apply to it (a person can mark the
 * audit not applicable). `evaluation` is the case as the engine sees it.
 */
export async function loadReconciliation(
  db: Executor,
  row: CaseRow,
  evaluation: CaseEvaluation,
  documents?: CaseDocuments,
): Promise<Reconciliation | null> {
  const step = evaluation.steps.find((s) => s.id === AUDIT_STEP);
  if (!step || step.applicability !== "applicable" || step.status === "not_applicable") return null;
  return reconcileDocuments({ facts: row.facts, documents: documents ?? (await loadDocuments(db, row.id)) });
}

/**
 * When the documents agree and everything the case needs has been entered, CLEAR approves the
 * audit's evidence and completes STEP-099 once its prerequisites are done (see passCheck). A
 * difference leaves it open and is the failure rule FL-06's business, and so are fields still to be
 * entered, which keep it open too: a comparison with nothing in it is not a clear one. Run it in the
 * transaction that changed the case, with the case locked; it returns the comparison for the
 * failure rules to read.
 */
export async function syncReconciliation(tx: Executor, row: CaseRow, now: Date): Promise<Reconciliation | null> {
  const current = evaluate(await loadOneCaseData(tx, row), now);
  const reconciliation = await loadReconciliation(tx, row, current);
  if (reconciliation?.status === "clear") {
    await passCheck(tx, row, now, current, { stepId: AUDIT_STEP, evidenceType: AUDIT_EVIDENCE, note: reconciliation.message });
  }
  return reconciliation;
}
