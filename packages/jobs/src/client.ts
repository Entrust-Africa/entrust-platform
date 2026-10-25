import { PgBoss, type ConstructorOptions } from "pg-boss";
import {
  DEFAULT_RETRY_CONFIG,
  type EnqueueOptions,
  type JobDefinitions,
  type JobName,
  type JobStatusInfo,
} from "./types";

let sharedBoss: PgBoss | null = null;
let startPromise: Promise<PgBoss> | null = null;

export function resolveDatabaseUrl(): string {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile("../../.env");
    } catch {
      // Fall back if file is missing
    }
  }
  const url = process.env.DATABASE_URL || "postgres://entrust:entrust@localhost:5432/entrust_platform";
  return url;
}

export function createBoss(options?: ConstructorOptions | string): PgBoss {
  const connection = options ?? resolveDatabaseUrl();
  const bossOptions: ConstructorOptions =
    typeof connection === "string" ? { connectionString: connection } : connection;
  return new PgBoss(bossOptions);
}

/** Returns the active singleton PgBoss instance for producer operations, starting it if necessary. */
export async function getBoss(): Promise<PgBoss> {
  if (sharedBoss) return sharedBoss;
  if (!startPromise) {
    const boss = createBoss();
    boss.on("error", (err: unknown) => {
      console.error("[jobs:pg-boss] Error:", err);
    });
    startPromise = boss.start().then(() => {
      sharedBoss = boss;
      return boss;
    });
  }
  return startPromise;
}

/** Enqueues a typed job into pg-boss with standard retry and backoff defaults. */
export async function enqueue<K extends JobName>(
  name: K,
  data: JobDefinitions[K],
  options?: EnqueueOptions,
): Promise<string | null> {
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

  // Ensure queue is registered in pg-boss
  try {
    await boss.createQueue(name);
  } catch {
    // Ignore error if queue already exists
  }

  const jobId = await boss.send(name, data as object, sendOptions);
  return jobId;
}

/** Retrieves job details and execution state by queue name and ID. */
export async function getJobStatus(name: string, jobId: string): Promise<JobStatusInfo | null> {
  const boss = await getBoss();
  const job = await boss.getJobById(name, jobId);
  if (!job) return null;

  return {
    id: job.id,
    name: job.name,
    state: job.state as JobStatusInfo["state"],
    retryCount: (job as any).retrycount ?? (job as any).retryCount ?? 0,
    output: job.output,
    createdOn: (job as any).createdon ?? (job as any).createdOn,
    completedOn: (job as any).completedon ?? (job as any).completedOn,
  };
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
