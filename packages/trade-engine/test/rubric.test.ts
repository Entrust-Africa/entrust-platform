import { describe, expect, it } from "vitest";
import { evaluateRubric, type RubricDef } from "../src/rubric";

const testRubric12: RubricDef = {
  criteria: [
    { id: "market", title: "Target Market", maxPoints: 4, mustHave: true },
    { id: "buyer", title: "Buyer Profile", maxPoints: 4, mustHave: true },
    { id: "compliance", title: "Compliance", maxPoints: 4, mustHave: false },
  ],
  passMark: 8,
  mustHaveMinimum: 2,
  bands: [
    { label: "Critical", from: 0 },
    { label: "Developing", from: 40 },
    { label: "Functional", from: 67 },
    { label: "Demonstrated", from: 85 },
  ],
  criticalFailures: [
    { id: "no-license", text: "No export license" },
  ],
};

const testRubric36: RubricDef = {
  criteria: [
    { id: "c1", title: "C1", maxPoints: 6, mustHave: true },
    { id: "c2", title: "C2", maxPoints: 6, mustHave: true },
    { id: "c3", title: "C3", maxPoints: 6, mustHave: true },
    { id: "c4", title: "C4", maxPoints: 6, mustHave: false },
    { id: "c5", title: "C5", maxPoints: 6, mustHave: false },
    { id: "c6", title: "C6", maxPoints: 6, mustHave: false },
  ],
  passMark: 24,
  mustHaveMinimum: 2,
  bands: [
    { label: "Critical", from: 0 },
    { label: "Developing", from: 40 },
    { label: "Functional", from: 67 },
    { label: "Demonstrated", from: 85 },
  ],
  criticalFailures: [
    { id: "cf1", text: "Critical failure 1" },
  ],
};

describe("evaluateRubric (#67)", () => {
  it("passes a 12-point rubric at 8 points with no critical failures and must-haves met", () => {
    const res = evaluateRubric(testRubric12, {
      market: { points: 3 },
      buyer: { points: 3 },
      compliance: { points: 2 },
    });

    expect(res.totalPoints).toBe(8);
    expect(res.maxPoints).toBe(12);
    expect(res.percentage).toBe(67);
    expect(res.band).toBe("Functional");
    expect(res.mustHavePassed).toBe(true);
    expect(res.hasCriticalFailure).toBe(false);
    expect(res.passed).toBe(true);
    expect(res.outcome).toBe("passed");
  });

  it("fails a 12-point rubric below pass mark (7 points)", () => {
    const res = evaluateRubric(testRubric12, {
      market: { points: 3 },
      buyer: { points: 2 },
      compliance: { points: 2 },
    });

    expect(res.totalPoints).toBe(7);
    expect(res.percentage).toBe(58);
    expect(res.band).toBe("Developing");
    expect(res.passed).toBe(false);
    expect(res.outcome).toBe("revision_required");
  });

  it("fails a submission whatever its total if a critical failure is confirmed", () => {
    // 12/12 points (100%), but critical failure confirmed
    const res = evaluateRubric(
      testRubric12,
      {
        market: { points: 4 },
        buyer: { points: 4 },
        compliance: { points: 4 },
      },
      ["no-license"]
    );

    expect(res.totalPoints).toBe(12);
    expect(res.percentage).toBe(100);
    expect(res.band).toBe("Demonstrated");
    expect(res.hasCriticalFailure).toBe(true);
    expect(res.passed).toBe(false);
    expect(res.outcome).toBe("revision_required");
  });

  it("fails if a must-have criterion scores below mustHaveMinimum even with total points >= passMark", () => {
    // Total is 9 (>= 8 passMark), but market is 1 (< 2 minimum)
    const res = evaluateRubric(testRubric12, {
      market: { points: 1 },
      buyer: { points: 4 },
      compliance: { points: 4 },
    });

    expect(res.totalPoints).toBe(9);
    expect(res.mustHavePassed).toBe(false);
    expect(res.passed).toBe(false);
    expect(res.outcome).toBe("revision_required");
  });

  it("evaluates a 36-point rubric accurately at and below the 24-point threshold", () => {
    const passRes = evaluateRubric(testRubric36, {
      c1: { points: 4 },
      c2: { points: 4 },
      c3: { points: 4 },
      c4: { points: 4 },
      c5: { points: 4 },
      c6: { points: 4 },
    });
    expect(passRes.totalPoints).toBe(24);
    expect(passRes.maxPoints).toBe(36);
    expect(passRes.percentage).toBe(67);
    expect(passRes.band).toBe("Functional");
    expect(passRes.passed).toBe(true);

    const failRes = evaluateRubric(testRubric36, {
      c1: { points: 4 },
      c2: { points: 4 },
      c3: { points: 4 },
      c4: { points: 4 },
      c5: { points: 4 },
      c6: { points: 3 },
    });
    expect(failRes.totalPoints).toBe(23);
    expect(failRes.percentage).toBe(64);
    expect(failRes.band).toBe("Developing");
    expect(failRes.passed).toBe(false);
  });
});
