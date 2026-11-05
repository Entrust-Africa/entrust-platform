"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { PASSES, SUPPORT_EMAIL, type PassId } from "@/lib/content";

// Every "Register" or "Get ... Pass" button on the page opens one dialog. The buttons and the dialog
// don't share a parent, so the buttons announce themselves with a window event.
const OPEN_EVENT = "summit:open-registration";

/** A button that opens the participant registration dialog, with the pass the visitor picked if any. */
export function OpenRegistration({
  pass,
  className,
  children,
}: {
  pass?: PassId;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { pass } }))}
    >
      {children}
    </button>
  );
}

/**
 * The participant registration form, in a modal. `url` is the registration form to frame; with none set,
 * the dialog says registration isn't open yet and gives an email address instead of showing a dead form.
 */
export function RegistrationDialog({ url }: { url: string | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState<PassId | null>(null);

  useEffect(() => {
    function onOpen(event: Event) {
      setPass((event as CustomEvent<{ pass?: PassId }>).detail?.pass ?? null);
      setOpen(true);
      dialog.current?.showModal();
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const picked = PASSES.find((p) => p.id === pass);
  const src = url && open ? withPass(url, pass) : undefined;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="registration-title"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialog.current) dialog.current?.close();
      }}
      className="m-auto w-[min(94vw,40rem)] border border-amber/60 bg-white p-0 text-ink backdrop:bg-ink-deep/80"
    >
      <div className="flex items-start justify-between gap-6 bg-ink px-6 py-5 text-white">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-amber uppercase">
            {picked ? picked.name : "Participant registration"}
          </p>
          <h2 id="registration-title" className="mt-2 font-display text-3xl leading-none uppercase">
            Register to attend
          </h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialog.current?.close()}
          className="-m-2 p-2 text-white/80 hover:text-white"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      {src ? (
        <iframe
          title="Participant registration form"
          src={src}
          className="block h-[min(70vh,40rem)] w-full border-0"
        />
      ) : (
        <div className="px-6 py-8">
          <p className="text-base leading-relaxed text-ink/80">
            Ticket registration isn&apos;t open yet. Email us and we&apos;ll tell you as soon as it is
            {picked ? `, and note your interest in the ${picked.name}` : ""}.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              picked ? `Diaspora Trade Summit: ${picked.name}` : "Diaspora Trade Summit registration",
            )}`}
            className="mt-6 inline-flex h-12 items-center bg-amber px-6 text-sm font-semibold text-ink hover:brightness-110"
          >
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      )}
    </dialog>
  );
}

function withPass(url: string, pass: PassId | null): string {
  if (!pass) return url;
  try {
    const next = new URL(url);
    next.searchParams.set("pass", pass);
    return next.toString();
  } catch {
    return url;
  }
}
