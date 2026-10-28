import Link from "next/link";
import { ShieldAlert, AlertCircle } from "lucide-react";
import type { AuditLogListType } from "@entrust/api/client";
import { getMe, serverApi } from "@/lib/api";
import { AuditView } from "./audit-view";

interface AuditPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const search = await searchParams;
  const me = await getMe();

  if (!me) {
    return null;
  }

  const client = await serverApi();
  const res = await client.v1.audit.$get({
    query: {
      organizationId: search.organizationId,
      entityType: search.entityType,
      entityId: search.entityId,
      action: search.action,
      platform: search.platform as any,
      from: search.from,
      to: search.to,
      page: search.page ? Number(search.page) : 1,
      limit: search.limit ? Number(search.limit) : 50,
      format: "json",
    },
  });

  // Handle SME / unauthorized access (403 Forbidden)
  if (res.status === 403) {
    return (
      <section aria-labelledby="access-denied-heading" className="mx-auto max-w-xl py-12 text-center">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-xs sm:p-10">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-warn-50 text-warn">
            <ShieldAlert className="size-8" aria-hidden="true" />
          </div>
          <h1 id="access-denied-heading" className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            Access Denied (403)
          </h1>
          <p className="mt-3 text-sm text-ink-2 leading-relaxed">
            The platform audit trail is restricted exclusively to Entrust staff. Your account does not have staff permissions to inspect platform audit records.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Return to Cases
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!res.ok) {
    const errorJson = (await res.json().catch(() => ({ error: "Failed to load audit logs" }))) as { error?: string };
    return (
      <div className="mx-auto max-w-2xl py-12">
        <div className="rounded-xl border border-danger/30 bg-danger-50/50 p-6 text-ink shadow-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-danger mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-bold text-danger">Failed to fetch audit records</h2>
              <p className="mt-1 text-xs text-ink-2">
                {errorJson.error ?? "An unexpected error occurred while loading audit events."}
              </p>
              <div className="mt-4">
                <Link
                  href="/audit"
                  className="inline-flex items-center rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-xs hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  Reset filters
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = (await res.json()) as AuditLogListType;
  return <AuditView initialData={data} searchParams={search} />;
}
