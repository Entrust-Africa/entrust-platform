"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@entrust/ui";
import { browserApi, errorText, ok } from "@/lib/summit-api";

type Imported = { total: number; created: number; updated: number; unchanged: number; shown: number; notShown: number; warnings: string[] };

async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

const MAX_BYTES = 10 * 1024 * 1024;

/** "Agro-Processing SME Training Program (Responses).xlsx" as "Agro-Processing SME Training Program". */
const programFrom = (fileName: string) =>
  fileName
    .replace(/\.xlsx$/i, "")
    .replace(/\s*\((?:responses?|\d+)\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Loads a form's responses for a programme. Every response is kept; only those from Ethiopia are listed. */
export function ApplicationsImportPanel({ programs, hasRecords }: { programs: string[]; hasRecords: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [program, setProgram] = useState(programs.length === 1 ? (programs[0] ?? "") : "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<Imported>();

  async function load() {
    if (!file) return;
    setError(undefined);
    setResult(undefined);
    if (!/\.xlsx$/i.test(file.name)) return setError("Choose an Excel file (.xlsx).");
    if (file.size > MAX_BYTES) return setError("That file is larger than 10 MB.");
    if (!program.trim()) return setError("Say which programme the responses are for.");
    setPending(true);
    try {
      const done = await ok(browserApi().v1.trade.applications.import.$post({ json: { program: program.trim(), fileName: file.name, contentBase64: await toBase64(file) } }));
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
        <h2 className="font-display text-base font-bold">{hasRecords ? "Update from the form" : "Load the form's responses"}</h2>
        <p className="mt-1 text-sm text-ink-2">
          In Google Forms, open Responses, then Link to Sheets, then File, Download, Microsoft Excel (.xlsx), and choose that file. Every response is saved. Only
          those from Ethiopia are listed here; the rest are kept in the database and not shown. A response is matched on its programme, time sent and email, so
          loading the file again adds the new ones and leaves the others as they are.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Programme</span>
          <input
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            list="application-programs"
            maxLength={200}
            placeholder="Agro-Processing SME Training Program"
            className="h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-ink placeholder:text-ink-3 focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25"
          />
          <datalist id="application-programs">
            {programs.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <input
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="The form's responses"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setFile(chosen);
            setError(undefined);
            if (chosen && !program.trim()) setProgram(programFrom(chosen.name));
          }}
          className="block min-w-0 text-sm text-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-canvas file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-surface"
        />
      </div>
      <div>
        <Button type="button" onClick={load} loading={pending} disabled={!file}>
          {hasRecords ? "Update the applications" : "Load the applications"}
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
            Read {result.total} {result.total === 1 ? "response" : "responses"}: {result.created} added, {result.updated} updated, {result.unchanged} unchanged.
          </p>
          <p className="text-ink-2">
            {result.shown} {result.shown === 1 ? "is" : "are"} from Ethiopia and listed below. {result.notShown} {result.notShown === 1 ? "is" : "are"} kept in the
            database and not shown, because {result.notShown === 1 ? "it is" : "they are"} from outside Ethiopia or don&apos;t say where from.
          </p>
          {result.warnings.length > 0 && (
            <div>
              <p className="font-semibold text-ink">Check these in the form&apos;s sheet ({result.warnings.length})</p>
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
