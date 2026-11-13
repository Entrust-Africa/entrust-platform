"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  Eye,
  FileCheck2,
  FileEdit,
  GitBranch,
  HelpCircle,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { Markdown } from "@/components/markdown";
import type { LearnerModuleData } from "@/components/modules/module-viewer";
import { tradeFetch } from "@/lib/trade-client";
import type { AdminModuleSummary, AdminModuleVersionDetail } from "@/lib/types";
import { NewDraftDialog, versionLabel } from "@/components/studio/new-draft-dialog";
import { useMe } from "@/lib/use-me";

export default function ModuleEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const moduleId = String(params.id ?? "M01");
  const requestedVersion = searchParams.get("version") ?? "1.0.0";
  // Set by the new-draft dialog, so the editor can say the draft was made.
  const justStarted = searchParams.get("started") === "1";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [versionDetail, setVersionDetail] = useState<AdminModuleVersionDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "lessons" | "quiz" | "rubric" | "worksheets" | "ai">("general");

  // Form State
  const [title, setTitle] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [objectives, setObjectives] = useState<string[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [workedExample, setWorkedExample] = useState<{ title: string; body: string } | null>(null);
  const [worksheets, setWorksheets] = useState<any[]>([]);
  const [knowledgeCheck, setKnowledgeCheck] = useState<{ passMark: number; questions: any[] }>({ passMark: 80, questions: [] });
  // Entrust's common standard: six criteria scored 0 to 6, pass at 24 of 36, no must-have criteria.
  const [rubric, setRubric] = useState<any>({ criteria: [], passMark: 24, mustHaveMinimum: 0, bands: [] });
  const [aiPrompts, setAiPrompts] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<LearnerModuleData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showNewDraft, setShowNewDraft] = useState(false);
  // Every version of this module, for the version picker and to know which one is live.
  const [moduleSummary, setModuleSummary] = useState<AdminModuleSummary | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [approving, setApproving] = useState(false);

  async function loadVersionData(version: string) {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    const res = await tradeFetch<AdminModuleVersionDetail>("GET", `/admin/modules/${moduleId}/versions/${version}`);
    if (res.ok && res.data) {
      setVersionDetail(res.data);
      const c = res.data.content as any;
      setTitle(res.data.title || c?.title || "");
      setDeliverable(res.data.deliverable || c?.deliverable || "");
      setObjectives(res.data.objectives || c?.objectives || []);
      setLessons(c?.lessons || []);
      setWorkedExample(c?.workedExample || null);
      setWorksheets(c?.worksheets || []);
      setKnowledgeCheck(c?.knowledgeCheck || { passMark: 80, questions: [] });
      setRubric(c?.rubric || { criteria: [], passMark: 24, mustHaveMinimum: 0, bands: [] });
      setAiPrompts(c?.aiPrompts || []);
      setIsDirty(false);
    } else {
      setError(res.error ?? "Failed to load version details.");
    }
    setLoading(false);
  }

  async function loadModuleSummary() {
    const res = await tradeFetch<{ items: AdminModuleSummary[] }>("GET", "/admin/modules");
    setModuleSummary(res.data?.items.find((m) => m.id === moduleId) ?? null);
  }

  useEffect(() => {
    void loadVersionData(requestedVersion).then(() => {
      if (justStarted) setSuccessMsg(`Draft v${requestedVersion} started. Edit it here, save, then send it for review.`);
    });
    void loadModuleSummary();
  }, [moduleId, requestedVersion]);

  // Leaving with unsaved edits loses them: the browser asks first.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // Only an Entrust administrator approves a version; the API refuses anyone else, so nobody else is offered it.
  const me = useMe();
  const canApprove = me?.staffRole === "admin";

  const isApproved = versionDetail?.status === "approved" || versionDetail?.status === "archived";
  const isInReview = versionDetail?.status === "in_review";
  const isDraft = versionDetail?.status === "draft";
  // Only a draft can be edited: once it is submitted for review the content stays as the reviewer saw it.
  const locked = !isDraft;
  const liveVersion = moduleSummary?.latestApprovedVersion ?? null;
  // A draft already open for this module, other than the one on screen: offered instead of starting a second one.
  const openDraft = moduleSummary?.versions.find((v) => (v.status === "draft" || v.status === "in_review") && v.version !== versionDetail?.version) ?? null;

  // Build current merged content object for saving
  function buildPayloadContent() {
    const base = versionDetail?.content || {};
    return {
      ...base,
      module: moduleId,
      version: versionDetail?.version,
      status: "draft",
      title,
      deliverable,
      objectives,
      lessons,
      workedExample,
      worksheets,
      knowledgeCheck,
      rubric,
      aiPrompts,
    };
  }

  /** Saves the draft. True when it saved, so a step that needs the saved draft can stop when it didn't. */
  async function handleSaveDraft(strict = true): Promise<boolean> {
    if (locked) return false;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      title,
      deliverable,
      objectives,
      content: buildPayloadContent(),
      changeSummary: "Updated content in course studio",
      strictValidation: strict,
    };

    const res = await tradeFetch<AdminModuleVersionDetail>("PATCH", `/admin/modules/${moduleId}/versions/${versionDetail?.version}`, payload);
    if (res.ok && res.data) {
      setVersionDetail(res.data);
      setIsDirty(false);
      setSuccessMsg("Draft saved.");
    } else {
      setError(res.error ?? "Failed to save draft.");
    }
    setSaving(false);
    return Boolean(res.ok && res.data);
  }

  async function handleSubmitReview() {
    if (!versionDetail) return;
    setSaving(true);
    setError(null);

    // Save first with strict validation. If that fails, the reviewer would get the last saved copy, not what's on screen,
    // so nothing is sent.
    if (isDirty && !(await handleSaveDraft(true))) {
      setSaving(false);
      return;
    }

    const res = await tradeFetch<AdminModuleVersionDetail>("POST", `/admin/modules/${moduleId}/versions/${versionDetail.version}/submit-review`);
    if (res.ok && res.data) {
      setVersionDetail(res.data);
      setSuccessMsg("Sent for review. An administrator approves it before learners see it.");
      void loadModuleSummary();
    } else {
      setError(res.error ?? "Failed to submit draft for review.");
    }
    setSaving(false);
  }

  async function handleApprove() {
    if (!versionDetail) return;
    setApproving(true);
    setError(null);

    const res = await tradeFetch<AdminModuleVersionDetail>("POST", `/admin/modules/${moduleId}/versions/${versionDetail.version}/approve`, {
      notes: approveNotes.trim() || undefined,
    });

    if (res.ok && res.data) {
      setVersionDetail(res.data);
      setShowApproveModal(false);
      setSuccessMsg(`v${res.data.version} is approved and live. New learners get it; anyone part-way through keeps their version.`);
      void loadModuleSummary();
    } else {
      setError(res.error ?? "Failed to approve version.");
    }
    setApproving(false);
  }

  async function handleOpenPreview() {
    if (!versionDetail) return;
    setPreviewLoading(true);
    setShowPreviewModal(true);
    const res = await tradeFetch<LearnerModuleData>("GET", `/admin/modules/${moduleId}/versions/${versionDetail.version}/preview`);
    if (res.ok && res.data) {
      setPreviewData(res.data);
    } else {
      setError(res.error ?? "Failed to generate learner preview.");
      setShowPreviewModal(false);
    }
    setPreviewLoading(false);
  }

  return (
    <div className="space-y-6">
      {/* Where you are: the module, which version is open, and what can be done with it. */}
      <div className="space-y-3">
        <Link href="/admin/modules" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
          <ArrowLeft className="size-4" /> Course studio
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">{moduleId}</span>
          <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">{title || moduleId}</h1>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <label htmlFor="studio-version" className="font-semibold text-ink">
              Version
            </label>
            <select
              id="studio-version"
              value={versionDetail?.version ?? requestedVersion}
              onChange={(e) => {
                if (isDirty && !window.confirm("You have changes that aren't saved. Leave them?")) return;
                router.push(`/admin/modules/${moduleId}/editor?version=${encodeURIComponent(e.target.value)}`);
              }}
              className="h-10 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {(moduleSummary?.versions ?? (versionDetail ? [versionDetail] : [])).map((v) => (
                <option key={v.version} value={v.version}>
                  {versionLabel(v)}
                </option>
              ))}
            </select>
            {versionDetail?.updatedAt && (
              <span className="text-ink-3">
                Last changed {new Date(versionDetail.updatedAt).toLocaleString()}
                {versionDetail.createdByUser?.name ? ` · started by ${versionDetail.createdByUser.name}` : ""}
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={handleOpenPreview} disabled={loading}>
              <Eye className="size-4" />
              Preview as learner
            </Button>

            {isDraft && (
              <>
                <Button variant="secondary" onClick={() => handleSaveDraft(true)} disabled={saving || !isDirty}>
                  <Save className="size-4" />
                  {saving ? "Saving…" : isDirty ? "Save draft" : "Saved"}
                </Button>
                <Button onClick={handleSubmitReview} disabled={saving}>
                  <Send className="size-4" />
                  Send for review
                </Button>
              </>
            )}

            {isInReview && canApprove && (
              <Button onClick={() => setShowApproveModal(true)}>
                <ShieldCheck className="size-4" />
                Approve
              </Button>
            )}

            {!isDraft && !isInReview && versionDetail && (
              openDraft ? (
                <Link
                  href={`/admin/modules/${moduleId}/editor?version=${encodeURIComponent(openDraft.version)}`}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <FileEdit className="size-4" />
                  Open draft v{openDraft.version}
                </Link>
              ) : (
                <Button onClick={() => setShowNewDraft(true)} disabled={!moduleSummary}>
                  <GitBranch className="size-4" />
                  Start a new draft
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* What this version is, in one sentence, so nobody wonders whether they are editing what learners see. */}
      {versionDetail && (
        <div
          className={`flex items-start gap-3 rounded-md p-4 text-sm ring-1 ring-inset ${
            isDraft ? "bg-info-50 text-ink ring-info/25" : isInReview ? "bg-warn-50 text-ink ring-warn/25" : "bg-surface-2 text-ink ring-line"
          }`}
        >
          {isDraft ? <FileEdit className="mt-0.5 size-5 shrink-0 text-info" /> : isInReview ? <Clock className="mt-0.5 size-5 shrink-0 text-warn" /> : <Lock className="mt-0.5 size-5 shrink-0 text-ink-2" />}
          <div>
            {isDraft && (
              <>
                <p className="font-semibold">You are editing draft v{versionDetail.version}.</p>
                <p className="mt-0.5 text-ink-2">
                  {versionDetail.changeSummary ? `${versionDetail.changeSummary}. ` : ""}
                  Learners don't see it: they keep {liveVersion ? `v${liveVersion}` : "the live version"} until this draft is sent for review and an administrator
                  approves it. Save as you go.
                </p>
              </>
            )}
            {isInReview && (
              <>
                <p className="font-semibold">v{versionDetail.version} is waiting for an administrator's approval.</p>
                <p className="mt-0.5 text-ink-2">
                  It can't be edited now, so the approver sees exactly what was sent. Learners keep {liveVersion ? `v${liveVersion}` : "the live version"} until it is approved.
                </p>
              </>
            )}
            {versionDetail.status === "approved" && (
              <>
                <p className="font-semibold">v{versionDetail.version} is live: this is what learners see.</p>
                <p className="mt-0.5 text-ink-2">
                  A live version never changes, so learners part-way through it aren't disrupted. To change the module,{" "}
                  {openDraft ? `carry on with draft v${openDraft.version}` : "start a new draft: it copies this version for you to edit"}.
                </p>
              </>
            )}
            {versionDetail.status === "archived" && (
              <>
                <p className="font-semibold">v{versionDetail.version} is retired.</p>
                <p className="mt-0.5 text-ink-2">A newer version replaced it. You can still read it, or copy it into a new draft.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 rounded-lg bg-ok-50 border border-ok/25 text-ok text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-ok shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-ok hover:text-ok">
            &times;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-danger-50 border border-danger/25 text-danger text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">That didn&apos;t work</p>
            <p className="whitespace-pre-wrap mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-danger hover:text-danger">
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-px overflow-x-auto">
        {[
          { id: "general", label: "Overview & Objectives" },
          { id: "lessons", label: `Lessons (${lessons.length})` },
          { id: "quiz", label: `Knowledge Check Quiz (${knowledgeCheck.questions.length})` },
          { id: "rubric", label: `Assessment Rubric (${rubric.criteria?.length || 0})` },
          { id: "worksheets", label: `Worksheets (${worksheets.length})` },
          { id: "ai", label: `AI Practice Lab (${aiPrompts.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
              activeTab === t.id
                ? "border-brand-600 text-brand-700 bg-brand-50/50"
                : "border-transparent text-ink-2 hover:text-ink hover:bg-surface-2"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: General & Objectives */}
      {activeTab === "general" && (
        <Card className="p-6 bg-surface border-line shadow-sm space-y-6">
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label htmlFor="editor-page-1" className="block text-xs font-bold text-ink mb-1">Module Title</label>
              <input id="editor-page-1"
                type="text"
                disabled={locked}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2 text-sm border border-line-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-surface-2"
              />
            </div>

            <div>
              <label htmlFor="editor-page-2" className="block text-xs font-bold text-ink mb-1">Deliverable Outcome</label>
              <textarea id="editor-page-2"
                rows={2}
                disabled={locked}
                value={deliverable}
                onChange={(e) => {
                  setDeliverable(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2 text-sm border border-line-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-surface-2"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-ink">Learning Objectives</label>
                {!locked && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setObjectives([...objectives, "New learning objective"]);
                      setIsDirty(true);
                    }}
                    className="text-xs h-7"
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add Objective
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {objectives.map((obj, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-ink-3 w-5">{i + 1}.</span>
                    <input
                      type="text"
                      disabled={locked}
                      value={obj}
                      onChange={(e) => {
                        const copy = [...objectives];
                        copy[i] = e.target.value;
                        setObjectives(copy);
                        setIsDirty(true);
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border border-line-strong rounded-md focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:bg-surface-2"
                    />
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => {
                          setObjectives(objectives.filter((_, idx) => idx !== i));
                          setIsDirty(true);
                        }}
                        className="p-1 text-ink-3 hover:text-danger"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tab 2: Lessons */}
      {activeTab === "lessons" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-3">Edit curriculum lessons, reading time estimates, and video references.</p>
            {!locked && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const newId = `lesson-${lessons.length + 1}`;
                  setLessons([...lessons, { id: newId, title: "New Lesson Title", body: "Lesson markdown content here...", minutes: 15 }]);
                  setIsDirty(true);
                }}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Lesson
              </Button>
            )}
          </div>

          {lessons.map((lesson, idx) => (
            <Card key={lesson.id || idx} className="p-5 bg-surface border-line shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-2 text-ink-2">
                    {lesson.id}
                  </span>
                  <input
                    type="text"
                    disabled={locked}
                    value={lesson.title}
                    onChange={(e) => {
                      const updated = [...lessons];
                      updated[idx].title = e.target.value;
                      setLessons(updated);
                      setIsDirty(true);
                    }}
                    className="flex-1 font-semibold text-sm px-2.5 py-1 border border-line-strong rounded focus:ring-2 focus:ring-brand-500 disabled:bg-surface-2"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-ink-3" />
                    <input
                      type="number"
                      disabled={locked}
                      min={1}
                      value={lesson.minutes ?? 15}
                      onChange={(e) => {
                        const updated = [...lessons];
                        updated[idx].minutes = parseInt(e.target.value, 10) || 15;
                        setLessons(updated);
                        setIsDirty(true);
                      }}
                      className="w-16 text-xs px-2 py-1 border border-line-strong rounded font-mono"
                    />
                    <span className="text-xs text-ink-3">min</span>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => {
                        setLessons(lessons.filter((_, i) => i !== idx));
                        setIsDirty(true);
                      }}
                      className="p-1 text-ink-3 hover:text-danger"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="editor-page-3" className="block text-xs font-semibold text-ink-2 mb-1">Lesson Markdown Content</label>
                <textarea id="editor-page-3"
                  rows={8}
                  disabled={locked}
                  value={lesson.body}
                  onChange={(e) => {
                    const updated = [...lessons];
                    updated[idx].body = e.target.value;
                    setLessons(updated);
                    setIsDirty(true);
                  }}
                  className="w-full font-mono text-xs p-3 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand-500 disabled:bg-surface-2"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 3: Knowledge Check Quiz (Addresses Issue #210 & #212) */}
      {activeTab === "quiz" && (
        <div className="space-y-6">
          <Card className="p-4 bg-brand-50/50 border-brand-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-brand-700">Quiz Passing Threshold</h3>
                <p className="text-xs text-brand-700 mt-0.5">
                  Percentage required for learner mastery. (Must be 1-100%).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  disabled={locked}
                  value={knowledgeCheck.passMark}
                  onChange={(e) => {
                    setKnowledgeCheck({ ...knowledgeCheck, passMark: parseInt(e.target.value, 10) || 80 });
                    setIsDirty(true);
                  }}
                  className="w-20 px-3 py-1.5 text-sm font-bold border border-line-strong rounded-lg bg-surface text-center"
                />
                <span className="text-sm font-semibold text-brand-700">%</span>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-3">
              Questions must contain at least 2 options and at least one marked correct answer. Explanations help learners understand the concepts.
            </p>
            {!locked && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const newQId = `q${knowledgeCheck.questions.length + 1}`;
                  setKnowledgeCheck({
                    ...knowledgeCheck,
                    questions: [
                      ...knowledgeCheck.questions,
                      {
                        id: newQId,
                        text: "New quiz question prompt?",
                        options: [
                          { id: "opt-1", text: "Option A" },
                          { id: "opt-2", text: "Option B" },
                        ],
                        correct: ["opt-1"],
                        explanation: "Explanation of why this answer is correct.",
                      },
                    ],
                  });
                  setIsDirty(true);
                }}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Question
              </Button>
            )}
          </div>

          {knowledgeCheck.questions.map((q, qIdx) => (
            <Card key={q.id || qIdx} className="p-5 bg-surface border-line shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-2 text-ink border border-line">
                    Q{qIdx + 1} ({q.id})
                  </span>
                  <input
                    type="text"
                    disabled={locked}
                    value={q.text}
                    onChange={(e) => {
                      const updated = { ...knowledgeCheck };
                      updated.questions[qIdx].text = e.target.value;
                      setKnowledgeCheck(updated);
                      setIsDirty(true);
                    }}
                    placeholder="Enter question prompt..."
                    className="flex-1 text-sm font-medium px-3 py-1.5 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand-500 disabled:bg-surface-2"
                  />
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => {
                      setKnowledgeCheck({
                        ...knowledgeCheck,
                        questions: knowledgeCheck.questions.filter((_, i) => i !== qIdx),
                      });
                      setIsDirty(true);
                    }}
                    className="p-1 text-ink-3 hover:text-danger"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Options list */}
              <div className="pl-4 border-l-2 border-line space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-ink-2">Answer Options (Check correct):</p>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...knowledgeCheck };
                        const optCount = updated.questions[qIdx].options.length + 1;
                        updated.questions[qIdx].options.push({
                          id: `opt-${optCount}`,
                          text: `Option ${String.fromCharCode(64 + optCount)}`,
                        });
                        setKnowledgeCheck(updated);
                        setIsDirty(true);
                      }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                {q.options.map((opt: any, oIdx: number) => {
                  const isChecked = q.correct?.includes(opt.id);
                  return (
                    <div key={opt.id || oIdx} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = { ...knowledgeCheck };
                          const currentCorrect = updated.questions[qIdx].correct || [];
                          if (e.target.checked) {
                            updated.questions[qIdx].correct = [...new Set([...currentCorrect, opt.id])];
                          } else {
                            updated.questions[qIdx].correct = currentCorrect.filter((id: string) => id !== opt.id);
                          }
                          setKnowledgeCheck(updated);
                          setIsDirty(true);
                        }}
                        className="w-4 h-4 rounded text-brand-600 border-line-strong focus:ring-brand-500"
                      />
                      <input
                        type="text"
                        disabled={locked}
                        value={opt.text}
                        onChange={(e) => {
                          const updated = { ...knowledgeCheck };
                          updated.questions[qIdx].options[oIdx].text = e.target.value;
                          setKnowledgeCheck(updated);
                          setIsDirty(true);
                        }}
                        className="flex-1 text-xs px-2.5 py-1 border border-line-strong rounded focus:ring-2 focus:ring-brand-500 disabled:bg-surface-2"
                      />
                      {!isApproved && q.options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = { ...knowledgeCheck };
                            updated.questions[qIdx].options = updated.questions[qIdx].options.filter((_: any, i: number) => i !== oIdx);
                            updated.questions[qIdx].correct = (updated.questions[qIdx].correct || []).filter((id: string) => id !== opt.id);
                            setKnowledgeCheck(updated);
                            setIsDirty(true);
                          }}
                          className="p-1 text-ink-3 hover:text-danger"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Field (Issue #210) */}
              <div className="pt-2 border-t border-line">
                <label htmlFor="editor-page-4" className="block text-xs font-semibold text-ink-2 mb-1">
                  Explanation & Concept Clarification
                </label>
                <textarea id="editor-page-4"
                  rows={2}
                  disabled={locked}
                  placeholder="Provide educational explanation displayed to learners upon submitting their quiz attempt..."
                  value={q.explanation || ""}
                  onChange={(e) => {
                    const updated = { ...knowledgeCheck };
                    updated.questions[qIdx].explanation = e.target.value;
                    setKnowledgeCheck(updated);
                    setIsDirty(true);
                  }}
                  className="w-full text-xs p-2.5 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand-500 disabled:bg-surface-2"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 4: Rubric */}
      {activeTab === "rubric" && (
        <Card className="p-6 bg-surface border-line shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-surface-2 border border-line">
            <div>
              <h3 className="text-xs font-bold uppercase text-ink-2">Rubric Thresholds</h3>
              <p className="text-xs text-ink-3">Points needed for module deliverable qualification.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-ink-2">Pass Mark:</span>
                <input
                  type="number"
                  min={1}
                  disabled={locked}
                  value={rubric.passMark ?? 14}
                  onChange={(e) => {
                    setRubric({ ...rubric, passMark: parseInt(e.target.value, 10) || 14 });
                    setIsDirty(true);
                  }}
                  className="w-16 text-xs px-2 py-1 border border-line-strong rounded font-mono text-center"
                />
                <span className="text-xs text-ink-3">pts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-ink-2">Must-Have Min:</span>
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  value={rubric.mustHaveMinimum ?? 2}
                  onChange={(e) => {
                    setRubric({ ...rubric, mustHaveMinimum: parseInt(e.target.value, 10) || 2 });
                    setIsDirty(true);
                  }}
                  className="w-16 text-xs px-2 py-1 border border-line-strong rounded font-mono text-center"
                />
                <span className="text-xs text-ink-3">pts</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-ink">Grading Criteria</h4>
              {!locked && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const cCount = (rubric.criteria?.length || 0) + 1;
                    const updated = {
                      ...rubric,
                      criteria: [
                        ...(rubric.criteria || []),
                        { id: `c${cCount}`, title: "New Criterion", maxPoints: 6, mustHave: false, description: "Description of criterion..." },
                      ],
                    };
                    setRubric(updated);
                    setIsDirty(true);
                  }}
                  className="text-xs h-7"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Criterion
                </Button>
              )}
            </div>

            {(rubric.criteria || []).map((crit: any, cIdx: number) => (
              <div key={crit.id || cIdx} className="p-3.5 rounded-lg border border-line bg-surface space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-2 text-ink-2">
                      {crit.id}
                    </span>
                    <input
                      type="text"
                      disabled={locked}
                      value={crit.title}
                      onChange={(e) => {
                        const copy = [...rubric.criteria];
                        copy[cIdx].title = e.target.value;
                        setRubric({ ...rubric, criteria: copy });
                        setIsDirty(true);
                      }}
                      className="flex-1 text-xs font-semibold px-2 py-1 border border-line-strong rounded"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-ink-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={crit.mustHave}
                        onChange={(e) => {
                          const copy = [...rubric.criteria];
                          copy[cIdx].mustHave = e.target.checked;
                          setRubric({ ...rubric, criteria: copy });
                          setIsDirty(true);
                        }}
                        className="rounded text-brand-600"
                      />
                      Must-Have
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-ink-3">Max:</span>
                      <input
                        type="number"
                        min={1}
                        disabled={locked}
                        value={crit.maxPoints}
                        onChange={(e) => {
                          const copy = [...rubric.criteria];
                          copy[cIdx].maxPoints = parseInt(e.target.value, 10) || 1;
                          setRubric({ ...rubric, criteria: copy });
                          setIsDirty(true);
                        }}
                        className="w-12 text-xs px-1.5 py-0.5 border border-line-strong rounded text-center"
                      />
                    </div>
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => {
                          setRubric({
                            ...rubric,
                            criteria: rubric.criteria.filter((_: any, i: number) => i !== cIdx),
                          });
                          setIsDirty(true);
                        }}
                        className="p-1 text-ink-3 hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  rows={2}
                  disabled={locked}
                  value={crit.description || ""}
                  onChange={(e) => {
                    const copy = [...rubric.criteria];
                    copy[cIdx].description = e.target.value;
                    setRubric({ ...rubric, criteria: copy });
                    setIsDirty(true);
                  }}
                  placeholder="Scoring guidance for assessor..."
                  className="w-full text-xs p-2 border border-line rounded"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 5: Worksheets */}
      {activeTab === "worksheets" && (
        <Card className="p-6 bg-surface border-line shadow-sm space-y-4">
          <p className="text-xs text-ink-3">
            Worksheets contain structured form fields and calculated matrices for SME completion.
          </p>
          {worksheets.map((ws, wIdx) => (
            <div key={ws.id || wIdx} className="p-4 rounded-lg border border-line bg-canvas space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-ink-2">{ws.id}</span>
                <input
                  type="text"
                  disabled={locked}
                  value={ws.title}
                  onChange={(e) => {
                    const copy = [...worksheets];
                    copy[wIdx].title = e.target.value;
                    setWorksheets(copy);
                    setIsDirty(true);
                  }}
                  className="flex-1 mx-3 text-sm font-semibold px-2.5 py-1 border border-line-strong rounded bg-surface"
                />
              </div>
              <div className="text-xs text-ink-2 space-y-1">
                <p><strong>Fields:</strong> {ws.fields?.length || 0} fields configured</p>
                <p><strong>Tables:</strong> {ws.tables?.length || 0} tables</p>
                <p><strong>Computed Formulas:</strong> {ws.computed?.length || 0} computed metrics</p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Tab 6: AI Practice Lab */}
      {activeTab === "ai" && (
        <Card className="p-6 bg-surface border-line shadow-sm space-y-4">
          <p className="text-xs text-ink-3">
            AI prompts for SME practice lab exercises, with prompt templates and verification criteria.
          </p>
          {aiPrompts.map((prompt, pIdx) => (
            <div key={prompt.id || pIdx} className="p-4 rounded-lg border border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-ink-2">{prompt.id}</span>
                <input
                  type="text"
                  disabled={locked}
                  value={prompt.title}
                  onChange={(e) => {
                    const copy = [...aiPrompts];
                    copy[pIdx].title = e.target.value;
                    setAiPrompts(copy);
                    setIsDirty(true);
                  }}
                  className="flex-1 mx-3 text-xs font-semibold px-2 py-1 border border-line-strong rounded"
                />
              </div>
              <textarea
                rows={3}
                disabled={locked}
                value={prompt.prompt}
                onChange={(e) => {
                  const copy = [...aiPrompts];
                  copy[pIdx].prompt = e.target.value;
                  setAiPrompts(copy);
                  setIsDirty(true);
                }}
                className="w-full font-mono text-xs p-2.5 border border-line rounded"
              />
            </div>
          ))}
        </Card>
      )}

      {showNewDraft && moduleSummary && versionDetail && (
        <NewDraftDialog
          moduleId={moduleId}
          moduleTitle={title || moduleSummary.title}
          versions={moduleSummary.versions}
          from={versionDetail.version}
          onClose={() => setShowNewDraft(false)}
        />
      )}

      {/* Approve Modal Confirmation */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-xl shadow-xl max-w-md w-full p-6 border border-line">
            <div className="flex items-center gap-3 text-ok">
              <ShieldCheck className="w-6 h-6 text-ok shrink-0" />
              <div>
                <h3 className="text-base font-bold text-ink">Approve Version {versionDetail?.version}</h3>
                <p className="text-xs text-ink-3">Publish this module version to production.</p>
              </div>
            </div>

            <div className="my-4 p-3 rounded-lg bg-warn-50 border border-warn/25 text-xs text-warn space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" /> Important Immutability Rule:
              </p>
              <p>
                Once approved, this version becomes <strong>immutable</strong> and will never change. Newly enrolled learners will automatically receive it.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="editor-page-5" className="block text-xs font-semibold text-ink-2">Approval Notes</label>
              <textarea id="editor-page-5"
                rows={3}
                placeholder="e.g. Reviewed with trade advisory board and cleared for publishing..."
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                className="w-full text-xs p-2.5 border border-line-strong rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)} disabled={approving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-ok hover:bg-ok text-white">
                {approving ? "Publishing..." : "Confirm & Approve"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Learner Preview Simulator Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col border border-line overflow-hidden">
            <div className="p-4 border-b border-line flex items-center justify-between bg-surface-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-600" />
                <h3 className="font-bold text-sm text-ink">Learner View Simulator</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-brand-100 text-brand-700 font-medium">
                  v{versionDetail?.version} (Answer keys hidden)
                </span>
              </div>
              <button
                aria-label="Close preview"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-md text-ink-3 hover:text-ink-2 hover:bg-line"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-canvas">
              {previewLoading || !previewData ? (
                <div className="py-24 text-center text-sm text-ink-3 flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-ink-3 mb-2" />
                  Generating sanitized learner view...
                </div>
              ) : (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="p-4 rounded-xl bg-surface border border-line shadow-sm">
                    <h2 className="text-xl font-bold text-ink">{previewData.title}</h2>
                    <p className="text-xs text-ink-2 mt-1">{previewData.deliverable}</p>
                    <div className="mt-4 pt-3 border-t border-line">
                      <h4 className="text-xs font-semibold text-ink-2 uppercase tracking-wide">Objectives:</h4>
                      <ul className="list-disc pl-5 mt-1.5 space-y-1 text-xs text-ink-2">
                        {previewData.objectives.map((obj: string, i: number) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Lessons Preview */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-ink">Curriculum Lessons</h3>
                    {previewData.lessons.map((lesson: any) => (
                      <Card key={lesson.id} className="p-4 bg-surface border-line space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-ink">{lesson.title}</h4>
                          <span className="text-xs text-ink-3">{lesson.minutes} min read</span>
                        </div>
                        <div className="text-xs text-ink-2 prose max-w-none">
                          <Markdown source={lesson.body} />
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Quiz Preview */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-ink">
                      Knowledge Check Quiz ({previewData.knowledgeCheck.questions.length} questions • Pass mark: {previewData.knowledgeCheck.passMark}%)
                    </h3>
                    {previewData.knowledgeCheck.questions.map((q: any, idx: number) => (
                      <Card key={q.id || idx} className="p-4 bg-surface border-line space-y-3">
                        <p className="text-xs font-semibold text-ink">
                          {idx + 1}. {q.text}
                        </p>
                        <div className="space-y-1.5 pl-2">
                          {q.options.map((opt: any) => (
                            <div key={opt.id} className="flex items-center gap-2 text-xs text-ink-2 p-2 rounded border border-line bg-canvas">
                              <input type={q.multiple ? "checkbox" : "radio"} disabled className="text-brand-600" />
                              <span>{opt.text}</span>
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
