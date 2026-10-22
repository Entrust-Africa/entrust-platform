"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";

const hints = [
  {
    q: "What is Entrust Africa?",
    a: "Entrust Africa is an ecosystem connecting African professionals, entrepreneurs, and diaspora communities through events, networks, and platforms like Entrust, Andinet, and Afri-Bridge.",
  },
  {
    q: "How do I join events?",
    a: "Open Events from the top navigation or home page, pick a session, and use Register now.",
  },
  {
    q: "How do I partner?",
    a: "Use Become a Partner or visit the Andinet partners page. The contact form is the fastest way to reach the team.",
  },
];

export function SiteAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-[120] flex flex-col items-end gap-2">
      {open ? (
        <div
          className="w-[min(22rem,calc(100vw-2rem))] max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl"
          role="dialog"
          aria-label="Site guide"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-[family-name:var(--font-heading)] text-base font-extrabold text-zinc-900">
              Guide
            </span>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-800"
              onClick={() => setOpen(false)}
              aria-label="Close guide"
            >
              <X size={18} />
            </button>
          </div>
          <p className="text-sm text-zinc-700" style={{ lineHeight: 1.6 }}>
            Quick answers—full support is available via{" "}
            <Link href="/contact" className="font-semibold text-[#19954f] underline-offset-2 hover:underline">
              Contact
            </Link>
            .
          </p>
          <ul className="mt-3 flex list-none flex-col gap-3 p-0">
            {hints.map((item) => (
              <li key={item.q}>
                <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-zinc-900">{item.q}</p>
                <p className="text-sm text-zinc-700" style={{ lineHeight: 1.6 }}>
                  {item.a}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className="inline-flex h-14 w-14 items-center justify-center rounded-full border-0 bg-[#19954f] text-white shadow-lg shadow-green-900/25 transition hover:bg-[#157642]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Close guide" : "Open guide"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
