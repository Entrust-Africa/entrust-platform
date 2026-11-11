"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, Card } from "@entrust/ui";

/** What a page shows when something it needed failed (often the API not answering), instead of a bare "Application error". */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card className="space-y-4 p-8 text-center">
        <h1 className="font-display text-xl font-bold text-ink">This page couldn&apos;t load</h1>
        <p className="text-sm text-ink-2">Something it needed didn&apos;t answer in time. Your work is saved. Try again in a moment.</p>
        {error.digest && <p className="font-mono text-xs text-ink-3">Reference {error.digest}</p>}
        <div className="flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className="inline-flex h-10 items-center rounded-md border border-line-strong px-4 text-sm font-semibold text-ink hover:bg-surface-2">
            Go to the start
          </Link>
        </div>
      </Card>
    </div>
  );
}
