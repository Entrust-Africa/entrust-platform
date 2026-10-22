import { redirect } from "next/navigation";
import { Patchwork } from "@entrust/ui";
import { getMe } from "@/lib/api";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await getMe()) redirect("/");
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <section className="relative flex flex-col justify-between gap-12 bg-night px-6 py-10 text-on-night sm:px-12 lg:py-14">
        <p className="font-display text-sm font-bold tracking-[0.18em] text-on-night-muted uppercase">
          Entrust Africa
        </p>
        <div className="max-w-xl">
          <h1 className="font-display text-4xl font-extrabold leading-tight sm:text-display">
            Your export cases, step by step.
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-on-night-muted">
            CLEAR Export tracks every permit, document and deadline from first order to the
            final foreign exchange settlement.
          </p>
        </div>
        <Patchwork className="max-w-xs" />
      </section>
      <section className="flex items-center justify-center px-6 py-12 sm:px-12">
        <SignInForm />
      </section>
    </main>
  );
}
