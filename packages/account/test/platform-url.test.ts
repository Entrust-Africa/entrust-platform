import { describe, expect, it } from "vitest";
import { platformUrl } from "../src/platform-url";

const at = (url: string) => {
  const { protocol, hostname, port } = new URL(url);
  return { protocol, hostname, port };
};

describe("platformUrl", () => {
  it("stays on the page for the platform the visitor is already on", () => {
    expect(platformUrl({ platform: "trade", current: "trade", location: at("https://trade.entrust-africa.com") })).toBe("/");
  });

  it("goes to the sibling on the same domain when nothing is configured (the deployed case that used to land on localhost)", () => {
    expect(platformUrl({ platform: "clear", current: "trade", location: at("https://trade.entrust-africa.com/cohorts") })).toBe(
      "https://clear.entrust-africa.com",
    );
    expect(platformUrl({ platform: "trade", current: "clear", location: at("https://clear.entrust-africa.com") })).toBe(
      "https://trade.entrust-africa.com",
    );
  });

  it("keeps a port on a sibling host", () => {
    expect(platformUrl({ platform: "clear", current: "trade", location: at("http://trade.localhost:8080") })).toBe(
      "http://clear.localhost:8080",
    );
  });

  it("prefers an address the app passed in, then the deployment's setting, over the one it works out", () => {
    const location = at("https://trade.entrust-africa.com");
    expect(platformUrl({ platform: "clear", current: "trade", explicit: "https://explicit.example", configured: "https://set.example", location })).toBe(
      "https://explicit.example",
    );
    expect(platformUrl({ platform: "clear", current: "trade", configured: "https://set.example///", location })).toBe("https://set.example");
  });

  it("ignores a setting that is empty", () => {
    expect(platformUrl({ platform: "clear", current: "trade", configured: "  ", location: at("https://trade.entrust-africa.com") })).toBe(
      "https://clear.entrust-africa.com",
    );
  });

  it("uses the other dev port on a developer's machine", () => {
    expect(platformUrl({ platform: "clear", current: "trade", location: at("http://localhost:3001") })).toBe("http://localhost:3000");
    expect(platformUrl({ platform: "trade", current: "clear", location: at("http://localhost:3000") })).toBe("http://localhost:3001");
  });

  it("stays on the page when it is already on that platform's dev port", () => {
    expect(platformUrl({ platform: "clear", current: "trade", location: at("http://localhost:3000") })).toBe("/");
  });

  it("falls back to localhost only when it cannot tell where it is (the server render)", () => {
    expect(platformUrl({ platform: "clear", current: "trade" })).toBe("http://localhost:3000");
  });
});
