import { Card } from "@entrust/ui";
import { ok } from "@/lib/summit-api";
import { load, requireUser } from "@/lib/summit-server";
import { Catalogue, EditionForm, MakeCurrentButton, NewEditionForm } from "@/components/commerce/settings";
import { PageTitle, Section } from "@/components/commerce/ui";

export const metadata = { title: "ADTIS settings" };

export default async function SettingsPage() {
  const path = "/summit/commerce/settings";
  const me = await requireUser(path);
  const canEdit = me.staffRole === "admin";
  const editions = await load(path, (api) => ok(api.v1.summit.commerce.editions.$get()));
  const current = editions.items.find((e) => e.isCurrent) ?? editions.items[0];
  const detail = current ? await load(path, (api) => ok(api.v1.summit.commerce.editions[":id"].$get({ param: { id: current.id } }))) : null;
  const periods = canEdit && current ? (await load(path, (api) => ok(api.v1.summit.periods.$get()))).items.map((p) => ({ id: p.id, name: p.name })) : [];

  return (
    <div className="space-y-8">
      <PageTitle title="Settings" intro="Prices, benefits, the number of booths and passes, payment instructions and the tax note. The team changes these here; nothing needs a developer." />
      {!canEdit && (
        <Card className="p-4 text-sm text-ink-2">Only an Entrust administrator can change these settings. You can see them here.</Card>
      )}

      {!current && canEdit && <NewEditionForm editions={[]} hasEditions={false} />}
      {!current && !canEdit && <Card className="p-4 text-sm text-ink-2">No edition has been set up yet.</Card>}

      {detail && (
        <>
          <Section title={detail.name} hint={detail.isCurrent ? "This is the edition the website sells." : "This edition is not the one the website sells."}>
            {canEdit ? (
              <EditionForm edition={detail} periods={periods} />
            ) : (
              <Card className="space-y-1 p-4 text-sm text-ink-2">
                <p>{detail.venue} · {detail.datesNote}</p>
                <p>{detail.taxNote}</p>
                <p>{detail.paymentMethods.length} payment method{detail.paymentMethods.length === 1 ? "" : "s"} set up.</p>
              </Card>
            )}
          </Section>

          <Section title="Packages, levels, categories and opportunities" hint="Prices are in US dollars. The number available is what stops a package being booked beyond what you have; leave it empty until you know it.">
            <Catalogue edition={detail} canEdit={canEdit} />
          </Section>
        </>
      )}

      {canEdit && current && (
        <Section title="Editions">
          <div className="overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <tbody className="divide-y divide-line">
                {editions.items.map((e) => (
                  <tr key={e.id}>
                    <th scope="row" className="px-3 py-2.5 font-semibold text-ink">{e.name}</th>
                    <td className="px-3 py-2.5 text-ink-2">{e.slug}</td>
                    <td className="px-3 py-2.5 text-ink-2">{e.productCount} products</td>
                    <td className="px-3 py-2.5 text-right">{e.isCurrent ? <span className="font-semibold text-ok">Current</span> : <MakeCurrentButton id={e.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <NewEditionForm editions={editions.items.map((e) => ({ id: e.id, name: e.name }))} hasEditions />
        </Section>
      )}
    </div>
  );
}
