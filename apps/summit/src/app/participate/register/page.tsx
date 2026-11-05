import { NotOpen, Page } from "@/components/site";
import { getCatalogue } from "@/lib/commerce";
import { countryOptions } from "@/lib/countries";
import { DelegateForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Register as a delegate · ADTIS 2027" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const catalogue = await getCatalogue();
  const edition = catalogue?.edition;
  const categories = (catalogue?.delegates ?? []).filter((p) => !p.availability.soldOut);

  return (
    <Page label="Participate" title="Register as a delegate" intro="Choose your category and tell us who is coming. You will receive a reference number and a digital badge with a QR code by email.">
      {!edition || categories.length === 0 ? (
        <NotOpen what="Delegate registration" />
      ) : (
        <section className="px-6 py-16 lg:px-16 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <DelegateForm
              countries={countryOptions()}
              categories={categories.map((p) => ({ slug: p.slug, label: `${p.name}: ${p.price}`, selectedSme: p.attributes.eligibility === "selected_sme" }))}
              taxNote={edition.taxNote}
              chosen={category}
            />
          </div>
        </section>
      )}
    </Page>
  );
}
