import { describe, expect, it } from "vitest";
import { formatTradeDateTime, parseTradeLocalDateTime, toTradeLocalDateTime, tradeToday } from "../src/time";

describe("TRADE's time zone", () => {
  it("reads a typed session time as Addis Ababa time, not UTC", () => {
    // 10:00 in Addis is 07:00 UTC. Read as UTC it would be stored as 10:00Z, 13:00 in Addis.
    expect(parseTradeLocalDateTime("2026-11-18T10:00")!.toISOString()).toBe("2026-11-18T07:00:00.000Z");
    expect(parseTradeLocalDateTime("2026-11-18T10:00:30")!.toISOString()).toBe("2026-11-18T07:00:30.000Z");
    expect(parseTradeLocalDateTime("2026-11-18")).toBeNull();
    expect(parseTradeLocalDateTime("not a time")).toBeNull();
  });

  it("shows a stored time back in the form as it was typed", () => {
    expect(toTradeLocalDateTime(new Date("2026-11-18T07:00:00Z"))).toBe("2026-11-18T10:00");
    expect(toTradeLocalDateTime(parseTradeLocalDateTime("2026-12-31T23:30")!)).toBe("2026-12-31T23:30");
  });

  it("knows it's already tomorrow in Addis between 21:00 and midnight UTC", () => {
    expect(tradeToday(new Date("2026-11-18T22:30:00Z"))).toBe("2026-11-19");
    expect(tradeToday(new Date("2026-11-18T20:59:00Z"))).toBe("2026-11-18");
  });

  it("writes a time the way a person reads it", () => {
    expect(formatTradeDateTime(new Date("2026-11-18T07:00:00Z"))).toBe("Wednesday 18 November 2026 at 10:00 (Addis Ababa time)");
  });
});
