import { NotOpen, Page } from "@/components/site";
import { getCatalogue } from "@/lib/commerce";
import { countryOptions } from "@/lib/countries";
import { ExhibitorForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book an exhibition booth · ADTIS 2027" };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const { package: chosen } = await searchParams;
  const catalogue = await getCatalogue();
  const edition = catalogue?.edition;
  const packages = (catalogue?.exhibition ?? []).filter((p) => !p.availability.soldOut);

  return (
    <Page label="Exhibit" title="Book an exhibition booth" intro="Complete the application. The ADTIS team reviews it and, if approved, sends you the payment instructions. Nothing is reserved or charged yet.">
      {!edition || packages.length === 0 ? (
        <NotOpen what="Exhibition booking" />
      ) : (
        <section className="px-6 py-16 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <ExhibitorForm
              countries={countryOptions()}
              packages={packages.map((p) => ({ slug: p.slug, label: `${p.name}: ${p.price}${p.attributes.boothSize ? ` (${p.attributes.boothSize})` : ""}` }))}
              zones={edition.exhibitionZones}
              taxNote={edition.taxNote}
              chosen={chosen}
            />
          </div>
        </section>
      )}
    </Page>
  );
}
