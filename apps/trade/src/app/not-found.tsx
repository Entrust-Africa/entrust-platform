import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-xl font-bold text-ink">Not found</h1>
      <p className="mt-3 text-sm text-ink-2">This page doesn&apos;t exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold text-brand-600 hover:underline">
        Go to TRADE
      </Link>
    </main>
  );
}
