import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "../app";
import { Problem } from "../schemas/problem";

const Me = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    activeOrganizationId: z.string().nullable(),
  })
  .openapi("Me");

const route = createRoute({
  method: "get",
  path: "/me",
  tags: ["Account"],
  summary: "The signed-in user",
  responses: {
    200: { description: "Signed in", content: { "application/json": { schema: Me } } },
    401: { description: "Not signed in", content: { "application/json": { schema: Problem } } },
  },
});

export const me = new OpenAPIHono<AppEnv>().openapi(route, (c) => {
  const user = c.get("user");
  const session = c.get("session");
  if (!user || !session) return c.json({ error: "Not signed in" }, 401);
  return c.json(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      activeOrganizationId: session.activeOrganizationId ?? null,
    },
    200,
  );
});
