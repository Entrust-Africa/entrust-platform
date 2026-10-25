export default async function EmailVerifiedPage({ searchParams }: { searchParams: Promise<{ invitationId?: string }> }) {
  const { invitationId } = await searchParams;
  const targetUrl = invitationId ? `/accept-invitation?id=${encodeURIComponent(invitationId)}` : "/sign-in";
  const buttonText = invitationId ? "Continue to accept invitation" : "Continue to sign in";
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl items-center px-6">
      <section className="w-full rounded-lg border border-line bg-surface p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">Entrust Africa</p>
        <h1 className="mt-4 font-display text-3xl font-bold">Email verified</h1>
        <p className="mt-3 text-ink-2">Your email address is verified. You can now access CLEAR.</p>
        <a
          className="mt-8 inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
          href={targetUrl}
        >
          {buttonText}
        </a>
      </section>
    </main>
  );
}
