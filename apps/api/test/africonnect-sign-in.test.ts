import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { SignJWT, exportJWK, generateKeyPair, type JWK } from "jose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Signing in to Entrust with an AfriConnect account, end to end through the real API and Better Auth, against a fake
// AfriConnect that answers the way the real one does (discovery, signed ID tokens with the nonce, userinfo, and the
// provisioning route). The real provider is covered on its side, in AfriConnect's productSignIn.test.ts.

const IDP = vi.hoisted(() => {
  process.env.AFRICONNECT_CLIENT_ID = "entrust-test-client";
  process.env.AFRICONNECT_CLIENT_SECRET = "entrust-test-secret";
  process.env.AFRICONNECT_ISSUER = "https://idp.test/api/auth";
  const state = {
    issuer: "https://idp.test/api/auth",
    jwk: null as unknown as JWK,
    privateKey: null as unknown as CryptoKey,
    /** Codes the fake provider issued, with who signed in and the nonce to put in the ID token. */
    codes: new Map<string, { sub: string; nonce: string | null; userinfo: Record<string, unknown> }>(),
    tokens: new Map<string, Record<string, unknown>>(),
    provisioned: [] as Array<{ email: string; name?: string }>,
    provisionReply: null as null | { status: number; body: unknown },
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== "https://idp.test") return realFetch(input, init);
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const basicOk = headers.get("authorization") === `Basic ${btoa("entrust-test-client:entrust-test-secret")}`;
    switch (url.pathname) {
      case "/api/auth/.well-known/openid-configuration":
        return json(200, {
          issuer: state.issuer,
          authorization_endpoint: `${state.issuer}/oauth2/authorize`,
          token_endpoint: `${state.issuer}/oauth2/token`,
          userinfo_endpoint: `${state.issuer}/oauth2/userinfo`,
          jwks_uri: `${state.issuer}/jwks`,
          id_token_signing_alg_values_supported: ["RS256"],
          response_types_supported: ["code"],
          code_challenge_methods_supported: ["S256"],
        });
      case "/api/auth/jwks":
        return json(200, { keys: [state.jwk] });
      case "/api/auth/oauth2/token": {
        if (!basicOk) return json(401, { error: "invalid_client" });
        const body = new URLSearchParams(String(init?.body ?? ""));
        const issued = state.codes.get(body.get("code") ?? "");
        if (!issued || !body.get("code_verifier")) return json(400, { error: "invalid_grant" });
        state.codes.delete(body.get("code")!);
        const accessToken = randomUUID();
        state.tokens.set(accessToken, issued.userinfo);
        const now = Math.floor(Date.now() / 1000);
        const idToken = await new SignJWT({ ...(issued.nonce ? { nonce: issued.nonce } : {}) })
          .setProtectedHeader({ alg: "RS256", kid: "k1" })
          .setIssuer(state.issuer)
          .setAudience("entrust-test-client")
          .setSubject(issued.sub)
          .setIssuedAt(now)
          .setExpirationTime(now + 3600)
          .sign(state.privateKey);
        return json(200, { access_token: accessToken, id_token: idToken, token_type: "Bearer", expires_in: 3600, scope: "openid email profile" });
      }
      case "/api/auth/oauth2/userinfo": {
        const info = state.tokens.get(headers.get("authorization")?.replace(/^Bearer /, "") ?? "");
        return info ? json(200, info) : json(401, { error: "invalid_token" });
      }
      case "/api/auth/product-sign-in/provision": {
        if (!basicOk) return json(401, { error: "invalid_client" });
        const body = JSON.parse(String(init?.body)) as { email: string; name?: string };
        state.provisioned.push(body);
        if (state.provisionReply) return json(state.provisionReply.status, state.provisionReply.body);
        return json(200, { sub: `sub-${body.email}`, created: true });
      }
    }
    return json(404, {});
  }) as typeof fetch;
  return state;
});

const { auth, ensureAfriConnectAccount, afriConnectSignIn } = await import("@entrust/auth");
const { schema } = await import("@entrust/db");
const { app } = await import("../src/app");
const { PREFIX, cleanup, db } = await import("./support");

const TRADE = "http://localhost:3001";
const email = (name: string) => `${PREFIX}ac-${Math.random().toString(36).slice(2, 8)}-${name}@example.test`;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  IDP.privateKey = privateKey;
  IDP.jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
});

beforeEach(() => {
  IDP.provisioned.length = 0;
  IDP.provisionReply = null;
});

afterAll(async () => {
  await db.delete(schema.user).where(like(schema.user.email, `${PREFIX}ac-%`));
  await cleanup();
});

function cookiesOf(response: Response, jar = new Map<string, string>()) {
  for (const cookie of response.headers.getSetCookie()) {
    const [pair] = cookie.split(";");
    const [name, ...value] = pair!.split("=");
    jar.set(name!, value.join("="));
  }
  return jar;
}
const header = (jar: Map<string, string>) => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

/**
 * Press "Continue" on TRADE's sign-in page, let the fake AfriConnect sign the person in, and follow the callback.
 * Returns where the API sends the browser, and the cookies it holds by then.
 */
async function signInThroughAfriConnect(person: { sub: string; userinfo: Record<string, unknown> }, loginHint?: string) {
  const start = await app.fetch(
    new Request("http://localhost:4000/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json", origin: TRADE },
      body: JSON.stringify({
        provider: "africonnect",
        callbackURL: `${TRADE}/`,
        errorCallbackURL: `${TRADE}/sign-in`,
        loginHint,
        additionalParams: { product: "trade" },
      }),
    }),
  );
  expect(start.status).toBe(200);
  const jar = cookiesOf(start);
  const authorize = new URL(((await start.json()) as { url: string }).url);
  expect(`${authorize.origin}${authorize.pathname}`).toBe("https://idp.test/api/auth/oauth2/authorize");

  const code = randomUUID();
  IDP.codes.set(code, { sub: person.sub, nonce: authorize.searchParams.get("nonce"), userinfo: { sub: person.sub, ...person.userinfo } });
  const callback = await app.fetch(
    new Request(
      `${authorize.searchParams.get("redirect_uri")}?${new URLSearchParams({ code, state: authorize.searchParams.get("state")!, iss: IDP.issuer })}`,
      { headers: { cookie: header(jar) } },
    ),
  );
  cookiesOf(callback, jar);
  return { authorize, status: callback.status, location: callback.headers.get("location") ?? "", cookie: header(jar) };
}

async function sessionUser(cookie: string) {
  const res = await app.fetch(new Request("http://localhost:4000/api/auth/get-session", { headers: { cookie, origin: TRADE } }));
  return ((await res.json()) as { user?: { id: string; email: string; name: string; emailVerified: boolean } } | null)?.user ?? null;
}

async function localUser(address: string, verified: boolean) {
  const ctx = await auth.$context;
  return ctx.internalAdapter.createUser({ email: address, name: "Local Person", emailVerified: verified }, { method: "admin" });
}

describe("signing in to Entrust with AfriConnect", () => {
  it("is switched on by the client settings", () => {
    expect(afriConnectSignIn).toBe(true);
  });

  it("sends the person to AfriConnect with PKCE, a nonce, their email and the product", async () => {
    const { authorize } = await signInThroughAfriConnect({ sub: randomUUID(), userinfo: {} }, "ada@example.com");
    const params = authorize.searchParams;
    expect(params.get("client_id")).toBe("entrust-test-client");
    expect(params.get("redirect_uri")).toBe("http://localhost:4000/api/auth/callback/africonnect");
    expect(params.get("scope")?.split(" ").sort()).toEqual(["email", "openid", "profile"]);
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("nonce")).toBeTruthy();
    expect(params.get("login_hint")).toBe("ada@example.com");
    expect(params.get("product")).toBe("trade");
  });

  it("a new person gets an Entrust account, named from userinfo, keyed on the subject", async () => {
    const address = email("new");
    const sub = randomUUID();
    const result = await signInThroughAfriConnect({ sub, userinfo: { email: address, email_verified: true, name: "Ada Lovelace" } });
    expect(result.status).toBe(302);
    expect(result.location).toBe(`${TRADE}/`);
    const user = await sessionUser(result.cookie);
    expect(user).toMatchObject({ email: address, name: "Ada Lovelace", emailVerified: true });
    const accounts = await db.select().from(schema.account).where(eq(schema.account.userId, user!.id));
    expect(accounts.map((a) => [a.providerId, a.accountId])).toEqual([["africonnect", sub]]);

    // The same subject later, even with another address on AfriConnect, is the same Entrust person.
    const again = await signInThroughAfriConnect({ sub, userinfo: { email: email("changed"), email_verified: true, name: "Ada" } });
    expect((await sessionUser(again.cookie))?.id).toBe(user!.id);
  });

  it("links an existing, verified Entrust account by email", async () => {
    const address = email("existing");
    const local = await localUser(address, true);
    const result = await signInThroughAfriConnect({ sub: randomUUID(), userinfo: { email: address, email_verified: true, name: "Someone Else" } });
    const user = await sessionUser(result.cookie);
    expect(user?.id).toBe(local.id);
    // Entrust's own name for them stays.
    expect(user?.name).toBe("Local Person");
  });

  it("refuses to link an Entrust account whose email was never verified", async () => {
    const address = email("unverified");
    await localUser(address, false);
    const result = await signInThroughAfriConnect({ sub: randomUUID(), userinfo: { email: address, email_verified: true, name: "X" } });
    const location = new URL(result.location);
    expect(`${location.origin}${location.pathname}`).toBe(`${TRADE}/sign-in`);
    expect(location.searchParams.get("error")).toBe("account_not_linked");
    expect(await sessionUser(result.cookie)).toBeNull();
  });

  it("refuses a person with no verified email on AfriConnect", async () => {
    for (const userinfo of [{ name: "Phone Only" }, { email: email("nv"), email_verified: false, name: "Not Verified" }]) {
      const result = await signInThroughAfriConnect({ sub: randomUUID(), userinfo });
      expect(new URL(result.location).searchParams.get("error")).toBe("email_not_found");
    }
  });

  it("refuses an ID token handed over directly, which would skip PKCE, state and the nonce", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ email: email("direct"), email_verified: true })
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(IDP.issuer)
      .setAudience("entrust-test-client")
      .setSubject(randomUUID())
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .sign(IDP.privateKey);
    const res = await app.fetch(
      new Request("http://localhost:4000/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json", origin: TRADE },
        body: JSON.stringify({ provider: "africonnect", idToken: { token, accessToken: "anything" } }),
      }),
    );
    expect(res.status).toBe(400);
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token"))).toBe(false);
  });

  it("signing out stays on Entrust: no trip to AfriConnect's end-session page", async () => {
    const result = await signInThroughAfriConnect({
      sub: randomUUID(),
      userinfo: { email: email("signout"), email_verified: true, name: "Sign Out" },
    });
    const res = await app.fetch(
      new Request("http://localhost:4000/api/auth/sign-out", {
        method: "POST",
        headers: { "content-type": "application/json", origin: TRADE, cookie: result.cookie },
        body: "{}",
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(((await res.json()) as { url?: string }).url).toBeUndefined();
  });

  it("no longer creates Entrust passwords", async () => {
    const res = await app.fetch(
      new Request("http://localhost:4000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: TRADE },
        body: JSON.stringify({ email: email("pw"), password: "correct-horse-battery", name: "PW" }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("making the accounts when Entrust has verified an email", () => {
  it("creates the Entrust account tied to the AfriConnect subject, and sign-in later finds it", async () => {
    const address = email("provisioned");
    const result = await ensureAfriConnectAccount({ email: address.toUpperCase() });
    expect(result).toMatchObject({ status: "linked", created: true });
    expect(IDP.provisioned).toEqual([{ email: address }]);
    const userId = (result as { userId: string }).userId;
    const [user] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
    expect(user).toMatchObject({ email: address, emailVerified: true });

    expect(await ensureAfriConnectAccount({ email: address })).toEqual({ status: "linked", userId, created: false });
    expect(IDP.provisioned).toHaveLength(1);

    expect(user!.name).toBe("");
    const signIn = await signInThroughAfriConnect({
      sub: `sub-${address}`,
      userinfo: { email: address, email_verified: true, name: "Chose A Name" },
    });
    const signedIn = await sessionUser(signIn.cookie);
    expect(signedIn?.id).toBe(userId);
    // The name they gave AfriConnect fills the empty one; a name Entrust already has is kept (see the linking test).
    const [named] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
    expect(named!.name).toBe("Chose A Name");
  });

  it("ties an existing verified Entrust account to AfriConnect", async () => {
    const address = email("tie");
    const local = await localUser(address, true);
    expect(await ensureAfriConnectAccount({ email: address })).toEqual({ status: "linked", userId: local.id, created: false });
    const accounts = await db.select().from(schema.account).where(eq(schema.account.userId, local.id));
    expect(accounts.map((a) => a.accountId)).toEqual([`sub-${address}`]);
  });

  it("leaves an unverified Entrust account alone, without asking AfriConnect", async () => {
    const address = email("squat");
    await localUser(address, false);
    expect((await ensureAfriConnectAccount({ email: address })).status).toBe("conflict");
    expect(IDP.provisioned).toHaveLength(0);
  });

  it("passes on AfriConnect's conflict and outages without making anything", async () => {
    for (const reply of [
      { status: 409, body: { code: "UNVERIFIED_ACCOUNT" } },
      { status: 500, body: {} },
    ]) {
      IDP.provisionReply = reply;
      const address = email(`reply-${reply.status}`);
      const result = await ensureAfriConnectAccount({ email: address });
      expect(result.status).toBe(reply.status === 409 ? "conflict" : "unavailable");
      expect(await db.select().from(schema.user).where(eq(schema.user.email, address))).toHaveLength(0);
    }
  });

  it("refuses when the subject already belongs to another Entrust user", async () => {
    const first = email("owner");
    const second = email("other");
    const owner = await localUser(first, true);
    await localUser(second, true);
    const ctx = await auth.$context;
    await ctx.internalAdapter.linkAccount({ userId: owner.id, providerId: "africonnect", accountId: `sub-${second}` });
    expect((await ensureAfriConnectAccount({ email: second })).status).toBe("conflict");
  });
});
