"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { browserApi, errorText, ok } from "@/lib/summit-api";

/** Starts the application for one organisation and opens the form. */
export function StartApplication({ organizationId, organizationName }: { organizationId: string; organizationName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    setPending(true);
    setError(undefined);
    try {
      const application = await ok(browserApi().v1.summit.applications.$post({ json: { organizationId } }));
      router.push(`/summit/applications/${application.id}/form`);
    } catch (e) {
      setError(errorText(e));
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button size="lg" className="w-full sm:w-auto" loading={pending} onClick={() => void start()}>
        Start the application
        <span className="sr-only"> for {organizationName}</span>
      </Button>
      {error && (
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
