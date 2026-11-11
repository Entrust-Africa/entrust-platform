import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../app";
import { isProduction, productionConfigReport } from "../config-check";

const route = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Liveness check",
  responses: {
    200: {
      description: "The API is running",
      content: {
        "application/json": {
          schema: z.object({
            status: z.literal("ok"),
            /** The commit the deploy workflow stamped on this build, so the smoke test can tell the new code is live. */
            commit: z.string().nullable(),
            /** False in production when a setting it can't run properly without is missing. The Worker's logs say which. */
            configured: z.boolean(),
          }),
        },
      },
    },
  },
});

export const health = new OpenAPIHono<AppEnv>().openapi(route, (c) =>
  c.json(
    {
      status: "ok" as const,
      commit: process.env.GIT_COMMIT?.trim() || null,
      configured: !isProduction() || productionConfigReport().problems.length === 0,
    },
    200,
  ),
);
