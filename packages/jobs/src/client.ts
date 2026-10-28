import { PgBoss, type ConstructorOptions } from "pg-boss";
import {
  DEFAULT_RETRY_CONFIG,
  JOB_NAMES,
  JOB_SCHEMAS,
  type EnqueueInput,
  type EnqueueOptions,
  type JobName,
  type JobStatusInfo,
} from "./types";

let sharedBoss: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

export function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required for @entrust/jobs");
  }
  return url;
}

/** Creates a new PgBoss instance (used by background worker runtimes and test suites). */
export function createBoss(options?: ConstructorOptions | string): PgBoss {
  const connection = options ?? resolveDatabaseUrl();
  const bossOptions: ConstructorOptions =
    typeof connection === "string" ? { connectionString: connection } : connection;
  return new PgBoss(bossOptions);
}

/**
 * Returns the active singleton PgBoss instance for producer operations, starting it if necessary.
 * Configured with producer-only settings (no background supervisor, no schedule runner, small connection pool).
 */
export async function getBoss(): Promise<PgBoss> {
  if (sharedBoss) return sharedBoss;

  if (!startPromise) {
    const boss = new PgBoss({
      connectionString: resolveDatabaseUrl(),
      supervise: false,
      schedule: false,
      max: 2,
    });

    boss.on("error", (err: unknown) => {
      console.error("[jobs:pg-boss] Error:", err);
    });

    startPromise = boss
      .start({ attempts: 3 })
      .then(async () => {
        // Pre-create known queues once on producer initialization
        for (const queue of Object.values(JOB_NAMES)) {
          await boss.createQueue(queue);
        }
        sharedBoss = boss;
        return boss;
      })
      .catch(async (err) => {
        startPromise = null;
        try {
          await boss.stop({ timeout: 1000 });
        } catch {
          // Ignore secondary cleanup error on failed start
        }
        throw err;
      });
  }

  return startPromise;
}

/** Enqueues a typed job into pg-boss with standard retry and backoff defaults. */
export async function enqueue<K extends JobName>(
  name: K,
  data: EnqueueInput<K>,
  options?: EnqueueOptions,
): Promise<string | null> {
  // Validate payload before communicating with pg-boss to fail fast on invalid inputs
  const schema = JOB_SCHEMAS[name];
  const validatedData = schema ? schema.parse(data) : data;

  const boss = await getBoss();

  const sendOptions: Record<string, any> = {
    retryLimit: options?.retryLimit ?? DEFAULT_RETRY_CONFIG.retryLimit,
    retryDelay: options?.retryDelay ?? DEFAULT_RETRY_CONFIG.retryDelay,
    retryBackoff: options?.retryBackoff ?? DEFAULT_RETRY_CONFIG.retryBackoff,
  };
  if (options?.priority !== undefined) sendOptions.priority = options.priority;
  if (options?.startAfter !== undefined) sendOptions.startAfter = options.startAfter;
  if (options?.expireInSeconds !== undefined) sendOptions.expireInSeconds = options.expireInSeconds;
  if (options?.singletonKey !== undefined) sendOptions.singletonKey = options.singletonKey;

  const jobId = await boss.send(name, validatedData as object, sendOptions);
  return jobId;
}

/** Retrieves job details and execution state by queue name and ID. */
export async function getJobStatus(name: string, jobId: string): Promise<JobStatusInfo | null> {
  const boss = await getBoss();
  try {
    const job = await boss.getJobById(name, jobId);
    if (!job) return null;

    return {
      id: job.id,
      name: job.name,
      state: job.state as JobStatusInfo["state"],
      retryCount: job.retryCount ?? 0,
      output: job.output,
      createdOn: job.createdOn,
      completedOn: job.completedOn,
    };
  } catch (err: any) {
    // If the queue does not exist in pg-boss, map to null (not found) instead of throwing 500
    if (
      err?.message?.includes("does not exist") ||
      err?.message?.includes("not found") ||
      err?.message?.includes("not exist")
    ) {
      return null;
    }
    throw err;
  }
}

/** Gracefully stops the singleton PgBoss instance. */
export async function stopBoss(): Promise<void> {
  if (sharedBoss) {
    const boss = sharedBoss;
    sharedBoss = null;
    startPromise = null;
    await boss.stop({ graceful: true, timeout: 5000 });
  }
}
