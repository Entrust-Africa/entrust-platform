import { z } from "@hono/zod-openapi";

/** The body of every error response. `code` is stable, `error` is for people. */
export const Problem = z
  .object({
    error: z.string(),
    code: z
      .enum(["invalid", "unauthenticated", "forbidden", "not_found", "invalid_transition", "precondition_failed"])
      .optional(),
  })
  .openapi("Problem");
