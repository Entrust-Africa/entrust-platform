import Image from "next/image";
import Link from "next/link";
import { Patchwork } from "@entrust/ui";

/** The frame for pages a visitor can open without signing in: the same header look as the app, with a way in. */
export function PublicShell({
  children,
  homeHref = "/summit",
  homeLabel = "TRADE, Summit",
  signInHref = "/sign-in?next=%2Fsummit%2Fapply",
}: {
  children: React.ReactNode;
  homeHref?: string;
  homeLabel?: string;
  signInHref?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-xs">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-3 focus:py-1.5 focus:text-xs focus:font-semibold focus:text-white focus:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          Skip to content
        </a>
        <Patchwork />
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={homeHref}
            aria-label={homeLabel}
            className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Image src="/logo.png" alt="" width={36} height={36} className="size-9 object-contain" priority />
            <span className="font-display text-base font-extrabold tracking-tight text-ink">TRADE</span>
          </Link>
          <Link
            href={signInHref}
            className="inline-flex h-11 items-center rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2"
          >
            Sign in
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6">
        {children}
      </main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-ink-3 sm:px-6">
          TRADE is part of Entrust Africa. Questions? Write to{" "}
          <a className="font-semibold text-brand-700 underline underline-offset-4" href="mailto:info@entrustafrica.com">
            info@entrustafrica.com
          </a>
          .
        </div>
      </footer>
    </div>
  );
}
