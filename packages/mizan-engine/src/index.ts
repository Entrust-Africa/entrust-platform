// MIZAN's pure functions: financial analysis, scoring and diagnostics over a configuration from @entrust/mizan-rules.
// No database, no clock: the same inputs and configuration always give the same result.

/** Stored on every assessment with the configuration version. Raise it when a change here could change a result. */
export const MIZAN_ENGINE_VERSION = "mizan-engine 0.1.0";

export * from "./statuses";
export { formatAmount, formatPercent, roundTo } from "./format";
export * from "./ratios";
export * from "./score";
export * from "./diagnostics";
