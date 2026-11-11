import type { ModuleContent } from "./schema";

/**
 * Approved versions no learner may start or be graded on any more, as `module@version`. They stay in the package, as an
 * approved version never changes, and staff can still read them; the API stores them as archived. M01, M03, M04 and M07
 * 0.1.0 predate Entrust's common standard (5 questions, some with 2 options, 9 to 16 point rubrics with must-haves), so a
 * learner on them would pass on far less than the 1.0.0 standard asks.
 */
export const RETIRED_VERSIONS: ReadonlySet<string> = new Set(["M01@0.1.0", "M03@0.1.0", "M04@0.1.0", "M07@0.1.0"]);

/** Whether a version is retired for learners. */
export const isRetired = (content: Pick<ModuleContent, "module" | "version">): boolean => RETIRED_VERSIONS.has(`${content.module}@${content.version}`);
