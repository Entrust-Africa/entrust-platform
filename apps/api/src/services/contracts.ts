import { eq } from "drizzle-orm";
import { schema } from "@entrust/db";
import { STEP_WORKERS, parsePrice, type CoffeeType, type PriceUnit } from "@entrust/gate-engine";
import type { CaseDetailView } from "../schemas/clear";
import { requireRole, type Ctx } from "./access";
import { recordChange } from "./audit";
import { evaluate, loadOneCaseData } from "./case-data";
import { mutateCase } from "./detail";
import { ServiceError } from "./errors";
import { contractView, loadContract } from "./price-check";

export interface ContractInput {
  number: string;
  buyerName: string;
  /** ISO date. */
  contractDate: string;
  unitPrice?: { amount: number; currency: string; per: PriceUnit } | null;
  coffeeType?: CoffeeType | null;
  grade?: string | null;
  origin?: string | null;
}

const blank = (value: string | null | undefined) => value?.trim() || null;

/** The day it is in Ethiopia, where the contract date is counted from. */
const today = (now: Date) => new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

/**
 * Records the case's sales contract: the buyer, the contract date and, for the price checks, the
 * unit price and what is sold (coffee type, grade and origin). The first call creates the contract
 * and later ones replace its terms, so leave nothing out. Recording it runs the minimum export price
 * check, which completes STEP-024 when the price is in order and raises FL-03 when it is below the
 * floor. SME owners and members record it for their own cases, Entrust admins and facilitators for any.
 * Once the commercial phase is signed off, changing it is an amendment (#13), which isn't available yet.
 */
export function recordContract(ctx: Ctx, caseId: string, input: ContractInput): Promise<CaseDetailView> {
  return mutateCase(ctx, caseId, async (tx, { row, actor }) => {
    requireRole(actor, STEP_WORKERS.sme, "record a case's sales contract");

    const number = blank(input.number);
    const buyerName = blank(input.buyerName);
    if (!number || !buyerName) throw new ServiceError("invalid", "The contract needs its number and the buyer's name.");
    // The round trip catches dates that don't exist, such as 2026-02-30.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.contractDate) || new Date(`${input.contractDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.contractDate) {
      throw new ServiceError("invalid", `"${input.contractDate}" is not a date. Use YYYY-MM-DD.`);
    }
    if (input.contractDate > today(ctx.now)) throw new ServiceError("invalid", "The contract date can't be in the future.");

    const unitPrice = input.unitPrice ?? null;
    if (unitPrice) {
      if (parsePrice(unitPrice.amount) === undefined) {
        throw new ServiceError("invalid", "The unit price must be a positive number with at most 4 decimals.");
      }
      if (!/^[A-Za-z]{3}$/.test(unitPrice.currency)) {
        throw new ServiceError("invalid", `"${unitPrice.currency}" is not a currency code such as USD.`);
      }
    }
    const values = {
      number,
      buyerName,
      contractDate: input.contractDate,
      unitPrice: unitPrice ? String(unitPrice.amount) : null,
      priceCurrency: unitPrice ? unitPrice.currency.toUpperCase() : null,
      priceUnit: unitPrice ? unitPrice.per : null,
      coffeeType: input.coffeeType ?? null,
      grade: blank(input.grade),
      origin: blank(input.origin),
    };

    const existing = await loadContract(tx, row);
    const before = existing && contractView(existing);
    if (before && JSON.stringify(before) === JSON.stringify(contractView(values))) return;

    let contractId: string;
    if (existing) {
      const phase = evaluate(await loadOneCaseData(tx, row), ctx.now).phases.find((p) => p.phase === 2);
      if (phase?.status === "locked") {
        throw new ServiceError(
          "precondition_failed",
          "Phase 2 is signed off. Changing the contract now is an amendment, which isn't available yet.",
        );
      }
      await tx.update(schema.salesContract).set(values).where(eq(schema.salesContract.id, existing.id));
      contractId = existing.id;
    } else {
      const [created] = await tx
        .insert(schema.salesContract)
        .values({ ...values, organizationId: row.organizationId })
        .returning({ id: schema.salesContract.id });
      if (!created) throw new Error("The contract was not saved");
      await tx.update(schema.exportCase).set({ salesContractId: created.id }).where(eq(schema.exportCase.id, row.id));
      contractId = created.id;
    }

    await recordChange(tx, ctx.principal.userId, {
      caseId: row.id,
      organizationId: row.organizationId,
      action: "case.contract_recorded",
      before,
      after: contractView(values),
      event: { type: "contract_recorded", data: { contractDate: values.contractDate, contractId, priced: unitPrice !== null } },
    });
  });
}
