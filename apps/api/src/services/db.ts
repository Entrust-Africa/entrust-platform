import type { Database } from "@entrust/db";

/** What a service needs from the database. Both the database and a transaction fit. */
export type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;
