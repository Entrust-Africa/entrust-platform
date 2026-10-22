import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb, schema } from "@entrust/db";

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
  emailAndPassword: { enabled: true },
  plugins: [organization()],
  advanced: cookieDomain
    ? { crossSubDomainCookies: { enabled: true, domain: cookieDomain } }
    : undefined,
});

export type Session = typeof auth.$Infer.Session;
