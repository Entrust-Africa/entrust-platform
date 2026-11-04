import { runWithRequestDb } from "@entrust/db";
import type { ExecutionContext } from "hono";
import { app } from "./app";

export default {
  // Each request gets its own database connections: a Worker can't reuse them across requests.
  fetch: (request: Request, env: unknown, ctx: ExecutionContext) => runWithRequestDb(async () => app.fetch(request, env, ctx)),
};
