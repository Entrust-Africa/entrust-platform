import {
  createBoss,
  JOB_NAMES,
  type Job,
  type JobDefinitions,
  type JobName,
  type PgBoss,
} from "@entrust/jobs";
import { handleSendEmail } from "./handlers/send-email";
import { handleTestFail } from "./handlers/test-fail";

export type JobHandler<T> = (data: T, job: Job<T>) => Promise<any>;

export const WORKER_HANDLERS: {
  [K in JobName]: JobHandler<JobDefinitions[K]>;
} = {
  [JOB_NAMES.SEND_EMAIL]: handleSendEmail,
  [JOB_NAMES.TEST_FAIL]: handleTestFail,
};

/**
 * Registers all typed job handlers on the provided PgBoss instance.
 * Ensures queues exist and logs failures with job metadata before rethrowing.
 */
export async function registerHandlers(boss: PgBoss): Promise<void> {
  for (const [queueName, handler] of Object.entries(WORKER_HANDLERS)) {
    await boss.createQueue(queueName);
    await boss.work(queueName, async (jobs: Job<any>[] | Job<any>) => {
      const list = Array.isArray(jobs) ? jobs : [jobs];
      let lastResult: any = null;
      for (const job of list) {
        if (!job) continue;
        console.info(`[worker] Processing ${queueName} job: ${job.id}`);
        try {
          lastResult = await handler(job.data, job);
          console.info(`[worker] Completed ${queueName} job: ${job.id}`);
        } catch (err) {
          console.error(
            `[worker] Job execution failed: queue=${queueName} id=${job.id} retryCount=${job.retryCount ?? 0}:`,
            err,
          );
          throw err;
        }
      }
      return lastResult;
    });
  }
}

async function main() {
  console.info("[worker] Starting Entrust background worker...");
  const boss = createBoss();

  boss.on("error", (error: unknown) => {
    console.error("[worker:pg-boss] Error:", error);
  });

  await boss.start();
  console.info("[worker] Connected to PostgreSQL and pg-boss initialized.");

  await registerHandlers(boss);
  console.info("[worker] All background job handlers registered and ready.");

  // Clean shutdown handling
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.info(`[worker] Received ${signal}. Draining active jobs and stopping pg-boss...`);
    try {
      await boss.stop({ graceful: true, timeout: 10000 });
      console.info("[worker] Clean shutdown complete.");
      process.exit(0);
    } catch (err) {
      console.error("[worker] Error during graceful shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

// Only start the worker loop when executed directly as main script
if (
  process.argv[1] &&
  (process.argv[1].endsWith("src/index.ts") || process.argv[1].endsWith("dist/index.mjs"))
) {
  main().catch((err) => {
    console.error("[worker] Fatal worker startup error:", err);
    process.exit(1);
  });
}
