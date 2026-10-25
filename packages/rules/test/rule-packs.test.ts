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
  "et-eu-coffee@0.1.0": "18478f98c129a3f8ed34d103aa59e2bb27b935a0c43a21c237b125f2cdf208eb",
  "et-tr-spices@0.1.0": "7b22d1ad22675fc1103fe8fabc3849cf295eb85726efb045c32cd0311a97655f",
  "et-us-spices@0.1.0": "13fd93cf74dc4c1bc95774066abcbb466beceb8cae8ecb1e9a8b21c16cf7c901",
  "et-eu-avocado@0.1.0": "b277c1fa4a813d10a1dacd28337c5cd985b1878022dd2047ce15e7f9ae92b925",
  "et-gcc-avocado@0.1.0": "600d267f3fcbe772677ffdb5123f3b85413e90fd7c65fb6a2ae7c0964445a29e",
  "et-us-processed-food@0.1.0": "e3f91eb2041dcb62d3203a986249322f8ffcd6d9bd0e7e6c02fbe27edf58db2d",
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
    expect(latestRulePack("green_coffee", "JP")).toBeUndefined();
    expect(latestRulePack("green_coffee", undefined)).toBeUndefined();
    // Versions of one pack may cover the same corridor; two different packs may not.
    expect(errorsFor(pack, newer)).toEqual([]);
    expect(errorsFor(pack, { ...pack, id: "other-coffee" })).toEqual(["other-coffee and et-us-green-coffee both cover green_coffee to US"]);
  });

  it("cover the launch corridors", () => {
    const covering = (product: string, destination: string) => latestRulePack(product, destination)?.id;
    expect(covering("green_coffee", "US")).toBe("et-us-green-coffee");
    expect(covering("green_coffee", "DE")).toBe("et-eu-coffee");
    expect(covering("roasted_coffee", "FR")).toBe("et-eu-coffee");
    expect(covering("oilseeds_spices", "TR")).toBe("et-tr-spices");
    expect(covering("oilseeds_spices", "US")).toBe("et-us-spices");
    expect(covering("fresh_produce", "NL")).toBe("et-eu-avocado");
    expect(["SA", "AE", "QA", "KW", "BH", "OM"].map((c) => covering("fresh_produce", c))).toEqual(Array(6).fill("et-gcc-avocado"));
    expect(covering("processed_food", "US")).toBe("et-us-processed-food");
    expect(covering("fresh_produce", "US")).toBeUndefined();
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

  it("refuses a requirement that can't apply to any case the pack covers", () => {
    const at = "et-us-green-coffee@0.4.0";
    // STEP-041 is the EU's check, and this pack covers the US.
    expect(errorsFor(withRequirement("USP-02", { steps: ["STEP-041"] }))).toContain(`${at} USP-02: never applies to a case this pack covers`);
    const toTurkey = { condition: { fact: "destinationCountry" as const, in: ["TR"] }, description: "the destination is Türkiye" };
    expect(errorsFor(withRequirement("USP-04", { appliesWhen: toTurkey }))).toEqual([`${at} USP-04: never applies to a case this pack covers`]);
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
    expect(errorsFor(withRequirement("USP-04", { jurisdiction: "GCC" }))).toEqual([]);
    expect(errorsFor(withRequirement("USP-04", { jurisdiction: "Gulf" }))).toEqual([`${at} USP-04: jurisdiction Gulf is not an ISO country code`]);
    expect(errorsFor(pack, pack)).toContain(`${at}: published twice`);
  });
});
