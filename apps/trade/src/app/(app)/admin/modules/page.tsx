"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, FileEdit, Plus, RefreshCw, Search } from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { NewDraftDialog } from "@/components/studio/new-draft-dialog";
import { tradeFetch } from "@/lib/trade-client";
import type { AdminModuleSummary } from "@/lib/types";

const linkButton =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors";

export default function CourseStudioPage() {
  const [modules, setModules] = useState<AdminModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [drafting, setDrafting] = useState<AdminModuleSummary | null>(null);

  async function loadModules() {
    setLoading(true);
    setError(null);
    const res = await tradeFetch<{ items: AdminModuleSummary[] }>("GET", "/admin/modules");
    if (res.ok && res.data) setModules(res.data.items);
    else setError(res.error ?? "The modules couldn't be loaded.");
    setLoading(false);
  }

  useEffect(() => {
    void loadModules();
  }, []);

  const needle = search.trim().toLowerCase();
  const filtered = modules.filter(
    (m) => !needle || m.id.toLowerCase().includes(needle) || m.title.toLowerCase().includes(needle) || m.deliverable.toLowerCase().includes(needle),
  );
  const drafts = modules.filter((m) => m.activeDraftVersion).length;
  const inReview = modules.filter((m) => m.inReviewVersion).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">Course studio</h1>
          <p className="mt-1 max-w-3xl text-base text-ink-2">
            Every TRADE module. View one as a learner sees it, or start a draft to change it. A draft is a copy: learners keep the live version until an
            administrator approves the draft.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void loadModules()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Figure label="Modules" value={modules.length} />
        <Figure label="Drafts being written" value={drafts} />
        <Figure label="Waiting for approval" value={inReview} />
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
        <label htmlFor="studio-search" className="sr-only">
          Find a module
        </label>
        <input
          id="studio-search"
          type="search"
          placeholder="Find a module by number or title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-md border border-line-strong bg-surface pr-3 pl-9 text-base text-ink placeholder:text-ink-3 sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-md bg-danger-50 p-4 text-sm text-danger ring-1 ring-inset ring-danger/25">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          {error}
        </div>
      )}

      {loading && modules.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">Loading the modules…</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">No module matches &ldquo;{search}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((mod) => {
            const openVersion = mod.activeDraftVersion ?? mod.inReviewVersion ?? mod.latestApprovedVersion ?? mod.versions[0]?.version;
            return (
              <Card key={mod.id} className="flex flex-col justify-between gap-4 p-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">{mod.id}</span>
                    {mod.latestApprovedVersion && <StatusBadge tone="ok">{`Live v${mod.latestApprovedVersion}`}</StatusBadge>}
                    {mod.inReviewVersion && <StatusBadge tone="warn">{`v${mod.inReviewVersion} waiting for approval`}</StatusBadge>}
                    {mod.activeDraftVersion && <StatusBadge tone="info">{`Draft v${mod.activeDraftVersion}`}</StatusBadge>}
                  </div>
                  <h2 className="font-display text-base font-bold text-ink">{mod.title}</h2>
                  <p className="line-clamp-2 text-sm text-ink-2">{mod.deliverable}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Link href={`/modules/${mod.id}`} className={`${linkButton} border border-line-strong bg-surface text-ink hover:bg-surface-2`}>
                    <Eye className="size-4" />
                    View as learner
                  </Link>
                  {mod.activeDraftVersion ? (
                    <Link
                      href={`/admin/modules/${mod.id}/editor?version=${mod.activeDraftVersion}`}
                      className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700`}
                    >
                      <FileEdit className="size-4" />
                      Edit draft v{mod.activeDraftVersion}
                    </Link>
                  ) : mod.inReviewVersion ? (
                    <Link
                      href={`/admin/modules/${mod.id}/editor?version=${mod.inReviewVersion}`}
                      className={`${linkButton} bg-brand-600 text-white hover:bg-brand-700`}
                    >
                      <FileEdit className="size-4" />
                      Review v{mod.inReviewVersion}
                    </Link>
                  ) : (
                    <Button size="sm" onClick={() => setDrafting(mod)}>
                      <Plus className="size-4" />
                      Start a new draft
                    </Button>
                  )}
                  {openVersion && (
                    <Link href={`/admin/modules/${mod.id}/editor?version=${openVersion}`} className="ml-auto text-sm font-semibold text-brand-600 hover:underline">
                      {mod.versions.length} version{mod.versions.length === 1 ? "" : "s"}
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {drafting && (
        <NewDraftDialog moduleId={drafting.id} moduleTitle={drafting.title} versions={drafting.versions} onClose={() => setDrafting(null)} />
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink">{value}</p>
    </Card>
  );
}
