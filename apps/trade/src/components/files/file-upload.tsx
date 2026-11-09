"use client";

import { useRef, useState } from "react";
import { Button } from "@entrust/ui";
import { ACCEPT_ATTRIBUTE, openFile, uploadFile, type UploadedFile } from "@/lib/upload";

/** Picks a PDF, JPEG or PNG and uploads it to the business's own storage. The caller gets the stored file's id. */
export function FileUpload({ organizationId, label = "Choose a file", onUploaded, disabled = false }: { organizationId: string; label?: string; onUploaded: (file: UploadedFile) => Promise<void> | void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await uploadFile(organizationId, file);
    if (!result.ok) {
      setBusy(false);
      setError(result.error);
    } else {
      try {
        await onUploaded(result.file);
      } finally {
        setBusy(false);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-1">
      <input ref={input} type="file" accept={ACCEPT_ATTRIBUTE} className="sr-only" aria-label={label} onChange={(e) => void pick(e.target.files?.[0])} disabled={disabled || busy} />
      <Button type="button" size="sm" variant="secondary" disabled={disabled || busy} loading={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : label}
      </Button>
      <p className="text-xs text-ink-3">PDF, JPEG or PNG, up to 20 MB.</p>
      {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

/** A file's name, which opens it in a new tab through a short-lived link. */
export function FileLink({ fileId, name }: { fileId: string; name: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <span>
      <button type="button" className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline" onClick={async () => setError(await openFile(fileId))}>
        {name}
      </button>
      {error && <span role="alert" className="ml-2 text-xs text-danger">{error}</span>}
    </span>
  );
}
