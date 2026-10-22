import { describe, expect, it } from "vitest";
import { EVIDENCE_TYPES, FACTS, MASTER_CONTROLS, PHASES, STEPS, validateSteps } from "../src";
import type { StepDefinition } from "../src";

const catalogue = { phases: PHASES, facts: FACTS, evidenceTypes: EVIDENCE_TYPES, masterControls: MASTER_CONTROLS };

describe("canonical steps", () => {
  it("encodes STEP-001 to STEP-125 exactly once", () => {
    const ids = STEPS.map((s) => s.id).sort();
    const expected = Array.from({ length: 125 }, (_, i) => `STEP-${String(i + 1).padStart(3, "0")}`);
    expect(ids).toEqual(expected);
  });

  it("passes validation", () => {
    expect(validateSteps(STEPS, catalogue)).toEqual([]);
  });

  it("puts every step in exactly one phase, inside that phase's range", () => {
    for (const phase of PHASES) {
      const inPhase = STEPS.filter((s) => s.phase === phase.id).map((s) => s.id);
      expect(inPhase).toContain(phase.firstStep);
      expect(inPhase).toContain(phase.lastStep);
    }
    expect(STEPS.every((s) => PHASES.some((p) => p.id === s.phase))).toBe(true);
  });

  it("has no prerequisite pointing at a missing or later step", () => {
    const seen = new Set<string>();
    for (const step of STEPS) {
      for (const prerequisite of step.prerequisites) expect(seen, `${step.id} needs ${prerequisite}`).toContain(prerequisite);
      seen.add(step.id);
    }
  });

  it("ends every phase with its milestone step", () => {
    for (const phase of PHASES) {
      const inPhase = STEPS.filter((s) => s.phase === phase.id);
      expect(inPhase.at(-1)?.id).toBe(phase.lastStep);
      expect(inPhase.at(-1)?.milestone).toBe(true);
    }
  });

  it("loads after the cargo is on board, and files the ISF before loading", () => {
    const order = STEPS.map((s) => s.id);
    expect(order.indexOf("STEP-104")).toBeLessThan(order.indexOf("STEP-094"));
    expect(order.indexOf("STEP-097")).toBeLessThan(order.indexOf("STEP-104"));
    expect(STEPS.find((s) => s.id === "STEP-104")?.prerequisites).toContain("STEP-097");
  });

  it("never names NBE as the issuer of an export permit", () => {
    const permitSteps = ["STEP-046", "STEP-047", "STEP-048", "STEP-121"];
    for (const id of permitSteps) {
      const step = STEPS.find((s) => s.id === id);
      expect(step?.name).not.toMatch(/NBE/);
      expect(step?.owner).not.toBe("authority");
    }
  });

  it("says why wherever a step differs from the spec", () => {
    const changed = STEPS.filter((s) => s.specName || s.specClass);
    expect(changed.filter((s) => !s.correction).map((s) => s.id)).toEqual([]);
  });

  it("rejects a step that uses a fact before the step that establishes it", () => {
    const broken: StepDefinition[] = STEPS.map((s) => (s.id === "STEP-083" ? { ...s, prerequisites: ["STEP-080"] } : s));
    expect(validateSteps(broken, catalogue)).toContain(
      "STEP-083: uses customsChannel, which is only known after STEP-082, but does not wait on it",
    );
  });

  it("chains the milestones so gates lock in order", () => {
    const milestones = STEPS.filter((s) => s.milestone);
    milestones.slice(1).forEach((m, i) => expect(m.prerequisites).toEqual([milestones[i]?.id]));
  });

  it("rejects a prerequisite that comes later", () => {
    const broken: StepDefinition[] = STEPS.map((s) =>
      s.id === "STEP-002" ? { ...s, prerequisites: ["STEP-003"] } : s,
    );
    expect(validateSteps(broken, catalogue)).toContain("STEP-002: prerequisite STEP-003 comes later in the sequence");
  });
});

describe("evidence types", () => {
  it("have unique ids and are all used by a step", () => {
    const ids = EVIDENCE_TYPES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const used = new Set(STEPS.flatMap((s) => s.evidence.map((e) => e.type)));
    expect(ids.filter((id) => !used.has(id))).toEqual([]);
  });

  it("require a human reviewer for physical certificates, permits and release notes", () => {
    const physical = [
      "phytosanitary_certificate",
      "quality_certificate",
      "health_certificate",
      "certificate_of_origin",
      "bank_export_permit",
      "customs_release_note",
      "permit_discharge",
    ];
    for (const id of physical) expect(EVIDENCE_TYPES.find((e) => e.id === id)?.humanReviewRequired, id).toBe(true);
  });
});

describe("master controls", () => {
  it("map every pilot checkpoint stage S01 to S14", () => {
    const stages = new Set(MASTER_CONTROLS.flatMap((m) => m.checkpointStages));
    for (let i = 1; i <= 14; i++) expect(stages).toContain(`S${String(i).padStart(2, "0")}`);
  });

  it("are each used by at least one step", () => {
    const used = new Set(STEPS.map((s) => s.masterControl));
    for (const m of MASTER_CONTROLS) expect(used, m.id).toContain(m.id);
  });
});
