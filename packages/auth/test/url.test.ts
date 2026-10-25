import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getClearAppUrl } from "../src/url";

describe("getClearAppUrl", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
  });

  afterEach(() => {
    process.env = { ...envBackup };
  });

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
