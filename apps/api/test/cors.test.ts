import { beforeAll, describe, expect, it } from "vitest";

// Who the API answers with credentials. The apps' own addresses count, so adding a new app needs no edit to
// CORS_ORIGINS. The settings are read when the app is imported, so set them first.
let app: typeof import("../src/app").app;

beforeAll(async () => {
  process.env.CORS_ORIGINS = "https://listed.example.test";
  process.env.CLEAR_APP_URL = "https://clear.example.test/";
  process.env.TRADE_APP_URL = "https://trade.example.test";
  ({ app } = await import("../src/app"));
});

const preflight = async (origin: string) => {
  const res = await app.request("/v1/health", {
    method: "OPTIONS",
    headers: { origin, "access-control-request-method": "GET" },
  });
  return res.headers.get("access-control-allow-origin");
};

describe("cross-origin access", () => {
  it("answers the TRADE and CLEAR apps and the listed origins", async () => {
    expect(await preflight("https://trade.example.test")).toBe("https://trade.example.test");
    expect(await preflight("https://clear.example.test")).toBe("https://clear.example.test");
    expect(await preflight("https://listed.example.test")).toBe("https://listed.example.test");
  });

  it("does not answer an origin nobody listed", async () => {
    expect(await preflight("https://elsewhere.example.test")).toBeNull();
  });
});
