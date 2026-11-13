"use client";

import { useState, useEffect, useRef, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FastForward,
  FileCheck2,
  FileText,
  HelpCircle,
  Info,
  Pause,
  Play,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Sparkles,
  X,
} from "lucide-react";
import { Card, cn, StatusBadge } from "@entrust/ui";
import { SIMULATION_PO, SIMULATION_GAPS, buildSimulationSteps, buildPhaseSummaries } from "@/lib/simulation/scenario";
import type { PlaybackSpeed, PurchaseOrderData, SimulationGap, SimulationLogEntry, SimulationStepDefinition, StepRunStatus } from "@/lib/simulation/types";

const STATUS_CONFIG: Record<StepRunStatus, { label: string; tone: "idle" | "info" | "warn" | "ok" | "danger" }> = {
  not_started: { label: "Not started", tone: "idle" },
  in_progress: { label: "In progress", tone: "info" },
  awaiting_sme: { label: "Awaiting SME", tone: "warn" },
  completed: { label: "Completed", tone: "ok" },
  blocked: { label: "Blocked", tone: "danger" },
  not_applicable: { label: "Not applicable", tone: "idle" },
};

function SimStatusBadge({ status }: { status: StepRunStatus }) {
  const config = STATUS_CONFIG[status] ?? { label: status, tone: "idle" as const };
  return <StatusBadge tone={config.tone}>{config.label}</StatusBadge>;
}

export function SimulationView() {
  const steps = useMemo(() => buildSimulationSteps(), []);
  const phases = useMemo(() => buildPhaseSummaries(), []);

  // State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [completedStepIds, setCompletedStepIds] = useState<Set<string>>(new Set());
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [autoPauseOnGap, setAutoPauseOnGap] = useState<boolean>(true);
  const [activePhaseTab, setActivePhaseTab] = useState<number>(1);
  const [selectedStep, setSelectedStep] = useState<SimulationStepDefinition | null>(null);
  const [showPoModal, setShowPoModal] = useState<boolean>(false);

  // Gaps state
  const [gapHsResolved, setGapHsResolved] = useState<boolean>(false);
  const [gapHandoverResolved, setGapHandoverResolved] = useState<boolean>(false);
  const [activeGap, setActiveGap] = useState<SimulationGap | null>(null);

  // Dynamic PO data (updates when gaps are resolved)
  const [poData, setPoData] = useState<PurchaseOrderData>(SIMULATION_PO);

  // Activity logs
  const [logs, setLogs] = useState<SimulationLogEntry[]>([
    {
      id: "log-init-1",
      timestamp: "12 Nov 2026 09:00:00",
      phase: 1,
      stepId: "SYSTEM",
      actor: "CLEAR Platform",
      action: "Simulation Initialized",
      detail: "Loaded Purchase Order US-2026-0048 for Atlantic Specialty Foods LLC (Miami, USA). Canonical 125-step export protocol ready.",
      level: "info",
    },
    {
      id: "log-init-2",
      timestamp: "12 Nov 2026 09:00:01",
      phase: 1,
      stepId: "SYSTEM",
      actor: "CLEAR Gate Engine",
      action: "Compliance Matrix Loaded",
      detail: "Notice: HS Code and final handover location deliberately left unconfirmed in PO terms to verify CLEAR non-assumption protocol.",
      level: "warning",
    },
  ]);

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Active step calculation
  const currentStep = steps[currentStepIndex] ?? steps[steps.length - 1];

  // Derive step statuses
  const stepStatuses: Record<string, StepRunStatus> = useMemo(() => {
    const map: Record<string, StepRunStatus> = {};
    steps.forEach((s, idx) => {
      if (completedStepIds.has(s.id)) {
        map[s.id] = "completed";
      } else if (idx === currentStepIndex) {
        if (s.id === "STEP-008" && !gapHsResolved) {
          map[s.id] = "awaiting_sme";
        } else if (s.id === "STEP-022" && !gapHandoverResolved) {
          map[s.id] = "awaiting_sme";
        } else {
          map[s.id] = isPlaying ? "in_progress" : "not_started";
        }
      } else if (idx < currentStepIndex) {
        map[s.id] = "completed";
      } else {
        map[s.id] = "not_started";
      }
    });
    return map;
  }, [steps, completedStepIds, currentStepIndex, isPlaying, gapHsResolved, gapHandoverResolved]);

  // Overall progress
  const progressPercent = Math.min(100, Math.round((completedStepIds.size / steps.length) * 100));

  // Determine active phase based on current step
  const activePhase = currentStep ? currentStep.phase : 1;

  // Sync activePhaseTab with playback progress
  useEffect(() => {
    if (currentStep) {
      setActivePhaseTab(currentStep.phase);
    }
  }, [currentStep?.phase]);

  // Scroll logs to bottom on new log
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Stop playback timer helper
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Resolve HS Code gap
  const handleResolveHsCode = () => {
    setGapHsResolved(true);
    setActiveGap(null);
    setPoData((prev) => ({
      ...prev,
      product: {
        ...prev.product,
        hsCode: "0901.21.00 (Ethiopian Customs Tariff: Coffee, roasted, not decaffeinated)",
      },
    }));

    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: `log-res-hs-${Date.now()}`,
        timestamp: now,
        phase: 1,
        stepId: "STEP-008",
        actor: "Momentous Trading PLC (SME)",
        action: "Gap Resolved: Confirmed HS Code 0901.21.00",
        detail:
          "SME confirmed 6-digit HS code 0901.21 and Ethiopian 8-digit tariff code 0901.21.00 for roasted whole coffee beans. CLEAR tariff lookup unlocked.",
        level: "success",
      },
    ]);

    // Mark STEP-008 completed and advance
    setCompletedStepIds((prev) => new Set([...prev, "STEP-008"]));
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  // Resolve Handover Location gap
  const handleResolveHandover = () => {
    setGapHandoverResolved(true);
    setActiveGap(null);
    setPoData((prev) => ({
      ...prev,
      deliveryTerms: {
        ...prev.deliveryTerms,
        namedPlace: "Momentous Roastery Facility, Plot 14, Bole Lemi Industrial Zone, Addis Ababa",
        handoverNote: "Handover facility confirmed with buyer's carrier (Ethiopian Airlines Cargo). Risk transfer point legally established.",
      },
    }));

    const now = new Date().toLocaleTimeString();
    setLogs((prev) => [
      ...prev,
      {
        id: `log-res-fca-${Date.now()}`,
        timestamp: now,
        phase: 2,
        stepId: "STEP-022",
        actor: "Momentous & Atlantic Specialty",
        action: "Gap Resolved: Named Handover Location Confirmed",
        detail:
          "Handover facility confirmed: Plot 14, Bole Lemi Industrial Zone, Addis Ababa. Carrier handover point specified under Incoterms 2020 FCA. Audit passed.",
        level: "success",
      },
    ]);

    // Mark STEP-022 completed and advance
    setCompletedStepIds((prev) => new Set([...prev, "STEP-022"]));
    setCurrentStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  // Advance simulation one step
  const advanceOneStep = () => {
    setCurrentStepIndex((prevIndex) => {
      if (prevIndex >= steps.length) {
        setIsPlaying(false);
        return prevIndex;
      }

      const step = steps[prevIndex];
      if (!step) {
        setIsPlaying(false);
        return prevIndex;
      }

      // Check for Gap 1: STEP-008 (HS Code unconfirmed)
      if (step.id === "STEP-008" && !gapHsResolved) {
        setActiveGap(SIMULATION_GAPS["gap-hs-code"] ?? null);
        const now = new Date().toLocaleTimeString();
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: `log-gap-hs-${Date.now()}`,
            timestamp: now,
            phase: 1,
            stepId: "STEP-008",
            actor: "CLEAR Gate Engine",
            action: "⚠️ Compliance Gap Detected: HS Code Unconfirmed",
            detail:
              "PO US-2026-0048 specifies 'To be confirmed by exporter and customs authority'. CLEAR non-assumption protocol halts progression and transitions STEP-008 to awaiting_sme.",
            level: "warning",
          },
        ]);
        if (autoPauseOnGap) {
          setIsPlaying(false);
        }
        return prevIndex;
      }

      // Check for Gap 2: STEP-022 (Handover Location unconfirmed under FCA)
      if (step.id === "STEP-022" && !gapHandoverResolved) {
        setActiveGap(SIMULATION_GAPS["gap-handover-location"] ?? null);
        const now = new Date().toLocaleTimeString();
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: `log-gap-fca-${Date.now()}`,
            timestamp: now,
            phase: 2,
            stepId: "STEP-022",
            actor: "CLEAR Contract Audit",
            action: "⚠️ Compliance Gap Detected: Named Handover Location Ambiguity",
            detail:
              "PO specifies Incoterms 2020 FCA Addis Ababa with unconfirmed handover location. Under FCA, the precise facility address is required to fix risk transfer boundaries. CLEAR transitions STEP-022 to awaiting_sme.",
            level: "warning",
          },
        ]);
        if (autoPauseOnGap) {
          setIsPlaying(false);
        }
        return prevIndex;
      }

      // Normal step completion
      const now = new Date().toLocaleTimeString();
      setCompletedStepIds((prevSet) => new Set([...prevSet, step.id]));

      const isMilestone = Boolean(step.milestone);
      setLogs((prevLogs) => [
        ...prevLogs,
        {
          id: `log-${step.id}-${Date.now()}`,
          timestamp: now,
          phase: step.phase,
          stepId: step.id,
          actor: step.authority ?? (step.owner === "sme" ? "Momentous Trading PLC" : step.owner === "entrust" ? "Entrust Compliance" : "CLEAR System"),
          action: isMilestone ? `★ MILESTONE: ${step.name}` : step.name,
          detail: step.executionDetail,
          level: isMilestone ? "milestone" : "info",
        },
      ]);

      const nextIndex = prevIndex + 1;
      if (nextIndex >= steps.length) {
        setIsPlaying(false);
        setLogs((prevLogs) => [
          ...prevLogs,
          {
            id: `log-finish-${Date.now()}`,
            timestamp: now,
            phase: 7,
            stepId: "STEP-125",
            actor: "CLEAR Gate Engine",
            action: "🎉 Export Simulation Completed (100% Compliant)",
            detail:
              "Purchase Order US-2026-0048 has fully executed through all 7 phases and 125 canonical steps. All gaps identified and resolved. Final case closed.",
            level: "success",
          },
        ]);
        return steps.length - 1;
      }

      return nextIndex;
    });
  };

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      stopTimer();
      return;
    }

    // Base interval ms divided by speed multiplier (1x = 750ms)
    const intervalMs = Math.max(120, Math.round(750 / speed));

    timerRef.current = setInterval(() => {
      advanceOneStep();
    }, intervalMs);

    return () => stopTimer();
  }, [isPlaying, speed, gapHsResolved, gapHandoverResolved, autoPauseOnGap, steps]);

  // Reset simulation
  const handleReset = () => {
    stopTimer();
    setIsPlaying(false);
    setCurrentStepIndex(0);
    setCompletedStepIds(new Set());
    setGapHsResolved(false);
    setGapHandoverResolved(false);
    setActiveGap(null);
    setPoData(SIMULATION_PO);
    setActivePhaseTab(1);
    setSelectedStep(null);
    setLogs([
      {
        id: `log-reset-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        phase: 1,
        stepId: "SYSTEM",
        actor: "CLEAR Platform",
        action: "Simulation Reset",
        detail: "State reset to initial Purchase Order US-2026-0048. HS Code and Handover Location reset to unconfirmed.",
        level: "info",
      },
    ]);
  };

  // Step backward
  const handleStepBackward = () => {
    if (currentStepIndex <= 0) return;
    setIsPlaying(false);
    const targetIdx = currentStepIndex - 1;
    const targetStep = steps[targetIdx];
    if (!targetStep) return;

    setCompletedStepIds((prev) => {
      const next = new Set(prev);
      next.delete(targetStep.id);
      return next;
    });
    setCurrentStepIndex(targetIdx);
  };

  // Step forward
  const handleStepForward = () => {
    setIsPlaying(false);
    advanceOneStep();
  };

  // Filter steps by active phase tab
  const filteredSteps = useMemo(() => {
    return steps.filter((s) => s.phase === activePhaseTab);
  }, [steps, activePhaseTab]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header Card */}
      <section className="relative overflow-hidden rounded-2xl bg-linear-to-r from-night via-night-2 to-[#1b263b] p-6 text-on-night shadow-lg sm:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-500/20 px-3 py-1 font-mono text-xs font-semibold tracking-wider text-brand-300 uppercase">
              <Sparkles className="size-3.5" />
              CLEAR Process Simulation · PO US-2026-0048
            </div>
            <h1 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              End-to-End Export Protocol Simulation
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-on-night-muted sm:text-base">
              Simulating <strong className="text-white">Momentous Trading PLC</strong> exporting 2,000 bags (500 kg) of Ethiopian Roasted Coffee to{" "}
              <strong className="text-white">Atlantic Specialty Foods LLC</strong> (Miami, USA) across all 7 phases and 125 canonical steps.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="text-xs font-medium text-on-night-muted">Active Phase</div>
              <div className="mt-1 font-display text-lg font-bold text-white">
                Phase {activePhase} / 7
              </div>
              <div className="text-[11px] text-brand-300 truncate">{phases[activePhase - 1]?.name}</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="text-xs font-medium text-on-night-muted">Steps Executed</div>
              <div className="mt-1 font-display text-lg font-bold text-white">
                {completedStepIds.size} <span className="text-sm font-normal text-on-night-muted">/ 125</span>
              </div>
              <div className="text-[11px] text-moss-300">{progressPercent}% complete</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="text-xs font-medium text-on-night-muted">Gaps Identified</div>
              <div className="mt-1 font-display text-lg font-bold text-amber-300">
                2 <span className="text-xs font-normal text-on-night-muted">({(gapHsResolved ? 1 : 0) + (gapHandoverResolved ? 1 : 0)} resolved)</span>
              </div>
              <div className="text-[11px] text-amber-200">Non-Assumption Protocol</div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="text-xs font-medium text-on-night-muted">Order Value</div>
              <div className="mt-1 font-display text-lg font-bold text-white">$7,000.00</div>
              <div className="text-[11px] text-on-night-muted">USD · FCA Addis Ababa</div>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-xs font-semibold text-on-night-muted">
            <span>Overall Simulation Progress</span>
            <span className="font-mono">{completedStepIds.size} of 125 Steps ({progressPercent}%)</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-linear-to-r from-brand-500 to-moss-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      {/* Control Bar */}
      <section aria-label="Simulation Controls" className="sticky top-16 z-20 rounded-xl border border-line bg-surface/95 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Main Playback Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg px-5 text-sm font-semibold text-white shadow-xs transition-all focus-visible:outline-2 focus-visible:outline-brand-500",
                isPlaying
                  ? "bg-amber-600 hover:bg-amber-700 animate-pulse"
                  : completedStepIds.size >= steps.length
                    ? "bg-moss-600 hover:bg-moss-700"
                    : "bg-brand-600 hover:bg-brand-700",
              )}
            >
              {isPlaying ? (
                <>
                  <Pause className="size-4" /> Pause
                </>
              ) : completedStepIds.size >= steps.length ? (
                <>
                  <RotateCcw className="size-4" /> Replay Simulation
                </>
              ) : (
                <>
                  <Play className="size-4 fill-white" /> {completedStepIds.size === 0 ? "Play Simulation" : "Resume Playback"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleStepForward}
              disabled={isPlaying || completedStepIds.size >= steps.length}
              title="Step Forward (1 step)"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-line/60 disabled:opacity-50"
            >
              <SkipForward className="size-3.5" /> Step Forward
            </button>

            <button
              type="button"
              onClick={handleStepBackward}
              disabled={isPlaying || currentStepIndex === 0}
              title="Step Backward"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 text-xs font-semibold text-ink transition-colors hover:bg-line/60 disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" /> Step Back
            </button>

            <button
              type="button"
              onClick={handleReset}
              title="Reset Simulation"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 text-xs font-semibold text-ink-2 transition-colors hover:bg-line/60 hover:text-ink"
            >
              <RefreshCw className="size-3.5" /> Reset
            </button>
          </div>

          {/* Speed & Option Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-canvas p-1">
              <span className="px-2 text-xs font-medium text-ink-3">Speed:</span>
              {([0.5, 1, 2, 5] as PlaybackSpeed[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-semibold transition-colors",
                    speed === s ? "bg-surface text-brand-700 shadow-xs" : "text-ink-2 hover:text-ink",
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Auto-pause toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-2">
              <input
                type="checkbox"
                checked={autoPauseOnGap}
                onChange={(e) => setAutoPauseOnGap(e.target.checked)}
                className="size-4 rounded-sm border-line text-brand-600 focus:ring-brand-500"
              />
              <span>Auto-pause on Gaps</span>
            </label>

            {/* PO Document Inspector Trigger */}
            <button
              type="button"
              onClick={() => setShowPoModal(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 text-xs font-semibold text-brand-800 transition-colors hover:bg-brand-100"
            >
              <FileText className="size-3.5 text-brand-600" /> Inspect PO Document
            </button>
          </div>
        </div>

        {/* Status Line */}
        <div className="mt-3 flex items-center justify-between border-t border-line/60 pt-2.5 text-xs text-ink-2">
          <div className="flex items-center gap-2 truncate">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                isPlaying ? "bg-moss-500 animate-ping" : "bg-ink-3",
              )}
            />
            <span>
              <strong>Current Step:</strong>{" "}
              <code className="font-mono text-ink font-semibold">{currentStep?.id}</code> — {currentStep?.name}
            </span>
          </div>

          <div className="font-mono text-[11px] text-ink-3">
            Phase {activePhase}: {phases[activePhase - 1]?.milestone}
          </div>
        </div>
      </section>

      {/* Active Compliance Gap Alert Banner */}
      {activeGap && (
        <section
          aria-labelledby="gap-alert-heading"
          className="rounded-xl border-2 border-amber-400 bg-amber-50/90 p-5 shadow-md animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs">
                <AlertTriangle className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-sm bg-amber-200 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 uppercase">
                    Compliance Gap Detected
                  </span>
                  <span className="font-mono text-xs font-semibold text-amber-800">{activeGap.stepId}</span>
                </div>
                <h3 id="gap-alert-heading" className="font-display text-base font-bold text-amber-950 sm:text-lg">
                  {activeGap.noticeHeading}
                </h3>
                <p className="max-w-3xl text-sm leading-relaxed text-amber-900">
                  {activeGap.noticeMessage}
                </p>
                <div className="mt-2 rounded-lg bg-white/70 p-3 text-xs text-amber-950 border border-amber-200/80">
                  <strong>Why CLEAR Refuses to Assume:</strong> {activeGap.policyReason}
                </div>
              </div>
            </div>

            <div className="shrink-0 pt-2 sm:pt-0">
              {activeGap.id === "gap-hs-code" && (
                <button
                  type="button"
                  onClick={handleResolveHsCode}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-amber-600"
                >
                  <CheckCircle2 className="size-4" />
                  {activeGap.resolutionLabel}
                </button>
              )}

              {activeGap.id === "gap-handover-location" && (
                <button
                  type="button"
                  onClick={handleResolveHandover}
                  className="inline-flex h-11 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-amber-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-amber-600"
                >
                  <CheckCircle2 className="size-4" />
                  {activeGap.resolutionLabel}
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 7-Phase Stepper Pills */}
      <nav aria-label="Simulation Phases" className="overflow-x-auto pb-1">
        <div className="flex min-w-[760px] gap-2">
          {phases.map((p) => {
            const isTabActive = activePhaseTab === p.id;
            const isCurrentPhase = activePhase === p.id;
            // Phase is complete if all its steps are completed
            const phaseStepList = steps.filter((s) => s.phase === p.id);
            const isPhaseDone = phaseStepList.every((s) => completedStepIds.has(s.id));
            const hasGapHere =
              (p.id === 1 && !gapHsResolved && currentStepIndex >= 7) ||
              (p.id === 2 && !gapHandoverResolved && currentStepIndex >= 21);

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActivePhaseTab(p.id)}
                className={cn(
                  "flex-1 rounded-xl border p-3 text-left transition-all",
                  isTabActive
                    ? "border-brand-600 bg-brand-50/60 shadow-xs ring-1 ring-brand-500"
                    : "border-line bg-surface hover:bg-canvas",
                )}
              >
                <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                  <span className={cn(isTabActive ? "text-brand-900" : "text-ink-2")}>Phase {p.id}</span>
                  {isPhaseDone ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-moss-600">
                      <CheckCircle2 className="size-3.5" /> Done
                    </span>
                  ) : hasGapHere ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                      <AlertTriangle className="size-3" /> Gap
                    </span>
                  ) : isCurrentPhase ? (
                    <span className="inline-block size-2 rounded-full bg-brand-600 animate-ping" />
                  ) : null}
                </div>
                <div className="mt-1 font-display text-xs font-bold text-ink line-clamp-1">{p.name}</div>
                <div className="mt-0.5 text-[11px] text-ink-3 truncate">{p.milestone}</div>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Grid: Left Steps Matrix, Right PO & Audit Stream */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)]">
        {/* Left Column: Steps for Active Phase */}
        <section aria-labelledby="phase-steps-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="phase-steps-heading" className="font-display text-base font-bold text-ink">
              Phase {activePhaseTab} Steps: {phases[activePhaseTab - 1]?.name}
            </h2>
            <span className="text-xs text-ink-3">
              {filteredSteps.filter((s) => completedStepIds.has(s.id)).length} of {filteredSteps.length} completed
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {filteredSteps.map((step) => {
              const status = stepStatuses[step.id] ?? "not_started";
              const isSelected = selectedStep?.id === step.id;
              const isCurrent = currentStep?.id === step.id;
              const isGapStep = step.id === "STEP-008" || step.id === "STEP-022";
              const isGapUnresolved =
                (step.id === "STEP-008" && !gapHsResolved) ||
                (step.id === "STEP-022" && !gapHandoverResolved);

              return (
                <div
                  key={step.id}
                  onClick={() => setSelectedStep(step)}
                  className={cn(
                    "group relative flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-all",
                    isCurrent
                      ? "border-brand-500 bg-brand-50/40 shadow-xs ring-1 ring-brand-400"
                      : isSelected
                        ? "border-ink-3 bg-canvas"
                        : "border-line bg-surface hover:bg-canvas/80",
                    isGapStep && isGapUnresolved && currentStepIndex >= steps.findIndex((s) => s.id === step.id)
                      ? "border-amber-400 bg-amber-50/50"
                      : "",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {status === "completed" ? (
                        <CheckCircle2 className="size-4 text-moss-600" />
                      ) : status === "awaiting_sme" ? (
                        <AlertTriangle className="size-4 text-amber-600 animate-bounce" />
                      ) : status === "in_progress" ? (
                        <Clock className="size-4 text-brand-600 animate-spin" />
                      ) : (
                        <div className="size-4 rounded-full border border-line bg-canvas" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink">{step.id}</span>
                        {step.milestone && (
                          <span className="rounded-sm bg-purple-100 px-1.5 py-0.2 font-sans text-[10px] font-bold text-purple-900 uppercase">
                            Milestone
                          </span>
                        )}
                        {step.authority && (
                          <span className="rounded-sm bg-neutral-100 px-1.5 py-0.2 text-[10px] font-medium text-ink-3">
                            {step.authority}
                          </span>
                        )}
                        {step.gapId && (
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.2 text-[10px] font-bold uppercase",
                              isGapUnresolved ? "bg-amber-100 text-amber-900" : "bg-moss-100 text-moss-800",
                            )}
                          >
                            {isGapUnresolved ? "Gap Pending" : "Gap Resolved"}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-semibold text-ink line-clamp-1 group-hover:text-brand-700">
                        {step.name}
                      </div>

                      <p className="text-xs text-ink-2 line-clamp-1">{step.summary}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <SimStatusBadge status={status} />
                    <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: PO Summary + Live Audit Feed */}
        <div className="flex flex-col gap-6">
          {/* Purchase Order Card */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-brand-600" />
                <h3 className="font-display text-sm font-bold text-ink">Simulated Purchase Order</h3>
              </div>
              <span className="font-mono text-xs font-bold text-brand-700">{poData.poNumber}</span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-ink-3">Buyer:</span>
                <div className="font-semibold text-ink truncate">{poData.buyer.company}</div>
                <div className="text-[11px] text-ink-2">{poData.buyer.address}</div>
              </div>

              <div>
                <span className="text-ink-3">Exporter:</span>
                <div className="font-semibold text-ink truncate">{poData.seller.company}</div>
                <div className="text-[11px] text-ink-2">{poData.seller.businessAddress}</div>
              </div>

              <div>
                <span className="text-ink-3">Product:</span>
                <div className="font-semibold text-ink">{poData.product.name}</div>
                <div className="text-[11px] text-ink-2">2,000 bags (500 kg net)</div>
              </div>

              <div>
                <span className="text-ink-3">Total Value:</span>
                <div className="font-semibold text-ink">$7,000.00 USD</div>
                <div className="text-[11px] text-ink-2">30% Advance / 70% CAD</div>
              </div>
            </div>

            {/* Unconfirmed Items Inspector */}
            <div className="mt-4 rounded-xl border border-line bg-canvas p-3 space-y-2.5">
              <div className="text-xs font-bold text-ink uppercase tracking-wider">
                Non-Assumption Gap Status:
              </div>

              {/* Item 1: HS Code */}
              <div className="flex items-start justify-between gap-2 text-xs border-b border-line/60 pb-2">
                <div>
                  <span className="font-semibold text-ink">HS Tariff Classification:</span>
                  <div
                    className={cn(
                      "mt-0.5 text-[11px]",
                      gapHsResolved ? "text-moss-700 font-medium" : "text-amber-800 font-semibold",
                    )}
                  >
                    {gapHsResolved ? "0901.21.00 (Confirmed by SME)" : "To be confirmed (Unconfirmed in PO)"}
                  </div>
                </div>
                {gapHsResolved ? (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-moss-100 px-1.5 py-0.5 text-[10px] font-bold text-moss-800">
                    <CheckCircle2 className="size-3" /> Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle className="size-3" /> Gap
                  </span>
                )}
              </div>

              {/* Item 2: Handover Location */}
              <div className="flex items-start justify-between gap-2 text-xs">
                <div>
                  <span className="font-semibold text-ink">FCA Handover Location:</span>
                  <div
                    className={cn(
                      "mt-0.5 text-[11px]",
                      gapHandoverResolved ? "text-moss-700 font-medium" : "text-amber-800 font-semibold",
                    )}
                  >
                    {gapHandoverResolved
                      ? "Bole Lemi Industrial Zone, Addis Ababa (Confirmed)"
                      : "Exporter's designated location (Unconfirmed in PO)"}
                  </div>
                </div>
                {gapHandoverResolved ? (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-moss-100 px-1.5 py-0.5 text-[10px] font-bold text-moss-800">
                    <CheckCircle2 className="size-3" /> Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                    <AlertTriangle className="size-3" /> Gap
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* Live Activity & Audit Log Feed */}
          <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-line bg-canvas/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-brand-600" />
                <h3 className="font-display text-sm font-bold text-ink">Live Activity & Audit Trail</h3>
              </div>
              <span className="font-mono text-xs text-ink-3">{logs.length} entries</span>
            </div>

            <div
              ref={logsContainerRef}
              className="max-h-[460px] overflow-y-auto p-4 space-y-3 font-sans text-xs"
            >
              {logs.map((log) => {
                const isMilestone = log.level === "milestone";
                const isWarning = log.level === "warning";
                const isSuccess = log.level === "success";

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "rounded-lg border p-2.5 transition-colors",
                      isMilestone
                        ? "border-purple-300 bg-purple-50 text-purple-950"
                        : isWarning
                          ? "border-amber-300 bg-amber-50 text-amber-950"
                          : isSuccess
                            ? "border-moss-200 bg-moss-50 text-moss-950"
                            : "border-line bg-surface text-ink",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-ink-3">
                      <span>{log.timestamp}</span>
                      <span className="font-semibold text-brand-700">{log.stepId}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-1.5 font-bold">
                      {isMilestone && <Sparkles className="size-3.5 text-purple-600" />}
                      {isWarning && <AlertTriangle className="size-3.5 text-amber-600" />}
                      {isSuccess && <CheckCircle2 className="size-3.5 text-moss-600" />}
                      <span>{log.action}</span>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed opacity-90">{log.detail}</p>
                    <div className="mt-1 text-[10px] font-medium text-ink-3">Actor: {log.actor}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* Step Detail Drawer / Slide-over Modal */}
      {selectedStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-xs p-4">
          <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setSelectedStep(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-ink-3 hover:bg-canvas hover:text-ink"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-brand-700">{selectedStep.id}</span>
                <span className="rounded-sm bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-ink-2">
                  Phase {selectedStep.phase}
                </span>
                <SimStatusBadge status={stepStatuses[selectedStep.id] ?? "not_started"} />
              </div>

              <h2 className="font-display text-xl font-bold text-ink">{selectedStep.name}</h2>

              <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-2">
                <div>
                  <span className="text-ink-3">Responsible Owner:</span>
                  <div className="font-semibold text-ink capitalize">{selectedStep.owner}</div>
                </div>
                {selectedStep.authority && (
                  <div>
                    <span className="text-ink-3">Governing Authority:</span>
                    <div className="font-semibold text-ink">{selectedStep.authority}</div>
                  </div>
                )}
                {selectedStep.masterControl && (
                  <div>
                    <span className="text-ink-3">Master Control Reference:</span>
                    <div className="font-semibold text-ink">{selectedStep.masterControl}</div>
                  </div>
                )}
                <div>
                  <span className="text-ink-3">Prerequisites:</span>
                  <div className="font-mono text-ink">
                    {selectedStep.prerequisites.length > 0 ? selectedStep.prerequisites.join(", ") : "None (Initial Step)"}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-ink uppercase tracking-wider">Execution Narrative</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{selectedStep.executionDetail}</p>
              </div>

              {selectedStep.gapId && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950 space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Special Compliance Test Point
                  </div>
                  <p>
                    This step deliberately tests CLEAR's non-assumption protocol. Under real export controls, assuming
                    an unverified parameter can cause regulatory seizure or legal breach.
                  </p>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStep(null)}
                  className="rounded-lg bg-neutral-100 px-4 py-2 text-xs font-semibold text-ink hover:bg-neutral-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full Purchase Order Inspection Modal */}
      {showPoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-xs p-4">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowPoModal(false)}
              className="absolute top-5 right-5 rounded-lg p-2 text-ink-3 hover:bg-canvas hover:text-ink"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-6">
              {/* Document Header */}
              <div className="border-b border-line pb-4">
                <div className="inline-block rounded-sm bg-neutral-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink-3 uppercase">
                  Simulation Document · Not Valid for Commercial Use
                </div>
                <h2 className="mt-2 font-display text-2xl font-extrabold text-ink">
                  PURCHASE ORDER (PO)
                </h2>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2 font-mono">
                  <span>PO Number: <strong>{poData.poNumber}</strong></span>
                  <span>Date: <strong>{poData.poDate}</strong></span>
                  <span>Type: <strong>{poData.orderType}</strong></span>
                  <span>Currency: <strong>{poData.currency}</strong></span>
                </div>
              </div>

              {/* Parties */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-1">
                  <div className="font-bold text-ink uppercase tracking-wide">1. Buyer Information</div>
                  <div className="font-bold text-sm text-ink">{poData.buyer.company}</div>
                  <div className="text-ink-2">{poData.buyer.address}</div>
                  <div className="text-ink-2">Contact: {poData.buyer.contactPerson}</div>
                  <div className="text-ink-2">Email: {poData.buyer.email}</div>
                  <div className="text-ink-2">Tel: {poData.buyer.telephone}</div>
                </div>

                <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-1">
                  <div className="font-bold text-ink uppercase tracking-wide">2. Seller / Exporter</div>
                  <div className="font-bold text-sm text-ink">{poData.seller.company}</div>
                  <div className="text-ink-2">Country: {poData.seller.country}</div>
                  <div className="text-ink-2">{poData.seller.businessAddress}</div>
                  <div className="text-ink-2">Contact: {poData.seller.contactPerson}</div>
                  <div className="text-ink-2">Email: {poData.seller.email}</div>
                </div>
              </div>

              {/* Product Specifications */}
              <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-2">
                <div className="font-bold text-ink uppercase tracking-wide">3. Product Details</div>
                <div className="grid grid-cols-2 gap-2 text-ink-2 sm:grid-cols-4">
                  <div>Product: <strong className="text-ink block">{poData.product.name}</strong></div>
                  <div>Form: <strong className="text-ink block">{poData.product.productForm}</strong></div>
                  <div>Roast: <strong className="text-ink block">{poData.product.roast}</strong></div>
                  <div>Quantity: <strong className="text-ink block">{poData.product.quantity}</strong></div>
                  <div>Net Weight: <strong className="text-ink block">{poData.product.totalNetWeight}</strong></div>
                  <div>Packaging: <strong className="text-ink block">{poData.product.packaging}</strong></div>
                  <div>Unit Price: <strong className="text-ink block">${poData.orderValue.unitPrice.toFixed(2)}</strong></div>
                  <div>Total Value: <strong className="text-ink block">${poData.orderValue.totalAmount.toFixed(2)} USD</strong></div>
                </div>

                {/* Highlighted HS Code */}
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  <div className="font-bold">HS Code Specification in PO:</div>
                  <div className="mt-0.5">{poData.product.hsCode}</div>
                </div>
              </div>

              {/* Terms */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-1.5">
                  <div className="font-bold text-ink uppercase tracking-wide">4. Delivery Terms</div>
                  <div>Incoterm: <strong className="text-ink">{poData.deliveryTerms.incoterm}</strong> ({poData.deliveryTerms.incotermsVersion})</div>
                  <div>Named Place: <strong className="text-ink">{poData.deliveryTerms.namedPlace}</strong></div>
                  <div className="mt-2 text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
                    {poData.deliveryTerms.handoverNote}
                  </div>
                </div>

                <div className="rounded-xl border border-line bg-canvas p-4 text-xs space-y-1.5">
                  <div className="font-bold text-ink uppercase tracking-wide">5. Payment Terms</div>
                  <ul className="list-disc pl-4 space-y-1 text-ink-2">
                    {poData.paymentTerms.map((term, i) => (
                      <li key={i}>{term}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPoModal(false)}
                  className="rounded-lg bg-brand-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  Close Inspector
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
