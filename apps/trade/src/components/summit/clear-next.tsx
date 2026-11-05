"use client";

import { useEffect } from "react";
import { NEXT_COOKIE } from "@/lib/next-path";

/** Forgets where a visitor was headed once they have arrived (see RememberNext). */
export function ClearNext() {
  useEffect(() => {
    document.cookie = `${NEXT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }, []);
  return null;
}

/**
 * Keeps where a visitor was headed for a day, so the "check your email" and "email verified" pages, which the sign-up
 * flow sends them through and which carry no address of their own, can send them back to it.
 */
export function RememberNext({ next }: { next: string }) {
  useEffect(() => {
    document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=86400; samesite=lax`;
  }, [next]);
  return null;
}
