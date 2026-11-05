"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { browserApi, errorText, ok } from "@/lib/summit-api";

type Imported = { total: number; created: number; updated: number; unchanged: number; warnings: string[] };

/** The file's bytes as base64, in pieces so a large file doesn't overflow the call stack. */
async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const MAX_BYTES = 10 * 1024 * 1024;

/** Loads the diagnostic workbook into the register. Loading it again updates the businesses it names and keeps the rest. */
export function ImportPanel({ hasRecords }: { hasRecords: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Imported>();

  async function load() {
    if (!file) return;
    setError(undefined);
    setResult(undefined);
    if (!/\.xlsx$/i.test(file.name)) return setError("Choose an Excel workbook (.xlsx).");
    if (file.size > MAX_BYTES) return setError("That file is larger than 10 MB.");
    setPending(true);
    try {
      const done = await ok(browserApi().v1.trade.register.import.$post({ json: { fileName: file.name, contentBase64: await toBase64(file) } }));
      setResult(done);
      setFile(null);
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <div>
        <h2 className="font-display text-base font-bold text-ink">{hasRecords ? "Update from the workbook" : "Load the workbook"}</h2>
        <p className="mt-1 text-sm text-ink-2">
          Choose the SME Export Readiness Diagnostic Database (.xlsx). Businesses are matched on their SME ID: new ones are added, changed ones
          updated, and any the file leaves out stay as they are. Totals and levels are worked out here, not read from the workbook.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="Diagnostic workbook"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setError(undefined);
          }}
          className="block min-w-0 flex-1 text-sm text-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-canvas file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
        />
        <Button type="button" onClick={load} loading={pending} disabled={!file}>
          {hasRecords ? "Update the register" : "Load the register"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {result && (
        <div role="status" className="space-y-2 rounded-md border border-line bg-canvas p-3 text-sm text-ink">
          <p className="font-semibold">
            Read {result.total} {result.total === 1 ? "business" : "businesses"}: {result.created} added, {result.updated} updated, {result.unchanged} unchanged.
          </p>
          {result.warnings.length > 0 && (
            <div>
              <p className="font-semibold text-ink">Check these in the workbook ({result.warnings.length})</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-2">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
