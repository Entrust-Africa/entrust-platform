import type { ModuleId } from "@entrust/trade-rules";

export interface ModuleCompletionCheckInput {
  lessonsCount: number;
  completedLessonsCount: number;
  knowledgeCheckPassed: boolean;
  practicalDeliverablePassed: boolean;
  isExempt: boolean;
  isM01: boolean;
  planAcknowledged: boolean;
  /** Absent for a module whose content has no individual learning plan to submit. */
  individualPlanSubmitted?: boolean;
  adminOverride?: boolean;
}

export interface ModuleCompletionResult {
  complete: boolean;
  missingCriteria: string[];
}

/**
 * Evaluates whether a module is passed according to the criteria defined in Issue #71:
 * - A module is passed when it meets the completion criteria in its content:
 *   every lesson done, the knowledge check passed, and the practical output passed.
 * - M01 also needs the learning plan acknowledged.
 * - Exempted counts as complete.
 * - Admin override counts as complete.
 */
export function checkModuleCompletionCriteria(input: ModuleCompletionCheckInput): ModuleCompletionResult {
  if (input.adminOverride) {
    return { complete: true, missingCriteria: [] };
  }
  if (input.isExempt) {
    return { complete: true, missingCriteria: [] };
  }

  const missing: string[] = [];

  if (input.completedLessonsCount < input.lessonsCount) {
    missing.push(`Lessons: ${input.completedLessonsCount} of ${input.lessonsCount} completed`);
  }

  if (!input.knowledgeCheckPassed) {
    missing.push("Knowledge check not passed");
  }

  if (!input.practicalDeliverablePassed) {
    missing.push("Practical deliverable not passed by assessor");
  }

  if (input.isM01 && !input.planAcknowledged) {
    missing.push("Learning plan must be acknowledged");
  }

  if (input.individualPlanSubmitted === false) {
    missing.push("Individual learning plan not submitted");
  }

  return {
    complete: missing.length === 0,
    missingCriteria: missing,
  };
}

/**
 * Checks if the entire program is complete according to Issue #71:
 * "The program is complete when every module in the active plan is passed or exempted,
 * M11 and M12 included. The plan and the enrolment then become completed."
 */
export function checkProgramCompletion(input: {
  assignedModules: readonly (ModuleId | string)[];
  passedOrExemptModuleIds: readonly (ModuleId | string)[];
}): boolean {
  if (input.assignedModules.length === 0) return false;
  const passedSet = new Set(input.passedOrExemptModuleIds);
  return input.assignedModules.every((mod) => passedSet.has(mod));
}

const CERT_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Generates a unique, human-friendly certificate code in the format:
 * TRADE-YYYY-XXXX-XXXX
 *
 * The characters come from the platform's cryptographic random source, so a code can't be predicted from others.
 * 32 characters divide 256 evenly, so taking a byte modulo 32 picks each one with the same chance.
 */
export function generateCertificateCode(year: number = new Date().getUTCFullYear()): string {
  const segment = (len: number) => {
    const bytes = new Uint8Array(len);
    globalThis.crypto.getRandomValues(bytes);
    let s = "";
    for (const byte of bytes) s += CERT_CHARSET[byte % CERT_CHARSET.length];
    return s;
  };
  return `TRADE-${year}-${segment(4)}-${segment(4)}`;
}
