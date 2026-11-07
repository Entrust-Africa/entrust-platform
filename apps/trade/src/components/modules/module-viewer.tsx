"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  FileCheck2,
  FileText,
  HelpCircle,
  PlayCircle,
  RotateCcw,
  Sparkles,
  Video,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import type {
  KnowledgeCheckAttemptResult,
  KnowledgeCheckHistoryList,
  ModuleProgressView,
  ModuleSubmissionView,
} from "@/lib/types";

export interface LearnerLesson {
  id: string;
  title: string;
  body: string;
  minutes?: number;
  videoUrl?: string;
}

export interface LearnerWorksheetField {
  id: string;
  label: string;
  kind?: string;
  required?: boolean;
}

export interface LearnerWorksheet {
  id: string;
  title: string;
  fields?: LearnerWorksheetField[];
  tables?: Array<{
    id: string;
    label: string;
    columns: Array<{ id: string; label: string; kind?: string }>;
  }>;
  computed?: Array<{
    id: string;
    label: string;
    kind?: string;
    calculator: string;
    inputs: string[];
  }>;
}

export interface LearnerQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; text: string }>;
  multiple: boolean;
}

export interface LearnerRubricCriterion {
  id: string;
  title: string;
  description?: string;
  maxPoints: number;
  mustHave: boolean;
}

export interface LearnerAiPrompt {
  id: string;
  title: string;
  prompt: string;
  verification: string[];
}

export interface LearnerModuleData {
  module: string;
  version: string;
  title: string;
  deliverable: string;
  objectives: string[];
  lessons: LearnerLesson[];
  workedExample?: { title: string; body: string } | null;
  worksheets: LearnerWorksheet[];
  knowledgeCheck: {
    passMark: number;
    questions: LearnerQuestion[];
  };
  rubric: {
    criteria: LearnerRubricCriterion[];
    passMark: number;
    mustHaveMinimum: number;
    bands: Array<{ label: string; from: number }>;
    criticalFailures: Array<{ id: string; text: string; autoCheck?: string }>;
  };
  aiPrompts: LearnerAiPrompt[];
}

export interface ModuleViewerProps {
  module: LearnerModuleData;
  enrollmentId?: string;
  isAssignedInPlan: boolean;
  isReadOnly: boolean;
  initialProgress?: ModuleProgressView | null;
  initialLessonId?: string;
}

type TabKey = "lesson" | "example" | "worksheets" | "knowledge" | "deliverable" | "prompts";

export function ModuleViewer({
  module,
  enrollmentId,
  isAssignedInPlan,
  isReadOnly,
  initialProgress,
  initialLessonId,
}: ModuleViewerProps) {
  // Determine resume lesson id: from initialLessonId, or lastLessonId in progress, or first lesson
  const savedLastLesson = (initialProgress?.lessonProgress as { lastLessonId?: string })?.lastLessonId;
  const initialCompletedLessons: string[] =
    (initialProgress?.lessonProgress as { completedLessons?: string[] })?.completedLessons ?? [];

  const [completedLessons, setCompletedLessons] = useState<string[]>(initialCompletedLessons);
  const [activeLessonId, setActiveLessonId] = useState<string>(
    initialLessonId ?? savedLastLesson ?? module.lessons[0]?.id ?? ""
  );
  const [activeTab, setActiveTab] = useState<TabKey>("lesson");
  const [status, setStatus] = useState<string>(initialProgress?.status ?? "not_started");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({});
  const [attemptHistory, setAttemptHistory] = useState<KnowledgeCheckHistoryList | null>(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<KnowledgeCheckAttemptResult | null>(null);
  const [latestSubmission, setLatestSubmission] = useState<ModuleSubmissionView | null>(null);
  const [shuffledOptions, setShuffledOptions] = useState<Record<string, Array<{ id: string; text: string }>>>(() => {
    const map: Record<string, Array<{ id: string; text: string }>> = {};
    for (const q of module.knowledgeCheck.questions) {
      map[q.id] = [...q.options];
    }
    return map;
  });
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enrollmentId) return;
    let cancelled = false;
    tradeFetch<KnowledgeCheckHistoryList>(
      "GET",
      `/modules/${module.module}/knowledge-check/attempts?enrollmentId=${enrollmentId}`
    ).then((res) => {
      if (!cancelled && res.ok && res.data) {
        setAttemptHistory(res.data);
      }
    });

    tradeFetch<{ items: ModuleSubmissionView[] }>(
      "GET",
      `/module-submissions?enrollmentId=${enrollmentId}&moduleId=${module.module}`
    ).then((res) => {
      if (!cancelled && res.ok && res.data?.items?.[0]) {
        setLatestSubmission(res.data.items[0]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enrollmentId, module.module]);

  const handleRetakeQuiz = () => {
    setQuizAnswers({});
    setQuizFeedback(null);
    const newMap: Record<string, Array<{ id: string; text: string }>> = {};
    for (const q of module.knowledgeCheck.questions) {
      newMap[q.id] = [...q.options].sort(() => Math.random() - 0.5);
    }
    setShuffledOptions(newMap);
  };

  const handleSubmitQuiz = async () => {
    if (!enrollmentId || isReadOnly || isSubmittingQuiz) return;
    setIsSubmittingQuiz(true);
    setErrorMessage(null);
    const res = await tradeFetch<KnowledgeCheckAttemptResult>(
      "POST",
      `/modules/${module.module}/knowledge-check/attempts`,
      {
        enrollmentId,
        contentVersion: module.version,
        answers: quizAnswers,
      }
    );
    setIsSubmittingQuiz(false);
    if (res.ok && res.data) {
      setQuizFeedback(res.data);
      if (res.data.passed && status === "not_started") {
        setStatus("in_progress");
      }
      tradeFetch<KnowledgeCheckHistoryList>(
        "GET",
        `/modules/${module.module}/knowledge-check/attempts?enrollmentId=${enrollmentId}`
      ).then((histRes) => {
        if (histRes.ok && histRes.data) {
          setAttemptHistory(histRes.data);
        }
      });
    } else {
      setErrorMessage(res.error ?? "Failed to submit knowledge check.");
    }
  };

  const activeLesson = module.lessons.find((l) => l.id === activeLessonId) ?? module.lessons[0];

  // Save lesson navigation & completion to API (save and resume)
  const saveLessonProgress = async (lessonId: string, completed?: boolean) => {
    if (isReadOnly || !enrollmentId) return;

    try {
      const res = await tradeFetch<ModuleProgressView>("POST", "/module-progress", {
        enrollmentId,
        moduleId: module.module,
        lessonId,
        completed,
        contentVersion: module.version,
      });

      if (res.ok && res.data) {
        setStatus(res.data.status);
        const dataCompleted = (res.data.lessonProgress as { completedLessons?: string[] })?.completedLessons;
        if (dataCompleted) {
          setCompletedLessons(dataCompleted);
        }
      }
    } catch {
      // Background save silently tolerates network blips
    }
  };

  const handleSelectLesson = (lessonId: string) => {
    setActiveLessonId(lessonId);
    setActiveTab("lesson");
    void saveLessonProgress(lessonId);
  };

  const handleToggleLessonComplete = async (lessonId: string) => {
    if (isReadOnly || !enrollmentId) return;

    const isDone = completedLessons.includes(lessonId);
    const updated = isDone
      ? completedLessons.filter((id) => id !== lessonId)
      : [...completedLessons, lessonId];

    setCompletedLessons(updated);
    await saveLessonProgress(lessonId, !isDone);
  };

  const handleCopyPrompt = async (promptId: string, promptText: string) => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPromptId(promptId);
      setTimeout(() => setCopiedPromptId(null), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSubmitDeliverable = async () => {
    if (isReadOnly || !enrollmentId || isSubmitting) return;

    if (!isAssignedInPlan) {
      setErrorMessage("Modules outside your learning plan can be read as a preview but cannot be submitted.");
      return;
    }

    const hasPassedTheory = Boolean(
      initialProgress?.theoryCompletedAt || quizFeedback?.passed || attemptHistory?.hasPassed
    );
    if (!hasPassedTheory) {
      setErrorMessage(
        "You must pass the Knowledge Check in Tab 4 before submitting your practical deliverable."
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await tradeFetch<ModuleSubmissionView>("POST", "/module-submissions", {
      enrollmentId,
      moduleId: module.module,
      contentVersion: module.version,
    });

    setIsSubmitting(false);

    if (res.ok && res.data) {
      setLatestSubmission(res.data);
      setStatus("submitted");
      setSubmissionFeedback("Deliverable successfully submitted for assessor review!");
    } else {
      setErrorMessage(res.error ?? "Failed to submit deliverable. Please try again.");
    }
  };

  const totalLessons = module.lessons.length;
  const doneCount = completedLessons.length;
  const progressPercent = totalLessons > 0 ? Math.round((doneCount / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Read-only or Preview Banners */}
      {isReadOnly && (
        <div className="rounded-md border border-sky-300 bg-sky-50 p-4 text-xs font-medium text-sky-900">
          Staff view (read-only mode). Progress and deliverables cannot be modified in this view.
        </div>
      )}

      {!isAssignedInPlan && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-xs font-medium text-amber-900">
          Preview Mode: This module is outside your current learning plan. You can read the lessons and exercises, but deliverable submission is disabled.
        </div>
      )}

      {/* Module Header */}
      <div className="rounded-lg border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-xs font-bold text-brand-700">
                {module.module}
              </span>
              <span className="text-xs text-ink-3">v{module.version}</span>
              <StatusBadge
                tone={
                  status === "passed" || status === "exempted"
                    ? "ok"
                    : status === "submitted"
                    ? "info"
                    : status === "in_progress"
                    ? "warn"
                    : "idle"
                }
              >
                {status.replace("_", " ").toUpperCase()}
              </StatusBadge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold text-ink">{module.title}</h1>
            <p className="mt-1 text-sm text-ink-2">
              <strong className="text-ink">Deliverable:</strong> {module.deliverable}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="text-xs text-ink-2">
              Progress: <strong className="text-ink">{doneCount}</strong> of {totalLessons} lessons ({progressPercent}%)
            </div>
            <div className="h-2 w-36 overflow-hidden rounded-full bg-line">
              <div
                className="h-full bg-brand-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Objectives */}
        {module.objectives.length > 0 && (
          <div className="mt-4 border-t border-line/60 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Key Objectives</div>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2 text-xs text-ink-2">
              {module.objectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="text-brand-600 font-bold">•</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Main Grid: Responsive Phone-First Layout */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Navigation Sidebar (Collapsible or scrollable on mobile) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4">
            <div className="font-display text-sm font-bold text-ink">Module Navigation</div>

            {/* Mobile Tab Switcher */}
            <div className="mt-3 flex overflow-x-auto pb-2 gap-1 border-b border-line lg:hidden">
              <button
                type="button"
                onClick={() => setActiveTab("lesson")}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md ${
                  activeTab === "lesson" ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"
                }`}
              >
                Lessons ({doneCount}/{totalLessons})
              </button>
              {module.workedExample && (
                <button
                  type="button"
                  onClick={() => setActiveTab("example")}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md ${
                    activeTab === "example" ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"
                  }`}
                >
                  Example
                </button>
              )}
              {module.worksheets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("worksheets")}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md ${
                    activeTab === "worksheets" ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"
                  }`}
                >
                  Worksheets
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("knowledge")}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md ${
                  activeTab === "knowledge" ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"
                }`}
              >
                Knowledge Check
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("deliverable")}
                className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md ${
                  activeTab === "deliverable" ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"
                }`}
              >
                Deliverable
              </button>
              {module.aiPrompts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("prompts")}
                  className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md ${
                    activeTab === "prompts" ? "bg-brand-600 text-white" : "bg-canvas text-ink-2"
                  }`}
                >
                  AI Prompts ({module.aiPrompts.length})
                </button>
              )}
            </div>

            {/* Lesson List */}
            <div className="mt-3 divide-y divide-line/60">
              <div className="py-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Lessons</div>
              {module.lessons.map((lesson, idx) => {
                const isCurrent = activeTab === "lesson" && activeLesson?.id === lesson.id;
                const isDone = completedLessons.includes(lesson.id);

                return (
                  <div
                    key={lesson.id}
                    className={`flex items-center justify-between gap-2 py-2.5 px-2 rounded-md cursor-pointer transition-colors ${
                      isCurrent ? "bg-brand-50 border-l-3 border-l-brand-600" : "hover:bg-canvas"
                    }`}
                    onClick={() => handleSelectLesson(lesson.id)}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <button
                        type="button"
                        disabled={isReadOnly}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleToggleLessonComplete(lesson.id);
                        }}
                        className="mt-0.5 shrink-0 text-ink-3 hover:text-brand-600 focus:outline-hidden"
                        title={isDone ? "Mark as incomplete" : "Mark as complete"}
                      >
                        {isDone ? (
                          <CheckCircle2 className="size-4 text-emerald-600" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className={`text-xs font-medium truncate ${isCurrent ? "text-brand-900 font-bold" : "text-ink"}`}>
                          {idx + 1}. {lesson.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-3">
                          {lesson.minutes && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" /> {lesson.minutes} min
                            </span>
                          )}
                          {lesson.videoUrl && (
                            <span className="flex items-center gap-1 text-brand-600">
                              <Video className="size-3" /> Video
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`size-3.5 text-ink-3 shrink-0 ${isCurrent ? "text-brand-600" : ""}`} />
                  </div>
                );
              })}
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden lg:block mt-4 pt-3 border-t border-line space-y-1">
              <div className="py-1 text-xs font-semibold uppercase tracking-wider text-ink-3">Resources</div>
              {module.workedExample && (
                <button
                  type="button"
                  onClick={() => setActiveTab("example")}
                  className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "example" ? "bg-brand-50 text-brand-700 font-bold" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <FileText className="size-3.5" /> Worked Example
                  </span>
                  <ChevronRight className="size-3" />
                </button>
              )}
              {module.worksheets.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("worksheets")}
                  className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "worksheets" ? "bg-brand-50 text-brand-700 font-bold" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="size-3.5" /> Worksheets ({module.worksheets.length})
                  </span>
                  <ChevronRight className="size-3" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setActiveTab("knowledge")}
                className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "knowledge" ? "bg-brand-50 text-brand-700 font-bold" : "text-ink hover:bg-canvas"
                }`}
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="size-3.5" /> Knowledge Check
                </span>
                <ChevronRight className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("deliverable")}
                className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  activeTab === "deliverable" ? "bg-brand-50 text-brand-700 font-bold" : "text-ink hover:bg-canvas"
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileCheck2 className="size-3.5" /> Deliverable & Checklist
                </span>
                <ChevronRight className="size-3" />
              </button>
              {module.aiPrompts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("prompts")}
                  className={`w-full text-left flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    activeTab === "prompts" ? "bg-brand-50 text-brand-700 font-bold" : "text-ink hover:bg-canvas"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-3.5 text-brand-600" /> AI Prompts ({module.aiPrompts.length})
                  </span>
                  <ChevronRight className="size-3" />
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* Content Viewer Panel */}
        <div className="lg:col-span-8">
          {errorMessage && (
            <div className="mb-4 rounded-md border border-red-300 bg-red-50 p-4 text-xs font-medium text-red-900 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {submissionFeedback && (
            <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>{submissionFeedback}</span>
            </div>
          )}

          {/* Tab 1: Lesson View */}
          {activeTab === "lesson" && activeLesson && (
            <Card className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <div className="text-xs text-ink-3">
                    Lesson {module.lessons.indexOf(activeLesson) + 1} of {totalLessons}
                  </div>
                  <h2 className="font-display text-xl font-bold text-ink">{activeLesson.title}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => handleToggleLessonComplete(activeLesson.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      completedLessons.includes(activeLesson.id)
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                        : "bg-surface border border-line text-ink hover:bg-canvas"
                    }`}
                  >
                    {completedLessons.includes(activeLesson.id) ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-600" /> Completed
                      </>
                    ) : (
                      <>
                        <Circle className="size-3.5" /> Mark complete
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Optional Video link */}
              {activeLesson.videoUrl && (
                <div className="rounded-md border border-brand-200 bg-brand-50/50 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-brand-900">
                    <PlayCircle className="size-5 text-brand-600 shrink-0" />
                    <span>Watch optional lesson video ({activeLesson.minutes ?? 10} min)</span>
                  </div>
                  <a
                    href={activeLesson.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                  >
                    Open Video ↗
                  </a>
                </div>
              )}

              {/* Lesson Text (Phone-first readable typography) */}
              <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-wrap font-sans">
                {activeLesson.body}
              </div>

              {/* Next / Previous Lesson Buttons */}
              <div className="flex items-center justify-between border-t border-line pt-4 text-xs font-semibold">
                {(() => {
                  const currentIndex = module.lessons.indexOf(activeLesson);
                  const prevLesson = module.lessons[currentIndex - 1];
                  const nextLesson = module.lessons[currentIndex + 1];

                  return (
                    <>
                      {prevLesson ? (
                        <button
                          type="button"
                          onClick={() => handleSelectLesson(prevLesson.id)}
                          className="text-brand-600 hover:underline flex items-center gap-1"
                        >
                          ← {prevLesson.title}
                        </button>
                      ) : <span />}

                      {nextLesson ? (
                        <Button
                          variant="secondary"
                          onClick={() => {
                            if (!completedLessons.includes(activeLesson.id)) {
                              void handleToggleLessonComplete(activeLesson.id);
                            }
                            handleSelectLesson(nextLesson.id);
                          }}
                        >
                          Next: {nextLesson.title} →
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => setActiveTab("deliverable")}
                        >
                          Review Deliverable →
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
            </Card>
          )}

          {/* Tab 2: Worked Example */}
          {activeTab === "example" && module.workedExample && (
            <Card className="p-6 space-y-4">
              <div className="border-b border-line pb-3">
                <span className="text-xs uppercase font-semibold text-ink-3">Case Study</span>
                <h2 className="font-display text-xl font-bold text-ink">{module.workedExample.title}</h2>
              </div>
              <div className="prose prose-sm max-w-none text-ink leading-relaxed whitespace-pre-wrap">
                {module.workedExample.body}
              </div>
            </Card>
          )}

          {/* Tab 3: Worksheets */}
          {activeTab === "worksheets" && (
            <div className="space-y-6">
              {module.worksheets.map((ws) => (
                <Card key={ws.id} className="p-6 space-y-4">
                  <div className="border-b border-line pb-3">
                    <span className="text-xs uppercase font-semibold text-ink-3">Practical Worksheet</span>
                    <h2 className="font-display text-lg font-bold text-ink">{ws.title}</h2>
                  </div>

                  {ws.fields && ws.fields.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {ws.fields.map((field) => (
                        <div key={field.id} className="space-y-1">
                          <label className="text-xs font-semibold text-ink">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type={field.kind === "money" ? "number" : "text"}
                            disabled={isReadOnly}
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                            className="w-full rounded-md border border-line bg-surface px-3 py-1.5 text-xs text-ink focus:border-brand-600 focus:outline-hidden disabled:bg-canvas"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {ws.tables && ws.tables.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {ws.tables.map((table) => (
                        <div key={table.id} className="overflow-x-auto">
                          <div className="text-xs font-semibold text-ink mb-1">{table.label}</div>
                          <table className="w-full text-left text-xs border border-line divide-y divide-line">
                            <thead className="bg-canvas">
                              <tr>
                                {table.columns.map((c) => (
                                  <th key={c.id} className="px-3 py-2 font-medium text-ink-2">
                                    {c.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                              <tr>
                                {table.columns.map((c) => (
                                  <td key={c.id} className="px-3 py-2">
                                    <input
                                      type={c.kind === "date" ? "date" : "text"}
                                      disabled={isReadOnly}
                                      className="w-full rounded border border-line px-2 py-1 text-xs"
                                    />
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}

                  {ws.computed && ws.computed.length > 0 && (
                    <div className="mt-4 rounded-md bg-canvas p-3 border border-line space-y-1">
                      <div className="text-[11px] font-semibold text-ink-3 uppercase">Calculated Values</div>
                      {ws.computed.map((comp) => (
                        <div key={comp.id} className="flex justify-between items-center text-xs">
                          <span className="text-ink-2">{comp.label}</span>
                          <span className="font-mono font-semibold text-ink">Automated by engine</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Tab 4: Knowledge Check */}
          {activeTab === "knowledge" && (
            <Card className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-ink">Knowledge Check</h2>
                  <p className="mt-0.5 text-xs text-ink-2">
                    Test your understanding with automatic server grading. Pass mark: {module.knowledgeCheck.passMark}%.
                  </p>
                </div>

                {attemptHistory && attemptHistory.items.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-canvas text-ink-2 px-2.5 py-1 rounded-full border border-line">
                      {attemptHistory.items.length} {attemptHistory.items.length === 1 ? "attempt" : "attempts"}
                    </span>
                    {attemptHistory.bestScore !== null && (
                      <span className="text-xs bg-canvas text-ink px-2.5 py-1 rounded-full border border-line font-medium">
                        Best: {attemptHistory.bestScore}%
                      </span>
                    )}
                    {attemptHistory.hasPassed ? (
                      <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
                        Passed
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                        In progress
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Feedback / Evaluation Banner */}
              {quizFeedback && (
                <div
                  className={`p-4 rounded-lg border ${
                    quizFeedback.passed
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-amber-50/70 border-amber-200 text-amber-950"
                  } space-y-2`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {quizFeedback.passed ? (
                        <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-sm font-bold">
                          {quizFeedback.passed ? "Knowledge Check Passed!" : `Score: ${quizFeedback.score}%`}
                        </div>
                        <div className="text-xs opacity-90 mt-0.5">
                          {quizFeedback.passed
                            ? `You scored ${quizFeedback.score}% (${quizFeedback.correctCount} of ${quizFeedback.totalQuestions} correct). Theory requirement completed.`
                            : `You scored ${quizFeedback.score}% (${quizFeedback.correctCount} of ${quizFeedback.totalQuestions} correct). You need ${module.knowledgeCheck.passMark}% to pass. Retakes are unlimited.`}
                        </div>
                      </div>
                    </div>
                    {!isReadOnly && (
                      <Button variant="secondary" size="sm" onClick={handleRetakeQuiz} className="shrink-0">
                        <RotateCcw className="size-3.5 mr-1.5" /> Retake
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {module.knowledgeCheck.questions.length === 0 ? (
                <div className="text-xs text-ink-3">No knowledge check questions registered for this module.</div>
              ) : (
                <div className="space-y-6">
                  {module.knowledgeCheck.questions.map((q, qIndex) => {
                    const selected = quizAnswers[q.id] ?? [];
                    const options = shuffledOptions[q.id] ?? q.options;
                    const qResult = quizFeedback?.results.find((r) => r.questionId === q.id);

                    return (
                      <div key={q.id} className="space-y-3 rounded-lg border border-line/80 p-4 bg-canvas/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold text-ink">
                            {qIndex + 1}. {q.text}
                            {q.multiple && <span className="text-ink-3 ml-1 font-normal">(select all that apply)</span>}
                          </div>
                          {qResult && (
                            <span
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded shrink-0 ${
                                qResult.isCorrect ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                              }`}
                            >
                              {qResult.isCorrect ? "Correct" : "Incorrect"}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          {options.map((opt) => {
                            const isChosen = selected.includes(opt.id);
                            const isAnswerKey = qResult?.correctAnswers.includes(opt.id);

                            let borderBgStyle = isChosen
                              ? "border-brand-600 bg-brand-50/60 font-medium text-brand-900"
                              : "border-line bg-surface hover:bg-canvas text-ink";

                            if (qResult) {
                              if (isAnswerKey) {
                                borderBgStyle = "border-emerald-500 bg-emerald-50 text-emerald-950 font-medium";
                              } else if (isChosen && !isAnswerKey) {
                                borderBgStyle = "border-red-400 bg-red-50 text-red-950 line-through";
                              } else {
                                borderBgStyle = "border-line bg-surface/60 text-ink-3";
                              }
                            }

                            return (
                              <label
                                key={opt.id}
                                className={`flex items-start gap-2.5 rounded-md border p-2.5 text-xs transition-colors ${borderBgStyle} ${
                                  quizFeedback || isReadOnly ? "cursor-default" : "cursor-pointer"
                                }`}
                              >
                                <input
                                  type={q.multiple ? "checkbox" : "radio"}
                                  name={`question-${q.id}`}
                                  disabled={isReadOnly || !!quizFeedback}
                                  checked={isChosen}
                                  onChange={() => {
                                    if (quizFeedback || isReadOnly) return;
                                    if (q.multiple) {
                                      setQuizAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: isChosen
                                          ? selected.filter((id) => id !== opt.id)
                                          : [...selected, opt.id],
                                      }));
                                    } else {
                                      setQuizAnswers((prev) => ({ ...prev, [q.id]: [opt.id] }));
                                    }
                                  }}
                                  className="mt-0.5"
                                />
                                <span>{opt.text}</span>
                              </label>
                            );
                          })}
                        </div>

                        {/* Question Feedback: Explanation and Lesson Link */}
                        {qResult && (
                          <div className="mt-3 p-3 rounded-md bg-canvas text-xs space-y-2 border border-line">
                            {qResult.explanation && (
                              <div className="text-ink-2">
                                <span className="font-semibold text-ink">Explanation: </span>
                                {qResult.explanation}
                              </div>
                            )}
                            {qResult.lessonId && (
                              <div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab("lesson");
                                    setActiveLessonId(qResult.lessonId!);
                                  }}
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                                >
                                  <BookOpen className="size-3.5" />
                                  Review Lesson:{" "}
                                  {module.lessons.find((l) => l.id === qResult.lessonId)?.title ?? qResult.lessonId}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Submit Button */}
              {!quizFeedback && !isReadOnly && module.knowledgeCheck.questions.length > 0 && (
                <div className="flex items-center justify-between border-t border-line pt-4">
                  <div className="text-xs text-ink-3">
                    {Object.keys(quizAnswers).length} of {module.knowledgeCheck.questions.length} questions answered
                  </div>
                  <Button
                    onClick={handleSubmitQuiz}
                    disabled={isSubmittingQuiz || Object.keys(quizAnswers).length === 0}
                  >
                    {isSubmittingQuiz ? "Grading..." : "Submit Knowledge Check"}
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Tab 5: Deliverable & Completion Criteria */}
          {activeTab === "deliverable" && (
            <Card className="p-6 space-y-6">
              <div className="border-b border-line pb-4">
                <span className="text-xs uppercase font-semibold text-ink-3">Module Practical Output</span>
                <h2 className="font-display text-xl font-bold text-ink">{module.deliverable}</h2>
                <p className="mt-1 text-xs text-ink-2">
                  Complete your worksheets and review readiness against the rubric criteria below before submitting for assessor evaluation.
                </p>
              </div>

              {/* Official Assessor Evaluation Feedback */}
              {latestSubmission?.officialScore && (
                <div
                  className={`p-5 rounded-lg border space-y-3 ${
                    latestSubmission.officialScore.passed
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                      : "bg-amber-50/70 border-amber-200 text-amber-950"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {latestSubmission.officialScore.passed ? (
                        <CheckCircle2 className="size-5 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="text-sm font-bold">
                          {latestSubmission.officialScore.passed
                            ? "Deliverable Passed!"
                            : "Deliverable Revision Required"}
                        </div>
                        <div className="text-xs opacity-90 mt-0.5">
                          Score: {latestSubmission.officialScore.totalPoints} / {latestSubmission.officialScore.maxPoints} pts
                          {" "}({latestSubmission.officialScore.percentage}%) • Band: {latestSubmission.officialScore.band}
                        </div>
                        {latestSubmission.officialScore.feedback && (
                          <div className="text-xs mt-2 p-2.5 rounded bg-surface border border-line text-ink">
                            <span className="font-semibold text-ink">Assessor Feedback: </span>
                            {latestSubmission.officialScore.feedback}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Criterion Breakdown */}
                  {latestSubmission.officialScore.criterionResults?.length > 0 && (
                    <div className="mt-3 divide-y divide-line/60 rounded-md border border-line bg-surface text-xs text-ink">
                      {latestSubmission.officialScore.criterionResults.map((cr) => (
                        <div key={cr.criterionId} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-medium">{cr.title}</span>
                            {cr.comment && <div className="text-ink-3 text-[11px] mt-0.5">{cr.comment}</div>}
                          </div>
                          <span className="font-mono font-semibold">
                            {cr.points} / {cr.maxPoints} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pending Review Notice */}
              {latestSubmission?.status === "submitted" && !latestSubmission.officialScore && (
                <div className="p-4 rounded-lg border border-brand-200 bg-brand-50 text-xs text-brand-950 flex items-start gap-2.5">
                  <Clock className="size-4 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Deliverable Under Review (Attempt v{latestSubmission.version})</span>
                    <p className="mt-0.5 text-brand-900 opacity-90">
                      Your work has been submitted to the Entrust assessor queue. An assessor will evaluate it against the module rubric.
                    </p>
                  </div>
                </div>
              )}

              {/* Rubric Criteria Checklist */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-ink uppercase tracking-wider">Evaluation Rubric Criteria</div>
                <div className="divide-y divide-line/60 rounded-lg border border-line">
                  {module.rubric.criteria.map((crit) => (
                    <div key={crit.id} className="flex items-center justify-between gap-3 p-3 text-xs">
                      <div className="flex items-start gap-2 min-w-0">
                        <CheckCircle2 className="size-4 text-brand-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-ink">{crit.title}</div>
                          {crit.mustHave && (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 border border-amber-200">
                              Must-Have Criterion (min {module.rubric.mustHaveMinimum} pts)
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs font-mono font-semibold text-ink-2 shrink-0">
                        {crit.maxPoints} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submission Action */}
              <div className="rounded-lg bg-surface border-2 border-brand-600/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-ink">Submit Deliverable</h3>
                    <p className="text-xs text-ink-2">
                      Ready to submit your completed work for facilitator review?
                    </p>
                  </div>
                  <StatusBadge tone={status === "submitted" || status === "passed" ? "ok" : "idle"}>
                    {status.toUpperCase()}
                  </StatusBadge>
                </div>

                {!isAssignedInPlan ? (
                  <p className="text-xs text-amber-800 font-medium">
                    This module is outside your active learning plan and cannot be submitted.
                  </p>
                ) : isReadOnly ? (
                  <p className="text-xs text-ink-3">Staff view is read-only.</p>
                ) : !initialProgress?.theoryCompletedAt && !quizFeedback?.passed && !attemptHistory?.hasPassed ? (
                  <div className="p-3 rounded border border-amber-200 bg-amber-50 text-xs text-amber-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="size-4 text-amber-600 shrink-0" />
                      Pass the Theory Knowledge Check in Tab 4 before submitting.
                    </span>
                    <Button variant="secondary" size="sm" onClick={() => setActiveTab("knowledge")}>
                      Go to Knowledge Check
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      disabled={isSubmitting || status === "submitted" || status === "passed"}
                      onClick={handleSubmitDeliverable}
                    >
                      {status === "submitted"
                        ? "Submitted for Review"
                        : status === "passed"
                        ? "Module Passed"
                        : status === "needs_revision"
                        ? "Resubmit Revised Deliverable"
                        : isSubmitting
                        ? "Submitting..."
                        : "Submit Deliverable for Review"}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Tab 6: AI Assistant Prompts */}
          {activeTab === "prompts" && (
            <div className="space-y-4">
              <div className="border-b border-line pb-3">
                <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2">
                  <Sparkles className="size-5 text-brand-600" /> AI Suggestions & Prompts
                </h2>
                <p className="mt-0.5 text-xs text-ink-2">
                  Use these prompts in your preferred AI tool to draft and test your work.
                </p>
              </div>

              {module.aiPrompts.map((item) => (
                <Card key={item.id} className="p-5 space-y-3 border-l-4 border-l-brand-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display text-sm font-bold text-ink">{item.title}</div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 border border-amber-300">
                      AI suggestion. Check the result before you use it.
                    </span>
                  </div>

                  <div className="relative rounded-md bg-canvas p-3 font-mono text-xs text-ink border border-line">
                    <pre className="whitespace-pre-wrap font-mono">{item.prompt}</pre>
                    <button
                      type="button"
                      onClick={() => handleCopyPrompt(item.id, item.prompt)}
                      className="absolute top-2 right-2 inline-flex items-center gap-1 rounded bg-surface px-2 py-1 text-[11px] font-semibold text-brand-700 shadow-xs border border-line hover:bg-canvas"
                    >
                      <Copy className="size-3" />
                      {copiedPromptId === item.id ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  {item.verification.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                        Verification Checklist:
                      </div>
                      <ul className="space-y-1 text-xs text-ink-2">
                        {item.verification.map((v, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-600 font-bold">✓</span>
                            <span>{v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
