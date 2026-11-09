// The export pricing calculator (M06), a tool in its own right so M11 and M12 can use it too. It keeps markup and gross margin
// apart, because confusing them is the mistake M06 is there to prevent, and it assumes nothing about which costs apply: the
// seller enters the ones its delivery term makes its own.

export interface PricingInput {
  quantity: number;
  productionCost: number;
  packagingCost: number;
  inlandTransport: number;
  exportPreparation: number;
  freightAndInsurance: number;
  otherCosts: number;
  /** Whether the target is a markup (on cost) or a gross margin (on selling price). */
  basis: "markup" | "margin";
  targetPercent: number;
}

export interface PricingResult {
  totalCost: number;
  unitCost: number;
  sellingPrice: number;
  unitPrice: number;
  grossProfit: number;
  /** Gross profit as a share of the selling price. */
  grossMarginPercent: number;
  /** Gross profit as a share of cost. */
  markupPercent: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The result, or a sentence saying why it can't be worked out. */
export function calculatePricing(input: PricingInput): PricingResult | { problem: string } {
  const costs = [input.productionCost, input.packagingCost, input.inlandTransport, input.exportPreparation, input.freightAndInsurance, input.otherCosts];
  if (costs.some((c) => !Number.isFinite(c) || c < 0)) return { problem: "Costs can't be negative." };
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return { problem: "Enter the order quantity." };
  if (!Number.isFinite(input.targetPercent) || input.targetPercent < 0) return { problem: "Enter a target of zero or more." };
  if (input.basis === "margin" && input.targetPercent >= 100) return { problem: "A gross margin has to be below 100%." };

  const totalCost = costs.reduce((sum, c) => sum + c, 0);
  if (totalCost <= 0) return { problem: "Enter at least one cost." };
  const sellingPrice = input.basis === "markup" ? totalCost * (1 + input.targetPercent / 100) : totalCost / (1 - input.targetPercent / 100);
  const grossProfit = sellingPrice - totalCost;
  return {
    totalCost: round2(totalCost),
    unitCost: round2(totalCost / input.quantity),
    sellingPrice: round2(sellingPrice),
    unitPrice: round2(sellingPrice / input.quantity),
    grossProfit: round2(grossProfit),
    grossMarginPercent: round2((grossProfit / sellingPrice) * 100),
    markupPercent: round2((grossProfit / totalCost) * 100),
  };
}
