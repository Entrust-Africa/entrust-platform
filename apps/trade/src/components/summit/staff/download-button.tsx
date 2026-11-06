"use client";

import { useState } from "react";
import { Button } from "@entrust/ui";
import { apiUrl, errorText } from "@/lib/summit-api";

/** Downloads a file the API makes for the signed-in person, such as the profile PDF. A refusal shows the sentence the API gave. */
export function DownloadButton({ path, fallbackName, children, variant = "secondary", disabled }: { path: string; fallbackName: string; children: React.ReactNode; variant?: "primary" | "secondary"; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function download() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(`${apiUrl}${path}`, { credentials: "include" });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The file could not be made. Try again.");
      }
      const blob = await response.blob();
      const named = /filename="?([^";]+)"?/.exec(response.headers.get("content-disposition") ?? "")?.[1];
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = named ?? fallbackName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-1">
      <Button size="sm" variant={variant} loading={busy} disabled={disabled} onClick={download}>
        {children}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
