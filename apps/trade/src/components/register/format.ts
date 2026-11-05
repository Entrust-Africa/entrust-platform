import type { StatusTone } from "@entrust/ui";

const NUMBER = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** An amount in birr, such as 25,500,000, or a dash when nothing is recorded. */
export const amount = (value: number | null): string => (value === null ? "–" : NUMBER.format(value));

export const orDash = (value: string | number | null): string => (value === null || value === "" ? "–" : String(value));

export const yesNo = (value: boolean | null): string => (value === null ? "–" : value ? "Yes" : "No");

type Level = "high" | "medium" | "low" | null;

/** How a readiness level reads and what colour supports it. */
export const READINESS: Record<"high" | "medium" | "low" | "none", { label: string; tone: StatusTone }> = {
  high: { label: "High", tone: "ok" },
  medium: { label: "Medium", tone: "warn" },
  low: { label: "Low", tone: "danger" },
  none: { label: "Not assessed", tone: "idle" },
};

export const readiness = (level: Level) => READINESS[level ?? "none"];

/** A priority for a finance conversation; the bank opportunity is the more useful of the two once there is one. */
export const PRIORITY: Record<"high" | "medium" | "low", { label: string; tone: StatusTone }> = {
  high: { label: "High priority", tone: "danger" },
  medium: { label: "Medium priority", tone: "warn" },
  low: { label: "Low priority", tone: "idle" },
};
