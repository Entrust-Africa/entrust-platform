import { describe, expect, it } from "vitest";
import {
  ENTRUST_ROLES,
  ORGANIZATION_KINDS,
  PLATFORMS,
  SME_ROLES,
  MIZAN_ACTIONS,
  mizanActionsFor,
  mizanCan,
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

describe("MIZAN permissions (#223)", () => {
  const staff = (staffRole: string | null, quality = false) => ({ staffRole, quality });

  it("lets an admin do everything and an Assessor everything but support relationships and the audit trail", () => {
    expect(mizanActionsFor(staff("admin"))).toEqual([...MIZAN_ACTIONS]);
    expect(mizanActionsFor(staff("reviewer"))).toEqual(["read_smes", "manage_smes", "assess", "review", "read_reports", "read_dashboard"]);
  });

  it("keeps cohort managers out, because they train the SMEs MIZAN assesses", () => {
    expect(mizanActionsFor(staff("facilitator"))).toEqual([]);
  });

  it("lets Quality read and change nothing", () => {
    expect(mizanActionsFor(staff(null, true))).toEqual(["read_smes", "read_reports", "read_dashboard", "read_audit"]);
  });

  it("gives nobody outside the Entrust organisation anything", () => {
    expect(mizanActionsFor(staff(null))).toEqual([]);
    expect(mizanCan(staff("owner"), "read_reports")).toBe(false);
    expect(mizanCan(staff("sponsor_admin"), "read_smes")).toBe(false);
  });
});
