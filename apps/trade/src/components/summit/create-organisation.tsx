"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { createBusiness } from "@/lib/summit-business";
import { countryName } from "@/lib/summit";
import { textInput } from "@/components/form-runner/styles";

/** A new visitor's business: its name and country, so it has an organisation to apply as. */
export function CreateOrganisation({ countries }: { countries: string[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function create(form: FormData) {
    setPending(true);
    setError(undefined);
    const result = await createBusiness({
      name: String(form.get("name") ?? ""),
      legalName: String(form.get("legalName") ?? ""),
      country: String(form.get("country") ?? ""),
    });
    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }
    router.refresh();
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
