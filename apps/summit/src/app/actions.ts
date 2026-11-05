"use server";

import { SUPPORT_EMAIL } from "@/lib/content";
import { apiBase } from "@/lib/period";

// The registration form's server action. The browser posts here, and this posts to the Entrust API, so the page needs
// no CORS rule and the API's address stays on the server.

const FIELDS = ["fullName", "email", "phone", "organisation", "jobTitle", "country", "pass", "notes"] as const;
export type RegistrationValues = Partial<Record<(typeof FIELDS)[number], string>>;

export type RegistrationState =
  | { status: "idle" }
  | { status: "error"; message: string; values: RegistrationValues }
  | { status: "done"; number: string; passName: string; email: string };

export async function registerAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  const text = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const values: RegistrationValues = Object.fromEntries(FIELDS.map((name) => [name, text(name)]));
  const fail = (message: string): RegistrationState => ({ status: "error", message, values });

  try {
    const res = await fetch(`${apiBase()}/v1/summit/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        ...values,
        // The API wants an absent optional field, not an empty one.
        phone: values.phone || undefined,
        notes: values.notes || undefined,
        consent: formData.get("consent") === "on",
        // A trap for bots: the field is hidden from people.
        website: text("website"),
      }),
    });
    if (res.status === 201) {
      const body = (await res.json()) as { number: string; passName: string };
      return { status: "done", number: body.number, passName: body.passName, email: values.email ?? "" };
    }
    if (res.status === 400) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return fail(body?.error ? `Please check the form: ${body.error}` : "Please check the form and try again.");
    }
  } catch {
    // Falls through to the message below.
  }
  return fail(`We couldn't save your registration just now. Please try again, or email ${SUPPORT_EMAIL}.`);
}
