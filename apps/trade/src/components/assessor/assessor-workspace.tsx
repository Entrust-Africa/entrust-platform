"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  FileCheck2,
  FileText,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@entrust/ui";
import { tradeFetch } from "@/lib/trade-client";
import type {
  ModuleSubmissionView,
  RubricAssessmentView,
} from "@/lib/types";
import type { LearnerModuleData } from "../modules/module-viewer";
import { SubmittedOutputs } from "./submitted-outputs";

export interface AssessorWorkspaceProps {
  submission: ModuleSubmissionView;
  module: LearnerModuleData;
  isAdmin: boolean;
  onScored?: (score: RubricAssessmentView) => void;
}

export function AssessorWorkspace({
  submission,
  module,
  isAdmin,
  onScored,
}: AssessorWorkspaceProps) {
  const rubric = module.rubric;

  // Initialize criterion scores
  const [criterionScores, setCriterionScores] = useState<
    Record<string, { points: number; comment?: string }>
  >(() => {
    const initial: Record<string, { points: number; comment?: string }> = {};
    // Start from the official score when there is one, so correcting one thing can't reset the rest,
    // and from zero when there isn't, so nothing passes without being marked.
    const official = submission.officialScore?.scores as Record<string, { points: number; comment?: string } | undefined> | undefined;
    for (const c of rubric.criteria) {
      initial[c.id] = official?.[c.id] ?? { points: 0 };
    }
    return initial;
  });

  const [confirmedFailures, setConfirmedFailures] = useState<string[]>(submission.officialScore?.confirmedCriticalFailures ?? []);
  const [feedback, setFeedback] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [latestScore, setLatestScore] = useState<RubricAssessmentView | null>(
    submission.officialScore ?? null
  );

  // Live score calculation
  const totalPoints = rubric.criteria.reduce(
    (sum, c) => sum + (criterionScores[c.id]?.points ?? 0),
    0
  );
  const maxPoints = rubric.criteria.reduce((sum, c) => sum + c.maxPoints, 0);
  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

  // Live band calculation
  const sortedBands = [...rubric.bands].sort((a, b) => a.from - b.from);
  let liveBand = sortedBands[0]?.label ?? "Critical";
  for (const b of sortedBands) {
    if (percentage >= b.from) {
      liveBand = b.label;
    }
  }

  const hasCriticalFailure = confirmedFailures.length > 0;
  const mustHavesMet = rubric.criteria.every(
    (c) => !c.mustHave || (criterionScores[c.id]?.points ?? 0) >= rubric.mustHaveMinimum
  );
  const meetsPassMark = totalPoints >= rubric.passMark;
  const livePassed = !hasCriticalFailure && meetsPassMark && mustHavesMet;

  const handleScoreChange = (criterionId: string, points: number) => {
    setCriterionScores((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        points,
      },
    }));
  };

  const handleCommentChange = (criterionId: string, comment: string) => {
    setCriterionScores((prev) => ({
      ...prev,
      [criterionId]: {
        points: prev[criterionId]?.points ?? 0,
        comment,
      },
    }));
  };

  const toggleCriticalFailure = (id: string) => {
    setConfirmedFailures((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmitScore = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await tradeFetch<RubricAssessmentView>(
      "POST",
      `/module-submissions/${submission.id}/score`,
      {
        scores: criterionScores,
        confirmedCriticalFailures: confirmedFailures,
        feedback: feedback.trim() || undefined,
      }
    );

    setIsSubmitting(false);

    if (res.ok && res.data) {
      setLatestScore(res.data);
      onScored?.(res.data);
    } else {
      setErrorMessage(res.error ?? "Failed to submit score.");
    }
  };

  const handleAdminOverride = async () => {
    if (!overrideReason.trim()) {
      setErrorMessage("An override reason is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await tradeFetch<RubricAssessmentView>(
      "PATCH",
      `/module-submissions/${submission.id}/score`,
      {
        scores: criterionScores,
        confirmedCriticalFailures: confirmedFailures,
        feedback: feedback.trim() || undefined,
        overrideReason: overrideReason.trim(),
      }
    );

    setIsSubmitting(false);

    if (res.ok && res.data) {
      setLatestScore(res.data);
      onScored?.(res.data);
    } else {
      setErrorMessage(res.error ?? "Failed to override score.");
    }
  };

  const wsSnapshot = submission.worksheetSnapshot as {
    values?: Record<string, unknown>;
    result?: { computed?: Record<string, unknown>; flags?: Array<{ code: string; message: string }> };
    worksheets?: Array<{ id: string; worksheetId: string; title: string; version: number; values: Record<string, unknown>; result?: { computed?: Record<string, unknown>; flags?: { code: string; message: string }[] } | null }>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-4">
        <div>
          <Link
            href="/review-queue"
            className="inline-flex items-center gap-1.5 text-xs text-ink-3 hover:text-ink mb-2"
          >
            <ArrowLeft className="size-3.5" /> Back to Review Queue
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-xs font-bold bg-brand-50 text-brand-700 px-2.5 py-0.5 rounded border border-brand-200">
              {submission.moduleId}
            </span>
            <h1 className="font-display text-xl font-bold text-ink">
              {module.title} — Deliverable Evaluation
            </h1>
          </div>
          <p className="text-xs text-ink-2 mt-1">
            Organization: <span className="font-semibold text-ink">{submission.organizationName ?? submission.organizationId}</span>
            {submission.cohortName && <> • Cohort: <span className="font-semibold text-ink">{submission.cohortName}</span></>}
            {" • "}Attempt Version: <span className="font-semibold text-ink">v{submission.version}</span>
            {" • "}Waiting: <span className="font-semibold text-ink">{submission.waitingTimeHours ?? 0} hrs</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            tone={
              submission.status === "passed"
                ? "ok"
                : submission.status === "revision_required"
                ? "danger"
                : "warn"
            }
          >
            {submission.status === "passed"
              ? "Passed"
              : submission.status === "revision_required"
              ? "Revision Required"
              : "Submitted"}
          </StatusBadge>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs text-red-900 flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Split Layout: Left Deliverable Snapshot, Right Rubric Scoring */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Deliverable Snapshot (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-5 space-y-4">
            <div className="border-b border-line pb-3">
              <span className="text-[10px] uppercase font-bold text-ink-3 tracking-wider">Learner Deliverable</span>
              <h3 className="font-display text-base font-bold text-ink">{module.deliverable}</h3>
            </div>

            {/* Worksheet Values Snapshot */}
            {wsSnapshot?.worksheets?.length ? (
              <SubmittedOutputs outputs={wsSnapshot.worksheets} module={module} />
            ) : wsSnapshot?.values && Object.keys(wsSnapshot.values).length > 0 ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-ink">Submitted Worksheet Figures</div>
                <div className="rounded-md border border-line divide-y divide-line text-xs bg-canvas/30">
                  {Object.entries(wsSnapshot.values).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between p-2.5">
                      <span className="font-mono text-ink-2">{k}</span>
                      <span className="font-medium text-ink">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-xs text-ink-3">No structured worksheet values attached.</div>
            )}

            {/* Computed Results from Engine */}
            {wsSnapshot?.result?.computed && Object.keys(wsSnapshot.result.computed).length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-ink">Automated Calculations</div>
                <div className="rounded-md border border-brand-200 bg-brand-50/40 divide-y divide-brand-100 text-xs">
                  {Object.entries(wsSnapshot.result.computed).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between p-2.5">
                      <span className="font-mono text-brand-900">{k}</span>
                      <span className="font-bold text-brand-800">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Worksheet Automated Flags */}
            {wsSnapshot?.result?.flags && wsSnapshot.result.flags.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <ShieldAlert className="size-3.5 text-amber-600" /> Automated Risk Flags
                </div>
                <div className="space-y-1.5">
                  {wsSnapshot.result.flags.map((flag, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded border border-amber-200 bg-amber-50 text-xs text-amber-950"
                    >
                      <span className="font-semibold">{flag.code}: </span>
                      {flag.message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence Records Attached */}
            <div className="space-y-2 pt-2 border-t border-line">
              <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                <FileCheck2 className="size-3.5 text-ink-3" /> Attached Evidence Records
              </div>
              {submission.evidenceRecordIds.length === 0 ? (
                <div className="text-xs text-ink-3 italic">None uploaded</div>
              ) : (
                <div className="space-y-1">
                  {submission.evidenceRecordIds.map((id) => (
                    <div
                      key={id}
                      className="text-xs p-2 rounded bg-surface border border-line flex items-center justify-between"
                    >
                      <span className="font-mono truncate">{id}</span>
                      <span className="text-[10px] text-ink-3">Record</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Rubric Scoring Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-ink-3 tracking-wider">Evaluation</span>
                <h3 className="font-display text-base font-bold text-ink">Rubric Scoring</h3>
              </div>

              {/* Live Score Display */}
              <div className="text-right">
                <div className="text-lg font-bold font-display text-ink">
                  {totalPoints} / {maxPoints} pts
                  <span className="text-sm font-normal text-ink-2 ml-1.5">({percentage}%)</span>
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                    {liveBand}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      livePassed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {livePassed ? "PASS" : "NEEDS REVISION"}
                  </span>
                </div>
              </div>
            </div>

            {/* Criteria Scoring */}
            <div className="space-y-5">
              {rubric.criteria.map((crit, idx) => {
                const current = criterionScores[crit.id] ?? { points: 0 };

                return (
                  <div key={crit.id} className="space-y-3 rounded-lg border border-line p-4 bg-canvas/30">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5">
                      <div>
                        <div className="text-xs font-bold text-ink">
                          {idx + 1}. {crit.title}
                        </div>
                        {crit.description && (
                          <div className="text-xs text-ink-2 mt-0.5">{crit.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {crit.mustHave && (
                          <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded">
                            Must-have (min {rubric.mustHaveMinimum} pts)
                          </span>
                        )}
                        <span className="text-xs font-mono font-semibold text-ink">
                          Max: {crit.maxPoints} pts
                        </span>
                      </div>
                    </div>

                    {/* Point Selection Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      {Array.from({ length: crit.maxPoints + 1 }, (_, i) => i).map((pts) => (
                        <button
                          key={pts}
                          type="button"
                          onClick={() => handleScoreChange(crit.id, pts)}
                          className={`size-8 rounded font-mono text-xs font-bold transition-all border ${
                            current.points === pts
                              ? "bg-brand-600 text-white border-brand-600 shadow-sm"
                              : "bg-surface text-ink border-line hover:bg-canvas"
                          }`}
                        >
                          {pts}
                        </button>
                      ))}
                    </div>

                    {/* Criterion Comment */}
                    <input
                      type="text"
                      placeholder={`Criterion feedback for ${crit.title}...`}
                      value={current.comment ?? ""}
                      onChange={(e) => handleCommentChange(crit.id, e.target.value)}
                      className="w-full text-xs rounded border border-line p-2 bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                );
              })}
            </div>

            {/* Critical Failures Section */}
            {rubric.criticalFailures && rubric.criticalFailures.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-line">
                <div className="text-xs font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="size-4 text-amber-600" />
                  Critical Failure Checks
                </div>
                <p className="text-xs text-ink-2">
                  A confirmed critical failure requires learner revision regardless of total points.
                </p>

                <div className="space-y-2">
                  {rubric.criticalFailures.map((cf) => {
                    const isConfirmed = confirmedFailures.includes(cf.id);

                    return (
                      <label
                        key={cf.id}
                        className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isConfirmed
                            ? "bg-red-50 border-red-300 text-red-950 font-medium"
                            : "bg-surface border-line text-ink hover:bg-canvas"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isConfirmed}
                          onChange={() => toggleCriticalFailure(cf.id)}
                          className="mt-0.5"
                        />
                        <div>
                          <div>{cf.text}</div>
                          {cf.autoCheck && (
                            <div className="text-[10px] text-ink-3 mt-0.5">
                              Auto-check rule: {cf.autoCheck}
                            </div>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General Assessor Feedback */}
            <div className="space-y-2 pt-2 border-t border-line">
              <label className="text-xs font-semibold text-ink">General Assessor Feedback</label>
              <textarea
                rows={3}
                placeholder="Overall observations, recommendations for buyer engagement, or required revisions..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full rounded-md border border-line p-2.5 text-xs text-ink bg-surface focus:outline-none focus:ring-1 focus:ring-brand-500 placeholder:text-ink-3"
              />
            </div>

            {/* Admin Override Section */}
            {isAdmin && (
              <div className="space-y-2 pt-2 border-t border-line bg-amber-50/50 p-3 rounded-lg border-amber-200">
                <label className="text-xs font-bold text-amber-950 flex items-center gap-1">
                  <ShieldAlert className="size-3.5 text-amber-600" /> Administrator Score Override
                </label>
                <p className="text-[11px] text-amber-900">
                  Required reason will be permanently recorded in the immutable platform audit log.
                </p>
                <input
                  type="text"
                  placeholder="Official justification for changing or overriding the score..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full rounded border border-amber-300 p-2 text-xs bg-surface text-ink"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-line">
              <div className="text-xs text-ink-2">
                Pass requirement: <span className="font-semibold text-ink">{rubric.passMark} pts (67%)</span>
                {" • "}Must-have min: <span className="font-semibold text-ink">{rubric.mustHaveMinimum} pts</span>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Button
                    variant="secondary"
                    onClick={handleAdminOverride}
                    disabled={isSubmitting || !overrideReason.trim()}
                  >
                    Override Score
                  </Button>
                )}
                <Button onClick={handleSubmitScore} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting Evaluation..." : "Submit Assessor Score"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
