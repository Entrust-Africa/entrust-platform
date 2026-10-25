import Link from "next/link";
import { Card } from "@entrust/ui";
import type { FactKey } from "@entrust/rules";
import { getMe, listOrganizations } from "@/lib/api";
import { DESTINATIONS, factDefinition } from "@/lib/catalogue";
import { NewCaseForm, type FactChoice } from "./new-case-form";

export const metadata = { title: "New case" };

const choice = (key: FactKey): FactChoice => {
  const fact = factDefinition(key);
  return { label: fact?.label ?? key, help: fact?.help ?? "", options: fact?.options ?? [] };
};

export default async function NewCasePage() {
  const [me, organizations] = await Promise.all([getMe(), listOrganizations()]);
  return (
    <div className="max-w-2xl">
      <Link href="/" className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline">
        ← Cases
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold">New export case</h1>
      <p className="mt-2 text-sm text-ink-2">
        The product and destination decide the steps the case gets and the rule pack it follows. Record the rest
        now if you know it; anything left out is asked for at the step that needs it.
      </p>
      {organizations.length === 0 ? (
        <Card className="mt-6 p-6">
          <p className="font-semibold">Your account isn&apos;t in an organisation yet</p>
          <p className="mt-2 text-sm text-ink-2">
            A case belongs to an exporting company. Ask your Entrust facilitator to add you to yours.
          </p>
        </Card>
      ) : (
        <NewCaseForm
          organizations={organizations}
          defaultOrganization={
            organizations.some((o) => o.id === me?.activeOrganizationId) ? me!.activeOrganizationId! : organizations[0]!.id
          }
          destinations={DESTINATIONS}
          facts={{
            product: choice("product"),
            transportMode: choice("transportMode"),
            coldChain: choice("coldChain"),
            paymentTerms: choice("paymentTerms"),
            incoterm: choice("incoterm"),
          }}
        />
      )}
    </div>
  );
}
