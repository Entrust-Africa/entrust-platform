import { NotOpen, Page } from "@/components/site";
import { getCatalogue } from "@/lib/commerce";
import { countryOptions } from "@/lib/countries";
import { SponsorForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Become a sponsor · ADTIS 2027" };

export default async function EnquirePage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const { package: chosen } = await searchParams;
  const catalogue = await getCatalogue();
  const edition = catalogue?.edition;
  const levels = (catalogue?.sponsorship ?? []).filter((p) => !p.availability.soldOut);
  const opportunities = (catalogue?.opportunities ?? []).filter((p) => !p.availability.soldOut);

  return (
    <Page label="Sponsor" title="Become a sponsor" intro="Tell us which package interests you and what you want from partnering with ADTIS. A member of the team will contact you. Nothing is reserved or charged yet.">
      {!edition || levels.length + opportunities.length === 0 ? (
        <NotOpen what="Sponsorship" />
      ) : (
        <section className="px-6 py-16 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <SponsorForm
              countries={countryOptions()}
              levels={levels.map((p) => ({ slug: p.slug, label: `${p.name}: ${p.price}` }))}
              opportunities={opportunities.map((p) => ({ slug: p.slug, label: `${p.name}: ${p.price}` }))}
              taxNote={edition.taxNote}
              chosen={chosen}
            />
          </div>
        </section>
      )}
    </Page>
  );
}
