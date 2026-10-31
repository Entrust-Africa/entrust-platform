import { NOT_KNOWN } from "@entrust/forms";
import { describe, expect, it } from "vitest";
import { applicationPathway, applicationSeeksInvestment, screenEligibility } from "../src";
import type { EligibilityException, ScreeningInput } from "../src";
import { application, draftRules, template } from "./helpers";

const screen = (answers = application(), input: Partial<ScreeningInput> = {}) =>
  screenEligibility(draftRules, template, answers, { documents: ["registration_certificate"], ...input });
const result = (r: ReturnType<typeof screen>, id: string) => r.criteria.find((c) => c.id === id)?.result;
const exception = (criterion: EligibilityException["criterion"], reason = "Registration is under way", by = "admin-1"): EligibilityException => ({ criterion, reason, by });

describe("eligibility screening", () => {
  it("finds a complete application eligible", () => {
    const r = screen();
    expect(r).toMatchObject({ rulesVersion: "0.1.0", outcome: "eligible", status: "eligible", missingDocuments: [] });
    expect(r.criteria.map((c) => c.result)).toEqual(["met", "met", "met", "met", "met", "met"]);
  });

  it("goes through the six requirements of the specification, in order", () => {
    expect(screen().criteria.map((c) => c.id)).toEqual(["registered", "operating", "representative", "offering", "declaration", "documents"]);
    expect(screen().criteria[0]?.text).toBe("The business is registered or has an accepted legal operating status in its country.");
  });

  describe("an ineligible applicant", () => {
    it("is not registered and has no accepted legal status", () => {
      const r = screen(application({ "S1.4": "not_registered" }));
      expect(r).toMatchObject({ outcome: "ineligible", status: "ineligible" });
      expect(result(r, "registered")).toBe("not_met");
    });

    it("accepts an accepted legal operating status in place of a registration", () => {
      expect(screen(application({ "S1.4": "accepted_legal_status" })).outcome).toBe("eligible");
    });

    it("isn't operating and has no venture ready to launch", () => {
      expect(result(screen(application({ "S2.8": "not_operating" })), "operating")).toBe("not_met");
      expect(screen(application({ "S2.8": "not_operating" })).outcome).toBe("ineligible");
      expect(screen(application({ "S2.8": "ready_to_launch" })).outcome).toBe("eligible");
    });

    it("isn't an authorized representative", () => {
      expect(result(screen(application({ "S1.14": "no" })), "representative")).toBe("not_met");
    });

    it("can't say what it sells", () => {
      expect(result(screen(application({ "S2.2": NOT_KNOWN })), "offering")).toBe("not_met");
    });

    it("doesn't accept the declaration or the data-use terms", () => {
      expect(result(screen(application({ "S9.2": "no" })), "declaration")).toBe("not_met");
    });

    it("wins over a requirement still unclear", () => {
      expect(screen(application({ "S1.4": "not_registered" }), { documents: [] }).outcome).toBe("ineligible");
    });
  });

  describe("pending clarification", () => {
    it("is what an application with a missing document gets, and it maps to awaiting additional information", () => {
      const r = screen(application(), { documents: [] });
      expect(r).toMatchObject({ outcome: "pending_clarification", status: "awaiting_additional_information", missingDocuments: ["registration_certificate"] });
      expect(result(r, "documents")).toBe("unclear");
      expect(r.criteria.find((c) => c.id === "documents")?.reason).toBe("Missing: registration certificate.");
    });

    it("ignores documents that aren't a kind the Summit knows", () => {
      expect(screen(application(), { documents: ["passport"] }).missingDocuments).toEqual(["registration_certificate"]);
    });

    it("is what an unanswered requirement gets", () => {
      const answers = application();
      const { "S1.4": _, ...rest } = answers as Record<string, unknown>;
      const r = screen(rest as typeof answers);
      expect(result(r, "registered")).toBe("unclear");
      expect(r.outcome).toBe("pending_clarification");
    });

    it("can't know the required documents without a pathway", () => {
      const { "S2.12": _, ...rest } = application() as Record<string, unknown>;
      expect(result(screen(rest as ReturnType<typeof application>), "documents")).toBe("unclear");
    });
  });

  describe("exceptions", () => {
    it("let an administrator accept a failed requirement, with the reason on record", () => {
      const e = exception("registered");
      const r = screen(application({ "S1.4": "not_registered" }), { exceptions: [e] });
      expect(r).toMatchObject({ outcome: "eligible", status: "eligible" });
      expect(r.criteria.find((c) => c.id === "registered")).toMatchObject({ result: "excepted", exception: e });
    });

    it("let an administrator accept a missing document", () => {
      expect(screen(application(), { documents: [], exceptions: [exception("documents", "Certificate is being reissued")] }).outcome).toBe("eligible");
    });

    it("don't change a requirement that is met", () => {
      const r = screen(application(), { exceptions: [exception("registered")] });
      expect(result(r, "registered")).toBe("met");
      expect(r.criteria.find((c) => c.id === "registered")?.exception).toBeUndefined();
    });

    it("cover only the requirement they name", () => {
      const r = screen(application({ "S1.4": "not_registered", "S1.14": "no" }), { exceptions: [exception("registered")] });
      expect(r.outcome).toBe("ineligible");
    });

    it("need a reason, an administrator and a known requirement, once each", () => {
      expect(() => screen(application(), { exceptions: [exception("registered", "  ")] })).toThrow("needs a reason");
      expect(() => screen(application(), { exceptions: [exception("registered", "Reason", "")] })).toThrow("administrator");
      expect(() => screen(application(), { exceptions: [exception("passport" as never)] })).toThrow('Unknown requirement "passport"');
      expect(() => screen(application(), { exceptions: [exception("registered"), exception("registered")] })).toThrow("Two exceptions");
    });
  });

  it("gives no commercial score: eligibility and scoring stay separate", () => {
    const r = screen(application({ "S1.4": "not_registered" }));
    expect(r.outcome).toBe("ineligible");
    expect(r).not.toHaveProperty("total");
    expect(r).not.toHaveProperty("points");
  });

  it("ignores the answer to a question that isn't shown", () => {
    // Everything is answered, but a registration number for an unregistered business isn't asked.
    expect(screen(application({ "S1.4": "not_registered", "S1.5": "123" })).outcome).toBe("ineligible");
  });

  it("gives the same answer for the same application", () => {
    expect(screen()).toEqual(screen());
  });
});

describe("what an application says about its pathway", () => {
  it("names the pathway, or none", () => {
    expect(applicationPathway(template, application({ "S2.12": "investment" }))).toBe("investment");
    expect(applicationPathway(template, {})).toBeUndefined();
    expect(applicationPathway(template, { "S2.12": "barter" })).toBeUndefined();
  });

  it("seeks investment on the investment and combined pathways, or when a trade or partnership applicant says so", () => {
    expect(applicationSeeksInvestment(template, application({ "S2.12": "investment" }))).toBe(true);
    expect(applicationSeeksInvestment(template, application({ "S2.12": "combined_trade_and_investment" }))).toBe(true);
    expect(applicationSeeksInvestment(template, application({ "S2.12": "trade_and_market_access", "S4.1": "yes" }))).toBe(true);
    expect(applicationSeeksInvestment(template, application({ "S2.12": "strategic_partnership", "S4.1": "no" }))).toBe(false);
    expect(applicationSeeksInvestment(template, application({ "S2.12": "trade_and_market_access", "S4.1": NOT_KNOWN }))).toBe(false);
  });
});
