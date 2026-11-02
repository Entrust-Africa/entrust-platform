import { describe, expect, it } from "vitest";
import * as account from "../src/index";

describe("@entrust/account exports", () => {
  it("exports authClient and useSignOut", () => {
    expect(account.authClient).toBeDefined();
    expect(account.useSignOut).toBeTypeOf("function");
  });

  it("exports all required account and auth views", () => {
    expect(account.SignInView).toBeTypeOf("function");
    expect(account.CheckEmailView).toBeTypeOf("function");
    expect(account.EmailVerifiedView).toBeTypeOf("function");
    expect(account.ForgotPasswordView).toBeTypeOf("function");
    expect(account.ResetPasswordView).toBeTypeOf("function");
    expect(account.AcceptInvitationView).toBeTypeOf("function");
    expect(account.AccountView).toBeTypeOf("function");
    expect(account.AccountMenu).toBeTypeOf("function");
    expect(account.OrgSwitcher).toBeTypeOf("function");
  });
});
