"use client";

import Link from "next/link";
import { ActionForm, Area, Consent, CountrySelect, Select, Submit, Text, Trap } from "@/components/forms";
import { exhibitorAction } from "@/app/commerce-actions";
import { SUPPORT_EMAIL } from "@/lib/content";
import { BUSINESS_SECTORS } from "@/lib/sectors";
import { amberButton } from "@/lib/styles";

export function ExhibitorForm({ countries, packages, zones, taxNote, chosen }: { countries: { code: string; name: string }[]; packages: { slug: string; label: string }[]; zones: string[]; taxNote: string; chosen?: string | undefined }) {
  return (
    <ActionForm
      action={exhibitorAction}
      done={(state) => (
        <div className="border border-line bg-paper p-8">
          <p className="font-mono text-[11px] tracking-[0.18em] text-amber-ink uppercase">Reference {String(state.receipt.number)}</p>
          <h2 className="mt-3 font-display text-4xl leading-none uppercase">We have your application</h2>
          <p className="mt-5 text-base leading-relaxed text-ink/80">
            Thank you. You applied for the <strong>{String(state.receipt.packageName)}</strong> ({String(state.receipt.price)}). We have emailed a receipt to <strong>{state.email}</strong>.
          </p>
          <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink/75">
            <li>The ADTIS team reviews your application.</li>
            <li>If it is approved, we email you the payment instructions.</li>
            <li>When your payment is verified, we allocate your booth and send your booking confirmation.</li>
          </ol>
          <p className="mt-5 text-sm text-ink/70">
            No booth is reserved yet and nothing is due. Questions? Write to{" "}
            <a className="font-semibold underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
          <Link href="/exhibit" className={`${amberButton} mt-8`}>
            Back to the packages
          </Link>
        </div>
      )}
    >
      {(values, pending) => (
        <>
          <p className="text-sm text-ink/70">
            Fields marked <span className="text-amber-ink">*</span> are required. {taxNote}
          </p>
          <Select name="packageSlug" label="Exhibition package" required values={{ packageSlug: values.packageSlug ?? chosen }} options={packages.map((p) => ({ value: p.slug, label: p.label }))} />
          <fieldset className="space-y-5">
            <legend className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">Your business</legend>
            <Text name="companyName" label="Company name" required values={values} autoComplete="organization" />
            <CountrySelect values={values} label="Country" options={countries} />
            <Text name="registrationDetails" label="Business registration details" required values={values} hint="Your registration or licence number and who issued it." />
            <Select name="sector" label="Business sector" required values={values} options={BUSINESS_SECTORS.map((s) => ({ value: s, label: s }))} />
            <Area name="productsServices" label="Products and services" required values={values} rows={3} />
            <Text name="website" label="Website" values={values} type="url" placeholder="https://" />
          </fieldset>
          <fieldset className="space-y-5">
            <legend className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">Contact person</legend>
            <Text name="contactName" label="Contact person's name" required values={values} autoComplete="name" />
            <Text name="position" label="Position" required values={values} autoComplete="organization-title" />
            <Text name="email" label="Email address" required type="email" values={values} autoComplete="email" />
            <Text name="phone" label="Telephone / WhatsApp" required type="tel" values={values} autoComplete="tel" hint="Include the country code." />
          </fieldset>
          <fieldset className="space-y-5">
            <legend className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">Your booth</legend>
            {zones.length > 0 ? (
              <Select name="preferredZone" label="Preferred exhibition zone" values={values} placeholder="No preference" options={zones.map((z) => ({ value: z, label: z }))} />
            ) : (
              <Text name="preferredZone" label="Preferred exhibition zone" values={values} hint="Optional. Zones are confirmed by the organisers." />
            )}
            <Area name="boothRequirements" label="Special booth requirements" values={values} rows={3} />
            <Area name="comments" label="Additional comments" values={values} rows={3} />
          </fieldset>
          <Consent>I agree that the ADTIS team may contact me about this application.</Consent>
          <Trap />
          <Submit pending={pending}>Submit application</Submit>
        </>
      )}
    </ActionForm>
  );
}
