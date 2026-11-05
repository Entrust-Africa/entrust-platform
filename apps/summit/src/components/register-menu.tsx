"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface RegisterMenuItem {
  href: string;
  label: string;
}

/** The menu's width (w-72) plus a little air: the room it needs to the left of the button's right edge. */
const MENU_ROOM = 288 + 16;

/**
 * The header's Register button. It opens a list of the four ways to take part, so each has a call to action at the top of every
 * page. Closes on Escape, on a click outside and when focus leaves it.
 */
export function RegisterMenu({ items }: { items: RegisterMenuItem[] }) {
  const [open, setOpen] = useState(false);
  // The header wraps on tablets and the button can land at the left edge, where a menu hanging off its right edge would leave the screen.
  const [alignLeft, setAlignLeft] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          if (!open) setAlignLeft((root.current?.getBoundingClientRect().right ?? MENU_ROOM) < MENU_ROOM);
          setOpen((o) => !o);
        }}
        className="inline-flex h-10 cursor-pointer items-center gap-2 bg-amber px-5 text-xs font-semibold text-ink hover:brightness-110"
      >
        Register
        <ChevronDown aria-hidden className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div id={menuId} className={`absolute top-full ${alignLeft ? "left-0" : "right-0"} z-50 mt-2 w-72 max-w-[calc(100vw-3rem)] border border-white/15 bg-ink-deep text-white shadow-xl shadow-black/40`}>
          <p className="border-b border-white/10 px-5 py-3 font-mono text-[11px] tracking-[0.2em] text-white/60 uppercase">Register as</p>
          <ul>
            {items.map((item) => (
              <li key={item.href} className="border-b border-white/10 last:border-b-0">
                <a href={item.href} onClick={() => setOpen(false)} className="block px-5 py-3.5 text-sm font-semibold hover:bg-white/10 hover:text-amber">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
