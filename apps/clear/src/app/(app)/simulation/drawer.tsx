"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A panel over the right of the page, for one step. The same panel as a case page's, but closing
 * it is left to the caller, because the simulator changes the address without a server round trip.
 */
export function Drawer({ onClose, label, children }: { onClose: () => void; label: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close.current();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      // Focus goes back to the row that opened the panel.
      opener?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40">
      <button type="button" tabIndex={-1} aria-hidden onClick={onClose} className="absolute inset-0 cursor-default bg-ink/40" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-surface shadow-2xl outline-none"
      >
        {children}
      </div>
    </div>
  );
}
