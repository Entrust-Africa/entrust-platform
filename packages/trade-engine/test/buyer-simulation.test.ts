import { describe, expect, it } from "vitest";
import { BUYER_SIMULATION, isStepCorrect, simulationScore, type SimulationAnswer } from "../src/buyer-simulation";

const step = (id: string) => BUYER_SIMULATION.find((s) => s.id === id)!;
const right: Record<string, SimulationAnswer> = {
  corridor: "suits",
  market: "b",
  limits: ["demand", "worth"],
  qualify: { lakeside: "qualified", riftvalley: "conditional", eastland: "not" },
  next: "intro",
};

describe("the M05 buyer simulation", () => {
  it("walks from the product to a next step, with one right answer for each", () => {
    expect(BUYER_SIMULATION.map((s) => s.id)).toEqual(["corridor", "market", "limits", "qualify", "next"]);
    for (const s of BUYER_SIMULATION) {
      if (s.kind === "choice") expect(s.options.filter((o) => o.correct), s.id).toHaveLength(1);
      if (s.kind !== "classify") expect(s.options.every((o) => o.feedback.length > 0), s.id).toBe(true);
    }
    expect(simulationScore(right)).toEqual({ correct: 5, total: 5 });
  });

  it("doesn't reward the largest or the nearest market", () => {
    expect(isStepCorrect(step("market"), "a")).toBe(false);
    expect(isStepCorrect(step("market"), "d")).toBe(false);
  });

  it("wants every true statement and no false one", () => {
    expect(isStepCorrect(step("limits"), ["demand"])).toBe(false);
    expect(isStepCorrect(step("limits"), ["demand", "worth", "buyer"])).toBe(false);
    expect(isStepCorrect(step("limits"), ["worth", "demand"])).toBe(true);
  });

  it("wants every business classified correctly", () => {
    expect(isStepCorrect(step("qualify"), { lakeside: "qualified", riftvalley: "conditional" })).toBe(false);
    expect(isStepCorrect(step("qualify"), { lakeside: "qualified", riftvalley: "conditional", eastland: "qualified" })).toBe(false);
  });

  it("counts an unanswered step as not done", () => {
    expect(simulationScore({})).toEqual({ correct: 0, total: 5 });
    expect(isStepCorrect(step("next"), undefined)).toBe(false);
  });
});
