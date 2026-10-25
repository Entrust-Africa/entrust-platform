import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb, schema } from "@entrust/db";
import { sendEmail } from "@entrust/notify";
import { InvitationEmail, PasswordResetEmail, VerificationEmail } from "@entrust/notify/templates";
import { getClearAppUrl } from "./url";

// Origins allowed to call the API with cookies, e.g. the CLEAR app and the website.
const trustedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

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
      await sendEmail({ to: user.email, subject: "Reset your Entrust password", react: PasswordResetEmail({ url }) });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, subject: "Verify your Entrust email", react: VerificationEmail({ url }) });
    },
  },
  plugins: [
    organization({
      sendInvitationEmail: async ({ invitation, organization, inviter }) => {
        const clearUrl = getClearAppUrl();
        await sendEmail({
          to: invitation.email,
          subject: `Invitation to join ${organization.name} on Entrust`,
          react: InvitationEmail({
            organizationName: organization.name,
            inviterName: inviter.user.name,
            role: invitation.role ?? "member",
            url: `${clearUrl}/accept-invitation?id=${encodeURIComponent(invitation.id)}`,
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
