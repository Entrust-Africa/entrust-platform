import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { Resend } from "resend";

export interface EmailInput {
  to: string | string[];
  subject: string;
  react: ReactElement;
  text?: string;
  from?: string;
}

const isDevelopment = process.env.NODE_ENV !== "production";
const apiKey = process.env.RESEND_API_KEY;
const defaultFrom = process.env.EMAIL_FROM ?? "Entrust <onboarding@resend.dev>";

function hasUsableKey(value: string | undefined): value is string {
  return Boolean(value && value.trim() && !value.includes("your-") && !value.includes("placeholder"));
}

/** Sends an HTML email through Resend, or logs it locally when running without credentials. */
export async function sendEmail(input: EmailInput): Promise<{ id: string | null; logged: boolean }> {
  const html = await render(input.react);
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const text = input.text ?? (await render(input.react, { plainText: true }));

  if (!hasUsableKey(apiKey)) {
    if (!isDevelopment) throw new Error("RESEND_API_KEY must be configured in production.");
    console.info("[email:development]", {
      to: recipients,
      from: input.from ?? defaultFrom,
      subject: input.subject,
      text,
    });
    return { id: null, logged: true };
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: input.from ?? defaultFrom,
    to: recipients,
    subject: input.subject,
    html,
    text,
  });
  if (result.error) throw new Error(`Resend rejected email: ${result.error.message}`);
  return { id: result.data?.id ?? null, logged: false };
}
