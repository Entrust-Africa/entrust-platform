"use client";

import { useEffect, useState } from "react";
import { Button, Field } from "@entrust/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
type Member = { id: string; userId: string; name: string; email: string; role: string };

export function Members({ organizationId }: { organizationId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  async function load() { const response = await fetch(`${api}/v1/organizations/${organizationId}/members`, { credentials: "include" }); if (response.ok) setMembers((await response.json()).members); }
  useEffect(() => { void load(); }, [organizationId]);
  async function invite(form: FormData) { const response = await fetch(`${api}/v1/organizations/${organizationId}/invitations`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(form.get("email")), role: "member" }) }); setMessage(response.ok ? "Invitation sent." : ((await response.json()).error ?? "Invitation failed.")); if (response.ok) setEmail(""); }
  async function remove(userId: string) { const response = await fetch(`${api}/v1/organizations/${organizationId}/members/${userId}`, { method: "DELETE", credentials: "include" }); if (response.ok) await load(); else setMessage((await response.json()).error ?? "Could not remove member."); }
  return <main className="mx-auto max-w-4xl px-6 py-12"><a className="text-sm font-semibold text-brand-600 hover:underline" href="/organizations">← Organisations</a><h1 className="mt-4 font-display text-4xl font-bold">Members</h1><div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]"><section className="rounded-lg border border-line bg-surface">{members.map((member) => <div className="flex items-center justify-between gap-4 border-b border-line p-4 last:border-0" key={member.id}><div><p className="font-semibold">{member.name}</p><p className="text-sm text-ink-3">{member.email} · {member.role}</p></div><Button variant="ghost" size="sm" onClick={() => void remove(member.userId)}>Remove</Button></div>)}</section><form action={invite} className="flex h-fit flex-col gap-4 rounded-lg border border-line bg-surface p-5"><h2 className="font-display text-lg font-bold">Invite someone</h2><Field label="Email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /><Button type="submit">Send invitation</Button>{message && <p className="text-sm text-ink-2">{message}</p>}</form></div></main>;
}
