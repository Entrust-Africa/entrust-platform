import { describe, expect, it, vi } from "vitest";
import { sendEmail } from "../src/index";
import { VerificationEmail } from "../src/templates";

describe("sendEmail", () => {
  it("logs the rendered email when credentials are not configured", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const result = await sendEmail({
      to: "person@example.test",
      subject: "Verify your email",
      react: VerificationEmail({ url: "http://localhost:3000/verify" }),
    });

    expect(result).toEqual({ id: null, logged: true });
    expect(log).toHaveBeenCalledWith(
      "[email:development]",
      expect.objectContaining({ to: ["person@example.test"], subject: "Verify your email" }),
    );
    log.mockRestore();
  });

  it("throws when EMAIL_MODE=send and RESEND_API_KEY is not configured", async () => {
    const originalMode = process.env.EMAIL_MODE;
    const originalKey = process.env.RESEND_API_KEY;
    try {
      process.env.EMAIL_MODE = "send";
      delete process.env.RESEND_API_KEY;
      await expect(
        sendEmail({
          to: "person@example.test",
          subject: "Verify your email",
          react: VerificationEmail({ url: "http://localhost:3000/verify" }),
        }),
      ).rejects.toThrow("RESEND_API_KEY must be configured when EMAIL_MODE=send.");
    } finally {
      process.env.EMAIL_MODE = originalMode;
      process.env.RESEND_API_KEY = originalKey;
    }
  });

  it("throws when EMAIL_MODE=send and EMAIL_FROM is unset", async () => {
    const originalMode = process.env.EMAIL_MODE;
    const originalKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.EMAIL_FROM;
    try {
      process.env.EMAIL_MODE = "send";
      process.env.RESEND_API_KEY = "re_test_123456789";
      delete process.env.EMAIL_FROM;
      await expect(
        sendEmail({
          to: "person@example.test",
          subject: "Verify your email",
          react: VerificationEmail({ url: "http://localhost:3000/verify" }),
        }),
      ).rejects.toThrow("EMAIL_FROM must be configured with a verified domain");
    } finally {
      process.env.EMAIL_MODE = originalMode;
      process.env.RESEND_API_KEY = originalKey;
      process.env.EMAIL_FROM = originalFrom;
    }
  });

  it("throws when EMAIL_MODE=send and EMAIL_FROM is onboarding@resend.dev", async () => {
    const originalMode = process.env.EMAIL_MODE;
    const originalKey = process.env.RESEND_API_KEY;
    const originalFrom = process.env.EMAIL_FROM;
    try {
      process.env.EMAIL_MODE = "send";
      process.env.RESEND_API_KEY = "re_test_123456789";
      process.env.EMAIL_FROM = "Entrust <onboarding@resend.dev>";
      await expect(
        sendEmail({
          to: "person@example.test",
          subject: "Verify your email",
          react: VerificationEmail({ url: "http://localhost:3000/verify" }),
        }),
      ).rejects.toThrow("EMAIL_FROM must be configured with a verified domain (not onboarding@resend.dev)");
    } finally {
      process.env.EMAIL_MODE = originalMode;
      process.env.RESEND_API_KEY = originalKey;
      process.env.EMAIL_FROM = originalFrom;
    }
  });
});
