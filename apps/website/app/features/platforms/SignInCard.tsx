import { buttonClasses } from "../../components/ui/Button";
import { ArrowUpRight } from "../../components/ui/icons";
import { NEW_TAB } from "./theme";

type CardLink = { label: string; href: string };

type Props = {
  /** Platform name as shown in "Sign in to …". */
  name: string;
  signInHref: string;
  /** Bottom-left link (e.g. "Create an account"). */
  secondary: CardLink;
  /** Bottom-right link (e.g. "Forgot your password?"). */
  forgot: CardLink;
};

/**
 * Sign-in panel for the platform heroes. Signing in happens on the platform
 * itself (its auth lives on its own domain), so the card hands the visitor to
 * the platform's sign-in page instead of collecting a password here.
 */
export function SignInCard({ name, signInHref, secondary, forgot }: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-lg bg-surface p-6 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]">
      <h2 className="text-xl font-semibold leading-7 text-ink">Sign in to {name}</h2>
      <a href={signInHref} {...NEW_TAB} className={buttonClasses("primary", "lg", "w-full")}>
        <span>Sign in</span>
        <ArrowUpRight className="transition-transform duration-300 group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
      </a>
      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
        {[secondary, forgot].map((l) => (
          <a
            key={l.label}
            href={l.href}
            {...NEW_TAB}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand"
          >
            <span className="link-grow">{l.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
