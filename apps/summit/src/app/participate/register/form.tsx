"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, Area, Consent, CountrySelect, Req, Select, Submit, Text, Trap } from "@/components/forms";
import { delegateAction } from "@/app/commerce-actions";
import { SUPPORT_EMAIL } from "@/lib/content";
import { BUSINESS_SECTORS } from "@/lib/sectors";
import { amberButton } from "@/lib/styles";

export interface CategoryOption {
  slug: string;
  label: string;
  selectedSme: boolean;
}

/** The category choice and the rest of the registration. A selected SME gives its application number instead of its organisation: there is no second application. */
export function DelegateForm({ countries, categories, taxNote, chosen }: { countries: { code: string; name: string }[]; categories: CategoryOption[]; taxNote: string; chosen?: string | undefined }) {
  const [slug, setSlug] = useState(chosen ?? "");
  const sme = categories.find((c) => c.slug === slug)?.selectedSme ?? false;
  return (
    <ActionForm
      action={delegateAction}
      done={(state) => {
        const paid = state.receipt.paymentRequired === true;
        const already = state.receipt.alreadyRegistered === true;
        return (
          <div className="border border-line bg-paper p-8">
            <p className="font-mono text-[11px] tracking-[0.18em] text-amber-ink uppercase">Reference {String(state.receipt.number)}</p>
            <h2 className="mt-3 font-display text-4xl leading-none uppercase">{already ? "You are already registered" : "You are registered"}</h2>
            <p className="mt-5 text-base leading-relaxed text-ink/80">
              {already ? (
                <>
                  This email address is already registered and paid for as a <strong>{String(state.receipt.categoryName)}</strong>. Your original confirmation and badge link are in your inbox.
                </>
              ) : paid ? (
                <>
                  We have your registration as a <strong>{String(state.receipt.categoryName)}</strong> ({String(state.receipt.price)}). We have emailed <strong>{state.email}</strong> with the payment instructions and a link to your badge. Your badge becomes valid once your payment has been verified.
                </>
              ) : (
                <>
                  You are registered as a <strong>{String(state.receipt.categoryName)}</strong>, free of charge. We have emailed <strong>{state.email}</strong> your confirmation and a link to your badge.
                </>
              )}
            </p>
            <p className="mt-4 text-sm text-ink/70">
              Can&apos;t find the email? Check your spam folder or write to{" "}
              <a className="font-semibold underline underline-offset-2" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <Link href="/participate" className={`${amberButton} mt-8`}>
              Back to the categories
            </Link>
          </div>
        );
      }}
    >
      {(values, pending) => (
        <>
          <p className="text-sm text-ink/70">
            Fields marked <span className="text-amber-ink">*</span> are required. {taxNote}
          </p>
          <div>
            <label htmlFor="f-categorySlug" className="block text-sm font-semibold">
              Delegate category
              <Req />
            </label>
            <select id="f-categorySlug" name="categorySlug" required value={slug} onChange={(e) => setSlug(e.target.value)} className="mt-1.5 block h-12 w-full border border-ink/25 bg-white px-3 text-sm text-ink focus:border-amber">
              <option value="">Choose</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {sme ? (
            <fieldset className="space-y-5 border border-amber/50 bg-amber/10 p-5">
              <legend className="px-1 font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">Selected SME</legend>
              <p className="text-sm leading-relaxed text-ink/80">
                Your business, country and sector come from your ADTIS application, so there is nothing more to fill in about them. Use the application number from your selection email, and below the email address of your Entrust account.
              </p>
              <div>
                <label htmlFor="f-applicationNumber" className="block text-sm font-semibold">
                  Application number
                  <Req />
                </label>
                <input id="f-applicationNumber" name="applicationNumber" required placeholder="SUM-000123" defaultValue={values.applicationNumber ?? ""} className="mt-1.5 block h-12 w-full border border-ink/25 bg-white px-3 font-mono text-sm uppercase text-ink placeholder:text-ink/40 focus:border-amber" />
              </div>
            </fieldset>
          ) : (
            <fieldset className="space-y-5">
              <legend className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">Your organisation</legend>
              <Text name="organisation" label="Organisation" required values={values} autoComplete="organization" />
              <CountrySelect values={values} options={countries} />
              <Select name="sector" label="Sector" values={values} options={BUSINESS_SECTORS.map((s) => ({ value: s, label: s }))} />
            </fieldset>
          )}
          <fieldset className="space-y-5">
            <legend className="font-mono text-[11px] tracking-[0.2em] text-amber-ink uppercase">About you</legend>
            <Text name="fullName" label="Full name" required values={values} autoComplete="name" hint="As you want it on your badge." />
            <Text name="jobTitle" label="Job title" required values={values} autoComplete="organization-title" />
            <Text name="email" label="Email address" required type="email" values={values} autoComplete="email" hint="Your confirmation and badge are sent here." />
            <Text name="phone" label="Telephone / WhatsApp" type="tel" values={values} autoComplete="tel" />
            <Area name="needs" label="Dietary or accessibility needs" values={values} rows={2} />
          </fieldset>
          <Consent>I agree that the ADTIS team may contact me about the summit.</Consent>
          <Trap />
          <Submit pending={pending}>Register</Submit>
        </>
      )}
    </ActionForm>
  );
}
