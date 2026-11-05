"use server";

import { SUPPORT_EMAIL } from "@/lib/content";
import { apiBase } from "@/lib/period";

// The forms' server actions. The browser posts here, and this posts to the Entrust API's public endpoints, so the pages need
// no CORS rule and the API's address stays on the server. A refusal from the API is shown in its own words.

export type FormState =
  | { status: "idle" }
  | { status: "error"; message: string; values: Record<string, string | undefined> }
  | { status: "done"; receipt: Record<string, unknown>; email: string };

const text = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};

/** The fields as given, so a form that failed comes back filled in. */
function valuesOf(data: FormData, names: readonly string[]): Record<string, string | undefined> {
  return Object.fromEntries(names.map((n) => [n, text(data, n)]));
}

const optional = (value: string): string | undefined => value || undefined;

async function submit(path: string, body: Record<string, unknown>, values: Record<string, string | undefined>, email: string): Promise<FormState> {
  const fail = (message: string): FormState => ({ status: "error", message, values });
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      body: JSON.stringify(body),
    });
    if (res.status === 201) return { status: "done", receipt: (await res.json()) as Record<string, unknown>, email };
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 400) return fail(data?.error ? `Please check the form: ${data.error}` : "Please check the form and try again.");
    if ((res.status === 404 || res.status === 422) && data?.error) return fail(data.error);
  } catch {
    // Falls through to the message below.
  }
  return fail(`We couldn't send that just now. Please try again, or email ${SUPPORT_EMAIL}.`);
}

const EXHIBITOR = ["packageSlug", "companyName", "country", "registrationDetails", "contactName", "position", "email", "phone", "sector", "productsServices", "website", "preferredZone", "boothRequirements", "comments"] as const;

export async function exhibitorAction(_: FormState, data: FormData): Promise<FormState> {
  const values = valuesOf(data, EXHIBITOR);
  return submit(
    "/v1/summit/commerce/exhibitor-applications",
    {
      ...values,
      website: optional(text(data, "website")),
      preferredZone: optional(text(data, "preferredZone")),
      boothRequirements: optional(text(data, "boothRequirements")),
      comments: optional(text(data, "comments")),
      consent: data.get("consent") === "on",
      nickname: text(data, "nickname"),
    },
    values,
    text(data, "email"),
  );
}

const SPONSOR = ["productSlug", "organisationName", "country", "contactName", "position", "email", "phone", "sector", "objectives", "requirements"] as const;

export async function sponsorAction(_: FormState, data: FormData): Promise<FormState> {
  const values = valuesOf(data, SPONSOR);
  return submit(
    "/v1/summit/commerce/sponsor-enquiries",
    { ...values, requirements: optional(text(data, "requirements")), consent: data.get("consent") === "on", nickname: text(data, "nickname") },
    values,
    text(data, "email"),
  );
}

const DELEGATE = ["categorySlug", "fullName", "email", "phone", "organisation", "jobTitle", "country", "sector", "needs", "applicationNumber"] as const;

export async function delegateAction(_: FormState, data: FormData): Promise<FormState> {
  const values = valuesOf(data, DELEGATE);
  return submit(
    "/v1/summit/commerce/delegates",
    {
      ...values,
      phone: optional(text(data, "phone")),
      organisation: optional(text(data, "organisation")),
      country: optional(text(data, "country")),
      sector: optional(text(data, "sector")),
      needs: optional(text(data, "needs")),
      applicationNumber: optional(text(data, "applicationNumber")),
      consent: data.get("consent") === "on",
      nickname: text(data, "nickname"),
    },
    values,
    text(data, "email"),
  );
}

const B2B = ["slug", "interest", "name", "email", "phone", "organisation", "role", "message"] as const;

export async function b2bAction(_: FormState, data: FormData): Promise<FormState> {
  const values = valuesOf(data, B2B);
  const slug = text(data, "slug");
  return submit(
    `/v1/summit/commerce/smes/${encodeURIComponent(slug)}/enquiries`,
    {
      interest: values.interest,
      name: values.name,
      email: values.email,
      phone: optional(text(data, "phone")),
      organisation: values.organisation,
      role: optional(text(data, "role")),
      message: values.message,
      consent: data.get("consent") === "on",
      nickname: text(data, "nickname"),
    },
    values,
    text(data, "email"),
  );
}
