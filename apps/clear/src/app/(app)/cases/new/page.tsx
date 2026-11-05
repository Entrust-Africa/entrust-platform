import Link from "next/link";
import { Card } from "@entrust/ui";
import type { FactKey } from "@entrust/rules";
import { getMe, listExporters, listOrganizations } from "@/lib/api";
import { DESTINATIONS, factDefinition } from "@/lib/catalogue";
import { NewCaseForm, type FactChoice } from "./new-case-form";

export const metadata = { title: "New case" };

const choice = (key: FactKey): FactChoice => {
  const fact = factDefinition(key);
  return { label: fact?.label ?? key, help: fact?.help ?? "", options: fact?.options ?? [] };
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mt-6 p-6">
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-sm text-ink-2">{children}</p>
    </Card>
  );
}

export default async function NewCasePage() {
  const me = await getMe();
  // Admins and facilitators open cases on behalf of any exporter, so they pick one; everyone else uses their own organisations.
  const forAnyExporter = me?.staffRole === "admin" || me?.staffRole === "facilitator";
  const organizations = forAnyExporter ? await listExporters() : await listOrganizations();

  const facts = {
    product: choice("product"),
    transportMode: choice("transportMode"),
    coldChain: choice("coldChain"),
    paymentTerms: choice("paymentTerms"),
    incoterm: choice("incoterm"),
  };

  const body = (() => {
    if (me?.staffRole === "reviewer") {
      return (
        <Notice title="Reviewers don't open cases">An Entrust admin or facilitator opens a case for an exporter.</Notice>
      );
    }
    if (forAnyExporter) {
      return organizations.length === 0 ? (
        <Notice title="No exporter has access to CLEAR yet">
          A case is opened for an SME organisation with CLEAR access. Give the exporter&apos;s organisation access first.
        </Notice>
      ) : (
        <NewCaseForm organizations={organizations} chooseExporter destinations={DESTINATIONS} facts={facts} />
      );
    }
    if (organizations.length === 0) {
      return (
        <Notice title="Your account isn't in an organisation yet">
          A case belongs to an exporting company. Ask your Entrust facilitator to add you to yours.
        </Notice>
      );
    }
    const clearOrgs = me?.organizations
      ? organizations.filter((o) => me.organizations?.find((m) => m.id === o.id)?.platforms.includes("clear") ?? true)
      : organizations;
    if (clearOrgs.length === 0) {
      return (
        <Notice title="CLEAR is not available for this organisation">
          None of your organisations currently have access to the CLEAR platform. Switch to an organisation that has access, or contact Entrust support.
        </Notice>
      );
    }
    const defaultOrg = clearOrgs.some((o) => o.id === me?.activeOrganizationId)
      ? me!.activeOrganizationId!
      : clearOrgs[0]!.id;
    return <NewCaseForm organizations={clearOrgs} defaultOrganization={defaultOrg} destinations={DESTINATIONS} facts={facts} />;
  })();

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
      {body}
    </div>
  );
}
