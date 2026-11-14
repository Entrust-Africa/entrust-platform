import type { GenericOAuthConfig } from "better-auth/plugins";
import { decodeJwt } from "jose";

/**
 * Signing in with an AfriConnect account (OpenID Connect).
 *
 * AfriConnect holds the credentials: a person types their email and password,
 * or an emailed code, only on AfriConnect's sign-in page, which it shows in the
 * product's own colours. Entrust keeps its own user record, organisations and
 * platform access; AfriConnect only says who the person is. A person is keyed
 * on the token's `sub`. An existing Entrust account is linked by email only
 * when AfriConnect says the address is verified and the Entrust account's
 * address is verified too (Better Auth's account-linking defaults).
 *
 * Switched on by AFRICONNECT_CLIENT_ID and AFRICONNECT_CLIENT_SECRET, issued by
 * AfriConnect's `idp:registerClient`. AFRICONNECT_ISSUER defaults to
 * production. The API's callback is `${BETTER_AUTH_URL}/api/auth/callback/africonnect`.
 */

export const AFRICONNECT_PROVIDER_ID = "africonnect";

const DEFAULT_ISSUER = "https://www.africonnect.africa.com/api/auth";

export interface AfriConnectSettings {
  issuer: string;
  clientId: string;
  clientSecret: string;
}

/** The provider's settings, or null when this deployment does not use it. */
export function afriConnectSettings(
  env: Record<string, string | undefined> = process.env,
): AfriConnectSettings | null {
  const clientId = env.AFRICONNECT_CLIENT_ID?.trim();
  const clientSecret = env.AFRICONNECT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const issuer = (env.AFRICONNECT_ISSUER?.trim() || DEFAULT_ISSUER).replace(/\/+$/, "");
  return { issuer, clientId, clientSecret };
}

/** AfriConnect's userinfo response, as far as Entrust reads it. */
interface AfriConnectUserInfo {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  picture?: unknown;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/**
 * The person, from AfriConnect's userinfo endpoint.
 *
 * Better Auth's default reads the ID token alone when it carries an email, but
 * AfriConnect's ID token has no name (profile claims come from userinfo, as
 * OpenID Connect allows for the code flow), so this always asks userinfo. The
 * ID token has already been verified (signature, issuer, audience, nonce)
 * before this runs; userinfo must describe the same subject.
 *
 * An address that is not verified is dropped, so Better Auth refuses the
 * sign-in with `email_not_found` rather than create or link an account on it.
 * AfriConnect leaves such addresses out anyway; this does not rely on that.
 */
export async function fetchAfriConnectUser(
  settings: AfriConnectSettings,
  tokens: { accessToken?: string; idToken?: string },
  fetchImpl: typeof fetch = fetch,
) {
  if (!tokens.accessToken || !tokens.idToken) return null;
  const idSubject = decodeJwt(tokens.idToken).sub;
  const response = await fetchImpl(`${settings.issuer}/oauth2/userinfo`, {
    headers: { authorization: `Bearer ${tokens.accessToken}`, accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const info = (await response.json().catch(() => null)) as AfriConnectUserInfo | null;
  const sub = text(info?.sub);
  if (!info || !sub || sub !== idSubject) return null;
  const verified = info.email_verified === true;
  const email = verified ? text(info.email)?.toLowerCase() : undefined;
  const name =
    text(info.name) ?? ([text(info.given_name), text(info.family_name)].filter(Boolean).join(" ") || undefined);
  return {
    id: sub,
    sub,
    email,
    emailVerified: verified && Boolean(email),
    name: name ?? "",
    image: text(info.picture),
  };
}

/**
 * The `genericOAuth` entry for AfriConnect. `onPerson` sees each person AfriConnect describes, before the sign-in
 * completes (Entrust uses it to fill in a name it does not have yet).
 */
export function afriConnectOAuthConfig(
  settings: AfriConnectSettings,
  onPerson?: (person: { sub: string; name: string }) => Promise<void>,
): GenericOAuthConfig {
  return {
    providerId: AFRICONNECT_PROVIDER_ID,
    name: "AfriConnect",
    discoveryUrl: `${settings.issuer}/.well-known/openid-configuration`,
    clientId: settings.clientId,
    clientSecret: settings.clientSecret,
    authentication: "basic",
    scopes: ["openid", "email", "profile"],
    pkce: true,
    // Without a verified ID token there is no sign-in: a discovery failure
    // skips the provider (and retries on the next request) instead.
    requireIdTokenVerification: true,
    getUserInfo: async (tokens) => {
      const person = await fetchAfriConnectUser(settings, tokens);
      if (person && onPerson) {
        await onPerson({ sub: person.sub, name: person.name }).catch((error) =>
          console.error("[auth] Could not use the name AfriConnect gave", error),
        );
      }
      return person;
    },
    // Entrust's own name and email for the person, once set, are theirs to keep.
    overrideUserInfo: false,
    // Signing out of Entrust signs out of Entrust only. AfriConnect's end-session page doesn't yet work as a browser
    // redirect through its web proxy, and no post-logout address is registered (see its SHARED_IDENTITY.md).
    disableProviderLogout: true,
  };
}

export type ProvisionResult =
  | { status: "linked"; sub: string; created: boolean }
  | { status: "conflict" }
  | { status: "unavailable"; reason: string };

/**
 * Ask AfriConnect, server to server, for an account for an address Entrust has
 * verified itself, and return its subject. Never signs anyone in or sets a
 * password; the person chooses one the first time they sign in. `conflict`
 * means AfriConnect has an account for the address whose address it never
 * verified: it is left for the person to link by signing in.
 */
export async function provisionAfriConnectAccount(
  settings: AfriConnectSettings,
  person: { email: string; name?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ProvisionResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${settings.issuer}/product-sign-in/provision`, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${encodeURIComponent(settings.clientId)}:${encodeURIComponent(settings.clientSecret)}`)}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ email: person.email, ...(person.name ? { name: person.name } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return { status: "unavailable", reason: error instanceof Error ? error.message : "request failed" };
  }
  if (response.status === 409) return { status: "conflict" };
  const body = (await response.json().catch(() => null)) as { sub?: unknown; created?: unknown } | null;
  if (!response.ok || typeof body?.sub !== "string" || !body.sub) {
    return { status: "unavailable", reason: `AfriConnect answered ${response.status}` };
  }
  return { status: "linked", sub: body.sub, created: body.created === true };
}

/**
 * Whether a platform app (CLEAR, TRADE) offers AfriConnect sign-in, from AFRICONNECT_SIGN_IN=on in that app's
 * settings. Read per request on the server. Turn it on only once the API has its AfriConnect client settings.
 */
export function afriConnectSignInShown(env: Record<string, string | undefined> = process.env): boolean {
  return env.AFRICONNECT_SIGN_IN?.trim().toLowerCase() === "on";
}

/**
 * Where "Meet buyers" sends someone: AfriConnect's marketplace, on the same site as the issuer. Set
 * AFRICONNECT_BUYERS_URL in a platform app's settings to point elsewhere (a staging AfriConnect, or another page).
 * Read per request on the server; anything that is not an http(s) address is ignored.
 */
export function afriConnectBuyersUrl(env: Record<string, string | undefined> = process.env): string {
  const web = (value: string | undefined) => {
    try {
      const url = new URL(value?.trim() ?? "");
      return url.protocol === "https:" || url.protocol === "http:" ? url : null;
    } catch {
      return null;
    }
  };
  const chosen = web(env.AFRICONNECT_BUYERS_URL);
  if (chosen) return chosen.href;
  const site = web(env.AFRICONNECT_ISSUER) ?? new URL(DEFAULT_ISSUER);
  return `${site.origin}/marketplace`;
}

/**
 * AfriConnect's public product search, open to visitors who aren't signed in, with the search filled in. The passport page
 * uses it for a business whose store on AfriConnect staff haven't linked yet.
 */
export function afriConnectSearchUrl(search: string, env: Record<string, string | undefined> = process.env): string {
  let site: URL;
  try {
    site = new URL(env.AFRICONNECT_ISSUER?.trim() ?? "");
  } catch {
    site = new URL(DEFAULT_ISSUER);
  }
  return `${site.origin}/explore?${new URLSearchParams({ q: search.trim() })}`;
}

/** AfriConnect's Market Intelligence, with Ethiopia chosen as the exporter. It's a trade analysis: the businesses are on the Marketplace. */
export function afriConnectMarketIntelligenceUrl(env: Record<string, string | undefined> = process.env): string {
  let site: URL;
  try {
    site = new URL(env.AFRICONNECT_ISSUER?.trim() ?? "");
  } catch {
    site = new URL(DEFAULT_ISSUER);
  }
  return `${site.origin}/export-potential?exporter=ETH`;
}
