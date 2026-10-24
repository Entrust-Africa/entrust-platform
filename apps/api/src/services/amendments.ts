import { eq, max, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  CLOCK_INPUT_SET,
  amendmentImpact,
  checkClockInput,
  clockInputOf,
  evidenceStatusOn,
  fieldLabel,
  type CoffeeType,
  type FieldChange,
  type PriceUnit,
  type StepTransition,
} from "@entrust/gate-engine";
import { FACTS, STEPS, type AmendableField } from "@entrust/rules";
import type { CaseDetailView, ContractView } from "../schemas/clear";
import { requireRole, type Ctx } from "./access";
import { recordChange } from "./audit";
import {
  evaluate,
  evidenceRecord,
  latestEvidence,
  loadEvents,
  loadOneCaseData,
  toCaseState,
  type CaseRow,
} from "./case-data";
import { prepareContract, storeContract, type ContractInput } from "./contracts";
import type { Executor } from "./db";
import { mutateCase } from "./detail";
import { fromEngine, ServiceError } from "./errors";
import { applyFacts, checkFacts, sameFacts, type FactInput } from "./facts";
import { loadDocuments } from "./reconciliation";
import { storeDocumentFields } from "./documents";
import { contractView, loadContract } from "./price-check";
import { writeStepTransition } from "./step-record";

export interface AmendInput {
  /** Why the case is being amended. Kept with the amendment and in the audit log. */
  reason: string;
  /** Facts to set; a null value clears one. Like updateFacts, but allowed after a gate is signed. */
  facts?: Record<string, FactInput>;
  /** Contract terms to change. Anything left out keeps its value; null clears the optional ones. */
  contract?: {
    number?: string;
    buyerName?: string;
    contractDate?: string;
    unitPrice?: { amount: number; currency: string; per: PriceUnit } | null;
    coffeeType?: CoffeeType | null;
    grade?: string | null;
    origin?: string | null;
  };
  /** Letter of credit terms to change. Anything left out keeps its value; null clears the two text terms. */
  lc?: { expiry?: string; quantityTolerance?: string | null; reference?: string | null };
}

interface Snapshot {
  facts: CaseRow["facts"];
  contract: ContractView | null;
  lc: { expiry: string | null; quantityTolerance: string | null; reference: string | null };
}

const LC_DOCUMENT = "letter_of_credit";

/** The facts, contract and letter of credit terms of a case as they stand. */
async function snapshotOf(tx: Executor, caseId: string): Promise<Snapshot> {
  const [row] = await tx.select().from(schema.exportCase).where(eq(schema.exportCase.id, caseId));
  if (!row) throw new Error("The case disappeared during the change");
  const contract = await loadContract(tx, row);
  const events = (await loadEvents(tx, caseId)).map((e) => ({ type: e.type, stepId: e.stepId, occurredAt: e.occurredAt.toISOString(), data: e.data }));
  const lc = (await loadDocuments(tx, caseId))[LC_DOCUMENT] ?? {};
  return {
    facts: row.facts,
    contract: contract && contractView(contract),
    lc: {
      expiry: clockInputOf(events, "lcExpiry") ?? null,
      quantityTolerance: lc.quantityTolerance ?? null,
      reference: lc.paymentReference ?? null,
    },
  };
}

const factValue = (value: CaseRow["facts"][keyof CaseRow["facts"]]) => (value === undefined ? null : typeof value === "string" ? value : [...value].sort());

/** The fields that differ between two snapshots, with their old and new values. */
function diff(before: Snapshot, after: Snapshot): FieldChange[] {
  const changes: FieldChange[] = [];
  const compare = (field: AmendableField, was: unknown, now: unknown) => {
    if (JSON.stringify(was ?? null) !== JSON.stringify(now ?? null)) changes.push({ field, label: fieldLabel(field), before: was ?? null, after: now ?? null });
  };
  for (const { key } of FACTS) compare(key, factValue(before.facts[key]), factValue(after.facts[key]));
  const contract = (view: ContractView | null, key: keyof ContractView) => view?.[key] ?? null;
  compare("contract.number", contract(before.contract, "number"), contract(after.contract, "number"));
  compare("contract.buyerName", contract(before.contract, "buyerName"), contract(after.contract, "buyerName"));
  compare("contract.contractDate", contract(before.contract, "contractDate"), contract(after.contract, "contractDate"));
  compare("contract.unitPrice", contract(before.contract, "unitPrice"), contract(after.contract, "unitPrice"));
  compare("contract.coffeeType", contract(before.contract, "coffeeType"), contract(after.contract, "coffeeType"));
  compare("contract.grade", contract(before.contract, "grade"), contract(after.contract, "grade"));
  compare("contract.origin", contract(before.contract, "origin"), contract(after.contract, "origin"));
  compare("lc.expiry", before.lc.expiry, after.lc.expiry);
  compare("lc.quantityTolerance", before.lc.quantityTolerance, after.lc.quantityTolerance);
  compare("lc.reference", before.lc.reference, after.lc.reference);
  return changes;
}

/** The recorded contract as a request, to lay a partial amendment over. */
function contractInputOf(view: ContractView | null): Partial<ContractInput> {
  return view
    ? {
        number: view.number,
        buyerName: view.buyerName,
        contractDate: view.contractDate,
        unitPrice: view.unitPrice,
        coffeeType: view.coffeeType,
        grade: view.grade,
        origin: view.origin,
      }
    : {};
}

/**
 * Amends a case after a phase gate was signed: its facts, its sales contract or its letter of
 * credit terms. Only Entrust admins and facilitators can, and a reason is required. The amendment
 * is the case's next version (v2, v3, ...) and keeps each field it changed, before and after.
 *
 * What it sets back is worked out from the step data (see amendmentImpact): the steps that depend
 * on the changed fields are verified again, so the completed ones are reopened; the approved
 * evidence those steps ask for goes back for review; and the sign-offs of the phases they sit in
 * are reopened. Other steps and evidence stay as they are. The case is "amendments pending" until
 * everything set back is done again. The automatic checks run as usual, so a minimum price or a
 * document comparison that still holds is completed again at once.
 */
export function amendCase(ctx: Ctx, caseId: string, input: AmendInput): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    requireRole(actor, ["admin", "facilitator"], "amend a case");
    const reason = input.reason.trim();
    if (!reason) throw new ServiceError("invalid", "Give the reason for the amendment.");
    if (!input.facts && !input.contract && !input.lc) {
      throw new ServiceError("invalid", "Say what to amend: facts, contract or lc.");
    }
    if (row.status !== "open" && row.status !== "amendments_pending") {
      throw new ServiceError("precondition_failed", `A ${row.status} case can't be amended.`);
    }

    const beforeData = await loadOneCaseData(tx, row);
    // A case is amended while a gate is signed, and while an earlier amendment is still being redone:
    // its gate is open again then, but a change now belongs in the case's versions all the same.
    if (row.status !== "amendments_pending" && !evaluate(beforeData, ctx.now).phases.some((p) => p.status === "locked")) {
      throw new ServiceError("precondition_failed", "No phase is signed off yet, so there is nothing to amend: change it directly.");
    }
    const beforeState = toCaseState(beforeData);
    const before = await snapshotOf(tx, row.id);
    const by = { userId: ctx.principal.userId, now: ctx.now };

    if (input.facts) {
      const next = applyFacts(row.facts, checkFacts(input.facts));
      if (!sameFacts(row.facts, next)) await tx.update(schema.exportCase).set({ facts: next }).where(eq(schema.exportCase.id, row.id));
    }
    if (input.contract) {
      const merged = { ...contractInputOf(before.contract), ...Object.fromEntries(Object.entries(input.contract).filter(([, v]) => v !== undefined)) };
      await storeContract(tx, row, prepareContract(merged as ContractInput, ctx.now));
    }
    if (input.lc) {
      const { expiry, quantityTolerance, reference } = input.lc;
      if (expiry !== undefined) {
        const value = fromEngine(() => checkClockInput("lcExpiry", expiry));
        if (value !== before.lc.expiry) {
          await tx.insert(schema.caseEvent).values({
            caseId: row.id,
            type: CLOCK_INPUT_SET,
            data: { key: "lcExpiry", value },
            actorUserId: by.userId,
            occurredAt: sql`clock_timestamp()`,
            recordedAt: sql`clock_timestamp()`,
          });
        }
      }
      const fields: Record<string, string | null> = {};
      if (quantityTolerance !== undefined) fields.quantityTolerance = quantityTolerance;
      if (reference !== undefined) fields.paymentReference = reference;
      if (Object.keys(fields).length) await storeDocumentFields(tx, row, by, LC_DOCUMENT, fields);
    }

    const after = await snapshotOf(tx, row.id);
    const changes = diff(before, after);
    if (changes.length === 0) {
      throw new ServiceError("invalid", "Nothing changed: the case already says what the amendment says.");
    }

    // The case as it is now, with the new facts: what the amendment sets back is worked out from it.
    const [fresh] = await tx.select().from(schema.exportCase).where(eq(schema.exportCase.id, row.id));
    if (!fresh) throw new Error("The case disappeared during the change");
    const afterData = await loadOneCaseData(tx, fresh);
    const asOf = ctx.now.toISOString();
    const impact = amendmentImpact(STEPS, beforeState, toCaseState(afterData), changes.map((c) => c.field), { asOf });

    const [latest] = await tx.select({ version: max(schema.caseAmendment.version) }).from(schema.caseAmendment).where(eq(schema.caseAmendment.caseId, row.id));
    const version = (latest?.version ?? 1) + 1;
    const note = `Amendment v${version}: ${reason}`;

    // Completed steps that depend on what changed are verified again, and so are the gates of their phases.
    // One after another: this runs inside a transaction, where queries share a single connection.
    const steps = evaluate(afterData, ctx.now).steps;
    for (const [action, ids] of [["reopen", impact.reopen], ["unlock", impact.unlock]] as const) {
      for (const id of ids) {
        const step = steps.find((s) => s.id === id);
        if (!step) continue;
        const transition: StepTransition = { action, from: "completed", record: { status: "in_progress", reason: note } };
        await writeStepTransition(tx, fresh, step, transition, by);
      }
    }

    // Approved evidence the affected steps ask for goes back for review; the rest stays approved.
    const sentBack: string[] = [];
    for (const type of impact.evidence) {
      const current = latestEvidence(afterData.evidence, type);
      if (!current || evidenceStatusOn(evidenceRecord(current), asOf) !== "approved") continue;
      await tx
        .update(schema.evidence)
        .set({ status: "changes_required", reviewerUserId: by.userId, reviewedAt: ctx.now, reviewNote: note })
        .where(eq(schema.evidence.id, current.id));
      await recordChange(tx, by.userId, {
        caseId: row.id,
        organizationId: row.organizationId,
        action: "evidence.amendment_reset",
        before: { evidenceId: current.id, type, status: "approved" },
        after: { evidenceId: current.id, type, status: "changes_required" },
        reason: note,
        event: { type: "evidence_reviewed", evidenceId: current.id, data: { type, action: "request_changes", from: "approved", to: "changes_required", amendment: version } },
      });
      sentBack.push(type);
    }

    await tx.insert(schema.caseAmendment).values({
      caseId: row.id,
      version,
      reason,
      changes,
      impact: { affected: impact.affected, reopened: impact.reopen, reverify: impact.reverify, evidence: sentBack, unlocked: impact.unlock },
      madeByUserId: by.userId,
      createdAt: ctx.now,
    });
    await recordChange(tx, by.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "case.amended",
      before: { version: version - 1, fields: Object.fromEntries(changes.map((c) => [c.field, c.before])) },
      after: { version, fields: Object.fromEntries(changes.map((c) => [c.field, c.after])) },
      reason,
      event: {
        type: "case_amended",
        data: { version, fields: changes.map((c) => c.field), reopened: impact.reopen, reverify: impact.reverify, evidence: sentBack, unlocked: impact.unlock },
      },
    });
  });
}
