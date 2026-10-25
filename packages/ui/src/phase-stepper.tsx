import * as React from "react";
import { Check, Lock } from "lucide-react";
import { cn } from "./cn";
import { ErrorState, Skeleton } from "./skeleton";

export type PhaseState = "done" | "current" | "upcoming" | "locked";

export interface PhaseStepData {
  n: number;
  title: string;
  steps?: string;
  state: PhaseState;
}

export interface PhaseStepperProps {
  phases?: PhaseStepData[];
  currentPhase?: number;
  onSelectPhase?: (n: number) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function PhaseStepper({
  phases = [],
  currentPhase,
  onSelectPhase,
  loading = false,
  error = null,
  onRetry,
  className,
}: PhaseStepperProps) {
  if (error) {
    return <ErrorState message={error} onRetry={onRetry} className={className} />;
  }

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading phases"
        className={cn("w-full rounded-lg border border-line bg-surface p-4", className)}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-2 w-10" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-3", className)}>
        No phases available.
      </div>
    );
  }

  return (
    <nav
      aria-label="Export phases progress"
      className={cn("w-full rounded-lg border border-line bg-surface p-4", className)}
    >
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7 md:gap-2">
        {phases.map((p, idx) => {
          const isSelected = currentPhase !== undefined && p.n === currentPhase;
          const isInteractive = Boolean(onSelectPhase);

          const StepContent = (
            <div
              className={cn(
                "group relative flex w-full flex-col items-center text-center transition-all",
                isInteractive && "cursor-pointer",
              )}
            >
              {/* Badge Icon / Indicator */}
              <div
                className={cn(
                  "relative flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all",
                  p.state === "done" && "bg-ok text-white shadow-xs",
                  p.state === "current" &&
                    "bg-product-600 text-white shadow-sm ring-4 ring-product-100",
                  p.state === "upcoming" && "border border-line bg-canvas text-ink-3",
                  p.state === "locked" && "border border-line bg-surface-2 text-ink-3/70",
                  isSelected && "ring-2 ring-brand-500 ring-offset-2",
                )}
              >
                {p.state === "done" ? (
                  <Check className="size-4 stroke-[2.5]" aria-hidden="true" />
                ) : p.state === "locked" ? (
                  <Lock className="size-3.5 stroke-[2]" aria-hidden="true" />
                ) : (
                  <span>{p.n}</span>
                )}
              </div>

              {/* Title & Step info */}
              <div className="mt-2 flex flex-col items-center">
                <span
                  className={cn(
                    "line-clamp-2 text-xs font-semibold leading-snug",
                    p.state === "current" ? "text-ink" : "text-ink-2",
                    isInteractive && "group-hover:text-brand-600",
                  )}
                >
                  {p.title}
                </span>
                {p.steps && (
                  <span className="mt-0.5 font-mono text-[10px] text-ink-3">
                    {p.steps}
                  </span>
                )}
              </div>
            </div>
          );

          return (
            <li key={p.n} className="flex flex-col items-center">
              {isInteractive ? (
                <button
                  type="button"
                  onClick={() => onSelectPhase?.(p.n)}
                  aria-current={p.state === "current" ? "step" : undefined}
                  aria-label={`Phase ${p.n}: ${p.title} (${p.state})`}
                  className="w-full rounded-md p-1 focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  {StepContent}
                </button>
              ) : (
                <div
                  aria-current={p.state === "current" ? "step" : undefined}
                  className="w-full p-1"
                >
                  {StepContent}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
