import Link from "next/link";
import { Card } from "@entrust/ui";

export default function HomePage() {
  return (
    <div className="w-full">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Export cases</h1>
          <p className="mt-1 text-sm text-ink-2">Track and manage your compliance and export workflows.</p>
        </div>
      </div>

      <Card className="mt-6 px-6 py-16 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg
            className="size-6"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <p className="mt-4 font-display text-lg font-bold">No export cases yet</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-2">
          Case intake arrives with the GATE engine. Until then, the{" "}
          <Link href="/design" className="font-semibold text-brand-600 underline underline-offset-4 hover:text-brand-700">
            design system
          </Link>{" "}
          shows the components the case screens will use.
        </p>
      </Card>
    </div>
  );
}
