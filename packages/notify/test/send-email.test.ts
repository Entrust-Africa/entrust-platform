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
});
