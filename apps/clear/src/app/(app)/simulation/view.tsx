"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { STEPS } from "@entrust/rules";

// Which tab is shown and which step is open live in the address bar, as they do on a case page, so
// a view can be linked to and Back closes a step's panel. The run itself stays in the browser: the
// address is changed with the History API, without a trip to the server.

export const TABS = [
  { id: "steps", label: "Steps" },
  { id: "order", label: "Order" },
  { id: "documents", label: "Documents" },
  { id: "deadlines", label: "Deadlines" },
  { id: "activity", label: "Activity" },
] as const;

export type Tab = (typeof TABS)[number]["id"];

export interface View {
  tab: Tab;
  /** The phase the steps tab shows, when it is not following the run. */
  phase?: number;
  /** The step whose panel is open. */
  step?: string;
}

/** The address of a view of the simulator, on the page it is shown on. */
export function viewHref(pathname: string, view: Partial<View>): string {
  const params = new URLSearchParams();
  if (view.tab && view.tab !== "steps") params.set("tab", view.tab);
  if (view.phase) params.set("phase", String(view.phase));
  if (view.step) params.set("step", view.step);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ""}`;
}

export function useView(): View {
  const params = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("tab"))?.id ?? "steps";
  const phase = Number(params.get("phase"));
  const step = params.get("step");
  return {
    tab,
    phase: tab === "steps" && phase >= 1 && phase <= 7 ? phase : undefined,
    step: STEPS.some((s) => s.id === step) ? (step as string) : undefined,
  };
}

/** Go to a view. Opening a step adds a history entry, so Back closes it; the rest replace. */
export function go(href: string, mode: "push" | "replace" = "replace") {
  if (mode === "push") window.history.pushState(null, "", href);
  else window.history.replaceState(null, "", href);
}

/** A real link to a view of the simulator that changes the address without leaving the page. */
export function ViewLink({
  to,
  mode = "replace",
  onClick,
  ...props
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: Partial<View>; mode?: "push" | "replace" }) {
  const href = viewHref(usePathname(), to);
  const handle = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      // A modified click opens the link the browser's way, in a new tab or window.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      go(href, mode);
    },
    [href, mode, onClick],
  );
  return <a href={href} onClick={handle} {...props} />;
}
