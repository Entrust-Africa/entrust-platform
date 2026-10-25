"use client";

import { Button, Card, Field } from "@entrust/ui";
import { useActionForm } from "../action-form";
import { createCase } from "../actions";
import { CheckboxGroup, SelectField } from "../inputs";

export interface FactChoice {
  label: string;
  help: string;
  options: readonly { value: string; label: string }[];
}

export function NewCaseForm({
  organizations,
  defaultOrganization,
  destinations,
  facts,
}: {
  organizations: { id: string; name: string }[];
  defaultOrganization: string;
  destinations: { group: string; countries: { code: string; name: string }[] }[];
  facts: Record<"product" | "transportMode" | "coldChain" | "paymentTerms" | "incoterm", FactChoice>;
}) {
  const { state, pending, onSubmit } = useActionForm(createCase);
  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-6">
      <Card className="flex flex-col gap-5 p-4 sm:p-6">
        <h2 className="font-display text-base font-bold">What is exported, and where</h2>
        {organizations.length > 1 ? (
          <SelectField
            label="Exporter"
            name="organizationId"
            defaultValue={defaultOrganization}
            options={organizations.map((o) => ({ value: o.id, label: o.name }))}
          />
        ) : (
          <input type="hidden" name="organizationId" value={defaultOrganization} />
        )}
        <SelectField
          label={facts.product.label}
          name="product"
          required
          placeholder="Choose the product"
          options={facts.product.options}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            label="Destination country"
            name="destinationCountry"
            placeholder="Choose the country"
            hint="The launch corridors' countries."
            groups={destinations.map((d) => ({
              label: d.group,
              options: d.countries.map((c) => ({ value: c.code, label: c.name })),
            }))}
          />
          <Field
            label="Another country"
            name="otherDestination"
            placeholder="JP"
            maxLength={2}
            pattern="[A-Za-z]{2}"
            hint="Its two-letter ISO code, if it isn't in the list."
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-5 p-4 sm:p-6">
        <div>
          <h2 className="font-display text-base font-bold">Shipment and payment</h2>
          <p className="mt-1 text-sm text-ink-2">Optional now. The Incoterm is confirmed at STEP-022 and the payment terms at STEP-025.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label={facts.transportMode.label} name="transportMode" placeholder="Not known yet" options={facts.transportMode.options} />
          <SelectField label={facts.incoterm.label} name="incoterm" placeholder="Not known yet" options={facts.incoterm.options} />
          <SelectField
            label={facts.coldChain.label}
            name="coldChain"
            placeholder="Not known yet"
            hint={facts.coldChain.help}
            options={facts.coldChain.options}
          />
          <Field
            label="Amount paid by cash against documents (USD)"
            name="cadAmountUsd"
            inputMode="decimal"
            hint="Checked against the NBE cap of USD 500,000 per permit."
          />
        </div>
        <CheckboxGroup legend={facts.paymentTerms.label} name="paymentTerms" hint={facts.paymentTerms.help} options={facts.paymentTerms.options} />
      </Card>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" loading={pending}>
          Open the case
        </Button>
      </div>
    </form>
  );
}
