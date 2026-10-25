import { createBoss, JOB_NAMES } from "@entrust/jobs";
import { handleSendEmail } from "./handlers/send-email";
import { handleTestFail } from "./handlers/test-fail";

async function main() {
  console.info("[worker] Starting Entrust background worker...");
  const boss = createBoss();

  boss.on("error", (error: unknown) => {
    console.error("[worker:pg-boss] Error:", error);
  });

  await boss.start();
  console.info("[worker] Connected to PostgreSQL and pg-boss initialized.");

  // Ensure queues exist
  await boss.createQueue(JOB_NAMES.SEND_EMAIL);
  await boss.createQueue(JOB_NAMES.TEST_FAIL);

  // Register worker for SEND_EMAIL
  await boss.work(JOB_NAMES.SEND_EMAIL, async (jobs: any) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    console.info(`[worker] Processing send-email job: ${job.id}`);
    const result = await handleSendEmail(job.data);
    console.info(`[worker] Completed send-email job: ${job.id}`);
    return result;
  });

  // Register worker for TEST_FAIL
  await boss.work(JOB_NAMES.TEST_FAIL, async (jobs: any) => {
    const job = Array.isArray(jobs) ? jobs[0] : jobs;
    if (!job) return;
    console.info(`[worker] Processing test-fail job: ${job.id}`);
    return await handleTestFail(job.data);
  });

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

main().catch((err) => {
  console.error("[worker] Fatal worker startup error:", err);
  process.exit(1);
});
