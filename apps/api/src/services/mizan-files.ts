import { and, eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { hasPlatformAccess } from "./access";
import type { Executor } from "./db";

// What MIZAN adds to the files store's rules. TRADE limits a facilitator or reviewer to the businesses on their cohorts, but a
// MIZAN Assessor (the reviewer role) assesses any SME, so the files route asks here as well.

/**
 * A MIZAN Assessor or Super Admin may upload for an SME that is in MIZAN: one with MIZAN access or a MIZAN record. Not any
 * business at all, so a TRADE reviewer still can't put files in a business they don't work with.
 */
export async function mizanUploadAllowed(db: Executor, organizationId: string): Promise<boolean> {
  const [sme] = await db.select({ id: schema.mizanSme.organizationId }).from(schema.mizanSme).where(eq(schema.mizanSme.organizationId, organizationId)).limit(1);
  return sme !== undefined || (await hasPlatformAccess(db, organizationId, "mizan"));
}

/**
 * MIZAN staff may open a file MIZAN holds as evidence: a signed notice or an assessment document. Nothing else. A notice's file
 * counts only when the person who recorded the notice uploaded it, as recording one requires: pointing a record at another of
 * the SME's files doesn't open that file to MIZAN.
 */
export async function mizanFileAllowed(db: Executor, fileId: string): Promise<boolean> {
  const [consent] = await db
    .select({ id: schema.mizanConsent.id })
    .from(schema.mizanConsent)
    .innerJoin(schema.file, eq(schema.file.id, schema.mizanConsent.fileId))
    .where(and(eq(schema.mizanConsent.fileId, fileId), eq(schema.file.uploaderUserId, schema.mizanConsent.capturedBy)))
    .limit(1);
  if (consent) return true;
  const [document] = await db.select({ id: schema.mizanDocument.id }).from(schema.mizanDocument).where(eq(schema.mizanDocument.fileId, fileId)).limit(1);
  return document !== undefined;
}
