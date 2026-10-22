import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../app";

const route = createRoute({
  method: "get",
  path: "/health",
  tags: ["System"],
  summary: "Liveness check",
  responses: {
    200: {
      description: "The API is running",
      content: { "application/json": { schema: z.object({ status: z.literal("ok") }) } },
    },
  },
});

export const health = new OpenAPIHono<AppEnv>().openapi(route, (c) => c.json({ status: "ok" as const }, 200));
