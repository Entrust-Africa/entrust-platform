import Link from "next/link";
import { Card } from "@entrust/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-12">
      <Card className="space-y-4 p-8 text-center">
        <h1 className="font-display text-xl font-bold text-ink">Not found</h1>
        <p className="text-sm text-ink-2">This page doesn&apos;t exist, or it isn&apos;t one you can open.</p>
        <Link href="/" className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Go to the start
        </Link>
      </Card>
    </div>
  );
}
