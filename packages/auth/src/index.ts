import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb, schema } from "@entrust/db";
import { sendEmail } from "@entrust/notify";
import { InvitationEmail, PasswordResetEmail, VerificationEmail } from "@entrust/notify/templates";
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

const trustedOrigins = Array.from(
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

// One auth instance for every Entrust platform, served by apps/api. Organisations
// are SME companies and the Entrust team; platform access is granted per organisation.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins,
  database: drizzleAdapter(getDb(), {
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
        const platform = (invitation as any).platform === "trade" ? "trade" : "clear";
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
  advanced: cookieDomain
    ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
    : undefined,
});

export type Session = typeof auth.$Infer.Session;
export { APIError } from "better-auth";
export {
  detectPlatformFromUrl,
  getClearAppUrl,
  getPlatformAppUrl,
  getTradeAppUrl,
  type AuthPlatform,
};
