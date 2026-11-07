import { and, eq, inArray } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError as BetterAuthAPIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, organization } from "better-auth/plugins";
import { getDb, schema, type Database } from "@entrust/db";
import { sendEmail } from "@entrust/notify";
import { InvitationEmail, PasswordResetEmail, VerificationEmail } from "@entrust/notify/templates";
import {
  AFRICONNECT_PROVIDER_ID,
  afriConnectOAuthConfig,
  afriConnectSettings,
  provisionAfriConnectAccount,
} from "./africonnect";
import {
  detectPlatformFromUrl,
  getClearAppUrl,
  getPlatformAppUrl,
  getTradeAppUrl,
  type AuthPlatform,
} from "./url";

// Origins allowed to call the API with cookies, e.g. the CLEAR and TRADE apps and the website.
const defaultDevOrigins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:6001"];
const envOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// The origins the API answers with credentials: the dev ports, `CORS_ORIGINS`, and the CLEAR and TRADE app URLs.
export const trustedOrigins = Array.from(
  new Set([
    ...defaultDevOrigins,
    ...envOrigins,
    ...(process.env.CLEAR_APP_URL ? [process.env.CLEAR_APP_URL.trim().replace(/\/+$/, "")] : []),
    ...(process.env.TRADE_APP_URL ? [process.env.TRADE_APP_URL.trim().replace(/\/+$/, "")] : []),
  ]),
);

// In production the API and the apps share a parent domain (".entrust-africa.com"),
// so the session cookie is scoped to it. Locally, every port shares "localhost".
const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;

// Better Auth is built once, at import time, but a Worker needs the database of the request
// being handled (see runWithRequestDb). So hand it a stand-in that resolves getDb() on every use.
const db = new Proxy({} as Database, {
  get(_target, property) {
    const current = getDb();
    const value = Reflect.get(current, property, current);
    return typeof value === "function" ? value.bind(current) : value;
  },
});

// Signing in with an AfriConnect account, when this deployment is registered with AfriConnect (africonnect.ts).
const afriConnect = afriConnectSettings();

/**
 * An Entrust user made for someone before they first signed in (by the provisioning below) has no name yet; the
 * name they gave AfriConnect fills it. A name Entrust already has is never replaced.
 */
async function fillEmptyName(person: { sub: string; name: string }) {
  if (!person.name.trim()) return;
  const accounts = db
    .select({ userId: schema.account.userId })
    .from(schema.account)
    .where(and(eq(schema.account.providerId, AFRICONNECT_PROVIDER_ID), eq(schema.account.accountId, person.sub)));
  await db
    .update(schema.user)
    .set({ name: person.name.trim() })
    .where(and(inArray(schema.user.id, accounts), eq(schema.user.name, "")));
}

// One auth instance for every Entrust platform, served by apps/api. Organisations
// are SME companies and the Entrust team; platform access is granted per organisation.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // With AfriConnect on, new accounts are made there (or by the provisioning below), never with an Entrust
    // password. Existing passwords keep working until they are retired.
    disableSignUp: Boolean(afriConnect),
    sendResetPassword: async ({ user, url }) => {
      const platform = detectPlatformFromUrl(url);
      const platformName = platform === "trade" ? "TRADE" : "CLEAR";
      await sendEmail({
        to: user.email,
        subject: `Reset your ${platformName} password`,
        react: PasswordResetEmail({ url, platformName }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const platform = detectPlatformFromUrl(url);
      const platformName = platform === "trade" ? "TRADE" : "CLEAR";
      await sendEmail({
        to: user.email,
        subject: `Verify your ${platformName} email`,
        react: VerificationEmail({ url, platformName }),
      });
    },
  },
  plugins: [
    // Always present (with no providers when AfriConnect is off), so the session type keeps every plugin's fields.
    genericOAuth({ config: afriConnect ? [afriConnectOAuthConfig(afriConnect, fillEmptyName)] : [] }),
    organization({
      schema: {
        invitation: {
          additionalFields: {
            platform: {
              type: "string",
              required: false,
            },
          },
        },
      },
      sendInvitationEmail: async ({ invitation, organization, inviter }) => {
        const inviteRecord = invitation as typeof invitation & { platform?: string };
        const platform = inviteRecord.platform === "trade" ? "trade" : "clear";
        const appUrl = platform === "trade" ? getTradeAppUrl() : getClearAppUrl();
        const platformName = platform === "trade" ? "TRADE" : "CLEAR";
        await sendEmail({
          to: invitation.email,
          subject: `Invitation to join ${organization.name} on ${platformName}`,
          react: InvitationEmail({
            organizationName: organization.name,
            inviterName: inviter.user.name,
            role: invitation.role ?? "member",
            url: `${appUrl}/accept-invitation?id=${encodeURIComponent(invitation.id)}`,
            platformName,
          }),
        });
      },
    }),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Better Auth also lets a client hand over an ID token directly instead of the redirect sign-in. For
      // AfriConnect that would skip PKCE, state and the nonce Entrust chose, so only the redirect is accepted.
      const body = ctx.body as { provider?: unknown; idToken?: unknown } | undefined;
      if ((ctx.path === "/sign-in/social" || ctx.path === "/link-social") && body?.provider === AFRICONNECT_PROVIDER_ID && body.idToken) {
        throw new BetterAuthAPIError("BAD_REQUEST", { message: "Sign in with AfriConnect through its sign-in page." });
      }
    }),
  },
  advanced: {
    // Every API request checks its session. With joins the session and its user come back in one
    // query rather than two, through the session-to-user relation in @entrust/db's schema.
    database: { joins: true },
    ...(cookieDomain ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } } : {}),
  },
});

export type Session = typeof auth.$Infer.Session;

/** Whether people sign in with their AfriConnect account on this deployment. */
export const afriConnectSignIn = Boolean(afriConnect);

export type EnsureAccountResult =
  | { status: "linked"; userId: string; created: boolean }
  | { status: "conflict"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "disabled" };

/**
 * Make sure a person whose email Entrust has just verified (a registration, not a sign-in) has an account on both
 * AfriConnect and Entrust, tied together by AfriConnect's subject. No password is set anywhere: the person chooses
 * one the first time they sign in. Safe to call again; a second call finds what the first made.
 *
 * Refuses (`conflict`) rather than guess when the accounts disagree: an Entrust account for the email whose address
 * was never verified (whoever made it may hold its password), an AfriConnect subject already tied to another Entrust
 * user, or an Entrust user already tied to another subject. Those are linked, or not, when the person signs in.
 */
export async function ensureAfriConnectAccount(person: { email: string; name?: string }): Promise<EnsureAccountResult> {
  if (!afriConnect) return { status: "disabled" };
  const email = person.email.trim().toLowerCase();
  const name = person.name?.trim() || undefined;
  const ctx = await auth.$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  if (found && !found.user.emailVerified) {
    return { status: "conflict", reason: "an Entrust account for this email was never verified" };
  }
  const linked = found?.accounts.find((account) => account.providerId === AFRICONNECT_PROVIDER_ID);
  if (found && linked) return { status: "linked", userId: found.user.id, created: false };

  const provisioned = await provisionAfriConnectAccount(afriConnect, { email, name });
  if (provisioned.status === "conflict") {
    return { status: "conflict", reason: "AfriConnect has an unverified account for this email" };
  }
  if (provisioned.status === "unavailable") return provisioned;

  const owner = await ctx.internalAdapter.findAccountByKey({
    providerId: AFRICONNECT_PROVIDER_ID,
    accountId: provisioned.sub,
  });
  if (owner) {
    return owner.userId === found?.user.id || !found
      ? { status: "linked", userId: owner.userId, created: false }
      : { status: "conflict", reason: "the AfriConnect account is tied to another Entrust user" };
  }
  const user = found?.user ?? (await ctx.internalAdapter.createUser(
      { email, name: name ?? "", emailVerified: true },
      { method: "africonnect-provisioning" },
    ));
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: AFRICONNECT_PROVIDER_ID,
    accountId: provisioned.sub,
  });
  return { status: "linked", userId: user.id, created: !found };
}
export { APIError } from "better-auth";
export {
  detectPlatformFromUrl,
  getClearAppUrl,
  getPlatformAppUrl,
  getTradeAppUrl,
  type AuthPlatform,
};
export * from "./roles";
export {
  AFRICONNECT_PROVIDER_ID,
  afriConnectSettings,
  provisionAfriConnectAccount,
  type AfriConnectSettings,
  type ProvisionResult,
} from "./africonnect";
