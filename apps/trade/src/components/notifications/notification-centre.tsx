"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  path: string | null;
  read: boolean;
  createdAt: string;
}
export interface NotificationList {
  unread: number;
  items: Notification[];
}
export interface NotificationPreferences {
  items: { kind: string; label: string; email: boolean; inApp: boolean }[];
}

/** Kinds meant for staff only, which a business has no use for. */
const STAFF_KINDS = new Set(["output_review", "admin_alert"]);

export function NotificationCentre({ initial, preferences, staff }: { initial: NotificationList; preferences: NotificationPreferences; staff: boolean }) {
  const [list, setList] = useState(initial);
  const [prefs, setPrefs] = useState(preferences);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const res = await tradeFetch<NotificationList>("GET", "/notifications?limit=50");
    if (res.data) setList(res.data);
  };
  const markRead = async (body: { ids?: string[]; all?: boolean }) => {
    setError(null);
    const res = await tradeFetch("POST", "/notifications/read", body);
    if (!res.ok) return setError(res.error);
    await reload();
  };
  const choose = async (kind: string, change: { email?: boolean; inApp?: boolean }) => {
    setError(null);
    const current = prefs.items.find((p) => p.kind === kind)!;
    const res = await tradeFetch<NotificationPreferences>("PUT", "/notification-preferences", { kind, email: current.email, inApp: current.inApp, ...change });
    if (!res.ok || !res.data) return setError(res.error);
    setPrefs(res.data);
  };

  return (
    <div className="space-y-8">
      {error && <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>}

      <section aria-labelledby="inbox" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inbox" className="font-display text-lg font-bold text-ink">
            Inbox {list.unread > 0 && <StatusBadge tone="info">{`${list.unread} unread`}</StatusBadge>}
          </h2>
          {list.unread > 0 && (
            <Button variant="secondary" size="sm" onClick={() => void markRead({ all: true })}>
              Mark all as read
            </Button>
          )}
        </div>
        <Card className="divide-y divide-line">
          {list.items.length === 0 && <p className="p-4 text-sm text-ink-2">Nothing yet.</p>}
          {list.items.map((n) => (
            <div key={n.id} className={`flex flex-wrap items-start justify-between gap-3 p-4 ${n.read ? "" : "bg-brand-50/40"}`}>
              <div className="min-w-0">
                <p className={`text-sm ${n.read ? "text-ink" : "font-semibold text-ink"}`}>{n.title}</p>
                <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>
                <p className="mt-1 text-xs text-ink-3">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                {n.path && (
                  <Link href={n.path} onClick={() => void markRead({ ids: [n.id] })} className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline">
                    Open
                  </Link>
                )}
                {!n.read && (
                  <Button variant="ghost" size="sm" onClick={() => void markRead({ ids: [n.id] })}>
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section aria-labelledby="prefs" className="space-y-3">
        <h2 id="prefs" className="font-display text-lg font-bold text-ink">How you hear about things</h2>
        <Card className="divide-y divide-line">
          {prefs.items
            .filter((p) => staff || !STAFF_KINDS.has(p.kind))
            .map((p) => (
              <div key={p.kind} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-ink">{p.label}</p>
                <div className="flex items-center gap-5 text-sm text-ink-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.inApp} onChange={(e) => void choose(p.kind, { inApp: e.target.checked })} />
                    In the platform
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={p.email} onChange={(e) => void choose(p.kind, { email: e.target.checked })} />
                    By email
                  </label>
                </div>
              </div>
            ))}
        </Card>
      </section>
    </div>
  );
}
