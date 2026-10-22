import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// One pool per process. Next.js dev reloads modules, so keep it on globalThis.
const globalForDb = globalThis as unknown as { entrustDb?: Database };

export function getDb(): Database {
  if (globalForDb.entrustDb) return globalForDb.entrustDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle(new Pool({ connectionString: url }), { schema });
  globalForDb.entrustDb = db;
  return db;
}
