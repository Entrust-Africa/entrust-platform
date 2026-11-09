import { describe, expect, it } from "vitest";
import { assignPathway, monthsBefore } from "../src";
import type { PathwayInput } from "../src";
import { findTradeRules, type TradeRules } from "@entrust/trade-rules";
import { noShipment, rules, rules010 } from "./helpers";

const assign = (input: Partial<PathwayInput>) => assignPathway(rules, { ...noShipment, ...input });

describe("from 0.3.0, Entrust's rule", () => {
  const rules030 = findTradeRules("0.3.0") as TradeRules;
  const assign030 = (input: Partial<PathwayInput>) => assignPathway(rules030, { ...noShipment, ...input });

  it("puts any completed shipment on Pathway B, however old", () => {
    expect(assign030({ lastShipmentDate: "2012-03-01" })).toMatchObject({ pathway: "B", provisional: true, reasonCodes: ["PATHWAY_RECENT_SHIPMENT", "PATHWAY_SHIPMENT_UNVERIFIED"] });
    expect(assign030({ lastShipmentDate: "2012-03-01", shipmentVerified: true })).toMatchObject({ pathway: "B", provisional: false });
  });

  it("keeps Pathway A for no shipment, and for a first order that hasn't shipped", () => {
    expect(assign030({})).toMatchObject({ pathway: "A", provisional: false });
    expect(assign030({ liveOrder: true })).toMatchObject({ pathway: "A", reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT", "PATHWAY_ORDER_PRIORITY"] });
  });

  it("doesn't hold the plan for staff over a self-reported shipment", () => {
    expect(rules030.pathway?.selfReportedAccepted).toBe(true);
    expect(rules030.reasonCodes.find((r) => r.code === "PATHWAY_RECENT_SHIPMENT")?.text).not.toContain("two years");
  });
});

describe("an exporter who doesn't know the shipment date", () => {
  it("goes to staff on a provisional Pathway B, and isn't told it hasn't shipped", () => {
    const assigned = assign({ shipmentDateUnknown: true });
    expect(assigned).toMatchObject({ pathway: "B", provisional: true });
    expect(assigned.reasonCodes).toEqual(["PATHWAY_SHIPMENT_UNVERIFIED"]);
  });

  it("is confirmed once staff accept a record", () => {
    expect(assign({ shipmentDateUnknown: true, shipmentVerified: true })).toMatchObject({ pathway: "B", provisional: false });
  });
});

describe("assignPathway", () => {
  it("gives Pathway B for a verified shipment in the last 24 months", () => {
    expect(assign({ lastShipmentDate: "2025-06-01", shipmentVerified: true })).toEqual({
      rulesVersion: "0.2.0",
      pathway: "B",
      provisional: false,
      liveOrder: false,
      reasonCodes: ["PATHWAY_RECENT_SHIPMENT"],
    });
  });

  it("gives a provisional B for a shipment staff haven't accepted yet", () => {
    expect(assign({ lastShipmentDate: "2025-06-01", shipmentVerified: false })).toMatchObject({
      pathway: "B",
      provisional: true,
      reasonCodes: ["PATHWAY_RECENT_SHIPMENT", "PATHWAY_SHIPMENT_UNVERIFIED"],
    });
  });

  it("gives Pathway A to an SME that has never shipped", () => {
    expect(assign({})).toMatchObject({ pathway: "A", provisional: false, reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT"] });
    // Verified means nothing without a shipment.
    expect(assign({ shipmentVerified: true })).toMatchObject({ pathway: "A", provisional: false });
  });

  it("puts a shipment exactly 24 months before the submission on B, and a day earlier on A", () => {
    expect(assign({ asOf: "2026-11-19", lastShipmentDate: "2024-11-19", shipmentVerified: true }).pathway).toBe("B");
    expect(assign({ asOf: "2026-11-19", lastShipmentDate: "2024-11-18", shipmentVerified: true })).toMatchObject({
      pathway: "A",
      reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT"],
    });
    expect(assign({ asOf: "2026-11-19", lastShipmentDate: "2026-11-19", shipmentVerified: true }).pathway).toBe("B");
  });

  it("counts the 24 months from the last day of a short month", () => {
    expect(monthsBefore("2028-02-29", 24)).toBe("2026-02-28");
    expect(monthsBefore("2026-03-31", 1)).toBe("2026-02-28");
    expect(monthsBefore("2026-01-15", 2)).toBe("2025-11-15");
    expect(assign({ asOf: "2028-02-29", lastShipmentDate: "2026-02-28", shipmentVerified: true }).pathway).toBe("B");
    expect(assign({ asOf: "2028-02-29", lastShipmentDate: "2026-02-27", shipmentVerified: true }).pathway).toBe("A");
  });

  it("keeps a first-time exporter with a live order on A and says why", () => {
    expect(assign({ liveOrder: true })).toEqual({
      rulesVersion: "0.2.0",
      pathway: "A",
      provisional: false,
      liveOrder: true,
      reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT", "PATHWAY_ORDER_PRIORITY"],
    });
    // An experienced exporter with a live order is already on B.
    expect(assign({ liveOrder: true, lastShipmentDate: "2026-01-10", shipmentVerified: true }).reasonCodes).toEqual(["PATHWAY_RECENT_SHIPMENT"]);
  });

  it("refuses dates that aren't real or are in the wrong order", () => {
    expect(() => assign({ asOf: "19/11/2026" })).toThrow(/asOf must be a real date/);
    expect(() => assign({ asOf: "2026-02-30" })).toThrow(/asOf must be a real date/);
    expect(() => assign({ lastShipmentDate: "last year" })).toThrow(/lastShipmentDate must be a real date/);
    expect(() => assign({ lastShipmentDate: "2026-12-01" })).toThrow(/can't be after asOf/);
  });

  it("gives the same answer for the same input and records the rules version", () => {
    const input = { asOf: "2026-11-19", lastShipmentDate: "2025-01-01", shipmentVerified: true, liveOrder: false };
    expect(assignPathway(rules, input)).toEqual(assignPathway(rules, input));
    expect(() => assignPathway(rules010, input)).toThrow(/no pathway and plan rules/);
  });
});
