import { getDb, runWithRequestDb } from "@entrust/db";
import type { ExecutionContext } from "hono";
import { app } from "./app";
import { sendDueReminders } from "./services/trade-notifications";

/** The Worker's bindings that this file reads. The rest of the settings arrive as process.env. */
interface Env {
  /** Hyperdrive in front of the database, when the Worker has one (wrangler.jsonc). */
  HYPERDRIVE?: { connectionString: string };
}

export default {
  // Each request gets its own database connections: a Worker can't reuse them across requests.
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    runWithRequestDb(async () => app.fetch(request, env, ctx), env.HYPERDRIVE?.connectionString),

  // Once a day (the cron in wrangler.jsonc): the TRADE reminders that depend on a date passing, not on someone acting.
  scheduled: (_controller: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }) => {
    ctx.waitUntil(
      runWithRequestDb(async () => {
        const told = await sendDueReminders(getDb());
        console.log("[trade:reminders]", JSON.stringify(told));
      }, env.HYPERDRIVE?.connectionString),
    );
  },
};
