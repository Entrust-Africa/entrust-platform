"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import type { AdminModuleVersionDetail, AdminModuleVersionSummary } from "@/lib/types";

const STATUS_WORD: Record<AdminModuleVersionSummary["status"], string> = {
  approved: "live",
  in_review: "waiting for approval",
  draft: "draft",
  archived: "retired",
};

/** How a version is named in a list: "v1.0.0 (live)". */
export function versionLabel(version: Pick<AdminModuleVersionSummary, "version" | "status">): string {
  return `v${version.version} (${STATUS_WORD[version.status]})`;
}

function parse(version: string): [number, number, number] | null {
  const parts = version.split(".").map((n) => Number.parseInt(n, 10));
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0]!, parts[1]!, parts[2]!] : null;
}

/** The next minor number above every version the module already has, so the suggestion is never taken. */
export function nextVersion(versions: { version: string }[]): string {
  const highest = versions
    .map((v) => parse(v.version))
    .filter((v): v is [number, number, number] => v !== null)
    .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
  return highest ? `${highest[0]}.${highest[1] + 1}.0` : "1.0.0";
}

/**
 * Starts a new draft of a module by copying one of its versions, then opens the draft in the editor. Learners keep the
 * live version until the draft is reviewed and approved.
 */
export function NewDraftDialog({
  moduleId,
  moduleTitle,
  versions,
  from,
  onClose,
}: {
  moduleId: string;
  moduleTitle: string;
  versions: AdminModuleVersionSummary[];
  /** The version to copy, preselected. Defaults to the live one. */
  from?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const live = versions.find((v) => v.status === "approved");
  const [sourceVersion, setSourceVersion] = useState(from ?? live?.version ?? versions[0]?.version ?? "");
  const [targetVersion, setTargetVersion] = useState(() => nextVersion(versions));
  const [changeSummary, setChangeSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await tradeFetch<AdminModuleVersionDetail>("POST", `/admin/modules/${moduleId}/versions`, {
      sourceVersion,
      targetVersion: targetVersion.trim(),
      changeSummary: changeSummary.trim() || `Draft started from v${sourceVersion}`,
    });
    if (!res.ok || !res.data) {
      setBusy(false);
      setError(res.error ?? "The draft couldn't be started.");
      return;
    }
    router.push(`/admin/modules/${moduleId}/editor?version=${encodeURIComponent(res.data.version)}&started=1`);
    // The editor stays mounted when only its address changes, so the dialog has to close itself.
    onClose();
  }

  const control =
    "h-10 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="new-draft-title">
      <div className="relative m-auto w-full max-w-lg rounded-lg bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <h2 id="new-draft-title" className="font-display text-lg font-bold text-ink">
              Start a new draft of {moduleId}
            </h2>
            <p className="mt-0.5 text-sm text-ink-2">{moduleTitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-2 hover:bg-surface-2 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-4 rounded-md bg-canvas p-3 text-sm text-ink-2">
          The draft starts as a copy of the version you pick. You edit the copy, send it for review, and an administrator approves it. Until then learners keep
          seeing {live ? `v${live.version}` : "the live version"}, unchanged.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-danger-50 p-3 text-sm text-danger ring-1 ring-inset ring-danger/25">
            {error}
          </p>
        )}

        <form onSubmit={create} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="draft-source" className="block text-sm font-semibold text-ink">
              Copy from
            </label>
            <select id="draft-source" value={sourceVersion} onChange={(e) => setSourceVersion(e.target.value)} className={control}>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  {versionLabel(v)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="draft-target" className="block text-sm font-semibold text-ink">
              New version number
            </label>
            <input
              id="draft-target"
              required
              pattern="^\d+\.\d+\.\d+$"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              aria-describedby="draft-target-hint"
              className={`${control} font-mono`}
            />
            <p id="draft-target-hint" className="text-xs text-ink-3">
              Three numbers: raise the middle one for new or rewritten material (1.1.0), the last one for small corrections (1.0.1).
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="draft-summary" className="block text-sm font-semibold text-ink">
              What you're changing (optional)
            </label>
            <textarea
              id="draft-summary"
              rows={3}
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="For example: clearer explanation for quiz question 2"
              className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-3 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!sourceVersion || !targetVersion.trim()}>
              Start draft
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
