import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { getDb, schema } from "@entrust/db";

// One auth instance for every Entrust platform. Organisations are SME
// companies and the Entrust team; platform access is granted per organisation.
export const auth = betterAuth({
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
});

export type Session = typeof auth.$Infer.Session;
