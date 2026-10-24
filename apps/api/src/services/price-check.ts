import { and, eq, gte, lte, sql } from "drizzle-orm";
import { schema } from "@entrust/db";
import {
  checkMinimumPrice,
  evidenceStatusOn,
  transitionEvidence,
  transitionStep,
  type CaseEvaluation,
  type CoffeeType,
  type ContractTerms,
  type EvidenceStatus,
  type MinimumPrice,
  type MinimumPriceCheck,
} from "@entrust/gate-engine";
import { EVIDENCE_TYPES, type StepId } from "@entrust/rules";
import type { ContractView } from "../schemas/clear";
import { recordChange } from "./audit";
import {
  evaluate,
  evidenceRecord,
  latestEvidence,
  loadOneCaseData,
  type CaseRow,
  type EvidenceRow,
} from "./case-data";
import type { Executor } from "./db";
import { fromEngine } from "./errors";
import { writeStepTransition } from "./step-record";

// The minimum export price check (STEP-024) on a case: the contract's unit price against the price
// table in force on the contract date. The pure part is in the GATE engine; this loads what it needs.

const PRICE_CHECK_STEP: StepId = "STEP-024";
const PRICE_CHECK_EVIDENCE = "minimum_price_check";

export type ContractRow = typeof schema.salesContract.$inferSelect;

export async function loadContract(db: Executor, row: CaseRow): Promise<ContractRow | null> {
  if (!row.salesContractId) return null;
  const [contract] = await db.select().from(schema.salesContract).where(eq(schema.salesContract.id, row.salesContractId));
  return contract ?? null;
}

type ContractFields = Pick<
  ContractRow,
  "number" | "buyerName" | "contractDate" | "unitPrice" | "priceCurrency" | "priceUnit" | "coffeeType" | "grade" | "origin"
>;

/** The contract as stored and as the API shows it. */
export function contractView(contract: ContractFields): ContractView {
  const { unitPrice } = termsOf(contract);
  return {
    number: contract.number,
    buyerName: contract.buyerName,
    contractDate: contract.contractDate,
    unitPrice: unitPrice && { amount: unitPrice.amount, currency: unitPrice.currency, per: unitPrice.unit },
    coffeeType: contract.coffeeType,
    grade: contract.grade,
    origin: contract.origin,
  };
}

/** What the check reads from a stored contract. */
export function termsOf(contract: ContractFields): ContractTerms {
  const { unitPrice, priceCurrency, priceUnit } = contract;
  return {
    contractDate: contract.contractDate,
    unitPrice:
      unitPrice !== null && priceCurrency !== null && priceUnit !== null
        ? { amount: Number(unitPrice), currency: priceCurrency, unit: priceUnit }
        : null,
    coffeeType: contract.coffeeType,
    grade: contract.grade,
    origin: contract.origin,
  };
}

/** The prices on file for a type of coffee that cover a day, from every table. The engine picks among them. */
export async function candidatePrices(db: Executor, coffeeType: CoffeeType, day: string): Promise<MinimumPrice[]> {
  const rows = await db
    .select({ price: schema.minimumPrice, recordedAt: schema.minimumPriceTable.createdAt })
    .from(schema.minimumPrice)
    .innerJoin(schema.minimumPriceTable, eq(schema.minimumPrice.tableId, schema.minimumPriceTable.id))
    .where(
      and(
        eq(schema.minimumPrice.coffeeType, coffeeType),
        lte(schema.minimumPrice.effectiveFrom, day),
        gte(schema.minimumPrice.effectiveTo, day),
      ),
    );
  return rows.map(({ price, recordedAt }) => ({
    id: price.id,
    tableId: price.tableId,
    recordedAt: recordedAt.toISOString(),
    effectiveFrom: price.effectiveFrom,
    effectiveTo: price.effectiveTo,
    coffeeType: price.coffeeType,
    grade: price.grade,
    origin: price.origin,
    currency: price.currency,
    unit: price.unit,
    minPrice: Number(price.minPrice),
  }));
}

/**
 * The case's contract price against the minimum export price, or null when STEP-024 doesn't apply
 * to it (it is for coffee, and a person can mark it not applicable). `evaluation` is the case as
 * the engine sees it.
 */
export async function loadPriceCheck(db: Executor, row: CaseRow, evaluation: CaseEvaluation): Promise<MinimumPriceCheck | null> {
  const step = evaluation.steps.find((s) => s.id === PRICE_CHECK_STEP);
  if (!step || step.applicability !== "applicable" || step.status === "not_applicable") return null;

  const contract = await loadContract(db, row);
  const terms = contract && termsOf(contract);
  const prices = terms?.coffeeType ? await candidatePrices(db, terms.coffeeType, terms.contractDate) : [];
  return checkMinimumPrice(terms, prices);
}

/**
 * Does what the check says CLEAR may do on its own: when the contract price is at or above the
 * minimum, it approves the check's evidence and completes STEP-024 once its prerequisites are done.
 * Every other result leaves the step open (the case detail says why), and a price below the floor
 * is the failure rule FL-03's business. Nothing is ever undone: a step completed on a price that
 * later changes is caught by FL-03 instead. Run it in the transaction that changed the case, with
 * the case locked; it returns the check for the failure rules to read.
 */
export async function syncPriceCheck(tx: Executor, row: CaseRow, now: Date): Promise<MinimumPriceCheck | null> {
  const first = evaluate(await loadOneCaseData(tx, row), now);
  const check = await loadPriceCheck(tx, row, first);
  const step = first.steps.find((s) => s.id === PRICE_CHECK_STEP);
  if (check?.status !== "met" || !step || step.status === "completed") return check;
  // Wait for the prerequisites: approving the evidence early would leave it standing if the price changes.
  if (step.blockedBy.length || step.heldBy.length) return check;

  const data = await loadOneCaseData(tx, row);
  await approveEvidence(tx, row, latestEvidence(data.evidence, PRICE_CHECK_EVIDENCE), check, now);

  const ready = evaluate(await loadOneCaseData(tx, row), now).steps.find((s) => s.id === PRICE_CHECK_STEP);
  if (ready?.canComplete) {
    const transition = fromEngine(() => transitionStep(ready, { to: "completed", actor: "system" }));
    await writeStepTransition(tx, row, ready, transition, { userId: null, now });
  }
  return check;
}

/**
 * Records the check's evidence as approved. It goes through the same transitions a person's would
 * (submit, review, approve), so the engine decides what CLEAR may do: the check's evidence type
 * needs no human reviewer, which is why CLEAR can approve it. A submission still waiting for review
 * is approved in place; otherwise this is a new submission.
 */
async function approveEvidence(
  tx: Executor,
  row: CaseRow,
  current: EvidenceRow | undefined,
  check: MinimumPriceCheck,
  now: Date,
): Promise<void> {
  const type = EVIDENCE_TYPES.find((t) => t.id === PRICE_CHECK_EVIDENCE);
  if (!type) throw new Error(`${PRICE_CHECK_EVIDENCE} is not an evidence type`);

  const asOf = now.toISOString();
  const from: EvidenceStatus = evidenceStatusOn(current && evidenceRecord(current), asOf);
  if (from === "approved") return;
  const hops = from === "submitted" ? (["under_review", "approved"] as const) : from === "under_review" ? (["approved"] as const) : (["submitted", "under_review", "approved"] as const);

  let record = current && evidenceRecord(current);
  for (const to of hops) {
    record = fromEngine(() => transitionEvidence({ type, current: record, to, actor: "system", asOf })).record;
  }
  const reviewed = { status: "approved" as const, reviewerUserId: null, reviewedAt: now, reviewNote: check.message };

  let evidenceId: string;
  if (hops[0] === "submitted" || !current) {
    const [inserted] = await tx
      .insert(schema.evidence)
      .values({
        caseId: row.id,
        type: type.id,
        ...reviewed,
        issuedOn: record?.issuedOn ?? null,
        validUntil: record?.validUntil ?? null,
        // Not the transaction's start: the latest submission of a type decides its status.
        submittedAt: sql`clock_timestamp()`,
      })
      .returning({ id: schema.evidence.id });
    if (!inserted) throw new Error("The evidence was not saved");
    evidenceId = inserted.id;
  } else {
    await tx.update(schema.evidence).set(reviewed).where(eq(schema.evidence.id, current.id));
    evidenceId = current.id;
  }

  await recordChange(tx, null, {
    caseId: row.id,
    organizationId: row.organizationId,
    action: "evidence.auto_approve",
    before: { type: type.id, status: from },
    after: { evidenceId, type: type.id, status: "approved" },
    reason: check.message,
    event: {
      type: "evidence_reviewed",
      evidenceId,
      data: { type: type.id, action: "approve", from, to: "approved", automatic: true },
    },
  });
}
