import { moduleContentSchema } from "./schema";
import type { ModuleContent } from "./schema";

const label = (raw: unknown): string => {
  const { module, version } = (raw ?? {}) as { module?: unknown; version?: unknown };
  return typeof module === "string" && typeof version === "string" ? `${module}@${version}` : "unnamed content";
};

/**
 * Check module versions with zod and for repeats. One message per problem; empty when valid. Takes
 * unknown values, so content loaded from files is checked the same way as content written in code.
 */
export function validateModuleContent(versions: readonly unknown[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const raw of versions) {
    const name = label(raw);
    const result = moduleContentSchema.safeParse(raw);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
        errors.push(`${name}: ${path}${issue.message}`);
      }
      continue;
    }
    const content: ModuleContent = result.data;
    const key = `${content.module}@${content.version}`;
    if (seen.has(key)) errors.push(`${key}: published twice`);
    seen.add(key);
  }
  return errors;
}
