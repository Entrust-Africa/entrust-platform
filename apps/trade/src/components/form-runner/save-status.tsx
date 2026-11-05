"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";
import { cn } from "@entrust/ui";
import type { SaveState } from "./use-autosave";

/** "Saving…", "Saved" or "Couldn't save" with a retry button. Always in the page so a screen reader hears it change. */
export function SaveStatus({ state, onRetry, readOnly }: { state: SaveState; onRetry: () => void; readOnly: boolean }) {
  if (readOnly) return null;
  const { status } = state;
  return (
    <div className="flex min-h-8 items-center text-sm" role="status" aria-live="polite">
      {(status === "saving" || status === "unsaved") && (
        <span className="inline-flex items-center gap-1.5 text-ink-2">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Saving…
        </span>
      )}
      {(status === "saved" || status === "idle") && (
        <span className={cn("inline-flex items-center gap-1.5", status === "saved" ? "text-ok" : "text-ink-3")}>
          <Check className="size-4" aria-hidden="true" />
          {status === "saved" ? "Saved" : "Saves as you go"}
        </span>
      )}
      {status === "error" && (
        <span className="inline-flex flex-wrap items-center gap-x-2 text-danger">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertCircle className="size-4" aria-hidden="true" />
            Couldn't save
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-11 items-center rounded-md px-2 font-semibold underline underline-offset-4 hover:bg-danger-50"
          >
            Try again
          </button>
        </span>
      )}
    </div>
  );
}
