import { Page } from "@/components/site";
import { SPEAKERS } from "@/lib/info";

export const metadata = { title: "Speakers · Africa Diaspora Trade & Investment Summit 2027" };

export default function SpeakersPage() {
  return (
    <Page label="Speakers" title="Confirmed speakers" intro="Speakers and institutional representatives are listed here once they are confirmed.">
      <section className="px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-[82rem]">
          {SPEAKERS.length === 0 ? (
            <p className="max-w-2xl border border-line bg-paper p-8 text-base leading-relaxed text-ink/75">The speakers will be announced as arrangements are finalised. Check back soon, or see the News page for updates.</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {SPEAKERS.map((s) => (
                <li key={s.name} className="border border-line bg-white p-6">
                  {s.photo && <img src={s.photo} alt="" className="mb-4 aspect-square w-full object-cover" />}
                  <p className="font-display text-2xl leading-tight uppercase">{s.name}</p>
                  <p className="mt-2 text-sm text-ink/70">{s.title}</p>
                  <p className="text-sm font-semibold">{s.organisation}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Page>
  );
}
