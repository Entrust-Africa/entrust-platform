import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";

export function CommunityPageContent() {
  return (
    <main className="community-page" style={{ padding: "3rem 1.25rem 5rem", maxWidth: 720, margin: "0 auto" }}>
      <h1
        className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-zinc-900 mb-4"
        style={{ lineHeight: 1.2 }}
      >
        Join the Entrust Africa community
      </h1>
      <p className="text-lg text-zinc-800 mb-8" style={{ lineHeight: 1.65 }}>
        Stay connected to African professionals, entrepreneurs, and diaspora communities. We share event updates,
        partnership opportunities, and ways to collaborate through Entrust, Andinet, and Afri-Bridge.
      </p>

      <section className="mb-10 p-6 rounded-2xl border border-zinc-200 bg-zinc-50">
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-zinc-900 mb-2">
          Newsletter
        </h2>
        <p className="text-zinc-700 mb-4" style={{ lineHeight: 1.65 }}>
          Get updates on events, programs, and community highlights. We never spam—unsubscribe anytime.
        </p>
      </section>

     
    
    </main>
  );
}
