"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@entrust/ui";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Use "danger" for something that can't be undone. */
  tone?: "primary" | "danger";
  busy?: boolean;
  error?: string | undefined;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A question the person has to answer before something that can't be undone. It traps focus and closes on Escape. */
export function ConfirmDialog({ open, title, children, confirmLabel, cancelLabel = "Go back", tone = "primary", busy, error, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-ink/60"
    >
      <div className="space-y-4 p-5 sm:p-6">
        <h2 id="confirm-title" className="font-display text-xl font-bold">
          {title}
        </h2>
        <div className="space-y-2 text-base leading-relaxed text-ink-2">{children}</div>
        {error && (
          <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="lg" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} size="lg" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
