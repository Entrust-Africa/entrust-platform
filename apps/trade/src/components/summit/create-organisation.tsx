"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { apiUrl } from "@/lib/summit-api";
import { countryName } from "@/lib/summit";
import { textInput } from "@/components/form-runner/styles";

/**
 * Which platform the new organisation is given with its first access. The API only offers "clear" or "trade" here, so
 * the Summit can't ask for its own. Once POST /v1/organizations accepts "summit", change this one value.
 */
const FIRST_PLATFORM = "trade";

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** A new visitor's business: its name and country, so it has an organisation to apply as. */
export function CreateOrganisation({ countries }: { countries: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function create(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const legalName = String(form.get("legalName") ?? "").trim() || name;
    const country = String(form.get("country") ?? "");
    const slug = `${slugOf(name) || "business"}-${Math.random().toString(36).slice(2, 7)}`;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiUrl}/v1/organizations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, legalName, slug, country, platform: FIRST_PLATFORM }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
        setError(typeof data?.error === "string" ? data.error : "We couldn't save your business. Please try again.");
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your internet connection and try again.");
      setPending(false);
    }
  }

  return (
    <form action={create} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="org-name" className="block text-base font-semibold text-ink">
          Business name
        </label>
        <input id="org-name" name="name" required maxLength={160} autoComplete="organization" className={textInput(false)} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="org-legal" className="block text-base font-semibold text-ink">
          Registered legal name
        </label>
        <input id="org-legal" name="legalName" maxLength={200} aria-describedby="org-legal-hint" className={textInput(false)} />
        <p id="org-legal-hint" className="text-sm text-ink-3">
          Leave this empty if it is the same as the business name.
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="org-country" className="block text-base font-semibold text-ink">
          Country
        </label>
        <select id="org-country" name="country" required defaultValue="" className={`${textInput(false)} appearance-auto`}>
          <option value="" disabled>
            Choose your country
          </option>
          {countries.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
        Save my business
      </Button>
    </form>
  );
}
