import { describe, expect, it } from "vitest";
import { FACTS, RULE_PACKS, STEPS, compareVersions, findRulePack, latestRulePack, packChanges, validateRulePacks } from "../src";
import type { PackRequirement, RulePack } from "../src";

const catalogue = { steps: STEPS, facts: FACTS };
const pack = findRulePack("et-us-green-coffee", "0.4.0") as RulePack;

/** The pack with one requirement changed, for the validator to catch. */
const withRequirement = (code: string, change: Partial<PackRequirement>): RulePack => ({
  ...pack,
  requirements: pack.requirements.map((r) => (r.code === code ? { ...r, ...change } : r)),
});
const errorsFor = (...packs: RulePack[]) => validateRulePacks(packs, catalogue);

// The content of every published version. A case keeps the version it was opened with, so a
// published version must not change: put a correction in a new version instead. Add a line here
// when a version is published.
const PUBLISHED: Record<string, string> = {
  "et-us-green-coffee@0.4.0": "463105a6b68d60dc8e753ca3c0e035b2e592ccbfbd22b82fb0a808a222be97d3",
};

describe("rule packs", () => {
  it("all validate", () => {
    expect(errorsFor(...RULE_PACKS)).toEqual([]);
  });

  it("never change once published", async () => {
    const sha256 = async (text: string) =>
      [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    const hashes = Object.fromEntries(
      await Promise.all(RULE_PACKS.map(async (p) => [`${p.id}@${p.version}`, await sha256(JSON.stringify(p))])),
    );
    expect(hashes).toEqual(PUBLISHED);
  });

  it("never link to ECTA's compromised website", () => {
    const links = RULE_PACKS.flatMap((p) => p.requirements.flatMap((r) => r.sources.map((s) => s.url ?? "")));
    expect(links.filter((url) => /^https?:\/\/(www\.)?ethiocta\.gov\.et(\/|$)/.test(url))).toEqual([]);
  });

  it("picks the newest version for a case's product and destination", () => {
    const newer = { ...pack, version: "0.10.0" };
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(latestRulePack("green_coffee", "US")?.version).toBe("0.4.0");
    expect(latestRulePack("green_coffee", " us ")?.id).toBe("et-us-green-coffee");
    expect(latestRulePack("roasted_coffee", "US")).toBeUndefined();
    expect(latestRulePack("green_coffee", "DE")).toBeUndefined();
    expect(latestRulePack("green_coffee", undefined)).toBeUndefined();
    // Versions of one pack may cover the same corridor; two different packs may not.
    expect(errorsFor(pack, newer)).toEqual([]);
    expect(errorsFor(pack, { ...pack, id: "other-coffee" })).toEqual(["other-coffee and et-us-green-coffee both cover green_coffee to US"]);
  });

  it("says what a new version changes, by requirement code", () => {
    const next: RulePack = {
      ...pack,
      version: "0.5.0",
      requirements: [
        ...pack.requirements.filter((r) => r.code !== "REV-02").map((r) => (r.code === "USE-02" ? { ...r, description: "Changed." } : r)),
        { ...pack.requirements.at(-1)!, code: "REV-03" },
      ],
    };
    expect(packChanges(pack, next)).toEqual({ added: ["REV-03"], removed: ["REV-02"], changed: ["USE-02"] });
    expect(packChanges(pack, pack)).toEqual({ added: [], removed: [], changed: [] });
    expect(packChanges(undefined, pack).added).toHaveLength(pack.requirements.length);
  });
});

describe("rule pack validation", () => {
  it("refuses a requirement presented as law without an official source", () => {
    expect(errorsFor(withRequirement("USP-04", { sources: [] }))).toEqual([
      "et-us-green-coffee@0.4.0 USP-04: a confirmed requirement cites an official source with a link",
    ]);
    expect(errorsFor(withRequirement("USP-04", { sources: [{ title: "A conversation" }] }))).toHaveLength(1);
    expect(errorsFor(withRequirement("PHY-01", { appliesWhen: undefined }))).toEqual([
      "et-us-green-coffee@0.4.0 PHY-01: a conditional requirement says when it applies",
    ]);
  });

  it("keeps a requirement awaiting verification labelled as such", () => {
    const usp06 = pack.requirements.find((r) => r.code === "USP-06")!;
    expect(errorsFor(withRequirement("USP-06", { verification: { ...usp06.verification, status: "source_checked" } }))).toEqual([
      "et-us-green-coffee@0.4.0 USP-06: a requirement awaiting verification can't be shown as checked or verified",
    ]);
  });

  it("checks steps, facts, dates, order and the version number", () => {
    const at = "et-us-green-coffee@0.4.0";
    expect(errorsFor(withRequirement("USP-04", { steps: ["STEP-999"] }))).toContain(`${at} USP-04: unknown step STEP-999`);
    expect(errorsFor(withRequirement("USP-04", { steps: [] }))).toContain(`${at} USP-04: is on no step`);
    expect(errorsFor(withRequirement("USP-04", { steps: ["STEP-098"] }))).toContain(
      `${at} USP-04: is only on exception steps, so it would apply only once one is raised`,
    );
    expect(
      errorsFor(withRequirement("POR-01", { appliesWhen: { condition: { fact: "incoterm", in: ["EXW"] }, description: "EXW" } })),
    ).toEqual([`${at} POR-01: incoterm has no value "EXW"`]);
    const usp04 = pack.requirements.find((r) => r.code === "USP-04")!;
    expect(errorsFor(withRequirement("USP-04", { verification: { ...usp04.verification, checkedOn: "2099-01-01" } }))).toEqual([
      `${at} USP-04: checked after the pack's own check date`,
    ]);
    expect(errorsFor(withRequirement("USP-04", { steps: ["STEP-002"] }))).toContain(`${at}: USP-04 starts before USE-01, so it goes first`);
    expect(errorsFor({ ...pack, version: "1.0" })).toContain("et-us-green-coffee@1.0: the version is major.minor.patch");
    expect(errorsFor(pack, pack)).toContain(`${at}: published twice`);
  });
});
