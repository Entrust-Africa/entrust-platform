import { NOT_KNOWN } from "@entrust/forms";
import type { Answers } from "@entrust/forms";
import { latestDiagnosticTemplate } from "@entrust/trade-rules";
import { describe, expect, it } from "vitest";
import { assignPathwayFromDiagnostic, pathwayInputFromDiagnostic } from "../src";
import { rules } from "./helpers";

const template = latestDiagnosticTemplate();
const asOf = "2026-11-19";

/** Answers that matter to the pathway: no export, no order, whatever else the form asks left out. */
const diagnostic = (answers: Answers = {}): Answers => ({ Q132: "no", Q135: "no", Q139: "no", ...answers });
const assign = (answers: Answers, shipmentVerified = false) => assignPathwayFromDiagnostic(rules, template, diagnostic(answers), { asOf, shipmentVerified });

describe("the pathway from the onboarding diagnostic", () => {
  it("gives Pathway B for a shipment in the last 24 months, provisional until staff accept it", () => {
    expect(assign({ Q135: "yes", Q137: "2025-06-01" })).toEqual({
      rulesVersion: "0.2.0",
      pathway: "B",
      provisional: true,
      liveOrder: false,
      reasonCodes: ["PATHWAY_RECENT_SHIPMENT", "PATHWAY_SHIPMENT_UNVERIFIED"],
    });
    expect(assign({ Q135: "yes", Q137: "2025-06-01" }, true)).toMatchObject({ pathway: "B", provisional: false, reasonCodes: ["PATHWAY_RECENT_SHIPMENT"] });
  });

  it("counts 24 months back to the day", () => {
    expect(assign({ Q135: "yes", Q137: "2024-11-19" }).pathway).toBe("B");
    expect(assign({ Q135: "yes", Q137: "2024-11-18" }).pathway).toBe("A");
  });

  it("puts a former exporter whose last shipment is older on Pathway A", () => {
    expect(assign({ Q135: "yes", Q137: "2023-03-10" })).toMatchObject({ pathway: "A", provisional: false, reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT"] });
  });

  it("puts everyone who hasn't shipped on Pathway A", () => {
    expect(assign({})).toMatchObject({ pathway: "A", reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT"] });
    expect(assign({ Q135: NOT_KNOWN })).toMatchObject({ pathway: "A" });
  });

  it("puts an exporter who doesn't know the date on Pathway A", () => {
    expect(assign({ Q135: "yes", Q137: NOT_KNOWN })).toMatchObject({ pathway: "A" });
    expect(assign({ Q135: "yes" })).toMatchObject({ pathway: "A" });
  });

  it("ignores a date left behind after Q135 changed to no", () => {
    expect(assign({ Q135: "no", Q137: "2026-01-01" })).toMatchObject({ pathway: "A", provisional: false });
  });

  describe("live orders", () => {
    it("flag a first-time exporter, who stays on Pathway A", () => {
      for (const id of ["Q132", "Q139"]) {
        expect(assign({ [id]: "yes" })).toEqual({
          rulesVersion: "0.2.0",
          pathway: "A",
          provisional: false,
          liveOrder: true,
          reasonCodes: ["PATHWAY_NO_RECENT_SHIPMENT", "PATHWAY_ORDER_PRIORITY"],
        });
      }
    });

    it("don't change an experienced exporter's pathway", () => {
      expect(assign({ Q135: "yes", Q137: "2026-02-01", Q132: "yes" })).toMatchObject({ pathway: "B", liveOrder: true });
    });

    it("aren't assumed from 'not known'", () => {
      expect(assign({ Q132: NOT_KNOWN, Q139: NOT_KNOWN })).toMatchObject({ liveOrder: false });
    });

    it("aren't read from a confirmed buyer alone", () => {
      expect(assign({ Q138: "yes" })).toMatchObject({ liveOrder: false });
    });
  });

  it("reads the input the rule takes", () => {
    expect(pathwayInputFromDiagnostic(template, diagnostic({ Q135: "yes", Q137: "2025-06-01", Q139: "yes" }), { asOf })).toEqual({
      asOf,
      lastShipmentDate: "2025-06-01",
      shipmentVerified: false,
      liveOrder: true,
    });
  });

  it("gives the same answer for the same diagnostic", () => {
    const answers = diagnostic({ Q135: "yes", Q137: "2025-06-01" });
    expect(assignPathwayFromDiagnostic(rules, template, answers, { asOf })).toEqual(assignPathwayFromDiagnostic(rules, template, answers, { asOf }));
  });

  it("throws on a shipment after the submission date, which the form check rejects first", () => {
    expect(() => assign({ Q135: "yes", Q137: "2026-12-01" })).toThrow(RangeError);
  });
});
