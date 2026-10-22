"use client";

import { useState } from "react";

type Props = {
  source?: string;
  className?: string;
};

export function NewsletterForm({ source = "site", className = "" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setStatus("err");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }
      setStatus("ok");
      setMessage(data.message ?? "You are subscribed.");
      setEmail("");
    } catch {
      setStatus("err");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className={`flex flex-col gap-3 sm:flex-row sm:items-stretch ${className}`}>
      <label className="sr-only" htmlFor={`newsletter-email-${source}`}>
        Email
      </label>
      <input
        id={`newsletter-email-${source}`}
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="min-h-[3rem] flex-1 rounded-xl border border-zinc-300 px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-[#19954f] focus:outline-none focus:ring-2 focus:ring-[#19954f]/30"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="min-h-[3rem] rounded-xl bg-[#19954f] px-6 font-[family-name:var(--font-heading)] font-bold text-white transition hover:bg-[#157642] disabled:opacity-60"
      >
        {status === "loading" ? "…" : "Stay updated"}
      </button>
      {message ? (
        <p className={`text-sm sm:col-span-full ${status === "ok" ? "text-green-800" : "text-red-700"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
