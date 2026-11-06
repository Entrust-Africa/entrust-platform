"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { createBusiness } from "@/lib/summit-business";
import { countryName } from "@/lib/summit";
import { textInput } from "@/components/form-runner/styles";

/**
 * A new visitor's business: its name and country, so it has an organisation to apply as (`platform` summit) or to be
 * enrolled with (`platform` trade). A business whose name is close to one we already have is asked to confirm.
 */
export function CreateOrganisation({ countries, platform = "summit" }: { countries: string[]; platform?: "summit" | "trade" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [similar, setSimilar] = useState<{ message: string; input: { name: string; legalName: string; country: string } }>();

  async function save(input: { name: string; legalName: string; country: string }, confirmDuplicateName: boolean) {
    setPending(true);
    setError(undefined);
    const result = await createBusiness({ ...input, platform, confirmDuplicateName });
    if (!result.ok) {
      if (result.duplicate) setSimilar({ message: result.error, input });
      else setError(result.error);
      setPending(false);
      return;
    }
    setSimilar(undefined);
    router.refresh();
  }

  async function create(form: FormData) {
    setSimilar(undefined);
    await save(
      {
        name: String(form.get("name") ?? ""),
        legalName: String(form.get("legalName") ?? ""),
        country: String(form.get("country") ?? ""),
      },
      false,
    );
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
      {similar && (
        <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p>{similar.message}</p>
          <p>If your business is already on Entrust, ask its owner to invite you. If it is a different business, you can go on.</p>
          <Button type="button" variant="secondary" loading={pending} onClick={() => void save(similar.input, true)}>
            Mine is a different business
          </Button>
        </div>
      )}
      <Button type="submit" size="lg" className="w-full sm:w-auto" loading={pending}>
        Save my business
      </Button>
    </form>
  );
}
