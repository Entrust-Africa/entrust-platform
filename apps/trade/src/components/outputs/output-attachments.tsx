"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "@entrust/ui";
import { FileLink, FileUpload } from "@/components/files/file-upload";
import { tradeFetch } from "@/lib/trade-client";
import type { OutputDetails } from "./output-review";

type Attachment = OutputDetails["attachments"][number] & { file: { id: string; name: string } };

/** Documents attached to a draft output, such as a costing sheet or a signed plan. A submitted version keeps what it was reviewed with. */
export function OutputAttachments({ versionId, organizationId }: { versionId: string; organizationId: string }) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await tradeFetch<OutputDetails>("GET", `/worksheet-versions/${versionId}/details`);
    if (res.data) setItems(res.data.attachments as Attachment[]);
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  return (
    <Card className="space-y-3 p-4 print:hidden">
      <h2 className="text-sm font-semibold text-ink">Documents for this output</h2>
      {items.length === 0 ? <p className="text-sm text-ink-2">No documents attached.</p> : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><FileLink fileId={a.file.id} name={a.file.name} />{a.description ? <span className="ml-2 text-xs text-ink-3">{a.description}</span> : null}</span>
              <Button size="sm" variant="ghost" onClick={async () => {
                setError(null);
                const res = await tradeFetch("DELETE", `/worksheet-versions/${versionId}/attachments/${a.id}`);
                if (!res.ok) return setError(res.error);
                await load();
              }}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <FileUpload organizationId={organizationId} label="Attach a document" onUploaded={async (file) => {
        setError(null);
        const res = await tradeFetch("POST", `/worksheet-versions/${versionId}/attachments`, { fileId: file.id, description: null });
        if (!res.ok) return setError(res.error);
        await load();
      }} />
      {error && <p role="alert" className="text-sm font-medium text-danger">{error}</p>}
    </Card>
  );
}
