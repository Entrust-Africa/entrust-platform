"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { FileLink, FileUpload } from "@/components/files/file-upload";
import { tradeFetch } from "@/lib/trade-client";

interface Evidence {
  id: string;
  description: string | null;
  file: { id: string; name: string };
}

/** Files that show an action was done. Opened when asked for, so the board doesn't ask about every item. */
export function ActionEvidence({ itemId, organizationId, readOnly }: { itemId: string; organizationId: string; readOnly: boolean }) {
  const [items, setItems] = useState<Evidence[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await tradeFetch<{ items: Evidence[] }>("GET", `/action-plan/items/${itemId}/evidence`);
    if (res.data) setItems(res.data.items);
    else setError(res.error);
  };

  if (items === null) {
    return (
      <button type="button" className="text-xs font-semibold text-brand-600 underline-offset-4 hover:underline" onClick={() => void load()}>
        Evidence files
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-line p-3">
      <p className="text-xs font-semibold text-ink-3">Evidence files</p>
      {items.length === 0 ? <p className="text-xs text-ink-2">None yet.</p> : (
        <ul className="space-y-1">
          {items.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span><FileLink fileId={e.file.id} name={e.file.name} />{e.description ? <span className="ml-2 text-xs text-ink-3">{e.description}</span> : null}</span>
              {!readOnly && <Button size="sm" variant="ghost" onClick={async () => {
                const res = await tradeFetch("DELETE", `/action-plan/items/${itemId}/evidence/${e.id}`);
                if (!res.ok) return setError(res.error);
                await load();
              }}>Remove</Button>}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && <FileUpload organizationId={organizationId} label="Add evidence" onUploaded={async (file) => {
        setError(null);
        const res = await tradeFetch("POST", `/action-plan/items/${itemId}/evidence`, { fileId: file.id, description: null });
        if (!res.ok) return setError(res.error);
        await load();
      }} />}
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
