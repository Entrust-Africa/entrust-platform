import { describe, expect, it, vi } from "vitest";
import {
  afriConnectBuyersUrl,
  afriConnectMarketIntelligenceUrl,
  afriConnectOAuthConfig,
  afriConnectSettings,
  fetchAfriConnectUser,
  provisionAfriConnectAccount,
} from "../src/africonnect";

const settings = { issuer: "https://idp.example.com/api/auth", clientId: "client-1", clientSecret: "secret-1" };

/** An unsigned JWT: these functions run after Better Auth has verified the ID token. */
const idToken = (sub: string) =>
  `${btoa(JSON.stringify({ alg: "none" }))}.${btoa(JSON.stringify({ sub }))}.`.replace(/=/g, "");

const respond = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

describe("AfriConnect settings", () => {
  it("are off without a client id and secret", () => {
    expect(afriConnectSettings({})).toBeNull();
    expect(afriConnectSettings({ AFRICONNECT_CLIENT_ID: "x" })).toBeNull();
  });

  it("default to the production issuer and trim a trailing slash", () => {
    expect(afriConnectSettings({ AFRICONNECT_CLIENT_ID: " a ", AFRICONNECT_CLIENT_SECRET: "b" })).toEqual({
      issuer: "https://www.africonnect.africa.com/api/auth",
      clientId: "a",
      clientSecret: "b",
    });
    expect(
      afriConnectSettings({ AFRICONNECT_CLIENT_ID: "a", AFRICONNECT_CLIENT_SECRET: "b", AFRICONNECT_ISSUER: "http://localhost:3000/api/auth/" })
        ?.issuer,
    ).toBe("http://localhost:3000/api/auth");
  });

  it("configure a verified-ID-token, PKCE, client-secret-basic OpenID provider", () => {
    const config = afriConnectOAuthConfig(settings);
    expect(config).toMatchObject({
      providerId: "africonnect",
      discoveryUrl: "https://idp.example.com/api/auth/.well-known/openid-configuration",
      authentication: "basic",
      pkce: true,
      requireIdTokenVerification: true,
      scopes: ["openid", "email", "profile"],
    });
  });
});

describe("reading the person from userinfo", () => {
  it("takes the name from userinfo, keyed on the ID token's subject", async () => {
    const fetchImpl = respond(200, { sub: "u1", email: "Ada@Example.com", email_verified: true, name: "Ada Lovelace" });
    const user = await fetchAfriConnectUser(settings, { accessToken: "at", idToken: idToken("u1") }, fetchImpl as never);
    expect(user).toEqual({ id: "u1", sub: "u1", email: "ada@example.com", emailVerified: true, name: "Ada Lovelace", image: undefined });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://idp.example.com/api/auth/oauth2/userinfo",
      expect.objectContaining({ headers: expect.objectContaining({ authorization: "Bearer at" }) }),
    );
  });

  it("falls back to given and family names", async () => {
    const fetchImpl = respond(200, { sub: "u1", email: "a@example.com", email_verified: true, given_name: "Ada", family_name: "L" });
    expect((await fetchAfriConnectUser(settings, { accessToken: "at", idToken: idToken("u1") }, fetchImpl as never))?.name).toBe("Ada L");
  });

  it("drops an address that is not verified, so no account is made or linked on it", async () => {
    const fetchImpl = respond(200, { sub: "u1", email: "a@example.com", email_verified: false, name: "A" });
    const user = await fetchAfriConnectUser(settings, { accessToken: "at", idToken: idToken("u1") }, fetchImpl as never);
    expect(user?.email).toBeUndefined();
    expect(user?.emailVerified).toBe(false);
  });

  it("refuses userinfo about another subject, a failed call, or missing tokens", async () => {
    expect(
      await fetchAfriConnectUser(settings, { accessToken: "at", idToken: idToken("u1") }, respond(200, { sub: "u2" }) as never),
    ).toBeNull();
    expect(await fetchAfriConnectUser(settings, { accessToken: "at", idToken: idToken("u1") }, respond(401, {}) as never)).toBeNull();
    expect(await fetchAfriConnectUser(settings, { idToken: idToken("u1") }, respond(200, { sub: "u1" }) as never)).toBeNull();
  });
});

describe("provisioning an account on AfriConnect", () => {
  it("authenticates as the client and returns the subject", async () => {
    const fetchImpl = respond(200, { sub: "u9", created: true });
    expect(await provisionAfriConnectAccount(settings, { email: "a@example.com", name: "A" }, fetchImpl as never)).toEqual({
      status: "linked",
      sub: "u9",
      created: true,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://idp.example.com/api/auth/product-sign-in/provision");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${btoa("client-1:secret-1")}`);
    expect(JSON.parse(String(init.body))).toEqual({ email: "a@example.com", name: "A" });
  });

  it("reports a conflict, and treats any other failure as unavailable", async () => {
    expect((await provisionAfriConnectAccount(settings, { email: "a@example.com" }, respond(409, {}) as never)).status).toBe("conflict");
    expect((await provisionAfriConnectAccount(settings, { email: "a@example.com" }, respond(403, {}) as never)).status).toBe("unavailable");
    expect((await provisionAfriConnectAccount(settings, { email: "a@example.com" }, respond(200, {}) as never)).status).toBe("unavailable");
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await provisionAfriConnectAccount(settings, { email: "a@example.com" }, down as never)).toEqual({
      status: "unavailable",
      reason: "fetch failed",
    });
  });
});

describe("the Meet buyers address", () => {
  it("points to Market Intelligence with Ethiopia chosen", () => {
    expect(afriConnectMarketIntelligenceUrl({})).toBe("https://www.africonnect.africa.com/export-potential?exporter=ETH");
    expect(afriConnectMarketIntelligenceUrl({ AFRICONNECT_ISSUER: "https://afri.example/api/auth" })).toBe("https://afri.example/export-potential?exporter=ETH");
    expect(afriConnectMarketIntelligenceUrl({ AFRICONNECT_ISSUER: "not a url" })).toBe("https://www.africonnect.africa.com/export-potential?exporter=ETH");
  });

  it("is AfriConnect's marketplace on the production site by default", () => {
    expect(afriConnectBuyersUrl({})).toBe("https://www.africonnect.africa.com/marketplace");
  });

  it("follows the issuer's site when one is set", () => {
    expect(afriConnectBuyersUrl({ AFRICONNECT_ISSUER: "http://localhost:3000/api/auth" })).toBe("http://localhost:3000/marketplace");
  });

  it("can be set outright, and an address that is not http(s) is ignored", () => {
    expect(afriConnectBuyersUrl({ AFRICONNECT_BUYERS_URL: " https://staging.example.com/buyers " })).toBe("https://staging.example.com/buyers");
    expect(afriConnectBuyersUrl({ AFRICONNECT_BUYERS_URL: "javascript:alert(1)" })).toBe("https://www.africonnect.africa.com/marketplace");
    expect(afriConnectBuyersUrl({ AFRICONNECT_BUYERS_URL: "not a url", AFRICONNECT_ISSUER: "also not" })).toBe(
      "https://www.africonnect.africa.com/marketplace",
    );
  });
});
