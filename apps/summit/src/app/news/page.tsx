import { Page } from "@/components/site";
import { NEWS } from "@/lib/info";

export const metadata = { title: "News & updates · Africa Diaspora Trade & Investment Summit 2027" };

export default function NewsPage() {
  return (
    <Page label="News & updates" title="Announcements" intro="Summit announcements, media and updates.">
      <section className="px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-3xl">
          {NEWS.length === 0 ? (
            <p className="border border-line bg-paper p-8 text-base leading-relaxed text-ink/75">No announcements yet. The dates, programme and speakers will be published here as they are confirmed.</p>
          ) : (
            <ol className="space-y-8">
              {NEWS.map((n) => (
                <li key={n.title} className="border-t border-line pt-6">
                  <time className="font-mono text-[11px] tracking-[0.16em] text-amber-ink uppercase" dateTime={n.date}>
                    {n.date}
                  </time>
                  <h2 className="mt-2 font-display text-3xl leading-tight uppercase">{n.url ? <a href={n.url} className="hover:text-amber-ink">{n.title}</a> : n.title}</h2>
                  <p className="mt-3 text-base leading-relaxed text-ink/75">{n.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </Page>
  );
}
