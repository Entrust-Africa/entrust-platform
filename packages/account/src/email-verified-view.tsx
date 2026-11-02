import Link from "next/link";

export interface EmailVerifiedViewProps {
  appName?: string;
  invitationId?: string;
  signInHref?: string;
}

export function EmailVerifiedView({
  appName = "CLEAR",
  invitationId,
  signInHref = "/sign-in",
}: EmailVerifiedViewProps) {
  const targetUrl = invitationId
    ? `/accept-invitation?id=${encodeURIComponent(invitationId)}`
    : signInHref;
  const buttonText = invitationId ? "Continue to accept invitation" : "Continue to sign in";

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-6">
      <section className="w-full rounded-lg border border-line bg-surface p-8 shadow-xs">
        <p className="text-sm font-semibold tracking-[0.12em] text-brand-600 uppercase">
          Entrust Africa
        </p>
        <h1 className="mt-4 font-display text-3xl font-bold">Email verified</h1>
        <p className="mt-3 text-ink-2">
          Your email address is verified. You can now access {appName}.
        </p>
        <Link
          className="mt-8 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          href={targetUrl}
        >
          {buttonText}
        </Link>
      </section>
    </main>
  );
}
