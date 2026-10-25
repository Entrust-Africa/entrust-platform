import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createBoss,
  enqueue,
  getJobStatus,
  JOB_NAMES,
  stopBoss,
} from "../src";

describe("Background Jobs Runtime with pg-boss", () => {
  let workerBoss: ReturnType<typeof createBoss>;

  beforeAll(async () => {
    // Start an in-test worker instance that subscribes to queues
    workerBoss = createBoss();
    await workerBoss.start();
    await workerBoss.createQueue(JOB_NAMES.SEND_EMAIL);
    await workerBoss.createQueue(JOB_NAMES.TEST_FAIL);
  });

  afterAll(async () => {
    await workerBoss.stop({ graceful: true, timeout: 5000 });
    await stopBoss();
  });

  it("enqueues and executes an end-to-end send-email job", async () => {
    let processedJob: any = null;

    // Register a worker handler
    await workerBoss.work(JOB_NAMES.SEND_EMAIL, async (jobs: any) => {
      const job = Array.isArray(jobs) ? jobs[0] : jobs;
      processedJob = job;
      return { sent: true, recipient: job.data.to };
    });

    const jobId = await enqueue(JOB_NAMES.SEND_EMAIL, {
      to: "trader@example.test",
      subject: "Test Notification",
      template: "test",
      props: { message: "Testing background worker dispatch" },
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe("string");

    // Wait for the job to complete
    let status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    const startTime = Date.now();
    while (status?.state !== "completed" && Date.now() - startTime < 10000) {
      await new Promise((r) => setTimeout(r, 200));
      status = await getJobStatus(JOB_NAMES.SEND_EMAIL, jobId!);
    }

    expect(status?.state).toBe("completed");
    expect(status?.id).toBe(jobId);
    expect(processedJob).not.toBeNull();
    expect(processedJob.data.to).toBe("trader@example.test");
  });

  it(
    "retries a failing job with backoff and lands in failed state with error kept",
    async () => {
    let attemptCount = 0;

    // Register a worker handler that always throws an error
    await workerBoss.work(JOB_NAMES.TEST_FAIL, async (jobs: any) => {
      attemptCount++;
      const job = Array.isArray(jobs) ? jobs[0] : jobs;
      throw new Error(`Simulated failure on attempt ${attemptCount} for job ${job.id}`);
    });

    // Enqueue with 1 retry and 1s delay
    const jobId = await enqueue(
      JOB_NAMES.TEST_FAIL,
      {
        reason: "Testing retry and terminal failure",
      },
      {
        retryLimit: 1,
        retryDelay: 1,
        retryBackoff: true,
      },
    );

    expect(jobId).toBeDefined();

    // Wait for retries to exhaust and land in failed state
    let status = await getJobStatus(JOB_NAMES.TEST_FAIL, jobId!);
    const startTime = Date.now();
    while (status?.state !== "failed" && Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 300));
      status = await getJobStatus(JOB_NAMES.TEST_FAIL, jobId!);
    }

    expect(status?.state).toBe("failed");
    expect(status?.retryCount).toBeGreaterThanOrEqual(1);
    expect(status?.output).toBeDefined();
    // Verify that the error message is preserved in output
    const outputStr = JSON.stringify(status?.output);
    expect(outputStr).toMatch(/Simulated failure/i);
  }, 20000);

  it("handles clean graceful shutdown without unhandled rejections", async () => {
    const testBoss = createBoss();
    await testBoss.start();
    await testBoss.createQueue("temporary-test-queue");

    // Stop gracefully
    await expect(testBoss.stop({ graceful: true, timeout: 2000 })).resolves.toBeUndefined();
  });
});
