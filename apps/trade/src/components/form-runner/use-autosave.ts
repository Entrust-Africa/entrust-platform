"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnswerPatch } from "./types";

export type SaveStatus = "idle" | "unsaved" | "saving" | "saved" | "error";

export interface SaveState {
  status: SaveStatus;
  message?: string;
}

const messageOf = (error: unknown) => (error instanceof Error && error.message ? error.message : "Something went wrong.");

/**
 * Collects answer changes and saves them a moment after the last one. Saves go one at a time and in order. A save that
 * fails keeps its changes, so the next try (the retry button or the next edit) sends them again. It never retries on its
 * own, so a server that is down is not hammered.
 */
export function useAutosave(onSave: (patch: AnswerPatch) => Promise<void>, options: { delayMs?: number; enabled?: boolean } = {}) {
  const { delayMs = 800, enabled = true } = options;
  const pending = useRef<AnswerPatch>({});
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const saveRef = useRef(onSave);
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const mounted = useRef(true);

  useEffect(() => {
    saveRef.current = onSave;
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const set = useCallback((next: SaveState) => {
    if (mounted.current) setState(next);
  }, []);

  /** Sends what is waiting. Resolves true when nothing is left unsaved. */
  const flush = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current);
    timer.current = undefined;
    while (inFlight.current) await inFlight.current;
    if (Object.keys(pending.current).length === 0) return true;

    const patch = pending.current;
    pending.current = {};
    set({ status: "saving" });
    const attempt = saveRef.current(patch).then(
      () => true,
      (error: unknown) => {
        // Put the changes back, unless the person has changed the same answer again since.
        for (const [id, value] of Object.entries(patch)) if (!(id in pending.current)) pending.current[id] = value;
        set({ status: "error", message: messageOf(error) });
        return false;
      },
    );
    inFlight.current = attempt;
    const saved = await attempt;
    inFlight.current = null;
    if (saved) {
      const more = Object.keys(pending.current).length > 0;
      if (more && !timer.current) timer.current = setTimeout(() => void flush(), delayMs);
      set(more ? { status: "unsaved" } : { status: "saved" });
    }
    return saved && Object.keys(pending.current).length === 0;
  }, [delayMs, set]);

  /** Adds changes to what is waiting and saves after the person pauses. */
  const queue = useCallback(
    (patch: AnswerPatch) => {
      if (!enabled) return;
      Object.assign(pending.current, patch);
      set({ status: "unsaved" });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, enabled, flush, set],
  );

  // Leaving the tab or the page is the last chance to send what is waiting.
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden" && Object.keys(pending.current).length > 0) void flush();
    };
    const warn = (event: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length > 0 || inFlight.current) event.preventDefault();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", hidden);
    window.addEventListener("beforeunload", warn);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", hidden);
      window.removeEventListener("beforeunload", warn);
      clearTimeout(timer.current);
      if (Object.keys(pending.current).length > 0) void flush();
    };
  }, [flush]);

  return { state, queue, flush };
}
