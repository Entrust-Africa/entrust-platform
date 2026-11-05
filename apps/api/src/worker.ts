import { runWithRequestDb } from "@entrust/db";
import type { ExecutionContext } from "hono";
import { app } from "./app";

/** The Worker's bindings that this file reads. The rest of the settings arrive as process.env. */
interface Env {
  /** Hyperdrive in front of the database, when the Worker has one (wrangler.jsonc). */
  HYPERDRIVE?: { connectionString: string };
}

export default {
  // Each request gets its own database connections: a Worker can't reuse them across requests.
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    runWithRequestDb(async () => app.fetch(request, env, ctx), env.HYPERDRIVE?.connectionString),
};
