import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detectPlatformFromUrl, getClearAppUrl, getPlatformAppUrl, getTradeAppUrl } from "../src/url";

describe("getClearAppUrl and getTradeAppUrl", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

  describe("getClearAppUrl", () => {
    it("returns configured URL and strips trailing slash", () => {
      process.env.CLEAR_APP_URL = "https://clear.entrust-africa.com///";
      expect(getClearAppUrl()).toBe("https://clear.entrust-africa.com");
    });

    it("falls back to http://localhost:3000 in development when unset", () => {
      delete process.env.CLEAR_APP_URL;
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_MODE;
      expect(getClearAppUrl()).toBe("http://localhost:3000");
    });

    it("throws in production when CLEAR_APP_URL is unset", () => {
      delete process.env.CLEAR_APP_URL;
      process.env.NODE_ENV = "production";
      expect(() => getClearAppUrl()).toThrow("CLEAR_APP_URL must be configured in production");
    });

    it("throws when EMAIL_MODE=send and CLEAR_APP_URL is unset", () => {
      delete process.env.CLEAR_APP_URL;
      process.env.NODE_ENV = "development";
      process.env.EMAIL_MODE = "send";
      expect(() => getClearAppUrl()).toThrow("CLEAR_APP_URL must be configured in production (or when EMAIL_MODE=send)");
    });

    it("throws in production when CLEAR_APP_URL points to localhost", () => {
      process.env.NODE_ENV = "production";
      process.env.CLEAR_APP_URL = "http://localhost:3000";
      expect(() => getClearAppUrl()).toThrow("CLEAR_APP_URL cannot point to localhost ('http://localhost:3000') in production.");
    });

    it("throws in production when CLEAR_APP_URL points to 127.0.0.1", () => {
      process.env.NODE_ENV = "production";
      process.env.CLEAR_APP_URL = "http://127.0.0.1:3000";
      expect(() => getClearAppUrl()).toThrow("CLEAR_APP_URL cannot point to localhost ('http://127.0.0.1:3000') in production.");
    });
  });

  describe("getTradeAppUrl", () => {
    it("returns configured URL and strips trailing slash", () => {
      process.env.TRADE_APP_URL = "https://trade.entrust-africa.com///";
      expect(getTradeAppUrl()).toBe("https://trade.entrust-africa.com");
    });

    it("falls back to http://localhost:3001 in development when unset", () => {
      delete process.env.TRADE_APP_URL;
      process.env.NODE_ENV = "development";
      delete process.env.EMAIL_MODE;
      expect(getTradeAppUrl()).toBe("http://localhost:3001");
    });

    it("throws in production when TRADE_APP_URL is unset", () => {
      delete process.env.TRADE_APP_URL;
      process.env.NODE_ENV = "production";
      expect(() => getTradeAppUrl()).toThrow("TRADE_APP_URL must be configured in production");
    });

    it("throws when EMAIL_MODE=send and TRADE_APP_URL is unset", () => {
      delete process.env.TRADE_APP_URL;
      process.env.NODE_ENV = "development";
      process.env.EMAIL_MODE = "send";
      expect(() => getTradeAppUrl()).toThrow("TRADE_APP_URL must be configured in production (or when EMAIL_MODE=send)");
    });

    it("throws in production when TRADE_APP_URL points to localhost", () => {
      process.env.NODE_ENV = "production";
      process.env.TRADE_APP_URL = "http://localhost:3001";
      expect(() => getTradeAppUrl()).toThrow("TRADE_APP_URL cannot point to localhost ('http://localhost:3001') in production.");
    });
  });

  describe("detectPlatformFromUrl", () => {
    it("detects trade from callbackURL pointing to localhost:3001", () => {
      process.env.TRADE_APP_URL = "http://localhost:3001";
      const resetUrl = "http://localhost:4000/reset-password/tok123?callbackURL=http%3A%2F%2Flocalhost%3A3001%2Freset-password";
      expect(detectPlatformFromUrl(resetUrl)).toBe("trade");
    });

    it("detects clear from callbackURL pointing to localhost:3000", () => {
      process.env.CLEAR_APP_URL = "http://localhost:3000";
      const resetUrl = "http://localhost:4000/reset-password/tok123?callbackURL=http%3A%2F%2Flocalhost%3A3000%2Freset-password";
      expect(detectPlatformFromUrl(resetUrl)).toBe("clear");
    });

    it("detects trade from trade subdomain", () => {
      const resetUrl = "http://localhost:4000/reset-password/tok123?callbackURL=https%3A%2F%2Ftrade.entrust-africa.com%2Freset-password";
      expect(detectPlatformFromUrl(resetUrl)).toBe("trade");
    });

    it("detects mizan from its subdomain or its dev port", () => {
      const resetUrl = "http://localhost:4000/reset-password/tok123?callbackURL=https%3A%2F%2Fmizan.entrust-africa.com%2Freset-password";
      expect(detectPlatformFromUrl(resetUrl)).toBe("mizan");
      expect(detectPlatformFromUrl("http://localhost:4000/verify?callbackURL=http%3A%2F%2Flocalhost%3A3003%2F")).toBe("mizan");
    });

    it("still detects trade in production when MIZAN_APP_URL isn't set", () => {
      const saved = { NODE_ENV: process.env.NODE_ENV, MIZAN_APP_URL: process.env.MIZAN_APP_URL, TRADE_APP_URL: process.env.TRADE_APP_URL };
      Object.assign(process.env, { NODE_ENV: "production", TRADE_APP_URL: "https://trade.entrust-africa.com" });
      delete process.env.MIZAN_APP_URL;
      try {
        const resetUrl = "https://api.entrust-africa.com/reset-password/t?callbackURL=https%3A%2F%2Ftrade.entrust-africa.com%2Freset-password";
        expect(detectPlatformFromUrl(resetUrl)).toBe("trade");
      } finally {
        for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    });

    it("falls back to clear for unrecognized URLs", () => {
      expect(detectPlatformFromUrl("invalid-url")).toBe("clear");
    });
  });
});
