"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileEdit,
  GitBranch,
  Layers,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import type { AdminModuleSummary } from "@/lib/types";

export default function AdminModulesPage() {
  const [modules, setModules] = useState<AdminModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Create Draft Modal State
  const [selectedModule, setSelectedModule] = useState<AdminModuleSummary | null>(null);
  const [sourceVersion, setSourceVersion] = useState("");
  const [targetVersion, setTargetVersion] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  async function loadModules() {
    setLoading(true);
    setError(null);
    const res = await tradeFetch<{ items: AdminModuleSummary[] }>("GET", "/admin/modules");
    if (res.ok && res.data) {
      setModules(res.data.items);
    } else {
      setError(res.error ?? "Could not load course modules.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadModules();
  }, []);

  function handleOpenCreateModal(mod: AdminModuleSummary) {
    setSelectedModule(mod);
    const base = mod.latestApprovedVersion ?? mod.versions[0]?.version ?? "1.0.0";
    setSourceVersion(base);

    // Auto-suggest next minor or patch version
    const parts = base.split(".").map((n) => parseInt(n, 10));
    if (parts.length === 3 && parts[0] !== undefined && parts[1] !== undefined && !parts.some(isNaN)) {
      const nextMinor = `${parts[0]}.${parts[1] + 1}.0`;
      setTargetVersion(nextMinor);
    } else {
      setTargetVersion("1.1.0");
    }

    setChangeSummary("");
    setModalError(null);
  }

  async function handleCreateDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModule) return;
    setCreating(true);
    setModalError(null);

    const res = await tradeFetch("POST", `/admin/modules/${selectedModule.id}/versions`, {
      sourceVersion,
      targetVersion: targetVersion.trim(),
      changeSummary: changeSummary.trim() || undefined,
    });

    if (res.ok) {
      setSelectedModule(null);
      await loadModules();
    } else {
      setModalError(res.error ?? "Failed to create draft version.");
    }
    setCreating(false);
  }

  const filtered = modules.filter(
    (m) =>
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.deliverable.toLowerCase().includes(search.toLowerCase()),
  );

  const totalDrafts = modules.filter((m) => m.activeDraftVersion).length;
  const totalInReview = modules.filter((m) => m.inReviewVersion).length;

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Course Content Studio</h1>
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-700/10">
              Staff Editor
            </span>
          </div>
          <p className="text-sm text-neutral-600 mt-1">
            Author and refine course lessons, quiz explanations, worksheets, and rubrics with review gating and version immutability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => loadModules()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/modules">
            <Button variant="ghost" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              View as Learner
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Curriculum Modules</p>
              <p className="text-xl font-bold text-neutral-900 mt-0.5">{modules.length} Live</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Active Drafts</p>
              <p className="text-xl font-bold text-neutral-900 mt-0.5">{totalDrafts} in Progress</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 bg-white border-neutral-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Awaiting Review</p>
              <p className="text-xl font-bold text-neutral-900 mt-0.5">{totalInReview} for Approval</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Filter modules by ID or title (e.g. M01, readiness, finance)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Failed to load course modules</p>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Modules List Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-neutral-500 flex flex-col items-center justify-center">
          <RefreshCw className="w-6 h-6 animate-spin text-neutral-400 mb-2" />
          Loading course content packages...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-500">
          No modules found matching &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((mod) => {
            const hasDraft = Boolean(mod.activeDraftVersion);
            const hasReview = Boolean(mod.inReviewVersion);
            const defaultTargetVersion = mod.activeDraftVersion || mod.inReviewVersion || mod.latestApprovedVersion || "1.0.0";

            return (
              <Card key={mod.id} className="p-5 bg-white border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                        {mod.id}
                      </span>
                      <h2 className="font-semibold text-neutral-900 text-base">{mod.title}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {mod.latestApprovedVersion && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          v{mod.latestApprovedVersion}
                        </span>
                      )}
                      {hasReview && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          v{mod.inReviewVersion} Review
                        </span>
                      )}
                      {hasDraft && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                          <FileEdit className="w-3 h-3" />
                          v{mod.activeDraftVersion} Draft
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-500 mt-2 line-clamp-2">
                    <strong className="text-neutral-700">Deliverable:</strong> {mod.deliverable}
                  </p>

                  {/* Versions history line */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-neutral-400" />
                      {mod.versions.length} version{mod.versions.length === 1 ? "" : "s"} on file
                    </span>
                    <span className="text-neutral-400">
                      {mod.versions[0]?.changeSummary ?? "Baseline release"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenCreateModal(mod)}
                    className="text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    New Draft Version
                  </Button>
                  <Link href={`/admin/modules/${mod.id}/editor?version=${defaultTargetVersion}`}>
                    <Button size="sm" className="text-xs bg-neutral-900 hover:bg-neutral-800 text-white">
                      <FileEdit className="w-3.5 h-3.5 mr-1.5" />
                      Open Studio
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Draft Version Modal */}
      {selectedModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-neutral-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">
                  New Draft Version for {selectedModule.id}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Creates an editable draft branched from an existing approved version.
                </p>
              </div>
              <button
                onClick={() => setSelectedModule(null)}
                className="text-neutral-400 hover:text-neutral-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDraft} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Source Base Version
                </label>
                <select
                  value={sourceVersion}
                  onChange={(e) => setSourceVersion(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                >
                  {selectedModule.versions.map((v) => (
                    <option key={v.version} value={v.version}>
                      v{v.version} ({v.status}) - {v.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-500 mt-1">
                  The initial contents of the draft will be copied from this version.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Target Version Number (Semver)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1.1.0 or 1.0.1"
                  pattern="^\d+\.\d+\.\d+$"
                  value={targetVersion}
                  onChange={(e) => setTargetVersion(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Must be format major.minor.patch (e.g. 1.1.0 for feature updates, 1.0.1 for fixes).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Change Summary / Release Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe what is being changed (e.g. Clarified quiz question 2 explanation per #210, updated rubric threshold)..."
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setSelectedModule(null)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="bg-neutral-900 hover:bg-neutral-800 text-white">
                  {creating ? "Creating Draft..." : "Create Draft"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
