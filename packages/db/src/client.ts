import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// One pool per process. Next.js dev reloads modules, so keep it on globalThis.
const globalForDb = globalThis as unknown as { entrustDb?: Database };

// The database for the request being handled, set by runWithRequestDb.
const requestDb = new AsyncLocalStorage<Database>();

function connectionUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return url;
}

export function getDb(): Database {
  const scoped = requestDb.getStore();
  if (scoped) return scoped;
  if (globalForDb.entrustDb) return globalForDb.entrustDb;
  const db = drizzle(new Pool({ connectionString: connectionUrl() }), { schema });
  globalForDb.entrustDb = db;
  return db;
}

/**
 * Runs one request with its own connection pool, closed before it returns.
 *
 * Cloudflare Workers cannot reuse a network connection opened during an earlier request: the
 * runtime cancels the request that tries ("code had hung"). A pool kept for the life of the
 * process, as getDb() does elsewhere, therefore fails every other request on a Worker. Inside
 * this scope getDb() returns the request's own database. The pool is closed before the response
 * is returned because the runtime closes the request's sockets as soon as it ends.
 */
export function runWithRequestDb<T>(run: () => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: connectionUrl(), max: 5 });
  let closing = false;
  // A connection dropped by the server would otherwise surface as an unhandled error. Closing the
  // pool makes the Worker's socket report "closed" once per connection; that is not a failure.
  pool.on("error", (error) => {
    if (!closing) console.error("[db] connection error:", error.message);
  });
  const db = drizzle(pool, { schema });
  return requestDb.run(db, async () => {
    try {
      return await run();
    } finally {
      closing = true;
      await pool.end().catch(() => undefined);
    }
  });
}
