"use client";

import { useState } from "react";
import { Card } from "@entrust/ui";
import { calculatePricing, type PricingInput } from "@entrust/trade-engine";

const COSTS = [
  ["productionCost", "Production cost"],
  ["packagingCost", "Packaging cost"],
  ["inlandTransport", "Inland transport"],
  ["exportPreparation", "Export preparation costs"],
  ["freightAndInsurance", "Freight and insurance, where they're yours to pay"],
  ["otherCosts", "Other seller-responsible costs"],
] as const;

const field = "mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink";
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function PricingCalculator() {
  const [values, setValues] = useState<Record<string, string>>({ quantity: "", targetPercent: "" });
  const [basis, setBasis] = useState<PricingInput["basis"]>("margin");
  const num = (key: string) => Number(values[key] ?? "") || 0;
  const started = Object.values(values).some((v) => v !== "");
  const result = calculatePricing({
    quantity: num("quantity"),
    productionCost: num("productionCost"),
    packagingCost: num("packagingCost"),
    inlandTransport: num("inlandTransport"),
    exportPreparation: num("exportPreparation"),
    freightAndInsurance: num("freightAndInsurance"),
    otherCosts: num("otherCosts"),
    basis,
    targetPercent: num("targetPercent"),
  });
  const input = (key: string, label: string) => (
    <label key={key} className="block text-xs font-semibold text-ink-3">
      {label}
      <input type="number" min="0" inputMode="decimal" className={field} value={values[key] ?? ""} onChange={(e) => setValues({ ...values, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        {input("quantity", "Order quantity")}
        {COSTS.map(([key, label]) => input(key, label))}
        <p className="text-xs text-ink-3">Which costs are yours depends on the delivery term you agree. Leave out any that aren't, and label estimates in your worksheet.</p>
      </Card>
      <Card className="space-y-3 p-5">
        <label className="block text-xs font-semibold text-ink-3">
          Your target is a
          <select className={field} value={basis} onChange={(e) => setBasis(e.target.value as PricingInput["basis"])}>
            <option value="margin">Gross margin (a share of the selling price)</option>
            <option value="markup">Markup (a share of cost)</option>
          </select>
        </label>
        {input("targetPercent", "Target percentage")}
      </Card>
      <Card className="p-5" aria-live="polite">
        {"problem" in result ? (
          <p className="text-sm text-ink-2">{started ? result.problem : "Enter your quantity, costs and target."}</p>
        ) : (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Total order cost", money(result.totalCost)],
              ["Unit cost", money(result.unitCost)],
              ["Selling price", money(result.sellingPrice)],
              ["Price per unit", money(result.unitPrice)],
              ["Gross profit", money(result.grossProfit)],
              ["Gross margin", `${result.grossMarginPercent}%`],
              ["Markup", `${result.markupPercent}%`],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold text-ink-3">{label}</dt>
                <dd className="font-display text-lg font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </div>
  );
}
