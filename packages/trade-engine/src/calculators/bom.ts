import { figure, round2, sum } from "./amounts";

export interface BomLineInput {
  id?: string;
  item: string;
  unit: string;
  /** Quantity of material required for one single finished unit */
  baseQuantityPerUnit: number;
  /** Expected waste / scrap percentage on this line (e.g. 5 for 5%) */
  wastePercentage: number;
  /** Unit purchase cost */
  unitCost: number;
}

export interface BomLineResult {
  id: string;
  item: string;
  unit: string;
  baseQuantityPerUnit: number;
  wastePercentage: number;
  baseTotalQuantity: number;
  wasteQuantity: number;
  requiredQuantity: number;
  unitCost: number;
  totalCost: number;
}

export interface BomInput {
  orderQuantity: number;
  items: readonly BomLineInput[];
}

export interface BomResult {
  orderQuantity: number;
  lines: readonly BomLineResult[];
  totalMaterialsCost: number;
}

/**
 * Bill of Materials (BOM) calculator with waste allowance (M07 AT-02).
 * Works out required material procurement quantities including waste percentages,
 * plus total materials cost.
 *
 * In the 1,000-uniform test case: 1,000 uniforms at 2.5 m/unit with 5% waste = 2,625 m fabric.
 */
export function calculateBOM(input: BomInput): BomResult {
  const orderQuantity = Math.max(0, figure("order quantity", input.orderQuantity) ?? 0);

  const lines: BomLineResult[] = (input.items || []).map((raw, idx) => {
    const id = raw.id || `bom-${idx + 1}`;
    const item = raw.item?.trim() || `Material item ${idx + 1}`;
    const unit = raw.unit?.trim() || "unit";
    const baseQuantityPerUnit = Math.max(0, figure(`${item} base quantity per unit`, raw.baseQuantityPerUnit) ?? 0);

    // Normalize waste rate (accept 5 or 0.05 as 5%)
    const rawWaste = figure(`${item} waste percentage`, raw.wastePercentage) ?? 0;
    const wastePercentage = rawWaste > 1 ? rawWaste : rawWaste * 100;
    const wasteFactor = Math.max(0, wastePercentage / 100);

    const unitCost = Math.max(0, figure(`${item} unit cost`, raw.unitCost) ?? 0);

    const baseTotalQuantity = round2(orderQuantity * baseQuantityPerUnit);
    const wasteQuantity = round2(baseTotalQuantity * wasteFactor);
    const requiredQuantity = round2(baseTotalQuantity + wasteQuantity);
    const totalCost = round2(requiredQuantity * unitCost);

    return {
      id,
      item,
      unit,
      baseQuantityPerUnit,
      wastePercentage,
      baseTotalQuantity,
      wasteQuantity,
      requiredQuantity,
      unitCost,
      totalCost,
    };
  });

  const totalMaterialsCost = sum(lines.map((l) => l.totalCost)) ?? 0;

  return {
    orderQuantity,
    lines,
    totalMaterialsCost: round2(totalMaterialsCost),
  };
}
