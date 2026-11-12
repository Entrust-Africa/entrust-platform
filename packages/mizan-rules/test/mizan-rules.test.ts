import { describe, expect, it } from "vitest";
import {
  CURRENT_MIZAN_CONFIG_VERSION,
  MIZAN_CONFIGS,
  allCriteria,
  canonicalJson,
  configFingerprint,
  currentMizanConfig,
  findCriterion,
  findMizanConfig,
  getMizanConfig,
  sha256Hex,
  validateMizanConfigs,
} from "../src";
import type { Criterion, MizanConfig } from "../src";

const cfg = getMizanConfig("0.2.1-interim");

// The fingerprint of every published configuration. Every assessment stores the version and fingerprint it was scored under, so
// a published configuration must not change: put a change in a new version instead. Add a line here when a version is published.
const PUBLISHED: Record<string, string> = {
  "0.2.1-interim": "a5c40c6be7b0d0d4cee83e39a1f4639ed89a9ed4a2c1864d20d016f591d0376d",
};

/** The configuration with one criterion changed, for the validator to catch. */
const withCriterion = (id: string, change: Partial<Criterion>): MizanConfig => ({
  ...cfg,
  dimensions: cfg.dimensions.map((d) => ({ ...d, criteria: d.criteria.map((c) => (c.id === id ? { ...c, ...change } : c)) })),
});
const errorsFor = (...configs: MizanConfig[]) => validateMizanConfigs(configs);

describe("published configurations", () => {
  it("all validate", () => {
    expect(errorsFor(...MIZAN_CONFIGS)).toEqual([]);
  });

  it("never change once published", async () => {
    const fingerprints = Object.fromEntries(await Promise.all(MIZAN_CONFIGS.map(async (c) => [c.version, await configFingerprint(c)])));
    expect(fingerprints).toEqual(PUBLISHED);
  });

  it("finds a version and the current one", () => {
    expect(findMizanConfig("0.2.1-interim")).toBe(cfg);
    expect(findMizanConfig("9.9.9")).toBeUndefined();
    expect(() => getMizanConfig("9.9.9")).toThrow("Unknown MIZAN configuration version: 9.9.9");
    expect(currentMizanConfig().version).toBe(CURRENT_MIZAN_CONFIG_VERSION);
  });
});

describe("configuration 0.2.1-interim", () => {
  it("has 4 pillars, 10 dimensions and 31 criteria, weighted 45/20/15/20 by pillar", () => {
    expect(cfg.pillars.map((p) => [p.id, p.area])).toEqual([
      ["P1", "financial"],
      ["P2", "operational"],
      ["P3", "commercial"],
      ["P4", "governance"],
    ]);
    expect(cfg.dimensions.map((d) => d.weight)).toEqual([10, 10, 15, 10, 10, 10, 10, 5, 5, 15]);
    const byPillar = (p: string) => cfg.dimensions.filter((d) => d.pillar === p).reduce((a, d) => a + d.weight, 0);
    expect(["P1", "P2", "P3", "P4"].map(byPillar)).toEqual([45, 20, 15, 20]);
    expect(allCriteria(cfg)).toHaveLength(31);
    expect(findCriterion(cfg, "D3.2")?.dimension.id).toBe("D3");
  });

  it("suggests debt-to-equity and customer concentration with lower values rating higher", () => {
    expect(findCriterion(cfg, "D4.1")?.criterion.suggestion).toEqual({
      direction: "lower_is_better",
      bands: [
        { atMost: null, rating: 1 },
        { atMost: 3, rating: 2 },
        { atMost: 2, rating: 3 },
        { atMost: 1, rating: 4 },
      ],
    });
    expect(findCriterion(cfg, "D4.1")?.criterion.ratingWhenNegativeEquity).toBe(0);
    expect(findCriterion(cfg, "D3.2")?.criterion.suggestion?.direction).toBe("higher_is_better");
  });

  it("is issued to the SME, says it is not validated, and never says bankable", () => {
    expect(cfg.clientIssue).toBe(true);
    expect(cfg.status).toContain("not yet independently validated");
    expect(JSON.stringify(cfg).toLowerCase()).not.toContain("bankable");
    expect(JSON.stringify(cfg)).not.toMatch(/\bC[1-5]\b/);
  });
});

describe("validator", () => {
  it("catches weights that don't add up to 100", () => {
    const changed = { ...cfg, dimensions: cfg.dimensions.map((d, i) => (i === 0 ? { ...d, weight: 11 } : d)) };
    expect(errorsFor(changed)).toContain("0.2.1-interim: dimension weights add up to 101, not 100");
  });

  it("catches missing anchors, a quantitative criterion with no ratio and an out-of-place id", () => {
    expect(errorsFor(withCriterion("D1.2", { anchors: ["a", "b", "c", "d", ""] }))).toContain("0.2.1-interim: D1.2: needs five written anchors, 0 to 4");
    const { ratio: _ratio, suggestion: _s, ...noRatio } = findCriterion(cfg, "D2.1")!.criterion;
    const changed = { ...cfg, dimensions: cfg.dimensions.map((d) => ({ ...d, criteria: d.criteria.map((c) => (c.id === "D2.1" ? noRatio : c)) })) };
    expect(errorsFor(changed)).toContain("0.2.1-interim: D2.1: a quantitative criterion needs a ratio");
    expect(errorsFor(withCriterion("D2.1", { id: "D9.9" }))).toContain("0.2.1-interim: criterion D9.9 sits in dimension D2");
    expect(errorsFor(withCriterion("D2.2", { id: "D2.1" }))).toContain("0.2.1-interim: criterion D2.1 appears twice");
  });

  it("catches suggestion bands in the wrong order", () => {
    const rising = withCriterion("D3.2", {
      suggestion: { direction: "higher_is_better", bands: [{ atLeast: null, rating: 0 }, { atLeast: 1.5, rating: 1 }, { atLeast: 1.1, rating: 2 }] },
    });
    expect(errorsFor(rising)).toContain("0.2.1-interim: D3.2: suggestion limits must rise as the rating rises");
    const falling = withCriterion("D4.1", {
      suggestion: { direction: "lower_is_better", bands: [{ atMost: null, rating: 1 }, { atMost: 1, rating: 2 }, { atMost: 3, rating: 3 }] },
    });
    expect(errorsFor(falling)).toContain("0.2.1-interim: D4.1: suggestion limits must fall as the rating rises");
    const twoFloors = withCriterion("D3.2", {
      suggestion: { direction: "higher_is_better", bands: [{ atLeast: null, rating: 0 }, { atLeast: null, rating: 1 }] },
    });
    expect(errorsFor(twoFloors)).toContain("0.2.1-interim: D3.2: only the first (lowest) suggestion band has no limit");
  });

  it("catches levels, caps and grades that don't line up", () => {
    const levels = cfg.levels.map((l) => (l.level === 4 ? { ...l, minScore: 85 } : l));
    expect(errorsFor({ ...cfg, levels })).toContain("0.2.1-interim: each higher level needs a higher minimum score, between 0 and 100");
    const overrides = cfg.overrides.map((o, i) => (i === 0 ? { ...o, capLevel: 7 } : o));
    expect(errorsFor({ ...cfg, overrides })).toContain("0.2.1-interim: override O1 caps at level 7, which doesn't exist");
    const confidenceGrades = [...cfg.thresholds.confidenceGrades].reverse();
    expect(errorsFor({ ...cfg, thresholds: { ...cfg.thresholds, confidenceGrades } })).toContain(
      "0.2.1-interim: confidence grades go from the highest minimum down to 0",
    );
  });

  it("catches a version published twice or written wrongly", () => {
    expect(errorsFor(cfg, cfg)).toContain("0.2.1-interim: published twice");
    expect(errorsFor({ ...cfg, version: "0.3" })).toContain("0.3: the version is major.minor.patch, with an optional -label");
    expect(errorsFor({ ...cfg, version: "0.3.0" })).toEqual([]);
  });
});

describe("fingerprints", () => {
  it("hash the standard SHA-256 test vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("don't depend on key order, and leave out undefined properties", () => {
    expect(canonicalJson({ b: 1, a: { d: [1, "x", null], c: true } })).toBe('{"a":{"c":true,"d":[1,"x",null]},"b":1}');
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it("refuse numbers JSON can't hold", () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow("NaN cannot be written as JSON");
    expect(() => canonicalJson([Infinity])).toThrow();
  });

  it("change when any weight changes", async () => {
    const changed = { ...cfg, dimensions: cfg.dimensions.map((d, i) => (i === 0 ? { ...d, weight: 11 } : d)) };
    expect(await configFingerprint(changed)).not.toBe(await configFingerprint(cfg));
    expect(await configFingerprint(structuredClone(cfg))).toBe(await configFingerprint(cfg));
  });
});
