"use client";

import Link from "next/link";
import { ActionForm, Area, Consent, CountrySelect, Req, Select, Submit, Text, Trap } from "@/components/forms";
import { sponsorAction } from "@/app/commerce-actions";
import { SUPPORT_EMAIL } from "@/lib/content";
import { BUSINESS_SECTORS } from "@/lib/sectors";
import { amberButton } from "@/lib/styles";

export function SponsorForm({ countries, levels, opportunities, taxNote, chosen }: { countries: { code: string; name: string }[]; levels: { slug: string; label: string }[]; opportunities: { slug: string; label: string }[]; taxNote: string; chosen?: string | undefined }) {
  return (
    <ActionForm
      action={sponsorAction}
      done={(state) => (
        <div className="border border-line bg-paper p-8">
          <p className="font-mono text-[11px] tracking-[0.18em] text-amber-ink uppercase">Reference {String(state.receipt.number)}</p>
          <h2 className="mt-3 font-display text-4xl leading-none uppercase">Thank you for your interest</h2>
          <p className="mt-5 text-base leading-relaxed text-ink/80">
            We have your enquiry about <strong>{String(state.receipt.productName)}</strong> and have emailed a receipt to <strong>{state.email}</strong>. A member of the ADTIS team will be in touch.
          </p>
          <p className="mt-4 text-sm text-ink/70">
            Sponsorship benefits are confirmed in a signed sponsorship agreement. Questions? Write to{" "}
            <a className="font-semibold underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link href="/sponsor" className={`${amberButton} mt-8`}>
            Back to sponsorship
          </Link>
        </div>
      )}
    >
      {(values, pending) => (
        <>
          <p className="text-sm text-ink/70">
            Fields marked <span className="text-amber-ink">*</span> are required. {taxNote}
          </p>
          <div>
            <label htmlFor="f-productSlug" className="block text-sm font-semibold">
              Sponsorship package of interest
              <Req />
            </label>
            <select
              key={`product-${values.productSlug ?? chosen ?? ""}`}
              id="f-productSlug"
              name="productSlug"
              required
              defaultValue={values.productSlug ?? chosen ?? ""}
              className="mt-1.5 block h-12 w-full border border-ink/25 bg-white px-3 text-sm text-ink focus:border-amber"
            >
              <option value="">Choose</option>
              {levels.length > 0 && (
                <optgroup label="Sponsorship levels">
                  {levels.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {opportunities.length > 0 && (
                <optgroup label="Additional opportunities">
                  {opportunities.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <Text name="organisationName" label="Organisation name" required values={values} autoComplete="organization" />
          <CountrySelect values={values} options={countries} />
          <Select name="sector" label="Industry or sector" required values={values} options={BUSINESS_SECTORS.map((s) => ({ value: s, label: s }))} />
          <Text name="contactName" label="Contact person" required values={values} autoComplete="name" />
          <Text name="position" label="Position" required values={values} autoComplete="organization-title" />
          <Text name="email" label="Email" required type="email" values={values} autoComplete="email" />
          <Text name="phone" label="Telephone" required type="tel" values={values} autoComplete="tel" hint="Include the country code." />
          <Area name="objectives" label="Sponsorship objectives" required values={values} rows={4} hint="What do you want to achieve by sponsoring ADTIS?" />
          <Area name="requirements" label="Additional requirements" values={values} rows={3} />
          <Consent>I agree that the ADTIS team may contact me about this enquiry.</Consent>
          <Trap />
          <Submit pending={pending}>Send enquiry</Submit>
        </>
      )}
    </ActionForm>
  );
}
