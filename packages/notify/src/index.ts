import { render } from "@react-email/components";
import { emailTheme } from "@entrust/ui";
import type { ReactElement } from "react";
import { Resend } from "resend";

export interface EmailInput {
  to: string | string[];
  subject: string;
  react: ReactElement;
  text?: string;
  from?: string;
}

function hasUsableKey(value: string | undefined): value is string {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && !normalized.includes("your-") && !normalized.includes("placeholder"));
}

export function hasUsableFrom(value: string | undefined): value is string {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
      !normalized.includes("onboarding@resend.dev") &&
      !normalized.includes("your-") &&
      !normalized.includes("placeholder") &&
      !normalized.includes("example.com"),
  );
}

let resend: Resend | undefined;

function emailConfig() {
  const mode = process.env.EMAIL_MODE ?? (process.env.NODE_ENV === "production" ? "send" : "log");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM?.trim() || (mode === "log" ? "Entrust <onboarding@resend.dev>" : undefined);
  if (mode !== "log" && mode !== "send") throw new Error("EMAIL_MODE must be either log or send.");
  return { mode, apiKey, from };
}

/** Sends an HTML email through Resend, or logs it locally when running without credentials. */
export async function sendEmail(input: EmailInput): Promise<{ id: string | null; logged: boolean }> {
  const { mode, apiKey, from } = emailConfig();
  const html = await render(input.react);
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const text = input.text ?? (await render(input.react, { plainText: true }));

  if (mode === "log") {
    console.info("[email:development]", {
      to: recipients,
      from: input.from ?? from,
      subject: input.subject,
      text,
    });
    return { id: null, logged: true };
  }

  if (!hasUsableKey(apiKey)) throw new Error("RESEND_API_KEY must be configured when EMAIL_MODE=send.");
  const resolvedFrom = input.from ?? from;
  if (!hasUsableFrom(resolvedFrom)) {
    throw new Error(
      "EMAIL_FROM must be configured with a verified domain (not onboarding@resend.dev) when EMAIL_MODE=send.",
    );
  }
  resend ??= new Resend(apiKey);
  const result = await resend.emails.send({
    from: resolvedFrom,
    to: recipients,
    subject: input.subject,
    html,
    text,
  });
  if (result.error) throw new Error(`Resend rejected email: ${result.error.message}`);
  return { id: result.data?.id ?? null, logged: false };
}
