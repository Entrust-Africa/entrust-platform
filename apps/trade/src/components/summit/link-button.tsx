import Link from "next/link";
import { cn } from "@entrust/ui";

const looks = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-900",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  "on-night": "bg-on-night text-night hover:bg-white",
} as const;

/** A link that looks like the big button: for moving to another page rather than doing something. */
export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: keyof typeof looks;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-md px-6 text-center text-base font-semibold transition-colors",
        looks[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
