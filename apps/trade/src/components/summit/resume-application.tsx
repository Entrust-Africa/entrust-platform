"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@entrust/ui";
import { browserApi, ok } from "@/lib/summit-api";
import { createBusiness, forgetBusiness, type PendingBusiness } from "@/lib/summit-business";

/**
 * Picks the application up where the visitor left off: they gave their business before confirming their email, so now
 * that they are signed in it is saved as their organisation and, if applications are open, the form opens.
 */
export function ResumeApplication({ business, startNow }: { business: PendingBusiness; startNow: boolean }) {
  const router = useRouter();
  const ran = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // React runs effects twice in development; one organisation is enough.
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const created = await createBusiness({ name: business.name, country: business.country });
      if (!created.ok) {
        setError(created.error);
        return;
      }
      forgetBusiness();
      if (!startNow) {
        router.refresh();
        return;
      }
      try {
        const application = await ok(browserApi().v1.summit.applications.$post({ json: { organizationId: created.id } }));
        router.replace(`/summit/applications/${application.id}/form`);
      } catch {
        // The business is saved; the page now offers to start the application itself.
        router.refresh();
      }
    })();
  }, [business, startNow, router]);

  if (error) {
    return (
      <div className="space-y-3" role="alert">
        <p className="rounded-md bg-danger-50 px-3 py-2 text-sm font-medium text-danger">{error}</p>
        <Button
          onClick={() => {
            forgetBusiness();
            router.refresh();
          }}
        >
          Enter my business details again
        </Button>
      </div>
    );
  }
  return (
    <p className="text-base text-ink-2" role="status">
      Setting up your application…
    </p>
  );
}
