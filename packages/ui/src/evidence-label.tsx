import { cn } from "./cn";
import { StatusBadge, type StatusTone } from "./status-badge";

export type EvidenceTier =
  | "ai_suggestion"
  | "self_reported"
  | "expert_reviewed"
  | "validated_regulatory_requirement"
  | "formal_bank_decision"
  | "assessor_verified"
  | "bank_approved";

interface TierConfig {
  label: string;
  tone: StatusTone;
}

const TIER_CONFIGS: Record<EvidenceTier, TierConfig> = {
  ai_suggestion: {
    label: "AI suggestion",
    tone: "warn",
  },
  self_reported: {
    label: "Self-reported",
    tone: "idle",
  },
  expert_reviewed: {
    label: "Expert-reviewed",
    tone: "ok",
  },
  assessor_verified: {
    label: "Expert-reviewed",
    tone: "ok",
  },
  validated_regulatory_requirement: {
    label: "Validated regulatory requirement",
    tone: "product",
  },
  formal_bank_decision: {
    label: "Formal bank decision",
    tone: "product",
  },
  bank_approved: {
    label: "Formal bank decision",
    tone: "product",
  },
};

export interface EvidenceLabelProps {
  tier: EvidenceTier;
  className?: string;
  disclaimer?: boolean;
}

/** Standard evidence confidence and source label used across CLEAR and TRADE. */
export function EvidenceLabel({ tier, className, disclaimer }: EvidenceLabelProps) {
  const config = TIER_CONFIGS[tier] ?? TIER_CONFIGS.self_reported;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StatusBadge tone={config.tone}>{config.label}</StatusBadge>
      {disclaimer && tier === "ai_suggestion" && (
        <span className="text-[11px] text-ink-3 italic">
          Check the result before you use it.
        </span>
      )}
    </span>
  );
}
