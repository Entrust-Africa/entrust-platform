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
import { ModuleViewer, type LearnerModuleData } from "@/components/modules/module-viewer";
import { tradeFetch } from "@/lib/trade-client";
import type { AdminModuleVersionDetail } from "@/lib/types";

export default function ModuleEditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const moduleId = String(params.id ?? "M01");
  const requestedVersion = searchParams.get("version") ?? "1.0.0";

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
  const [rubric, setRubric] = useState<any>({ criteria: [], passMark: 14, mustHaveMinimum: 2, bands: [] });
  const [aiPrompts, setAiPrompts] = useState<any[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Modals
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<LearnerModuleData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [showApproveModal, setShowApproveModal] = useState(false);
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
      setRubric(c?.rubric || { criteria: [], passMark: 14, mustHaveMinimum: 2, bands: [] });
      setAiPrompts(c?.aiPrompts || []);
      setIsDirty(false);
    } else {
      setError(res.error ?? "Failed to load version details.");
    }
    setLoading(false);
  }

  useEffect(() => {
    loadVersionData(requestedVersion);
  }, [moduleId, requestedVersion]);

  const isApproved = versionDetail?.status === "approved" || versionDetail?.status === "archived";
  const isInReview = versionDetail?.status === "in_review";
  const isDraft = versionDetail?.status === "draft";
  // Only a draft can be edited: once it is submitted for review the content stays as the reviewer saw it.
  const locked = !isDraft;

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

  async function handleSaveDraft(strict = true) {
    if (locked) return;
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
      setSuccessMsg("Draft saved successfully.");
    } else {
      setError(res.error ?? "Failed to save draft.");
    }
    setSaving(false);
  }

  async function handleSubmitReview() {
    if (!versionDetail) return;
    setSaving(true);
    setError(null);

    // Save first with strict validation
    await handleSaveDraft(true);

    const res = await tradeFetch<AdminModuleVersionDetail>("POST", `/admin/modules/${moduleId}/versions/${versionDetail.version}/submit-review`);
    if (res.ok && res.data) {
      setVersionDetail(res.data);
      setSuccessMsg("Draft successfully submitted for review!");
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
      setSuccessMsg(`Version ${res.data.version} successfully approved into production!`);
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
    <div className="space-y-6 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/modules" className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
                {moduleId}
              </span>
              <h1 className="text-xl font-bold text-neutral-900">{title || moduleId}</h1>
              {versionDetail && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                    isApproved
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : isInReview
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-sky-50 text-sky-700 border border-sky-200"
                  }`}
                >
                  {isApproved && <CheckCircle2 className="w-3.5 h-3.5" />}
                  {isInReview && <Clock className="w-3.5 h-3.5" />}
                  {isDraft && <FileEdit className="w-3.5 h-3.5" />}
                  v{versionDetail.version} ({versionDetail.status.toUpperCase()})
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Author: {versionDetail?.createdByUser?.name ?? "Entrust Staff"} • Last Updated:{" "}
              {versionDetail?.updatedAt ? new Date(versionDetail.updatedAt).toLocaleString() : "Recently"}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleOpenPreview} disabled={loading}>
            <Eye className="w-4 h-4 mr-1.5" />
            Preview as Learner
          </Button>

          {isDraft && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleSaveDraft(true)}
                disabled={saving || !isDirty}
                className={isDirty ? "border-sky-500 text-sky-700" : ""}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? "Saving..." : "Save Draft"}
              </Button>

              <Button size="sm" variant="secondary" onClick={handleSubmitReview} disabled={saving} className="text-amber-700 border-amber-300 hover:bg-amber-50">
                <Send className="w-4 h-4 mr-1.5" />
                Submit for Review
              </Button>
            </>
          )}

          {isInReview && (
            <>
              <Button
                size="sm"
                onClick={() => setShowApproveModal(true)}
                className="bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                Approve Version
              </Button>
            </>
          )}

          {isApproved && (
            <Link href="/admin/modules">
              <Button size="sm" variant="secondary">
                <GitBranch className="w-4 h-4 mr-1.5" />
                Branch New Draft
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Lock Notice for Approved Versions */}
      {isApproved && (
        <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-neutral-200 text-neutral-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Approved Version is Frozen & Immutable</p>
              <p className="text-xs text-neutral-600 mt-0.5">
                Version {versionDetail?.version} is published to production. Active learners stay on their enrolled version. To make corrections or improvements, create a new draft version.
              </p>
            </div>
          </div>
          <Link href="/admin/modules">
            <Button size="sm" className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Create Revision
            </Button>
          </Link>
        </div>
      )}

      {/* Success Banner */}
      {successMsg && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            &times;
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Validation Error</p>
            <p className="whitespace-pre-wrap mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-800">
            &times;
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-px overflow-x-auto">
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
                ? "border-sky-600 text-sky-700 bg-sky-50/50"
                : "border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: General & Objectives */}
      {activeTab === "general" && (
        <Card className="p-6 bg-white border-neutral-200 shadow-sm space-y-6">
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">Module Title</label>
              <input
                type="text"
                disabled={locked}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-neutral-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1">Deliverable Outcome</label>
              <textarea
                rows={2}
                disabled={locked}
                value={deliverable}
                onChange={(e) => {
                  setDeliverable(e.target.value);
                  setIsDirty(true);
                }}
                className="w-full px-3.5 py-2 text-sm border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-neutral-50"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-neutral-800">Learning Objectives</label>
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
                    <span className="text-xs font-mono text-neutral-400 w-5">{i + 1}.</span>
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
                      className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-neutral-50"
                    />
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => {
                          setObjectives(objectives.filter((_, idx) => idx !== i));
                          setIsDirty(true);
                        }}
                        className="p-1 text-neutral-400 hover:text-rose-600"
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
            <p className="text-xs text-neutral-500">Edit curriculum lessons, reading time estimates, and video references.</p>
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
            <Card key={lesson.id || idx} className="p-5 bg-white border-neutral-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2 flex-1 max-w-xl">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
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
                    className="flex-1 font-semibold text-sm px-2.5 py-1 border border-neutral-300 rounded focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-50"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
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
                      className="w-16 text-xs px-2 py-1 border border-neutral-300 rounded font-mono"
                    />
                    <span className="text-xs text-neutral-500">min</span>
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => {
                        setLessons(lessons.filter((_, i) => i !== idx));
                        setIsDirty(true);
                      }}
                      className="p-1 text-neutral-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Lesson Markdown Content</label>
                <textarea
                  rows={8}
                  disabled={locked}
                  value={lesson.body}
                  onChange={(e) => {
                    const updated = [...lessons];
                    updated[idx].body = e.target.value;
                    setLessons(updated);
                    setIsDirty(true);
                  }}
                  className="w-full font-mono text-xs p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-50"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 3: Knowledge Check Quiz (Addresses Issue #210 & #212) */}
      {activeTab === "quiz" && (
        <div className="space-y-6">
          <Card className="p-4 bg-sky-50/50 border-sky-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-sky-900">Quiz Passing Threshold</h3>
                <p className="text-xs text-sky-700 mt-0.5">
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
                  className="w-20 px-3 py-1.5 text-sm font-bold border border-sky-300 rounded-lg bg-white text-center"
                />
                <span className="text-sm font-semibold text-sky-900">%</span>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-500">
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
            <Card key={q.id || qIdx} className="p-5 bg-white border-neutral-200 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-100 text-neutral-800 border border-neutral-200">
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
                    className="flex-1 text-sm font-medium px-3 py-1.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-50"
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
                    className="p-1 text-neutral-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Options list */}
              <div className="pl-4 border-l-2 border-neutral-100 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-700">Answer Options (Check correct):</p>
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
                      className="text-xs text-sky-600 hover:text-sky-800 font-medium"
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
                        className="w-4 h-4 rounded text-sky-600 border-neutral-300 focus:ring-sky-500"
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
                        className="flex-1 text-xs px-2.5 py-1 border border-neutral-300 rounded focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-50"
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
                          className="p-1 text-neutral-400 hover:text-rose-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Field (Issue #210) */}
              <div className="pt-2 border-t border-neutral-100">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Explanation & Concept Clarification
                </label>
                <textarea
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
                  className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-sky-500 disabled:bg-neutral-50"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 4: Rubric */}
      {activeTab === "rubric" && (
        <Card className="p-6 bg-white border-neutral-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-neutral-50 border border-neutral-200">
            <div>
              <h3 className="text-xs font-bold uppercase text-neutral-700">Rubric Thresholds</h3>
              <p className="text-xs text-neutral-500">Points needed for module deliverable qualification.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-neutral-600">Pass Mark:</span>
                <input
                  type="number"
                  min={1}
                  disabled={locked}
                  value={rubric.passMark ?? 14}
                  onChange={(e) => {
                    setRubric({ ...rubric, passMark: parseInt(e.target.value, 10) || 14 });
                    setIsDirty(true);
                  }}
                  className="w-16 text-xs px-2 py-1 border border-neutral-300 rounded font-mono text-center"
                />
                <span className="text-xs text-neutral-400">pts</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-neutral-600">Must-Have Min:</span>
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  value={rubric.mustHaveMinimum ?? 2}
                  onChange={(e) => {
                    setRubric({ ...rubric, mustHaveMinimum: parseInt(e.target.value, 10) || 2 });
                    setIsDirty(true);
                  }}
                  className="w-16 text-xs px-2 py-1 border border-neutral-300 rounded font-mono text-center"
                />
                <span className="text-xs text-neutral-400">pts</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-800">Grading Criteria</h4>
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
                        { id: `c${cCount}`, title: "New Criterion", maxPoints: 3, mustHave: true, description: "Description of criterion..." },
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
              <div key={crit.id || cIdx} className="p-3.5 rounded-lg border border-neutral-200 bg-white space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700">
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
                      className="flex-1 text-xs font-semibold px-2 py-1 border border-neutral-300 rounded"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-neutral-600 cursor-pointer">
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
                        className="rounded text-sky-600"
                      />
                      Must-Have
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-neutral-500">Max:</span>
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
                        className="w-12 text-xs px-1.5 py-0.5 border border-neutral-300 rounded text-center"
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
                        className="p-1 text-neutral-400 hover:text-rose-600"
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
                  className="w-full text-xs p-2 border border-neutral-200 rounded"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tab 5: Worksheets */}
      {activeTab === "worksheets" && (
        <Card className="p-6 bg-white border-neutral-200 shadow-sm space-y-4">
          <p className="text-xs text-neutral-500">
            Worksheets contain structured form fields and calculated matrices for SME completion.
          </p>
          {worksheets.map((ws, wIdx) => (
            <div key={ws.id || wIdx} className="p-4 rounded-lg border border-neutral-200 bg-neutral-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-700">{ws.id}</span>
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
                  className="flex-1 mx-3 text-sm font-semibold px-2.5 py-1 border border-neutral-300 rounded bg-white"
                />
              </div>
              <div className="text-xs text-neutral-600 space-y-1">
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
        <Card className="p-6 bg-white border-neutral-200 shadow-sm space-y-4">
          <p className="text-xs text-neutral-500">
            AI prompts for SME practice lab exercises, with prompt templates and verification criteria.
          </p>
          {aiPrompts.map((prompt, pIdx) => (
            <div key={prompt.id || pIdx} className="p-4 rounded-lg border border-neutral-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-neutral-700">{prompt.id}</span>
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
                  className="flex-1 mx-3 text-xs font-semibold px-2 py-1 border border-neutral-300 rounded"
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
                className="w-full font-mono text-xs p-2.5 border border-neutral-200 rounded"
              />
            </div>
          ))}
        </Card>
      )}

      {/* Approve Modal Confirmation */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-neutral-200">
            <div className="flex items-center gap-3 text-emerald-800">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-base font-bold text-neutral-900">Approve Version {versionDetail?.version}</h3>
                <p className="text-xs text-neutral-500">Publish this module version to production.</p>
              </div>
            </div>

            <div className="my-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" /> Important Immutability Rule:
              </p>
              <p>
                Once approved, this version becomes <strong>immutable</strong> and will never change. Newly enrolled learners will automatically receive it.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-700">Approval Notes</label>
              <textarea
                rows={3}
                placeholder="e.g. Reviewed with trade advisory board and cleared for publishing..."
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                className="w-full text-xs p-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)} disabled={approving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApprove} disabled={approving} className="bg-emerald-700 hover:bg-emerald-800 text-white">
                {approving ? "Publishing..." : "Confirm & Approve"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Learner Preview Simulator Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:p-8 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col border border-neutral-200 overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-600" />
                <h3 className="font-bold text-sm text-neutral-900">Learner View Simulator</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-medium">
                  v{versionDetail?.version} (Answer keys hidden)
                </span>
              </div>
              <button
                aria-label="Close preview"
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/50">
              {previewLoading || !previewData ? (
                <div className="py-24 text-center text-sm text-neutral-500 flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-neutral-400 mb-2" />
                  Generating sanitized learner view...
                </div>
              ) : (
                <div className="space-y-6 max-w-4xl mx-auto">
                  <div className="p-4 rounded-xl bg-white border border-neutral-200 shadow-sm">
                    <h2 className="text-xl font-bold text-neutral-900">{previewData.title}</h2>
                    <p className="text-xs text-neutral-600 mt-1">{previewData.deliverable}</p>
                    <div className="mt-4 pt-3 border-t border-neutral-100">
                      <h4 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Objectives:</h4>
                      <ul className="list-disc pl-5 mt-1.5 space-y-1 text-xs text-neutral-600">
                        {previewData.objectives.map((obj: string, i: number) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Lessons Preview */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-neutral-900">Curriculum Lessons</h3>
                    {previewData.lessons.map((lesson: any) => (
                      <Card key={lesson.id} className="p-4 bg-white border-neutral-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-neutral-900">{lesson.title}</h4>
                          <span className="text-xs text-neutral-500">{lesson.minutes} min read</span>
                        </div>
                        <div className="text-xs text-neutral-700 prose max-w-none">
                          <Markdown source={lesson.body} />
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Quiz Preview */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-neutral-900">
                      Knowledge Check Quiz ({previewData.knowledgeCheck.questions.length} questions • Pass mark: {previewData.knowledgeCheck.passMark}%)
                    </h3>
                    {previewData.knowledgeCheck.questions.map((q: any, idx: number) => (
                      <Card key={q.id || idx} className="p-4 bg-white border-neutral-200 space-y-3">
                        <p className="text-xs font-semibold text-neutral-900">
                          {idx + 1}. {q.text}
                        </p>
                        <div className="space-y-1.5 pl-2">
                          {q.options.map((opt: any) => (
                            <div key={opt.id} className="flex items-center gap-2 text-xs text-neutral-700 p-2 rounded border border-neutral-100 bg-neutral-50/50">
                              <input type={q.multiple ? "checkbox" : "radio"} disabled className="text-sky-600" />
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
