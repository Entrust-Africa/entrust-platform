"use client";

import { useState } from "react";
import { browserApi, errorText, ok } from "@/lib/summit-api";

/** Opens one of the applicant's documents in a new tab with a short-lived link. The tab opens first so a phone's pop-up blocker allows it. */
export function DocumentLink({ applicationId, documentId, children }: { applicationId: string; documentId: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function open() {
    setBusy(true);
    setError(undefined);
    const tab = window.open("", "_blank");
    try {
      const link = await ok(browserApi().v1.summit.applications[":id"].documents[":documentId"]["download-url"].$get({ param: { id: applicationId, documentId } }));
      if (tab) tab.location.href = link.downloadUrl;
      else window.location.href = link.downloadUrl;
    } catch (e) {
      tab?.close();
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <span>
      <button type="button" onClick={open} disabled={busy} className="font-semibold text-brand-600 hover:underline disabled:opacity-60">
        {busy ? "Opening…" : children}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
