"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

export interface Sponsor {
  id: string;
  name: string;
  slug: string;
  members: { userId: string; name: string | null; email: string; role: string }[];
}

const ROLE_LABEL: Record<string, string> = { sponsor_admin: "Administrator", sponsor_viewer: "Viewer" };
const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function SponsorAdmin({ initial }: { initial: Sponsor[] }) {
  const router = useRouter();
  const [sponsors, setSponsors] = useState(initial);
  const [name, setName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await tradeFetch<Sponsor>("POST", "/sponsors", { name: name.trim(), slug: slugOf(name), ...(adminEmail.trim() ? { adminEmail: adminEmail.trim() } : {}) });
    setBusy(false);
    if (!res.data) return setError(res.error);
    setSponsors((now) => [...now, res.data!].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
    setAdminEmail("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold text-ink">Add a sponsor bank</h2>
        <form onSubmit={create} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Bank name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
          <Field label="First administrator's email (optional)" type="email" hint="They need an account already." value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            Add bank
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </Card>

      {sponsors.length === 0 ? (
        <p className="text-sm text-ink-2">No sponsor banks yet.</p>
      ) : (
        sponsors.map((sponsor) => <SponsorCard key={sponsor.id} sponsor={sponsor} onChange={(next) => setSponsors((now) => now.map((s) => (s.id === next.id ? next : s)))} />)
      )}
    </div>
  );
}

function SponsorCard({ sponsor, onChange }: { sponsor: Sponsor; onChange: (next: Sponsor) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("sponsor_viewer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(call: () => ReturnType<typeof tradeFetch<Sponsor>>) {
    setBusy(true);
    setError(null);
    const res = await call();
    setBusy(false);
    if (!res.data) return setError(res.error);
    onChange(res.data);
    setEmail("");
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-bold text-ink">{sponsor.name}</h3>
        <span className="font-mono text-xs text-ink-3">{sponsor.slug}</span>
      </div>
      {sponsor.members.length === 0 ? (
        <p className="text-sm text-ink-2">Nobody signs in for this bank yet.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {sponsor.members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-semibold text-ink">{m.name || m.email}</span> <span className="text-ink-3">{m.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge tone={m.role === "sponsor_admin" ? "info" : "idle"}>{ROLE_LABEL[m.role] ?? m.role}</StatusBadge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Remove ${m.email} from ${sponsor.name}`}
                  onClick={() => void run(() => tradeFetch<Sponsor>("DELETE", `/sponsors/${sponsor.id}/members/${encodeURIComponent(m.userId)}`))}
                >
                  Remove
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => tradeFetch<Sponsor>("POST", `/sponsors/${sponsor.id}/members`, { email: email.trim(), role }));
        }}
      >
        <Field label="Add a person by email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="text-sm font-semibold text-ink">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-1 block h-10 rounded-md border border-line bg-surface px-2 text-sm text-ink">
            <option value="sponsor_viewer">Viewer (reads reports)</option>
            <option value="sponsor_admin">Administrator (also manages people)</option>
          </select>
        </label>
        <Button type="submit" variant="secondary" loading={busy} disabled={!email.trim()}>
          Add
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}
