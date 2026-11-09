"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, Loader2, Lock, Plus, Trash2 } from "lucide-react";
import { Card, cn, uploadFile } from "@entrust/ui";
import { ConfirmDialog } from "../confirm-dialog";
import { apiUrl, browserApi, errorText, ok } from "@/lib/summit-api";
import {
  DOCUMENT_KIND_ORDER,
  DOCUMENT_LABELS,
  formatBytes,
  type SummitApplication,
  type SummitDocument,
  type SummitDocumentKind,
} from "@/lib/summit";

const ACCEPT = "application/pdf,image/jpeg,image/png";
const TYPE_BY_EXTENSION: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const MAX_BYTES = 20 * 1024 * 1024;

/** The file's type, from the browser or, when the browser doesn't say, from its name. Only PDF, JPG and PNG are accepted. */
function typeOf(file: File): string | null {
  if (Object.values(TYPE_BY_EXTENSION).includes(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return file.type === "" ? (TYPE_BY_EXTENSION[extension] ?? null) : null;
}

export interface DocumentsPanelProps {
  application: SummitApplication;
  /** Called with the application after a document is added or removed. */
  onChange: (application: SummitApplication) => void;
  /** Show the panel's own heading and intro. A page that already has a heading for it turns this off. */
  heading?: boolean;
}

interface Busy {
  kind: SummitDocumentKind;
  name: string;
  percent: number;
}

/** The supporting documents: which ones the application needs, which are in, and a way to add or remove them. */
export function DocumentsPanel({ application, onChange, heading = true }: DocumentsPanelProps) {
  const [busy, setBusy] = useState<Busy | null>(null);
  const [failure, setFailure] = useState<{ kind: SummitDocumentKind; message: string } | null>(null);
  const [removing, setRemoving] = useState<SummitDocument | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const [opening, setOpening] = useState<string | null>(null);

  const canAdd = application.canEditDocuments;
  const canRemove = application.editable;
  const required = application.requiredDocuments;
  const byKind = (kind: SummitDocumentKind) => application.documents.filter((d) => d.kind === kind);
  const have = required.filter((kind) => byKind(kind).length > 0);
  const missing = required.filter((kind) => byKind(kind).length === 0);
  const others = DOCUMENT_KIND_ORDER.filter((kind) => !required.includes(kind));

  async function add(kind: SummitDocumentKind, file: File) {
    setFailure(null);
    const type = typeOf(file);
    if (!type) return setFailure({ kind, message: "That file type is not accepted. Use a PDF, JPG or PNG file." });
    if (file.size > MAX_BYTES) return setFailure({ kind, message: "That file is too big. The most we can take is 20 MB." });
    if (file.size === 0) return setFailure({ kind, message: "That file is empty." });
    setBusy({ kind, name: file.name, percent: 0 });
    try {
      const upload = await uploadFile(type === file.type ? file : new File([file], file.name, { type }), {
        apiUrl,
        organizationId: application.organizationId,
        onProgress: (percent) => setBusy((b) => (b ? { ...b, percent: Math.round(percent) } : b)),
        fetchFn: (input, init) => fetch(input, { ...init, credentials: "include" }),
      });
      const next = await ok(
        browserApi().v1.summit.applications[":id"].documents.$post({
          param: { id: application.id },
          json: { fileId: upload.id, kind },
        }),
      );
      onChange(next);
    } catch (error) {
      setFailure({ kind, message: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(undefined);
    try {
      const next = await ok(browserApi().v1.summit.applications[":id"].documents[":documentId"].$delete({ param: { id: application.id, documentId: removing.id } }));
      onChange(next);
      setRemoving(null);
    } catch (error) {
      setRemoveError(errorText(error));
    } finally {
      setRemoveBusy(false);
    }
  }

  async function open(document: SummitDocument) {
    setOpening(document.id);
    setFailure(null);
    // Open the tab first, on the tap, so a phone's pop-up blocker lets it through.
    const tab = window.open("", "_blank");
    try {
      const link = await ok(browserApi().v1.summit.applications[":id"].documents[":documentId"]["download-url"].$get({ param: { id: application.id, documentId: document.id } }));
      if (tab) tab.location.href = link.downloadUrl;
      else window.location.href = link.downloadUrl;
    } catch (error) {
      tab?.close();
      setFailure({ kind: document.kind, message: errorText(error) });
    } finally {
      setOpening(null);
    }
  }

  const row = (kind: SummitDocumentKind, isRequired: boolean) => {
    const files = byKind(kind);
    const uploading = busy?.kind === kind ? busy : null;
    const problem = failure?.kind === kind ? failure.message : null;
    return (
      <li key={kind} className="space-y-3 px-4 py-4">
        <div className="flex items-start gap-3">
          {files.length > 0 ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden="true" />
          ) : isRequired ? (
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden="true" />
          ) : (
            <FileText className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-snug text-ink">{DOCUMENT_LABELS[kind]}</p>
            <p className={cn("text-sm", files.length === 0 && isRequired ? "font-medium text-warn" : "text-ink-3")}>
              {files.length > 0 ? `${files.length} added` : isRequired ? "Needed" : "Optional"}
            </p>
          </div>
        </div>

        {files.map((file) => (
          <div key={file.id} className="ml-8 flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{file.fileName}</p>
              <p className="text-xs text-ink-3">
                {formatBytes(file.sizeBytes)}
                {file.restricted && (
                  <span className="ml-2 inline-flex items-center gap-1">
                    <Lock className="size-3" aria-hidden="true" />
                    Private
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void open(file)}
              disabled={opening === file.id}
              aria-label={`Open ${file.fileName}`}
              className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-2 hover:bg-surface"
            >
              {opening === file.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />}
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => {
                  setRemoveError(undefined);
                  setRemoving(file);
                }}
                aria-label={`Remove ${file.fileName}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}

        {uploading && (
          <div className="ml-8 space-y-1" role="status">
            <p className="truncate text-sm text-ink-2">Uploading {uploading.name}…</p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${uploading.percent}%` }} />
            </div>
          </div>
        )}

        {problem && (
          <p className="ml-8 rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
            {problem}
          </p>
        )}

        {canAdd && (
          <div className="ml-8">
            <AddButton
              label={files.length > 0 ? "Add another file" : "Add a file"}
              kindLabel={DOCUMENT_LABELS[kind]}
              disabled={busy !== null}
              onFile={(file) => void add(kind, file)}
            />
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {heading ? (
        <div>
          <h3 className="font-display text-xl font-bold text-ink">Documents</h3>
          <p className="mt-1 text-base text-ink-2">Add each file as a PDF, JPG or PNG, up to 20 MB. You can take a photo with your phone.</p>
        </div>
      ) : (
        <p className="text-base text-ink-2">Add each file as a PDF, JPG or PNG, up to 20 MB. You can take a photo with your phone.</p>
      )}

      <p className="rounded-lg border border-line bg-surface-2 p-4 text-base text-ink-2">
        You do not need to upload financial records. Where we need figures, you type them into the application.
      </p>

      {required.length > 0 ? (
        <div
          className={cn("rounded-lg border p-4 text-base", missing.length === 0 ? "border-ok/30 bg-ok-50 text-ink" : "border-warn/30 bg-warn-50 text-ink")}
          role="status"
        >
          {missing.length === 0
            ? "You have added every document we need."
            : `You have added ${have.length} of ${required.length} documents we need. Still to add: ${missing.map((k) => DOCUMENT_LABELS[k].toLowerCase()).join(", ")}.`}
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface-2 p-4 text-base text-ink-2" role="status">
          Tell us your main opportunity under "Business overview" first. Then we can show which documents you need.
        </div>
      )}

      {!canAdd && (
        <p className="rounded-lg border border-line bg-surface-2 p-4 text-base text-ink-2">You can't add or change documents on this application now.</p>
      )}

      {required.length > 0 && (
        <Card>
          <h4 className="border-b border-line px-4 py-3 font-display text-base font-bold text-ink">Documents we need</h4>
          <ul className="divide-y divide-line">{required.map((kind) => row(kind, true))}</ul>
        </Card>
      )}

      <Card>
        <h4 className="border-b border-line px-4 py-3 font-display text-base font-bold text-ink">
          {required.length > 0 ? "Other documents that help" : "Documents you can add"}
        </h4>
        <ul className="divide-y divide-line">{others.map((kind) => row(kind, false))}</ul>
      </Card>

      <ConfirmDialog
        open={removing !== null}
        title="Remove this file?"
        confirmLabel="Remove"
        tone="danger"
        busy={removeBusy}
        error={removeError}
        onConfirm={() => void remove()}
        onCancel={() => setRemoving(null)}
      >
        <p>{removing ? `${removing.fileName} will be taken off your application. You can add it again later.` : ""}</p>
      </ConfirmDialog>
    </div>
  );
}

/** A big button that opens the phone's file picker, camera and photos included. */
function AddButton({ label, kindLabel, disabled, onFile }: { label: string; kindLabel: string; disabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label={`${label}: ${kindLabel}`}
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={cn(
          "inline-flex h-12 items-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-base font-semibold text-ink",
          disabled ? "cursor-not-allowed opacity-60" : "hover:bg-surface-2",
        )}
      >
        <Plus className="size-4" aria-hidden="true" />
        {label}
      </button>
    </>
  );
}
