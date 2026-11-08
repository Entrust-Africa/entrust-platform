import { authClient } from "./auth-client";

// Signing in with an AfriConnect account (see packages/auth/src/africonnect.ts). Entrust's pages ask only for the email;
// AfriConnect's page, in the platform's own colours, asks for the password or emails a code, and sends the person back.

export type AfriConnectProduct = "clear" | "trade";

/**
 * Go to AfriConnect to sign in, with the email already typed. `callbackPath` is where the person lands once signed in
 * (an Entrust account is made for them on the way if they have none). Resolves only if the redirect could not start.
 */
export async function continueWithAfriConnect(input: {
  email?: string;
  product: AfriConnectProduct;
  callbackPath: string;
  errorPath?: string;
  /** Go straight on to Google from AfriConnect's page (`idp_hint`). */
  via?: "google";
}): Promise<{ error: string } | undefined> {
  const origin = window.location.origin;
  const callbackURL = new URL(input.callbackPath, origin).href;
  try {
    const result = await authClient.signIn.social({
      provider: "africonnect",
      callbackURL,
      newUserCallbackURL: callbackURL,
      errorCallbackURL: new URL(input.errorPath ?? "/sign-in", origin).href,
      loginHint: input.email?.trim().toLowerCase() || undefined,
      // No email goes with Google, so nothing would tell this person apart from whoever is still signed in on
      // AfriConnect (signing out of Entrust leaves that session). `prompt=login` makes AfriConnect sign them in again.
      additionalParams: { product: input.product, ...(input.via ? { idp_hint: input.via, prompt: "login" } : {}) },
    });
    if (result.error) return { error: "Sign-in couldn't start. Try again in a moment." };
  } catch {
    return { error: "Sign-in couldn't start. Check your connection and try again." };
  }
  // The auth client is on its way to AfriConnect.
  return undefined;
}

const MESSAGES: Record<string, string> = {
  account_not_linked:
    "There is an older Entrust account with this email that was never confirmed. Ask your Entrust facilitator to remove it, then sign in again.",
  email_not_found:
    "Your AfriConnect account has no confirmed email address. Add one on AfriConnect, then sign in again.",
  access_denied: "Sign-in was cancelled. You can try again.",
  signup_disabled: "New accounts can't be created right now. Try again later.",
  banned: "This account can't sign in. Contact Entrust if you think that is a mistake.",
};

/**
 * A plain line for the `?error=` code Better Auth adds when a sign-in through AfriConnect fails. Unknown codes get a
 * general line; the provider's own description is never shown.
 */
export function afriConnectErrorMessage(code: string | null | undefined): string | undefined {
  const key = code?.trim().toLowerCase();
  if (!key) return undefined;
  return Object.hasOwn(MESSAGES, key) ? MESSAGES[key] : "That sign-in didn't complete. Please try again.";
}
