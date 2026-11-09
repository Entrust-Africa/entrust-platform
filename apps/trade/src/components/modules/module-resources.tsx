"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field } from "@entrust/ui";
import { FileUpload } from "@/components/files/file-upload";
import { tradeFetch } from "@/lib/trade-client";

interface Resource {
  id: string;
  lessonId: string | null;
  name: string;
  resourceType: string;
  version: string;
  accessLevel: "learner" | "staff";
  archived: boolean;
}

const TYPES = ["template", "guide", "worksheet", "checklist", "video", "other"];
const select = "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink";

/**
 * A module's downloadable resources. A learner sees the learner resources. A Super Admin or Cohort Manager can add one by uploading
 * a file to Entrust's own storage, and archive one; a staff-only resource never reaches a learner.
 */
export function ModuleResources({ moduleId, canManage, entrustOrganizationId }: { moduleId: string; canManage: boolean; entrustOrganizationId: string | null }) {
  const [items, setItems] = useState<Resource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", resourceType: "template", accessLevel: "learner" });

  const load = async () => {
    const res = await tradeFetch<{ items: Resource[] }>("GET", `/modules/${moduleId}/resources`);
    if (res.data) setItems(res.data.items);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId]);

  if (items.length === 0 && !canManage) return null;
  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold text-ink">Downloads</h2>
      {items.length === 0 ? <p className="text-sm text-ink-2">No downloads for this module yet.</p> : (
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm">
                <button type="button" className="font-semibold text-brand-600 underline-offset-4 hover:underline" onClick={async () => {
                  const res = await tradeFetch<{ downloadUrl: string }>("GET", `/resources/${r.id}/download-url`);
                  if (res.data) window.open(res.data.downloadUrl, "_blank", "noopener,noreferrer");
                  else setError(res.error);
                }}>{r.name}</button>
                <span className="ml-2 text-xs text-ink-3">{r.resourceType} · version {r.version}{r.accessLevel === "staff" ? " · staff only" : ""}</span>
              </span>
              {canManage && <Button size="sm" variant="ghost" onClick={async () => {
                const res = await tradeFetch("DELETE", `/resources/${r.id}`);
                if (!res.ok) return setError(res.error);
                await load();
              }}>Archive</Button>}
            </li>
          ))}
        </ul>
      )}
      {canManage && entrustOrganizationId && (
        <div className="space-y-3 border-t border-line pt-3">
          <p className="text-sm font-semibold text-ink">Add a download</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <label className="text-xs font-semibold text-ink-3">Kind<select className={select} value={draft.resourceType} onChange={(e) => setDraft({ ...draft, resourceType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label className="text-xs font-semibold text-ink-3">Who can download it<select className={select} value={draft.accessLevel} onChange={(e) => setDraft({ ...draft, accessLevel: e.target.value })}><option value="learner">Learners and staff</option><option value="staff">Staff only</option></select></label>
          </div>
          <FileUpload organizationId={entrustOrganizationId} label="Upload and add" disabled={!draft.name.trim()} onUploaded={async (file) => {
            setError(null);
            const res = await tradeFetch("POST", `/modules/${moduleId}/resources`, { name: draft.name.trim(), fileId: file.id, resourceType: draft.resourceType, accessLevel: draft.accessLevel });
            if (!res.ok) return setError(res.error);
            setDraft({ ...draft, name: "" });
            await load();
          }} />
          {!draft.name.trim() && <p className="text-xs text-ink-3">Give it a name first.</p>}
        </div>
      )}
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </Card>
  );
}
