import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const social = vi.hoisted(() => vi.fn());
vi.mock("../src/auth-client", () => ({ authClient: { signIn: { social } } }));

const { continueWithAfriConnect } = await import("../src/africonnect");

// Leaving for AfriConnect from a platform's sign-in page.

beforeEach(() => {
  social.mockReset();
  social.mockResolvedValue({ data: { url: "https://idp.example.com" }, error: null });
  vi.stubGlobal("window", { location: { origin: "https://trade.example.com" } });
});
afterEach(() => vi.unstubAllGlobals());

describe("continueWithAfriConnect", () => {
  it("passes the typed email and leaves any existing AfriConnect session to the email check", async () => {
    await continueWithAfriConnect({ email: " Ada@Example.com ", product: "trade", callbackPath: "/" });
    expect(social.mock.calls[0]?.[0]).toMatchObject({
      provider: "africonnect",
      callbackURL: "https://trade.example.com/",
      errorCallbackURL: "https://trade.example.com/sign-in",
      loginHint: "ada@example.com",
      additionalParams: { product: "trade" },
    });
  });

  it("makes Google sign in again, because no email tells this person from whoever is signed in on AfriConnect", async () => {
    await continueWithAfriConnect({ product: "clear", callbackPath: "/", via: "google" });
    const call = social.mock.calls[0]?.[0];
    expect(call.loginHint).toBeUndefined();
    expect(call.additionalParams).toEqual({ product: "clear", idp_hint: "google", prompt: "login" });
  });

  it("reports a sign-in that could not start", async () => {
    social.mockResolvedValueOnce({ data: null, error: { status: 500 } });
    expect(await continueWithAfriConnect({ product: "trade", callbackPath: "/" })).toEqual({ error: "Sign-in couldn't start. Try again in a moment." });
    social.mockRejectedValueOnce(new TypeError("offline"));
    expect(await continueWithAfriConnect({ product: "trade", callbackPath: "/" })).toEqual({ error: "Sign-in couldn't start. Check your connection and try again." });
  });
});
