import { describe, expect, it } from "vitest";
import { employeeRange, isPassportId, normalisePassportId, passportStanding } from "../src/passport";

describe("passport numbers", () => {
  it("accepts the printed form and tidies case and spaces", () => {
    expect(isPassportId("EA-ETH-0002")).toBe(true);
    expect(normalisePassportId("  ea-eth-0002 ")).toBe("EA-ETH-0002");
    expect(isPassportId("ea-eth-0002")).toBe(true);
  });
  it("rejects anything else", () => {
    for (const bad of ["EA-ET-0002", "EA-ETH-2", "ETH-0002", "EA-ETH-00021", ""]) expect(isPassportId(bad)).toBe(false);
  });
});

describe("standing", () => {
  const day = (iso: string) => new Date(`${iso}T09:00:00Z`);
  it("is active up to and including the last valid day", () => {
    expect(passportStanding("active", "2027-11-13", day("2027-11-13"))).toBe("active");
    expect(passportStanding("active", "2027-11-13", day("2027-11-14"))).toBe("expired");
  });
  it("keeps a suspended or revoked passport that way", () => {
    expect(passportStanding("revoked", "2027-11-13", day("2026-11-13"))).toBe("revoked");
    expect(passportStanding("suspended", "2020-01-01", day("2026-11-13"))).toBe("suspended");
  });
});

describe("employee range", () => {
  it("adds permanent and temporary staff", () => {
    expect(employeeRange(8, 3)).toBe("11–20");
    expect(employeeRange(5, null)).toBe("1–5");
    expect(employeeRange(null, 40)).toBe("21–50");
    expect(employeeRange(250, 1)).toBe("251+");
    expect(employeeRange(0, 0)).toBe("No employees");
  });
  it("says nothing when the business gave no figure", () => {
    expect(employeeRange(null, null)).toBeNull();
    expect(employeeRange(undefined, undefined)).toBeNull();
  });
});
