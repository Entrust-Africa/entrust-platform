// The settings production can't run properly without. The Node entry (index.ts) and the Worker (worker.ts) both call
// checkProductionConfig once when they start answering, so a missing value is said out loud wherever the API runs.

type Env = Record<string, string | undefined>;

const local = (url: string | undefined) => !url || url.includes("localhost") || url.includes("127.0.0.1");

/** What's wrong with production's settings. `problems` break something; `warnings` are worth knowing about. */
export function productionConfigReport(env: Env = process.env): { problems: string[]; warnings: string[] } {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!env.BETTER_AUTH_SECRET) problems.push("BETTER_AUTH_SECRET is not set, so nobody can sign in.");
  if (local(env.TRADE_APP_URL)) problems.push("TRADE_APP_URL is not set or points to localhost: onboarding links lead to localhost and notices go out with no link.");
  if (local(env.CLEAR_APP_URL)) warnings.push("CLEAR_APP_URL is not set or points to localhost, so CLEAR invitations will fail.");
  if (local(env.MIZAN_APP_URL)) warnings.push("MIZAN_APP_URL is not set or points to localhost, so MIZAN sign-in emails name the wrong platform and the MIZAN app can't sign in through the API.");
  if (!env.MFA_ENCRYPTION_KEY) {
    // Changing the key would make every stored authenticator secret unreadable, so this stays a warning: set it only
    // together with re-enrolling staff.
    warnings.push("MFA_ENCRYPTION_KEY is not set, so authenticator secrets are encrypted with a key made from BETTER_AUTH_SECRET.");
  }
  const from = env.EMAIL_FROM?.trim();
  if (!from || from.includes("onboarding@resend.dev")) warnings.push("EMAIL_FROM is unset or onboarding@resend.dev, so Resend delivers only to the account owner.");
  if (!env.RESEND_API_KEY) warnings.push("RESEND_API_KEY is not set.");
  return { problems, warnings };
}

let reported: { problems: string[]; warnings: string[] } | null = null;

/** Logs the report the first time it's asked for, and returns it. */
export function checkProductionConfig(env: Env = process.env): { problems: string[]; warnings: string[] } {
  if (reported) return reported;
  reported = productionConfigReport(env);
  for (const problem of reported.problems) console.error(`[config:error] ${problem}`);
  for (const warning of reported.warnings) console.warn(`[config:warning] ${warning}`);
  return reported;
}

/** Whether this process is production: NODE_ENV says so, or it's the deployed Worker (worker.ts sets it). */
let production = process.env.NODE_ENV === "production";
export const markProduction = (): void => {
  production = true;
};
export const isProduction = (): boolean => production;
