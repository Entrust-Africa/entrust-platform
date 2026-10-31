import { compareVersions } from "../validate";
import type { DiagnosticTemplate } from "./types";
import { validateDiagnosticTemplates } from "./validate";
import { DIAGNOSTIC_1_0_0 } from "./v1";

export * from "./types";
export { validateDiagnosticTemplates } from "./validate";

// Every published version of the onboarding diagnostic. Each diagnostic stores the version it was
// answered against, so a version stays here after a newer one is published, and
// test/diagnostic.test.ts fails if a published one is edited. Put a correction in a new version.
export const DIAGNOSTIC_TEMPLATES: readonly DiagnosticTemplate[] = [DIAGNOSTIC_1_0_0];

// A template that doesn't validate never reaches an SME: loading the package fails instead.
const errors = validateDiagnosticTemplates(DIAGNOSTIC_TEMPLATES);
if (errors.length) throw new Error(`Invalid TRADE diagnostic:\n${errors.join("\n")}`);

export function findDiagnosticTemplate(version: string): DiagnosticTemplate | undefined {
  return DIAGNOSTIC_TEMPLATES.find((t) => t.version === version);
}

/** The newest published version, for diagnostics started now. */
export function latestDiagnosticTemplate(): DiagnosticTemplate {
  return DIAGNOSTIC_TEMPLATES.reduce((newest, t) => (compareVersions(t.version, newest.version) > 0 ? t : newest));
}
