"use client";

import { useEffect, useState } from "react";
import { Button, Field } from "@entrust/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Org = { id: string; name: string; slug: string; role: string };

export function OrganizationSettings() {
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function load() {
    const response = await fetch(`${api}/v1/organizations`, { credentials: "include" });
    if (response.ok) setOrganizations((await response.json()).organizations);
  }
  useEffect(() => { void load(); }, []);

  async function create(form: FormData) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`${api}/v1/organizations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, legalName, slug: String(form.get("slug")) }),
      });
      setPending(false);
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const msg =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : "Could not create the organisation.";
        setError(msg);
      } else {
        setName("");
        setLegalName("");
        await load();
      }
    } catch {
      setPending(false);
      setError("Network error. Please try again.");
    }
  }

  return <main className="mx-auto max-w-4xl px-6 py-12"><p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-600">CLEAR · Organisations</p><h1 className="mt-3 font-display text-4xl font-bold">Organisation settings</h1><p className="mt-3 max-w-2xl text-ink-2">Create and manage the organisations you use in CLEAR. Every organisation receives a permanent SME ID.</p><section className="mt-10 grid gap-8 md:grid-cols-2"><div className="rounded-lg border border-line bg-surface p-6"><h2 className="font-display text-xl font-bold">Your organisations</h2><div className="mt-5 flex flex-col gap-3">{organizations.length ? organizations.map((org) => <a className="rounded-md border border-line p-4 hover:border-brand-500" href={`/organizations/${org.id}/members`} key={org.id}><p className="font-semibold">{org.name}</p><p className="mt-1 text-sm text-ink-3">{org.slug} · {org.role}</p><p className="mt-2 text-sm font-semibold text-brand-600">Open members →</p></a>) : <p className="text-sm text-ink-3">No organisations yet.</p>}</div></div><div className="rounded-lg border border-line bg-surface p-6"><h2 className="font-display text-xl font-bold">Create an SME organisation</h2><form action={create} className="mt-5 flex flex-col gap-4"><Field label="Organisation name" value={name} onChange={(event) => setName(event.target.value)} required /><Field label="Legal name" value={legalName} onChange={(event) => setLegalName(event.target.value)} required /><Field label="Slug" name="slug" placeholder="example-sme" required /><Button type="submit" loading={pending}>Create organisation</Button>{error && <p className="text-sm text-danger">{error}</p>}</form></div></section></main>;
}
