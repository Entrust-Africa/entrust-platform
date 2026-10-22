"use client";

import { useState } from "react";

type Props = {
  eventName: string;
  className?: string;
};

export function EventRsvpForm({ eventName, className = "" }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/event-rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventName, name, email, phone, notes }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setStatus("err");
        setMessage(data.error ?? "Could not register.");
        return;
      }
      setStatus("ok");
      setMessage(data.message ?? "Registered.");
      setName("");
      setEmail("");
      setPhone("");
      setNotes("");
    } catch {
      setStatus("err");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} className={`grid gap-3 ${className}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold text-zinc-800">
          Full name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 focus:border-[#19954f] focus:outline-none focus:ring-2 focus:ring-[#19954f]/25"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-800">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-h-11 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 focus:border-[#19954f] focus:outline-none focus:ring-2 focus:ring-[#19954f]/25"
          />
        </label>
      </div>
      <label className="grid gap-1 text-sm font-semibold text-zinc-800">
        Phone (optional)
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-11 rounded-lg border border-zinc-300 px-3 text-base text-zinc-900 focus:border-[#19954f] focus:outline-none focus:ring-2 focus:ring-[#19954f]/25"
        />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-800">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-base text-zinc-900 focus:border-[#19954f] focus:outline-none focus:ring-2 focus:ring-[#19954f]/25"
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="min-h-12 rounded-xl bg-[#19954f] font-[family-name:var(--font-heading)] font-bold text-white transition hover:bg-[#157642] disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Register now"}
      </button>
      {message ? (
        <p className={`text-sm ${status === "ok" ? "text-green-800" : "text-red-700"}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
