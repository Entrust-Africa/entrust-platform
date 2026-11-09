import { describe, expect, it } from "vitest";
import { INFORMATION_PACK_ITEMS, WORKSHEET_DEFINITIONS, computeWorksheet, findWorksheet, packItemId, prefillFrom } from "../src";

const flagCodes = (r: ReturnType<typeof computeWorksheet>) => r.flags.map((f) => f.code);

describe("the worksheet definitions", () => {
  it("are the six the issues ask for, each laid out with every field, table and result placed once", () => {
    expect(WORKSHEET_DEFINITIONS.map((w) => w.id)).toEqual([
      "m01-export-opportunity-brief",
      "m03-income-statement",
      "m03-cash-flow-forecast",
      "m03-working-capital-brief",
      "m03-information-pack",
      "m04-transaction-brief",
      "m07-order-fulfilment-plan",
    ]);
    for (const w of WORKSHEET_DEFINITIONS) {
      const ids = [...w.fields.map((f) => f.id), ...w.tables.map((t) => t.id), ...w.computed.map((c) => c.id)];
      const placed = w.sections.flatMap((s) => s.items);
      expect([w.id, [...placed].sort()]).toEqual([w.id, [...ids].sort()]);
      expect([w.id, new Set(ids).size]).toEqual([w.id, ids.length]);
      // A field that shows only for another's answer names a field that exists.
      for (const f of w.fields) if (f.showWhen) expect(ids, `${w.id}.${f.id}`).toContain(f.showWhen.field);
      for (const f of [...w.fields, ...w.tables.flatMap((t) => t.columns)]) {
        if (f.kind === "choice") expect(f.options?.length, `${w.id}.${f.id}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("open a money worksheet with the currency, and the rate and its date for any but birr", () => {
    for (const w of WORKSHEET_DEFINITIONS.filter((x) => x.money)) {
      expect(w.fields.slice(0, 3).map((f) => f.id), w.id).toEqual(["currency", "exchange_rate", "rate_date"]);
    }
    expect(findWorksheet("m04-transaction-brief")?.prefillFrom).toBe("m03-working-capital-brief");
    expect(findWorksheet("nope")).toBeUndefined();
    expect(() => computeWorksheet("nope", {})).toThrow("no worksheet");
  });
});

describe("M03 simplified income statement (acceptance test 1)", () => {
  it("reproduces the spice firm: 2.4M revenue, 35% gross margin, 10% operating margin", () => {
    const r = computeWorksheet("m03-income-statement", { currency: "ETB", revenue: 2_400_000, cost_of_goods_sold: 1_560_000, operating_expenses: 600_000 });
    expect(r.computed).toEqual({ gross_profit: 840_000, gross_margin: 35, operating_profit: 240_000, operating_margin: 10 });
    expect(r.problems).toEqual([]);
    expect(r.etb).toEqual({});
  });

  it("leaves what depends on a blank figure blank, never zero", () => {
    expect(computeWorksheet("m03-income-statement", { revenue: 1000 }).computed).toEqual({ gross_profit: null, gross_margin: null, operating_profit: null, operating_margin: null });
    expect(computeWorksheet("m03-income-statement", { revenue: 1000, cost_of_goods_sold: 400 }).computed).toMatchObject({ gross_profit: 600, gross_margin: 60, operating_profit: null });
    expect(computeWorksheet("m03-income-statement", {}).computed.gross_profit).toBeNull();
  });

  it("shows the ETB figure when the worksheet isn't in birr, from the rate and date the learner entered", () => {
    const base = { currency: "USD", revenue: 10_000, cost_of_goods_sold: 6_000, operating_expenses: 1_000 };
    expect(computeWorksheet("m03-income-statement", base).etb).toEqual({ gross_profit: null, operating_profit: null });
    const r = computeWorksheet("m03-income-statement", { ...base, exchange_rate: 56.5, rate_date: "2026-11-01" });
    expect(r.computed).toMatchObject({ gross_profit: 4_000, operating_profit: 3_000 });
    expect(r.etb).toEqual({ gross_profit: 226_000, operating_profit: 169_500 });
  });

  it("reports a figure that isn't a number against its field, and a rate that makes no sense", () => {
    const r = computeWorksheet("m03-income-statement", { revenue: "lots", cost_of_goods_sold: 10 });
    expect(r.problems).toContainEqual({ field: "revenue", message: "Revenue must be a number." });
    expect(r.computed.gross_profit).toBeNull();
    expect(computeWorksheet("m03-income-statement", { currency: "USD", exchange_rate: 0 }).problems).toContainEqual({ field: "exchange_rate", message: "The exchange rate must be above 0." });
    expect(computeWorksheet("m03-income-statement", { nonsense: 1 }).problems).toContainEqual({ field: "nonsense", message: "This worksheet has no such field." });
  });
});

describe("M03 three-month cash-flow forecast (acceptance test 2)", () => {
  it("carries each month's closing balance into the next: 120k + 400k - 510k = 10k", () => {
    const r = computeWorksheet("m03-cash-flow-forecast", {
      currency: "ETB",
      opening_balance: 120_000,
      months: [{ inflows: 400_000, outflows: 510_000 }, { inflows: 300_000, outflows: 200_000 }, { inflows: 100_000, outflows: 150_000 }],
    });
    expect(r.rows.months).toEqual([
      { opening: 120_000, net: -110_000, closing: 10_000 },
      { opening: 10_000, net: 100_000, closing: 110_000 },
      { opening: 110_000, net: -50_000, closing: 60_000 },
    ]);
    expect(r.computed).toEqual({ lowest_closing: 10_000, months_below_zero: 0 });
    expect(r.flags).toEqual([]);
  });

  it("warns for each month that ends below zero (acceptance test 12)", () => {
    const r = computeWorksheet("m03-cash-flow-forecast", { opening_balance: 10_000, months: [{ inflows: 0, outflows: 30_000 }, { inflows: 5_000, outflows: 1_000 }, { inflows: 50_000, outflows: 0 }] });
    expect(r.computed).toEqual({ lowest_closing: -20_000, months_below_zero: 2 });
    expect(r.flags.map((f) => [f.code, f.severity, f.fields])).toEqual([
      ["negative_closing_balance", "warning", ["months.0.outflows"]],
      ["negative_closing_balance", "warning", ["months.1.outflows"]],
    ]);
  });

  it("waits for the figures it needs", () => {
    const r = computeWorksheet("m03-cash-flow-forecast", { opening_balance: 1000, months: [{ inflows: 100 }, {}, {}] });
    expect(r.rows.months?.[0]).toEqual({ opening: 1000, net: null, closing: null });
    expect(r.computed).toEqual({ lowest_closing: null, months_below_zero: 0 });
    expect(computeWorksheet("m03-cash-flow-forecast", {}).computed).toEqual({ lowest_closing: null, months_below_zero: null });
  });
});

describe("M03 export working-capital brief (acceptance test 3)", () => {
  it("works out the gap: outflows less internal cash and the buyer's advance, with the days until payment", () => {
    const r = computeWorksheet("m03-working-capital-brief", {
      currency: "ETB",
      pre_shipment_outflows: 560_000,
      post_shipment_outflows: 200_000,
      internal_cash: 150_000,
      buyer_advance: 200_000,
      start_date: "2026-01-01",
      payment_date: "2026-04-01",
    });
    expect(r.computed).toEqual({ total_outflows: 760_000, available_funds: 350_000, gap: 410_000, funding_needed: 410_000, days_until_payment: 90 });
  });

  it("finances nothing when the business covers the order, and refuses a payment before the first outflow", () => {
    const covered = computeWorksheet("m03-working-capital-brief", { pre_shipment_outflows: 100, post_shipment_outflows: 50, internal_cash: 500, buyer_advance: 0 });
    expect(covered.computed).toMatchObject({ gap: -350, funding_needed: 0 });
    const wrong = computeWorksheet("m03-working-capital-brief", { start_date: "2026-04-01", payment_date: "2026-01-01" });
    expect(wrong.problems).toContainEqual({ field: "payment_date", message: "Payment can't arrive before the first outflow." });
    expect(computeWorksheet("m03-working-capital-brief", { start_date: "2026-02-30" }).problems.some((p) => p.field === "start_date")).toBe(true);
  });
});

describe("M03 financial information pack (acceptance test 11)", () => {
  it("counts what is ready and lists what is missing", () => {
    expect(INFORMATION_PACK_ITEMS).toHaveLength(12);
    const ready = Object.fromEntries([0, 1, 4].map((i) => [packItemId(i), true]));
    const r = computeWorksheet("m03-information-pack", ready);
    expect(r.computed).toMatchObject({ provided: 3, completion_percent: 25 });
    expect(String(r.computed.missing).split("; ")).toHaveLength(9);
    expect(String(r.computed.missing)).not.toContain("Bank statements");
    expect(computeWorksheet("m03-information-pack", Object.fromEntries(INFORMATION_PACK_ITEMS.map((_, i) => [packItemId(i), true]))).computed).toMatchObject({ completion_percent: 100, missing: "" });
    expect(computeWorksheet("m03-information-pack", {}).computed).toMatchObject({ provided: 0, completion_percent: 0 });
  });
});

describe("M01 Export Opportunity Brief", () => {
  const actions = (...deadlines: string[]) => deadlines.map((deadline) => ({ action: "Do it", owner: "Me", deadline }));
  it("flags an action with a deadline outside the next 30 days", () => {
    const r = computeWorksheet("m01-export-opportunity-brief", { brief_date: "2026-11-10", actions: actions("2026-11-20", "2026-12-10", "2026-12-11", "2026-11-09") });
    expect(r.flags.map((f) => [f.code, f.fields[0]])).toEqual([
      ["deadline_beyond_30_days", "actions.2.deadline"],
      ["deadline_before_brief", "actions.3.deadline"],
    ]);
  });
  it("waits for the date of the brief, and takes only the rows the worksheet has room for", () => {
    expect(computeWorksheet("m01-export-opportunity-brief", { actions: actions("2030-01-01") }).flags).toEqual([]);
    expect(computeWorksheet("m01-export-opportunity-brief", { actions: actions("a", "b", "c", "d") }).problems).toContainEqual({ field: "actions", message: "Three actions for the next 30 days has room for 3 rows." });
  });
});

describe("M04 Transaction Finance and Payment-Risk Brief", () => {
  const outlays = [
    { stage: "sourcing", date: "2026-01-10", amount: 400_000 },
    { stage: "production", date: "2026-02-01", amount: 200_000 },
    { stage: "logistics", date: "2026-03-01", amount: 100_000 },
    { stage: "customs", date: "2026-03-10", amount: 60_000 },
  ];

  it("reproduces the garment case: 760k outlay, 200k advance, 150k own cash, 410k gap", () => {
    const r = computeWorksheet("m04-transaction-brief", { currency: "ETB", outlays, internal_cash: 150_000, advances: [{ amount: 200_000 }] });
    expect(r.computed).toMatchObject({ total_outlay: 760_000, peak_cumulative: 760_000, peak_date: "2026-03-10", available_funds: 350_000, gap: 410_000, funding_needed: 410_000, peak_gap: 410_000 });
    expect(r.rows.outlays?.map((x) => x.cumulative)).toEqual([400_000, 600_000, 700_000, 760_000]);
  });

  it("reproduces the sesame case: a 760k peak against 200k of cash is a 560k gap", () => {
    const r = computeWorksheet("m04-transaction-brief", { outlays, internal_cash: 200_000 });
    expect(r.computed).toMatchObject({ peak_cumulative: 760_000, available_funds: 200_000, gap: 560_000, peak_gap: 560_000 });
  });

  it("waits for a stage, a date and an amount before it works out the schedule", () => {
    const r = computeWorksheet("m04-transaction-brief", { outlays: [{ stage: "sourcing", amount: 100 }], internal_cash: 10 });
    expect(r.computed).toMatchObject({ total_outlay: 100, peak_cumulative: null, gap: 90 });
    expect(computeWorksheet("m04-transaction-brief", { outlays: [{ amount: 100 }] }).computed.total_outlay).toBeNull();
    expect(computeWorksheet("m04-transaction-brief", {}).computed.gap).toBeNull();
  });

  it("raises the open-account flag as soon as that combination is chosen (acceptance test 3)", () => {
    const base = { payment_method: "open_account" };
    expect(flagCodes(computeWorksheet("m04-transaction-brief", base))).toEqual([]);
    const r = computeWorksheet("m04-transaction-brief", { ...base, buyer_verified: "no" });
    expect(r.flags).toEqual([expect.objectContaining({ code: "open_account_unverified_buyer", severity: "critical_candidate", fields: ["payment_method", "buyer_verified"] })]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", { ...base, buyer_verified: "yes" }))).toEqual([]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", { payment_method: "letter_of_credit", buyer_verified: "no" }))).toEqual([]);
  });

  it("checks the dates: delivery before production starts, and repayment after the payment window (acceptance test 2)", () => {
    const r = computeWorksheet("m04-transaction-brief", { production_start: "2026-03-01", delivery_date: "2026-02-01", repayment_date: "2026-06-01", payment_window_end: "2026-05-01" });
    expect(r.flags.map((f) => [f.code, f.severity])).toEqual([
      ["delivery_before_production", "warning"],
      ["repayment_after_payment_window", "warning"],
      ["repayment_after_payment_window", "critical_candidate"],
    ]);
    expect(r.flags[0]?.fields).toEqual(["production_start", "delivery_date"]);
    // The same day passes both checks.
    expect(computeWorksheet("m04-transaction-brief", { production_start: "2026-03-01", delivery_date: "2026-03-01", repayment_date: "2026-05-01", payment_window_end: "2026-05-01" }).flags).toEqual([]);
  });

  it("flags a schedule with no raw material or no freight, once it has something in it", () => {
    const noFreight = computeWorksheet("m04-transaction-brief", { outlays: [outlays[0]!, outlays[1]!] });
    expect(flagCodes(noFreight)).toEqual(["freight_missing"]);
    const noMaterial = computeWorksheet("m04-transaction-brief", { outlays: [outlays[1]!, outlays[2]!] });
    expect(flagCodes(noMaterial)).toEqual(["raw_material_missing"]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", { outlays }))).toEqual([]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", {}))).toEqual([]);
  });

  it("expects a verified order only on Pathway B or for a live order (#48)", () => {
    const answer = { order_document_verified: "no" };
    expect(flagCodes(computeWorksheet("m04-transaction-brief", answer, { pathway: "B" }))).toEqual(["no_verified_order"]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", answer, { pathway: "A" }))).toEqual([]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", answer, { pathway: "A", liveOrder: true }))).toEqual(["no_verified_order"]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", { ...answer, deal_basis: "a_live_order" }, { pathway: "A" }))).toEqual(["no_verified_order"]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", { ...answer, deal_basis: "a_target_deal" }, { pathway: "A" }))).toEqual([]);
    expect(flagCodes(computeWorksheet("m04-transaction-brief", {}, { pathway: "B" }))).toEqual([]);
  });

  it("refuses a negative outlay and a stage that isn't one of the four, against the field", () => {
    expect(computeWorksheet("m04-transaction-brief", { outlays: [{ stage: "sourcing", date: "2026-01-01", amount: -5 }] }).problems.some((p) => p.field === "outlays")).toBe(true);
    expect(computeWorksheet("m04-transaction-brief", { outlays: [{ stage: "magic", date: "2026-01-01", amount: 5 }] }).problems.some((p) => p.field === "outlays")).toBe(true);
  });

  it("gives the same result every time", () => {
    const values = { outlays, internal_cash: 150_000, advances: [{ amount: 200_000 }], payment_method: "open_account", buyer_verified: "no" };
    expect(computeWorksheet("m04-transaction-brief", values, { pathway: "B" })).toEqual(computeWorksheet("m04-transaction-brief", structuredClone(values), { pathway: "B" }));
  });
});

describe("prefilling one worksheet from another", () => {
  it("only ever carries fields the target has, so a prefilled draft can be submitted", () => {
    const sample = (kind: string, options?: readonly { value: string }[]) => (["number", "money", "percent"].includes(kind) ? 5 : kind === "date" ? "2026-11-01" : kind === "choice" ? options![0]!.value : kind === "checkbox" ? true : "Some words");
    for (const target of WORKSHEET_DEFINITIONS.filter((d) => d.prefillFrom)) {
      const source = WORKSHEET_DEFINITIONS.find((d) => d.id === target.prefillFrom)!;
      const values: Record<string, unknown> = {};
      for (const f of source.fields) if (!f.showWhen) values[f.id] = sample(f.kind, f.options);
      const prefilled = prefillFrom(target.id, { id: source.id, values, computed: computeWorksheet(source.id, values).computed });
      expect(computeWorksheet(target.id, prefilled).problems.filter((p) => p.message.includes("no such field")), target.id).toEqual([]);
    }
  });

  const wc = {
    id: "m03-working-capital-brief",
    values: { currency: "USD", exchange_rate: 56.5, rate_date: "2026-11-01", pre_shipment_outflows: 560_000, internal_cash: 150_000, buyer_advance: 200_000 },
    computed: {},
  };
  it("starts the M04 brief from the M03 working-capital brief", () => {
    expect(prefillFrom("m04-transaction-brief", wc)).toEqual({ currency: "USD", exchange_rate: 56.5, rate_date: "2026-11-01", internal_cash: 150_000, advances: [{ amount: 200_000 }] });
    expect(prefillFrom("m04-transaction-brief", { ...wc, values: {} })).toEqual({});
  });
  it("offers nothing to a worksheet that doesn't build on it, or from another worksheet", () => {
    expect(prefillFrom("m03-income-statement", wc)).toEqual({});
    expect(prefillFrom("m04-transaction-brief", { ...wc, id: "m03-income-statement" })).toEqual({});
  });

  it("starts the M07 fulfilment plan from the M04 transaction brief", () => {
    const m04 = {
      id: "m04-transaction-brief",
      values: {
        currency: "USD",
        exchange_rate: 56.5,
        rate_date: "2026-11-01",
        buyer_name: "Hamburg Coffee Imports GmbH",
        product: "Washed Sidama Specialty Green Coffee",
        contract_value: 85_000,
        incoterm: "fob",
        delivery_date: "2026-12-24",
        payment_method: "letter_of_credit",
        repayment_date: "2026-11-20",
      },
      computed: {},
    };
    expect(prefillFrom("m07-order-fulfilment-plan", m04)).toEqual({
      currency: "USD",
      exchange_rate: 56.5,
      rate_date: "2026-11-01",
      customer_name: "Hamburg Coffee Imports GmbH",
      product: "Washed Sidama Specialty Green Coffee",
      contract_value: 85_000,
      incoterm: "fob",
      contract_deadline: "2026-12-24",
      handover_date: "2026-12-24",
      financing_source: "letter_of_credit",
      m04_cash_milestone_date: "2026-11-20",
    });
  });
});
