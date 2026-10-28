"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Download,
  Filter,
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { AuditLogItemType, AuditLogListType } from "@entrust/api/client";
import { cn } from "@entrust/ui";

interface AuditViewProps {
  initialData: AuditLogListType;
  searchParams: Record<string, string | undefined>;
}

export function AuditView({ initialData, searchParams }: AuditViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [orgFilter, setOrgFilter] = useState(searchParams.organizationId ?? "");
  const [entityFilter, setEntityFilter] = useState(searchParams.entityType ?? "");
  const [actionFilter, setActionFilter] = useState(searchParams.action ?? "");
  const [platformFilter, setPlatformFilter] = useState(searchParams.platform ?? "");
  const [fromFilter, setFromFilter] = useState(searchParams.from ? searchParams.from.slice(0, 10) : "");
  const [toFilter, setToFilter] = useState(searchParams.to ? searchParams.to.slice(0, 10) : "");

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const applyFilters = (newPage?: number) => {
    const params = new URLSearchParams();
    if (orgFilter.trim()) params.set("organizationId", orgFilter.trim());
    if (entityFilter.trim()) params.set("entityType", entityFilter.trim());
    if (actionFilter.trim()) params.set("action", actionFilter.trim());
    if (platformFilter.trim()) params.set("platform", platformFilter.trim());
    if (fromFilter.trim()) params.set("from", `${fromFilter.trim()}T00:00:00.000Z`);
    if (toFilter.trim()) params.set("to", `${toFilter.trim()}T23:59:59.999Z`);
    if (newPage && newPage > 1) params.set("page", String(newPage));

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setOrgFilter("");
    setEntityFilter("");
    setActionFilter("");
    setPlatformFilter("");
    setFromFilter("");
    setToFilter("");
    startTransition(() => {
      router.push(pathname);
    });
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (orgFilter.trim()) params.set("organizationId", orgFilter.trim());
    if (entityFilter.trim()) params.set("entityType", entityFilter.trim());
    if (actionFilter.trim()) params.set("action", actionFilter.trim());
    if (platformFilter.trim()) params.set("platform", platformFilter.trim());
    if (fromFilter.trim()) params.set("from", `${fromFilter.trim()}T00:00:00.000Z`);
    if (toFilter.trim()) params.set("to", `${toFilter.trim()}T23:59:59.999Z`);

    window.location.href = `/api/audit/export?${params.toString()}`;
  };

  const currentPage = initialData.page;
  const totalPages = initialData.totalPages;
  const startRecord = initialData.total === 0 ? 0 : (currentPage - 1) * initialData.limit + 1;
  const endRecord = Math.min(currentPage * initialData.limit, initialData.total);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Platform Audit Trail
          </h1>
          <p className="mt-1 text-sm text-ink-3">
            Read-side log of platform events, status transitions, and actions across all organisations.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500"
        >
          <Download className="size-4" aria-hidden="true" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter Toolbar Card */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-xs sm:p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters(1);
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Organisation Filter */}
            <div>
              <label htmlFor="filter-org" className="block text-xs font-semibold text-ink-2">
                Organisation ID
              </label>
              <input
                id="filter-org"
                type="text"
                placeholder="e.g. org-..."
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Entity Type Filter */}
            <div>
              <label htmlFor="filter-entity" className="block text-xs font-semibold text-ink-2">
                Entity Type
              </label>
              <select
                id="filter-entity"
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All entity types</option>
                <option value="case">Case</option>
                <option value="evidence">Evidence</option>
                <option value="rule_pack">Rule Pack</option>
                <option value="organization">Organisation</option>
                <option value="member">Member</option>
                <option value="file">File</option>
                <option value="minimum_price">Minimum Price</option>
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label htmlFor="filter-action" className="block text-xs font-semibold text-ink-2">
                Action
              </label>
              <input
                id="filter-action"
                type="text"
                placeholder="e.g. case.created"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-ink-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* Platform Filter */}
            <div>
              <label htmlFor="filter-platform" className="block text-xs font-semibold text-ink-2">
                Platform
              </label>
              <select
                id="filter-platform"
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">All platforms</option>
                <option value="clear">CLEAR</option>
                <option value="trade">TRADE</option>
                <option value="mizan">MIZAN</option>
              </select>
            </div>

            {/* From Date */}
            <div>
              <label htmlFor="filter-from" className="block text-xs font-semibold text-ink-2">
                From Date
              </label>
              <input
                id="filter-from"
                type="date"
                value={fromFilter}
                onChange={(e) => setFromFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            {/* To Date */}
            <div>
              <label htmlFor="filter-to" className="block text-xs font-semibold text-ink-2">
                To Date
              </label>
              <input
                id="filter-to"
                type="date"
                value={toFilter}
                onChange={(e) => setToFilter(e.target.value)}
                className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-line/60">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reset</span>
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              <Filter className="size-3.5" aria-hidden="true" />
              <span>{isPending ? "Filtering..." : "Apply filters"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table or Empty State */}
      {initialData.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-12 text-center shadow-xs">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-canvas text-ink-3">
            <FileText className="size-6 text-ink-3" aria-hidden="true" />
          </div>
          <h2 className="font-display text-base font-semibold text-ink">No audit records found</h2>
          <p className="mt-1 text-sm text-ink-3">
            No platform events match your current filter criteria. Try adjusting dates or removing filters.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-md border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-xs hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-500"
            >
              Reset filters
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div
            tabIndex={0}
            role="region"
            aria-label="Audit records table"
            className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-b border-line bg-canvas/60 font-semibold uppercase tracking-wider text-ink-3">
                <tr>
                  <th scope="col" className="px-4 py-3">Timestamp</th>
                  <th scope="col" className="px-4 py-3">Actor</th>
                  <th scope="col" className="px-4 py-3">Organisation</th>
                  <th scope="col" className="px-4 py-3">Platform</th>
                  <th scope="col" className="px-4 py-3">Action</th>
                  <th scope="col" className="px-4 py-3">Entity</th>
                  <th scope="col" className="px-4 py-3">Reason / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {initialData.items.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const hasChanges = Boolean(item.before || item.after);

                  return (
                    <tr key={item.id} className="hover:bg-canvas/40 transition-colors">
                      {/* Occurred At */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-ink-2">
                        {new Date(item.occurredAt).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        })}
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {item.actorName ?? item.actorEmail ?? "System"}
                        </div>
                        {item.actorEmail && item.actorName && (
                          <div className="text-[11px] text-ink-3">{item.actorEmail}</div>
                        )}
                      </td>

                      {/* Organisation */}
                      <td className="px-4 py-3 text-ink-2">
                        {item.organizationName ? (
                          <span className="font-medium text-ink">{item.organizationName}</span>
                        ) : (
                          <span className="text-ink-3">Platform-wide</span>
                        )}
                      </td>

                      {/* Platform */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-sm border border-line bg-canvas px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-ink-2">
                          {item.platform ?? "core"}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <code className="rounded-sm bg-canvas/80 px-1.5 py-0.5 font-mono font-semibold text-brand-700">
                          {item.action}
                        </code>
                      </td>

                      {/* Entity */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-medium text-ink">{item.entityType}</span>
                        <span className="block font-mono text-[11px] text-ink-3 truncate max-w-[120px]">
                          {item.entityId}
                        </span>
                      </td>

                      {/* Reason / Expandable Diff */}
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-ink-2" title={item.reason ?? ""}>
                          {item.reason ?? "—"}
                        </div>
                        {hasChanges && (
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-1 focus-visible:outline-brand-500"
                          >
                            <span>{isExpanded ? "Hide diff" : "View diff"}</span>
                            {isExpanded ? (
                              <ChevronUp className="size-3" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="size-3" aria-hidden="true" />
                            )}
                          </button>
                        )}

                        {isExpanded && hasChanges && (
                          <div className="mt-2 rounded-md border border-line bg-canvas p-2.5 font-mono text-[11px] text-ink leading-relaxed">
                            {item.before && (
                              <div className="mb-1.5">
                                <span className="font-bold text-warn block">Before:</span>
                                <pre className="overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(item.before, null, 2)}
                                </pre>
                              </div>
                            )}
                            {item.after && (
                              <div>
                                <span className="font-bold text-ok block">After:</span>
                                <pre className="overflow-x-auto whitespace-pre-wrap">
                                  {JSON.stringify(item.after, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Navigation */}
          <div className="flex flex-col items-center justify-between gap-3 px-2 py-1 text-xs text-ink-3 sm:flex-row">
            <div>
              Showing <span className="font-semibold text-ink">{startRecord}</span> to{" "}
              <span className="font-semibold text-ink">{endRecord}</span> of{" "}
              <span className="font-semibold text-ink">{initialData.total}</span> events
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage <= 1 || isPending}
                onClick={() => applyFilters(currentPage - 1)}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-1.5 font-semibold text-ink shadow-xs hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                <span>Previous</span>
              </button>

              <span className="px-2 font-medium">
                Page {currentPage} of {Math.max(1, totalPages)}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages || isPending}
                onClick={() => applyFilters(currentPage + 1)}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-1.5 font-semibold text-ink shadow-xs hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand-500"
              >
                <span>Next</span>
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
