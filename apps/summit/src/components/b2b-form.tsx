"use client";

import { ActionForm, Area, Consent, Select, Submit, Text, Trap } from "@/components/forms";
import { b2bAction } from "@/app/commerce-actions";

const INTERESTS = [
  { value: "buyer", label: "Buying products or services" },
  { value: "investor", label: "Investing" },
  { value: "distributor", label: "Distribution" },
  { value: "partner", label: "Strategic partnership" },
  { value: "other", label: "Something else" },
];

/** "Request B2B Matchmaking": a buyer, investor or partner asks to be put in touch with a business. */
export function B2bForm({ slug, name }: { slug: string; name: string }) {
  return (
    <ActionForm
      action={b2bAction}
      done={(state) => (
        <div className="border border-amber/60 bg-amber/10 p-6">
          <p className="font-mono text-[11px] tracking-[0.18em] text-amber-ink uppercase">Reference {String(state.receipt.number)}</p>
          <h3 className="mt-2 font-display text-2xl leading-none uppercase">Your enquiry is on its way</h3>
          <p className="mt-3 text-sm leading-relaxed text-ink/80">
            We have passed your message to {name}, which will reply to you directly at <strong>{state.email}</strong>. The ADTIS team can also help arrange a meeting at the summit.
          </p>
        </div>
      )}
    >
      {(values, pending) => (
        <>
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm text-ink/70">
            Fields marked <span className="text-amber-ink">*</span> are required. Your details are shared with {name} and the ADTIS team.
          </p>
          <Select name="interest" label="I am interested in" required values={values} options={INTERESTS} />
          <Text name="name" label="Your name" required values={values} autoComplete="name" />
          <Text name="organisation" label="Your organisation" required values={values} autoComplete="organization" />
          <Text name="role" label="Your role" values={values} autoComplete="organization-title" />
          <Text name="email" label="Email" required type="email" values={values} autoComplete="email" />
          <Text name="phone" label="Telephone / WhatsApp" type="tel" values={values} autoComplete="tel" />
          <Area name="message" label="Your message" required values={values} rows={4} hint="What would you like to discuss?" />
          <Consent>I agree that {name} and the ADTIS team may contact me about this enquiry.</Consent>
          <Trap />
          <Submit pending={pending}>Request B2B Matchmaking</Submit>
        </>
      )}
    </ActionForm>
  );
}
