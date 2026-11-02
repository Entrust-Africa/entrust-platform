import { describe, expect, it } from "vitest";
import {
  ENTRUST_ROLES,
  ORGANIZATION_KINDS,
  PLATFORMS,
  SME_ROLES,
} from "../src/index";

describe("@entrust/roles", () => {
  it("defines organisation kinds including sme, entrust, sponsor", () => {
    expect(ORGANIZATION_KINDS).toEqual(["sme", "entrust", "sponsor"]);
  });

  it("defines SME roles", () => {
    expect(SME_ROLES).toEqual(["owner", "member"]);
  });

  it("defines Entrust staff roles", () => {
    expect(ENTRUST_ROLES).toEqual(["admin", "facilitator", "reviewer"]);
  });

  it("defines shared platforms", () => {
    expect(PLATFORMS).toEqual(["clear", "trade", "summit", "mizan"]);
  });
});
