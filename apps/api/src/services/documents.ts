import { and, eq, inArray } from "drizzle-orm";
import { schema } from "@entrust/db";
import { STEP_WORKERS, checkDocumentValue, type DocumentValues } from "@entrust/gate-engine";
import { DOCUMENT_FIELDS, RECONCILIATION_DOCUMENTS, type DocumentFieldKey } from "@entrust/rules";
import type { CaseDetailView, DocumentCatalogueView } from "../schemas/clear";
import { requireRole, type Ctx } from "./access";
import { recordChange } from "./audit";
import type { CaseRow } from "./case-data";
import type { Executor } from "./db";
import { mutateCase } from "./detail";
import { fromEngine, ServiceError } from "./errors";
import { loadDocuments } from "./reconciliation";

const FIELD_LABELS = new Map(DOCUMENT_FIELDS.map((f) => [f.key, f.label]));

/**
 * Records what a document says, field by field, for the shipping document comparison. The fields
 * given are set (a null or blank value clears one); the others are left alone. Each value is
 * checked for what it should be (a date, a weight with its unit) when it is typed in, and must be
 * a field the document may carry. SME owners and members enter them for their own cases, Entrust
 * admins and facilitators for any. The comparison runs with the change: it can complete STEP-099,
 * or raise FL-06 and hold the handoff to the bank. Corrections after the fact are fine, because the
 * comparison is what catches a document that no longer agrees.
 */
export function recordDocumentFields(
  ctx: Ctx,
  caseId: string,
  documentId: string,
  input: Record<string, string | null>,
): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    requireRole(actor, STEP_WORKERS.sme, "enter a case's document fields");
    const stored = await storeDocumentFields(tx, row, { userId: ctx.principal.userId, now: ctx.now }, documentId, input);
    if (!stored) return;
    const { document, existing, changes, cleared } = stored;

    const keys = [...changes.map(([key]) => key), ...cleared];
    const pick = (values: Record<string, string | undefined>) => Object.fromEntries(keys.map((key) => [key, values[key] ?? null]));
    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "case.document_fields_recorded",
      before: { document: document.id, fields: pick(existing) },
      after: { document: document.id, fields: pick({ ...Object.fromEntries(changes), ...Object.fromEntries(cleared.map((key) => [key, undefined])) }) },
      event: {
        type: "document_fields_recorded",
        data: { document: document.id, set: changes.map(([key]) => key), cleared },
      },
    });
  });
}

export interface StoredFields {
  document: (typeof RECONCILIATION_DOCUMENTS)[number];
  /** What was entered from the document before. */
  existing: DocumentValues;
  changes: [DocumentFieldKey, string][];
  cleared: DocumentFieldKey[];
}

/**
 * Checks and writes fields of one document, without the audit rows: the caller records the change.
 * Returns null when nothing changes. Throws a ServiceError for a document that isn't compared, a field
 * it can't carry, or a value that isn't what the field should hold.
 */
export async function storeDocumentFields(
  tx: Executor,
  row: CaseRow,
  by: { userId: string; now: Date },
  documentId: string,
  input: Record<string, string | null>,
): Promise<StoredFields | null> {
  const document = RECONCILIATION_DOCUMENTS.find((d) => d.id === documentId);
  if (!document) throw new ServiceError("not_found", `${documentId} is not one of the documents that are compared.`);

  const problems: string[] = [];
  const set = new Map<DocumentFieldKey, string>();
  const clear = new Set<DocumentFieldKey>();
  for (const [key, raw] of Object.entries(input)) {
    const field = document.fields.find((f) => f === key);
    if (!field) {
      problems.push(`${FIELD_LABELS.get(key as DocumentFieldKey) ?? key} isn't a field of the ${document.name.toLowerCase()}.`);
    } else if (raw === null || raw.trim() === "") {
      clear.add(field);
    } else {
      try {
        set.set(field, fromEngine(() => checkDocumentValue(field, raw)));
      } catch (error) {
        problems.push(error instanceof ServiceError ? error.message : String(error));
      }
    }
  }
  if (problems.length) throw new ServiceError("invalid", problems.join(" "));

  const existing = (await loadDocuments(tx, row.id))[document.id] ?? {};
  const changes = [...set].filter(([key, value]) => existing[key] !== value);
  const cleared = [...clear].filter((key) => existing[key] !== undefined);
  if (changes.length === 0 && cleared.length === 0) return null;

  for (const [field, value] of changes) {
    await tx
      .insert(schema.documentField)
      .values({ caseId: row.id, document: document.id, field, value, enteredByUserId: by.userId })
      .onConflictDoUpdate({
        target: [schema.documentField.caseId, schema.documentField.document, schema.documentField.field],
        set: { value, enteredByUserId: by.userId, updatedAt: by.now },
      });
  }
  if (cleared.length) {
    await tx
      .delete(schema.documentField)
      .where(
        and(
          eq(schema.documentField.caseId, row.id),
          eq(schema.documentField.document, document.id),
          inArray(schema.documentField.field, cleared),
        ),
      );
  }
  return { document, existing, changes, cleared };
}

/** The fields and documents of the comparison, for building the forms that enter them. */
export function documentCatalogue(): DocumentCatalogueView {
  return {
    fields: DOCUMENT_FIELDS.map((f) => ({ key: f.key, number: f.number, label: f.label, help: f.help, kind: f.kind, tolerance: f.tolerance === true })),
    documents: RECONCILIATION_DOCUMENTS.map((d) => ({
      document: d.id,
      name: d.name,
      role: d.role,
      requiredWhen: d.requiredWhen?.description ?? null,
      fields: [...d.fields],
      requires: (d.requires ?? []).map((r) => ({ fields: [...r.fields], when: r.when?.description ?? null })),
    })),
  };
}
